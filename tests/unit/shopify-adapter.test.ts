import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";
import { ShopifyAdapter } from "@/lib/channels/shopify/adapter";
import type { ChannelAdapter } from "@/lib/channels/_adapter";

const SECRET = "test-shopify-secret-shpss_abcdef";
beforeAll(() => {
  process.env.SHOPIFY_CLIENT_SECRET = SECRET;
});

describe("ShopifyAdapter", () => {
  it("is assignable to ChannelAdapter", () => {
    // Type-only: if ShopifyAdapter ever drifts from the interface, this fails to compile.
    const adapter: ChannelAdapter = new ShopifyAdapter("acme.myshopify.com", "shpat_x");
    expect(adapter.channel).toBe("SHOPIFY");
  });

  it("has channel = 'SHOPIFY'", () => {
    const a = new ShopifyAdapter("acme.myshopify.com", "shpat_x");
    expect(a.channel).toBe("SHOPIFY");
  });

  describe("verifyWebhook", () => {
    it("returns valid for a correctly-signed body", () => {
      const a = new ShopifyAdapter("acme.myshopify.com", "shpat_x");
      const body = JSON.stringify({ id: 1 });
      const signature = crypto
        .createHmac("sha256", SECRET)
        .update(body, "utf8")
        .digest("base64");
      const result = a.verifyWebhook({
        rawBody: body,
        headers: { "x-shopify-hmac-sha256": signature },
      });
      expect(result.valid).toBe(true);
    });

    it("returns invalid for a wrong signature", () => {
      const a = new ShopifyAdapter("acme.myshopify.com", "shpat_x");
      const result = a.verifyWebhook({
        rawBody: "anything",
        headers: { "x-shopify-hmac-sha256": "not-the-right-signature==" },
      });
      expect(result.valid).toBe(false);
    });
  });

  describe("handleWebhook", () => {
    it("parses topic, event id, and payload from headers + body", () => {
      const a = new ShopifyAdapter("acme.myshopify.com", "shpat_x");
      const body = JSON.stringify({ id: 42, title: "Test product" });
      const parsed = a.handleWebhook({
        rawBody: body,
        headers: {
          "x-shopify-topic": "products/update",
          "x-shopify-webhook-id": "evt-123",
        },
      });
      expect(parsed.topic).toBe("products/update");
      expect(parsed.externalEventId).toBe("evt-123");
      expect(parsed.payload).toEqual({ id: 42, title: "Test product" });
    });
  });

});
