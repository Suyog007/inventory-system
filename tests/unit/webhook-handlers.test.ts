// Tests Shopify webhook handlers (products/delete + orders/create) against
// a real test DB. handleShopifyTopic is pure logic, easy to drive without HTTP.

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptToken } from "@/lib/crypto";
import { handleShopifyTopic } from "@/lib/channels/shopify/webhook-handlers";

let prisma: PrismaClient;
let connectionId: string;
let cardId: string;
let variantId: string;
let listingId: string;
const VARIANT_GID = "gid://shopify/ProductVariant/wh-test-v-1";
const PRODUCT_GID = "gid://shopify/Product/wh-test-1";

beforeAll(async () => {
  process.env.AUTH_SECRET = "test-secret-for-encryption-do-not-use-in-prod-1234567890";
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
});

beforeEach(async () => {
  await prisma.channelConnection.deleteMany({ where: { shopDomain: "test-webhook.myshopify.com" } });
  await prisma.card.deleteMany({ where: { vendor: "Webhook Test Vendor" } });

  const conn = await prisma.channelConnection.create({
    data: {
      channel: "SHOPIFY",
      shopDomain: "test-webhook.myshopify.com",
      accessToken: encryptToken("fake-token"),
      scopes: "read_products,write_products",
    },
  });
  connectionId = conn.id;

  const card = await prisma.card.create({
    data: {
      title: "Webhook Test Card",
      vendor: "Webhook Test Vendor",
      status: "ACTIVE",
      parseSource: "MANUAL_OVERRIDE",
    },
  });
  cardId = card.id;

  const variant = await prisma.variant.create({
    data: { cardId, name: "Default", sku: "WH-TEST", quantity: 1, position: 1 },
  });
  variantId = variant.id;

  const listing = await prisma.listing.create({
    data: {
      variantId,
      channelConnectionId: connectionId,
      externalId: VARIANT_GID,
      externalParentId: PRODUCT_GID,
      status: "ACTIVE",
      price: 100.0,
    },
  });
  listingId = listing.id;
});

describe("products/delete handler", () => {
  it("soft-deletes the listing for the matching product GID", async () => {
    await handleShopifyTopic(connectionId, "products/delete", {
      id: 12345, // Shopify sends numeric IDs in REST webhook payloads
    });

    // The card was set up with externalParentId = gid://shopify/Product/wh-test-1
    // so a delete for product id=12345 doesn't match; nothing should change.
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.deletedAt).toBeNull();

    // Now send the actual id of our product
    await handleShopifyTopic(connectionId, "products/delete", {
      id: "wh-test-1",
    });
    const listingAfter = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listingAfter.deletedAt).not.toBeNull();
    expect(listingAfter.status).toBe("DELISTED");
  });
});

describe("orders/create handler", () => {
  it("records Order + OrderLine, decrements variant quantity, idempotent", async () => {
    const payload = {
      id: 998001,
      email: "buyer@example.com",
      total_price: "100.00",
      customer: { first_name: "Alice", last_name: "Smith" },
      created_at: "2026-06-25T15:00:00Z",
      line_items: [
        {
          variant_id: "wh-test-v-1",
          quantity: 1,
          price: "100.00",
          title: "Webhook Test Card",
        },
      ],
    };

    await handleShopifyTopic(connectionId, "orders/create", payload);

    const orders = await prisma.order.findMany({
      where: { channelConnectionId: connectionId, externalOrderId: "998001" },
      include: { lines: true },
    });
    expect(orders).toHaveLength(1);
    expect(orders[0].customerName).toBe("Alice Smith");
    expect(Number(orders[0].total)).toBe(100);
    expect(orders[0].lines).toHaveLength(1);
    expect(orders[0].lines[0].quantity).toBe(1);

    const variant = await prisma.variant.findUniqueOrThrow({ where: { id: variantId } });
    expect(variant.quantity).toBe(0);

    // Re-running the same webhook is a no-op (idempotent)
    await handleShopifyTopic(connectionId, "orders/create", payload);
    const countAfter = await prisma.order.count({
      where: { channelConnectionId: connectionId, externalOrderId: "998001" },
    });
    expect(countAfter).toBe(1);
  });

  it("when variant qty drops to 0, enqueues DELETE_LISTING for OTHER channels", async () => {
    // Set up a second listing on a different connection for the same Variant
    const conn2 = await prisma.channelConnection.create({
      data: {
        channel: "EBAY",
        externalAccountId: "fake-ebay-seller",
        accessToken: encryptToken("fake-ebay-token"),
        scopes: "",
      },
    });
    const ebayListing = await prisma.listing.create({
      data: {
        variantId,
        channelConnectionId: conn2.id,
        externalId: "ebay-listing-99",
        status: "ACTIVE",
        price: 110.0,
      },
    });

    await handleShopifyTopic(connectionId, "orders/create", {
      id: 998002,
      total_price: "100.00",
      line_items: [
        { variant_id: "wh-test-v-1", quantity: 1, price: "100.00", title: "X" },
      ],
    });

    const outbox = await prisma.outboxItem.findMany({
      where: { targetId: ebayListing.id },
    });
    expect(outbox).toHaveLength(1);
    expect(outbox[0].operation).toBe("DELETE_LISTING");
    expect(outbox[0].channelConnectionId).toBe(conn2.id);

    // Cleanup the EBAY connection so other tests aren't affected
    await prisma.channelConnection.delete({ where: { id: conn2.id } });
  });

  it("ignores line items with no matching listing", async () => {
    await handleShopifyTopic(connectionId, "orders/create", {
      id: 998003,
      total_price: "0.00",
      line_items: [
        { variant_id: "nonexistent-variant-id", quantity: 1, price: "0.00", title: "X" },
      ],
    });

    const order = await prisma.order.findUniqueOrThrow({
      where: {
        channelConnectionId_externalOrderId: {
          channelConnectionId: connectionId,
          externalOrderId: "998003",
        },
      },
      include: { lines: true },
    });
    expect(order.lines).toHaveLength(0);
  });
});

describe("unknown topic", () => {
  it("does not throw", async () => {
    await expect(
      handleShopifyTopic(connectionId, "fulfillments/whatever", { junk: true }),
    ).resolves.toBeUndefined();
  });
});
