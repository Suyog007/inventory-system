import { describe, it, expect, beforeAll } from "vitest";
import {
  isValidShopDomain,
  buildInstallUrl,
  generateState,
} from "@/lib/channels/shopify/oauth";

beforeAll(() => {
  process.env.SHOPIFY_CLIENT_ID = "test-client-id";
  process.env.SHOPIFY_CLIENT_SECRET = "test-secret";
  process.env.AUTH_URL = "http://localhost:3000";
});

describe("Shopify OAuth helpers", () => {
  describe("isValidShopDomain", () => {
    it("accepts valid *.myshopify.com domains", () => {
      expect(isValidShopDomain("my-store.myshopify.com")).toBe(true);
      expect(isValidShopDomain("acme-cards-1.myshopify.com")).toBe(true);
      expect(isValidShopDomain("a.myshopify.com")).toBe(true);
    });

    it("rejects non-myshopify domains", () => {
      expect(isValidShopDomain("evil.com")).toBe(false);
      expect(isValidShopDomain("my-store.shopify.com")).toBe(false);
      expect(isValidShopDomain("my-store.myshopify.com.evil.com")).toBe(false);
    });

    it("rejects malformed input", () => {
      expect(isValidShopDomain("")).toBe(false);
      expect(isValidShopDomain("-leading-dash.myshopify.com")).toBe(false);
      expect(isValidShopDomain("https://store.myshopify.com")).toBe(false);
    });
  });

  describe("buildInstallUrl", () => {
    it("builds a valid Shopify OAuth URL with required params", () => {
      const url = new URL(
        buildInstallUrl("acme.myshopify.com", "state123"),
      );
      expect(url.hostname).toBe("acme.myshopify.com");
      expect(url.pathname).toBe("/admin/oauth/authorize");
      expect(url.searchParams.get("client_id")).toBe("test-client-id");
      expect(url.searchParams.get("state")).toBe("state123");
      expect(url.searchParams.get("redirect_uri")).toBe(
        "http://localhost:3000/api/channels/shopify/callback",
      );
      expect(url.searchParams.get("scope")).toContain("read_products");
      expect(url.searchParams.get("scope")).toContain("write_products");
    });

    it("throws on invalid shop domain", () => {
      expect(() => buildInstallUrl("evil.com", "state")).toThrow();
    });
  });

  describe("generateState", () => {
    it("returns a unique hex string each call", () => {
      const a = generateState();
      const b = generateState();
      expect(a).not.toBe(b);
      expect(a).toMatch(/^[a-f0-9]+$/);
      expect(a.length).toBeGreaterThanOrEqual(32);
    });
  });
});
