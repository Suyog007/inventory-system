import { describe, it, expect, beforeAll } from "vitest";
import crypto from "node:crypto";
import { verifyShopifyHmac } from "@/lib/channels/shopify/webhooks";

const SECRET = "test-shopify-secret-shpss_abcdef";

beforeAll(() => {
  process.env.SHOPIFY_CLIENT_SECRET = SECRET;
});

function signBody(body: string): string {
  return crypto.createHmac("sha256", SECRET).update(body, "utf8").digest("base64");
}

describe("Shopify webhook HMAC verification", () => {
  it("returns true for a correctly signed body", () => {
    const body = JSON.stringify({ id: 12345, title: "Test" });
    const signature = signBody(body);
    expect(verifyShopifyHmac(body, signature)).toBe(true);
  });

  it("returns false for an incorrectly signed body", () => {
    const body = JSON.stringify({ id: 12345 });
    expect(verifyShopifyHmac(body, "obviously-wrong-signature-aBcDeFgH123==")).toBe(
      false,
    );
  });

  it("returns false when body has been tampered with", () => {
    const original = JSON.stringify({ id: 12345 });
    const tampered = JSON.stringify({ id: 99999 });
    const signature = signBody(original);
    expect(verifyShopifyHmac(tampered, signature)).toBe(false);
  });

  it("returns false when header is missing", () => {
    expect(verifyShopifyHmac("body", undefined)).toBe(false);
  });
});
