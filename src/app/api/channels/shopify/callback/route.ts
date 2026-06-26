import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { exchangeCodeForToken, isValidShopDomain } from "@/lib/channels/shopify/oauth";
import { encryptToken } from "@/lib/crypto";
import { db } from "@/lib/db";
import {
  SHOPIFY_SCOPES,
  getWebhookCallbackUrl,
} from "@/lib/channels/shopify/config";
import { ShopifyClient } from "@/lib/channels/shopify/client";
import { registerShopifyWebhooks } from "@/lib/channels/shopify/webhook-subscriptions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const shopParam = url.searchParams.get("shop");
  const state = url.searchParams.get("state");

  const jar = await cookies();
  const cookieState = jar.get("shopify_oauth_state")?.value;
  const cookieShop = jar.get("shopify_oauth_shop")?.value;

  // Clear cookies regardless of outcome
  jar.delete("shopify_oauth_state");
  jar.delete("shopify_oauth_shop");

  if (!code || !shopParam || !state) {
    return NextResponse.redirect(
      new URL("/settings/channels?error=missing_params", req.url),
    );
  }

  // CSRF protection: state must match what we set in the install cookie.
  // (We do NOT require the shop to match the cookie — Shopify normalizes
  // aliases like "marketplacetest-6.myshopify.com" to the canonical
  // "gxivzj-25.myshopify.com" on callback. Same store, different domain.)
  if (!cookieState || cookieState !== state) {
    return NextResponse.redirect(
      new URL("/settings/channels?error=state_mismatch", req.url),
    );
  }

  if (cookieShop && cookieShop !== shopParam) {
    console.log(
      `[shopify oauth] shop alias normalized: ${cookieShop} -> ${shopParam}`,
    );
  }

  if (!isValidShopDomain(shopParam)) {
    return NextResponse.redirect(
      new URL("/settings/channels?error=invalid_shop", req.url),
    );
  }

  try {
    const { accessToken, scope } = await exchangeCodeForToken(shopParam, code);

    await db.channelConnection.upsert({
      where: { channel_shopDomain: { channel: "SHOPIFY", shopDomain: shopParam } },
      create: {
        channel: "SHOPIFY",
        shopDomain: shopParam,
        accessToken: encryptToken(accessToken),
        scopes: scope || SHOPIFY_SCOPES.join(","),
        installedAt: new Date(),
      },
      update: {
        accessToken: encryptToken(accessToken),
        scopes: scope || SHOPIFY_SCOPES.join(","),
        installedAt: new Date(),
        deletedAt: null,
      },
    });

    // Register webhook subscriptions so Shopify pushes real-time events to us.
    // Non-fatal: if this fails (e.g. WEBHOOK_BASE_URL not set / not HTTPS),
    // we still consider the install successful — user can re-register from UI.
    try {
      const client = new ShopifyClient(shopParam, accessToken);
      const result = await registerShopifyWebhooks(client, getWebhookCallbackUrl());
      console.log("[shopify webhooks]", result);
    } catch (err) {
      console.warn("[shopify webhooks] registration failed (non-fatal):", err);
    }

    return NextResponse.redirect(
      new URL("/settings/channels?connected=shopify", req.url),
    );
  } catch (err) {
    console.error("[shopify oauth callback]", err);
    return NextResponse.redirect(
      new URL("/settings/channels?error=token_exchange_failed", req.url),
    );
  }
}
