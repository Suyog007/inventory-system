import crypto from "node:crypto";
import { getShopifyClientSecret } from "./config";

// Shopify signs every webhook with HMAC-SHA256 of the raw body using the
// app's Client Secret. Verifying this proves the webhook actually came from Shopify.
export function verifyShopifyHmac(
  rawBody: string,
  headerValue: string | undefined,
): boolean {
  if (!headerValue) return false;
  const computed = crypto
    .createHmac("sha256", getShopifyClientSecret())
    .update(rawBody, "utf8")
    .digest("base64");
  // Use timingSafeEqual to avoid timing attacks
  const a = Buffer.from(computed);
  const b = Buffer.from(headerValue);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
