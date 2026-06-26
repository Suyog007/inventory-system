import crypto from "node:crypto";
import {
  SHOPIFY_SCOPES,
  getInstallRedirectUri,
  getShopifyClientId,
  getShopifyClientSecret,
} from "./config";

const SHOP_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export function isValidShopDomain(shop: string): boolean {
  return SHOP_DOMAIN_RE.test(shop);
}

export function buildInstallUrl(shop: string, state: string): string {
  if (!isValidShopDomain(shop)) {
    throw new Error(`Invalid Shopify shop domain: ${shop}`);
  }
  const params = new URLSearchParams({
    client_id: getShopifyClientId(),
    scope: SHOPIFY_SCOPES.join(","),
    redirect_uri: getInstallRedirectUri(),
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
}

export function generateState(): string {
  return crypto.randomBytes(16).toString("hex");
}

export interface TokenExchangeResult {
  accessToken: string;
  scope: string;
}

export async function exchangeCodeForToken(
  shop: string,
  code: string,
): Promise<TokenExchangeResult> {
  if (!isValidShopDomain(shop)) {
    throw new Error(`Invalid Shopify shop domain: ${shop}`);
  }
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: getShopifyClientId(),
      client_secret: getShopifyClientSecret(),
      code,
    }),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  }
  const { access_token, scope } = (await res.json()) as {
    access_token: string;
    scope: string;
  };
  return { accessToken: access_token, scope };
}
