// Centralized Shopify OAuth + API config.
// Reads from env so the same client works in dev, staging, prod.

export const SHOPIFY_API_VERSION = "2026-04";

export const SHOPIFY_SCOPES = [
  "read_products",
  "write_products",
  "read_inventory",
  "write_inventory",
  "read_locations",
  "read_product_listings",
  "read_publications",
  "write_publications",
  "read_orders",
] as const;

export function getShopifyClientId(): string {
  const v = process.env.SHOPIFY_CLIENT_ID;
  if (!v) throw new Error("SHOPIFY_CLIENT_ID env var is required");
  return v;
}

export function getShopifyClientSecret(): string {
  const v = process.env.SHOPIFY_CLIENT_SECRET;
  if (!v) throw new Error("SHOPIFY_CLIENT_SECRET env var is required");
  return v;
}

export function getAppBaseUrl(): string {
  return process.env.AUTH_URL || "http://localhost:3000";
}

export function getInstallRedirectUri(): string {
  return `${getAppBaseUrl()}/api/channels/shopify/callback`;
}
