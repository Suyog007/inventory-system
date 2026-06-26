// Unit-tests the import orchestrator against a real test database.
// Uses a fake ChannelAdapter by stubbing the ShopifyAdapter via injection.
//
// Strategy: directly seed a ChannelConnection, then call upsertSnapshot's
// underlying logic via importFromChannel with a small mock. Since
// importFromChannel routes to ShopifyAdapter by switch, we either:
//   a) point AT a real Shopify (integration, not done here), or
//   b) mock the adapter module
// We do (b) using Vitest module mocks.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptToken } from "@/lib/crypto";
import type { ChannelListingSnapshot } from "@/lib/channels/_adapter";

// Mock ShopifyAdapter BEFORE importing import.ts
const mockSnapshots: ChannelListingSnapshot[] = [];
vi.mock("@/lib/channels/shopify/adapter", () => {
  return {
    ShopifyAdapter: class {
      readonly channel = "SHOPIFY";
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async *importCatalog(_opts: { updatedSince?: Date }) {
        for (const s of mockSnapshots) yield s;
      }
      async pushUpsert(): Promise<never> {
        throw new Error("not used in import tests");
      }
      async pushDelete(): Promise<never> {
        throw new Error("not used in import tests");
      }
      verifyWebhook() {
        return { valid: false };
      }
      handleWebhook() {
        return { topic: "test", payload: {} };
      }
    },
  };
});

import { importFromChannel } from "@/lib/sync/import";

// Direct Prisma client for test setup/teardown (separate from app singleton so we
// don't get caught in env var loading order)
let prisma: PrismaClient;
let connectionId: string;

beforeAll(async () => {
  process.env.AUTH_SECRET = "test-secret-for-encryption-do-not-use-in-prod-1234567890";
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
});

beforeEach(async () => {
  // Clean slate per test (cascade-delete from connection wipes its children)
  await prisma.channelConnection.deleteMany({ where: { shopDomain: "test-import.myshopify.com" } });
  // Also clean orphaned cards/variants/tags from previous tests
  await prisma.card.deleteMany({ where: { vendor: "Import Test Vendor" } });
  await prisma.tag.deleteMany({ where: { name: { startsWith: "import-test-tag-" } } });

  const conn = await prisma.channelConnection.create({
    data: {
      channel: "SHOPIFY",
      shopDomain: "test-import.myshopify.com",
      accessToken: encryptToken("fake-token"),
      scopes: "read_products,write_products",
    },
  });
  connectionId = conn.id;
  mockSnapshots.length = 0;
});

afterEach(async () => {
  mockSnapshots.length = 0;
});

