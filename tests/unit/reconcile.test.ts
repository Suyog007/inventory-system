// Tests the `reconcile: true` mode of importFromChannel.
//
// Setup: 2 local listings exist. The mocked adapter returns only 1 of them
// during the import pass. Reconcile should:
//   - Update the 1 that was seen
//   - Soft-delete the 1 that wasn't seen (drift detected)

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptToken } from "@/lib/crypto";
import type { ChannelListingSnapshot } from "@/lib/channels/_adapter";

const mockSnapshots: ChannelListingSnapshot[] = [];
vi.mock("@/lib/channels/shopify/adapter", () => {
  return {
    ShopifyAdapter: class {
      readonly channel = "SHOPIFY";
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async *importCatalog(_opts: { updatedSince?: Date }) {
        for (const s of mockSnapshots) yield s;
      }
      async pushUpsert() {
        return { externalId: "x" };
      }
      async pushDelete() {}
      verifyWebhook() {
        return { valid: false };
      }
      handleWebhook() {
        return { topic: "x", payload: {} };
      }
    },
  };
});

import { importFromChannel } from "@/lib/sync/import";

let prisma: PrismaClient;
let connectionId: string;

beforeAll(async () => {
  process.env.AUTH_SECRET = "test-secret-for-encryption-do-not-use-in-prod-1234567890";
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
});

beforeEach(async () => {
  await prisma.channelConnection.deleteMany({
    where: { shopDomain: "test-reconcile.myshopify.com" },
  });
  await prisma.card.deleteMany({ where: { vendor: "Reconcile Test Vendor" } });

  const conn = await prisma.channelConnection.create({
    data: {
      channel: "SHOPIFY",
      shopDomain: "test-reconcile.myshopify.com",
      accessToken: encryptToken("fake-token"),
      scopes: "read_products,write_products",
    },
  });
  connectionId = conn.id;
  mockSnapshots.length = 0;
});

describe("reconcile mode", () => {
  it("soft-deletes local listings not present on Shopify", async () => {
    // Seed two products via initial import
    mockSnapshots.push(
      {
        externalId: "gid://shopify/Product/keep-me",
        title: "Card I'll Keep",
        vendor: "Reconcile Test Vendor",
        productType: "Graded Sports Cards",
        status: "ACTIVE",
        tags: [],
        variants: [
          {
            externalId: "gid://shopify/ProductVariant/keep-v1",
            sku: "KEEP",
            price: 50,
            quantity: 1,
            position: 1,
            title: "Default",
          },
        ],
        images: [],
        updatedAt: new Date(),
      },
      {
        externalId: "gid://shopify/Product/delete-me",
        title: "Card I'll Delete on Shopify",
        vendor: "Reconcile Test Vendor",
        productType: "Graded Sports Cards",
        status: "ACTIVE",
        tags: [],
        variants: [
          {
            externalId: "gid://shopify/ProductVariant/delete-v1",
            sku: "DELETE",
            price: 25,
            quantity: 1,
            position: 1,
            title: "Default",
          },
        ],
        images: [],
        updatedAt: new Date(),
      },
    );
    await importFromChannel({ channelConnectionId: connectionId });

    // Now simulate the "delete-me" product being removed on Shopify
    mockSnapshots.splice(1, 1);

    const result = await importFromChannel({
      channelConnectionId: connectionId,
      reconcile: true,
    });

    expect(result.productsUpdated).toBe(1);
    expect(result.productsDeleted).toBe(1);

    const keepListing = await prisma.listing.findFirst({
      where: { externalId: "gid://shopify/ProductVariant/keep-v1" },
    });
    expect(keepListing).not.toBeNull();
    expect(keepListing!.deletedAt).toBeNull();

    const deletedListing = await prisma.listing.findFirst({
      where: { externalId: "gid://shopify/ProductVariant/delete-v1" },
    });
    expect(deletedListing).not.toBeNull();
    expect(deletedListing!.deletedAt).not.toBeNull();
    expect(deletedListing!.status).toBe("DELISTED");

    // SyncRun should be RECONCILE kind with productsDeleted = 1
    const lastRun = await prisma.syncRun.findFirst({
      where: { channelConnectionId: connectionId },
      orderBy: { startedAt: "desc" },
    });
    expect(lastRun!.kind).toBe("RECONCILE");
    expect(lastRun!.productsDeleted).toBe(1);
  });

  it("does NOT soft-delete listings with placeholder externalId (local-...)", async () => {
    // Create a local-only listing (simulates a CREATE that hasn't synced yet)
    const card = await prisma.card.create({
      data: {
        title: "Local-only card",
        vendor: "Reconcile Test Vendor",
        status: "ACTIVE",
        parseSource: "MANUAL_OVERRIDE",
      },
    });
    const variant = await prisma.variant.create({
      data: { cardId: card.id, name: "Default", quantity: 1 },
    });
    await prisma.listing.create({
      data: {
        variantId: variant.id,
        channelConnectionId: connectionId,
        externalId: `local-${card.id}`,
        status: "ACTIVE",
        price: 10,
      },
    });

    // Reconcile with no snapshots from Shopify
    const result = await importFromChannel({
      channelConnectionId: connectionId,
      reconcile: true,
    });

    expect(result.productsDeleted).toBe(0);

    const placeholder = await prisma.listing.findFirst({
      where: { externalId: { startsWith: "local-" } },
    });
    expect(placeholder).not.toBeNull();
    expect(placeholder!.deletedAt).toBeNull();
  });
});
