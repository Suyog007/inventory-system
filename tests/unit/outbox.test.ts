// Tests the outbox worker against a real DB using a mocked Shopify adapter.
// Verifies: success path, retry with backoff, FAILED after max attempts,
// CREATE_LISTING updates externalId, DELETE_LISTING soft-deletes Listing.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptToken } from "@/lib/crypto";

// Controllable mock adapter state — tests mutate these between runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockState: { pushUpsertImpl: any; pushDeleteImpl: any } = {
  pushUpsertImpl: async () => ({ externalId: "default" }),
  pushDeleteImpl: async () => {},
};

vi.mock("@/lib/channels/shopify/adapter", () => {
  return {
    ShopifyAdapter: class {
      readonly channel = "SHOPIFY";
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async *importCatalog() {}
      async pushUpsert(input: unknown) {
        return mockState.pushUpsertImpl(input);
      }
      async pushDelete(id: string) {
        return mockState.pushDeleteImpl(id);
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

import { processItem, processNextBatch } from "@/lib/sync/outbox";

let prisma: PrismaClient;
let connectionId: string;
let cardId: string;
let variantId: string;
let listingId: string;

beforeAll(async () => {
  process.env.AUTH_SECRET = "test-secret-for-encryption-do-not-use-in-prod-1234567890";
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
});

// Helper to make a recorded mock fn we can introspect.
// Uses `any` because we want a single helper for both signatures.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeMock(impl: (...args: any[]) => any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any[][] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (...args: any[]) => {
    calls.push(args);
    return impl(...args);
  };
  (fn as unknown as { calls: unknown[][] }).calls = calls;
  return fn as unknown as ((...args: unknown[]) => unknown) & {
    calls: unknown[][];
  };
}

let upsertMock: ReturnType<typeof makeMock>;
let deleteMock: ReturnType<typeof makeMock>;

beforeEach(async () => {
  // Reset mocks
  upsertMock = makeMock(async () => ({ externalId: "default" }));
  deleteMock = makeMock(async () => {});
  mockState.pushUpsertImpl = upsertMock;
  mockState.pushDeleteImpl = deleteMock;

  // Clean previous test data
  await prisma.channelConnection.deleteMany({
    where: { shopDomain: "test-outbox.myshopify.com" },
  });
  await prisma.card.deleteMany({ where: { vendor: "Outbox Test Vendor" } });

  // Seed a connection + card + variant + listing for tests
  const conn = await prisma.channelConnection.create({
    data: {
      channel: "SHOPIFY",
      shopDomain: "test-outbox.myshopify.com",
      accessToken: encryptToken("fake-token"),
      scopes: "read_products,write_products",
    },
  });
  connectionId = conn.id;

  const card = await prisma.card.create({
    data: {
      title: "Outbox Test Card",
      vendor: "Outbox Test Vendor",
      status: "ACTIVE",
      parseSource: "MANUAL_OVERRIDE",
    },
  });
  cardId = card.id;

  const variant = await prisma.variant.create({
    data: { cardId, name: "Default", sku: "OUTBOX-TEST", quantity: 1, position: 1 },
  });
  variantId = variant.id;

  const listing = await prisma.listing.create({
    data: {
      variantId,
      channelConnectionId: connectionId,
      externalId: "gid://shopify/ProductVariant/outbox-test-1",
      externalParentId: "gid://shopify/Product/outbox-test-1",
      status: "ACTIVE",
      price: 99.99,
    },
  });
  listingId = listing.id;
});

afterEach(async () => {
  vi.restoreAllMocks();
});

describe("processItem — UPDATE_LISTING", () => {
  it("calls adapter.pushUpsert with current Card+Variant+Listing data", async () => {
    upsertMock = makeMock(async () => ({
      externalId: "gid://shopify/Product/outbox-test-1",
      externalUrl: "https://example.com/p/1",
    }));
    mockState.pushUpsertImpl = upsertMock;

    const item = await prisma.outboxItem.create({
      data: {
        channelConnectionId: connectionId,
        operation: "UPDATE_LISTING",
        targetType: "Listing",
        targetId: listingId,
        payload: { listingId },
      },
    });

    await processItem(item.id);

    expect(upsertMock.calls).toHaveLength(1);
    const callArg = upsertMock.calls[0][0] as {
      title: string;
      variant: { sku: string; price: number };
      externalId: string;
    };
    expect(callArg.title).toBe("Outbox Test Card");
    expect(callArg.variant.sku).toBe("OUTBOX-TEST");
    expect(callArg.variant.price).toBe(99.99);
    expect(callArg.externalId).toBe("gid://shopify/ProductVariant/outbox-test-1");

    const updated = await prisma.outboxItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.status).toBe("COMPLETED");
    expect(updated.attempts).toBe(1);
    expect(updated.completedAt).not.toBeNull();
  });
});

describe("processItem — CREATE_LISTING", () => {
  it("updates Listing.externalId with what adapter returns", async () => {
    mockState.pushUpsertImpl = async () => ({
      externalId: "gid://shopify/Product/NEW-FROM-SHOPIFY",
      externalUrl: "https://example.com/p/new",
    });

    const item = await prisma.outboxItem.create({
      data: {
        channelConnectionId: connectionId,
        operation: "CREATE_LISTING",
        targetType: "Listing",
        targetId: listingId,
        payload: { listingId },
      },
    });
    await processItem(item.id);

    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.externalId).toBe("gid://shopify/Product/NEW-FROM-SHOPIFY");
    expect(listing.externalUrl).toBe("https://example.com/p/new");
  });
});

describe("processItem — DELETE_LISTING", () => {
  it("calls adapter.pushDelete with externalId and soft-deletes locally", async () => {
    deleteMock = makeMock(async (_id: string) => {});
    mockState.pushDeleteImpl = deleteMock;

    const item = await prisma.outboxItem.create({
      data: {
        channelConnectionId: connectionId,
        operation: "DELETE_LISTING",
        targetType: "Listing",
        targetId: listingId,
        payload: { listingId },
      },
    });
    await processItem(item.id);

    expect(deleteMock.calls).toHaveLength(1);
    // Shopify deletion targets the parent product GID, not the variant GID
    expect(deleteMock.calls[0][0]).toBe("gid://shopify/Product/outbox-test-1");
    const listing = await prisma.listing.findUniqueOrThrow({ where: { id: listingId } });
    expect(listing.deletedAt).not.toBeNull();
    expect(listing.status).toBe("DELISTED");
  });
});

describe("processItem — retry with backoff on transient failure", () => {
  it("on first failure, reschedules with +1min backoff", async () => {
    mockState.pushUpsertImpl = async () => {
      throw new Error("Shopify 503");
    };

    const item = await prisma.outboxItem.create({
      data: {
        channelConnectionId: connectionId,
        operation: "UPDATE_LISTING",
        targetType: "Listing",
        targetId: listingId,
        payload: { listingId },
      },
    });
    const before = Date.now();
    await processItem(item.id);
    const after = Date.now();

    const updated = await prisma.outboxItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.status).toBe("PENDING");
    expect(updated.attempts).toBe(1);
    expect(updated.lastError).toContain("Shopify 503");
    // scheduledFor is ~now + 60s
    const sched = updated.scheduledFor.getTime();
    expect(sched).toBeGreaterThanOrEqual(before + 59_000);
    expect(sched).toBeLessThanOrEqual(after + 61_000);
  });

  it("after MAX_ATTEMPTS, marks FAILED", async () => {
    mockState.pushUpsertImpl = async () => {
      throw new Error("permanent");
    };

    // Pre-seed an item with attempts = 9 so the next failure trips the max
    const item = await prisma.outboxItem.create({
      data: {
        channelConnectionId: connectionId,
        operation: "UPDATE_LISTING",
        targetType: "Listing",
        targetId: listingId,
        payload: { listingId },
        attempts: 9,
      },
    });
    await processItem(item.id);

    const updated = await prisma.outboxItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(updated.status).toBe("FAILED");
    expect(updated.attempts).toBe(10);
    expect(updated.lastError).toContain("permanent");
  });
});

describe("processNextBatch", () => {
  it("only picks items whose scheduledFor is in the past", async () => {
    mockState.pushUpsertImpl = async () => ({ externalId: "x" });

    const past = await prisma.outboxItem.create({
      data: {
        channelConnectionId: connectionId,
        operation: "UPDATE_LISTING",
        targetType: "Listing",
        targetId: listingId,
        payload: { listingId },
        scheduledFor: new Date(Date.now() - 10_000),
      },
    });
    const future = await prisma.outboxItem.create({
      data: {
        channelConnectionId: connectionId,
        operation: "UPDATE_LISTING",
        targetType: "Listing",
        targetId: listingId,
        payload: { listingId },
        scheduledFor: new Date(Date.now() + 60_000),
      },
    });

    const n = await processNextBatch(10);
    expect(n).toBe(1);
    expect(
      (await prisma.outboxItem.findUniqueOrThrow({ where: { id: past.id } })).status,
    ).toBe("COMPLETED");
    expect(
      (await prisma.outboxItem.findUniqueOrThrow({ where: { id: future.id } })).status,
    ).toBe("PENDING");
  });
});