describe("importFromChannel", () => {
  it("creates a new Card+Variant+Listing+Image when product is new", async () => {
    mockSnapshots.push({
      externalId: "gid://shopify/Product/9999001",
      externalUrl: "https://example.myshopify.com/products/test-1",
      title: "2022 Panini Father's Day Charles Barkley #20 Holo PSA 10",
      descriptionHtml:
        "Player - Charles Barkley Card Number - #20 Set - 2022 Panini Father's Day Grader - PSA Grade - 10 Certification Number - 93074114 Sport - Multi-Sport",
      vendor: "Import Test Vendor",
      productType: "Graded Sports Cards",
      status: "ACTIVE",
      tags: ["import-test-tag-a", "import-test-tag-b"],
      variants: [
        {
          externalId: "gid://shopify/ProductVariant/9999001-v1",
          sku: "93074114",
          price: 275.0,
          quantity: 1,
          position: 1,
          title: "Default Title",
        },
      ],
      images: [
        { externalId: "gid://shopify/Image/img1", url: "https://cdn.test/1.jpg", position: 0 },
      ],
      updatedAt: new Date(),
    });

    const result = await importFromChannel({ channelConnectionId: connectionId });

    expect(result.productsAdded).toBe(1);
    expect(result.productsUpdated).toBe(0);
    expect(result.errors).toEqual([]);

    const cards = await prisma.card.findMany({
      where: { vendor: "Import Test Vendor" },
      include: { variants: { include: { listings: true } }, images: true, cardTags: { include: { tag: true } } },
    });
    expect(cards).toHaveLength(1);
    const card = cards[0];
    expect(card.player).toBe("Charles Barkley");
    expect(card.year).toBe(2022);
    expect(card.grader).toBe("PSA");
    expect(Number(card.grade)).toBe(10);
    expect(card.certNumber).toBe("93074114");
    expect(card.parseSource).toBe("TEMPLATED_DESCRIPTION");
    expect(card.variants).toHaveLength(1);
    expect(card.variants[0].sku).toBe("93074114");
    expect(card.variants[0].quantity).toBe(1);
    expect(card.variants[0].listings).toHaveLength(1);
    expect(card.variants[0].listings[0].externalId).toBe("gid://shopify/ProductVariant/9999001-v1");
    expect(Number(card.variants[0].listings[0].price)).toBe(275);
    expect(card.images).toHaveLength(1);
    expect(card.cardTags).toHaveLength(2);
  });

  it("is idempotent: running twice with same snapshot doesn't duplicate", async () => {
    mockSnapshots.push({
      externalId: "gid://shopify/Product/9999002",
      title: "Test Card 2",
      vendor: "Import Test Vendor",
      productType: "Graded Sports Cards",
      status: "ACTIVE",
      tags: [],
      variants: [
        {
          externalId: "gid://shopify/ProductVariant/9999002-v1",
          sku: "TEST-002",
          price: 50.0,
          quantity: 1,
          position: 1,
          title: "Default Title",
        },
      ],
      images: [],
      updatedAt: new Date(),
    });

    const r1 = await importFromChannel({ channelConnectionId: connectionId });
    expect(r1.productsAdded).toBe(1);

    const r2 = await importFromChannel({ channelConnectionId: connectionId });
    expect(r2.productsAdded).toBe(0);
    expect(r2.productsUpdated).toBe(1);

    const count = await prisma.card.count({ where: { vendor: "Import Test Vendor" } });
    expect(count).toBe(1);
  });

  it("updates price when Shopify-side price changes", async () => {
    mockSnapshots.push({
      externalId: "gid://shopify/Product/9999003",
      title: "Test Card 3",
      vendor: "Import Test Vendor",
      productType: "Graded Sports Cards",
      status: "ACTIVE",
      tags: [],
      variants: [
        {
          externalId: "gid://shopify/ProductVariant/9999003-v1",
          sku: "TEST-003",
          price: 100.0,
          quantity: 1,
          position: 1,
          title: "Default Title",
        },
      ],
      images: [],
      updatedAt: new Date(),
    });
    await importFromChannel({ channelConnectionId: connectionId });

    // Simulate Shopify-side price change
    mockSnapshots[0].variants[0].price = 150.0;
    await importFromChannel({ channelConnectionId: connectionId });

    const listings = await prisma.listing.findMany({
      where: { externalId: "gid://shopify/ProductVariant/9999003-v1" },
    });
    expect(listings).toHaveLength(1);
    expect(Number(listings[0].price)).toBe(150);
  });

  it("records a SyncRun with counts", async () => {
    mockSnapshots.push({
      externalId: "gid://shopify/Product/9999004",
      title: "Test Card 4",
      vendor: "Import Test Vendor",
      productType: "Graded Sports Cards",
      status: "ACTIVE",
      tags: [],
      variants: [
        {
          externalId: "gid://shopify/ProductVariant/9999004-v1",
          sku: "TEST-004",
          price: 10.0,
          quantity: 1,
          position: 1,
          title: "Default Title",
        },
      ],
      images: [],
      updatedAt: new Date(),
    });

    const result = await importFromChannel({ channelConnectionId: connectionId });
    const syncRun = await prisma.syncRun.findUniqueOrThrow({ where: { id: result.syncRunId } });
    expect(syncRun.kind).toBe("IMPORT");
    expect(syncRun.productsAdded).toBe(1);
    expect(syncRun.completedAt).not.toBeNull();
  });
});
