import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { buildInstallUrl, generateState, isValidShopDomain } from "@/lib/channels/shopify/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const shop = url.searchParams.get("shop")?.trim().toLowerCase();
  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.json(
      {
        error:
          "Invalid or missing 'shop' query parameter. Must be a *.myshopify.com domain.",
      },
      { status: 400 },
    );
  }

  // Generate state, store in a short-lived cookie so the callback can verify
  const state = generateState();
  const installUrl = buildInstallUrl(shop, state);

  const jar = await cookies();
  jar.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300, // 5 minutes
    path: "/",
  });
  jar.set("shopify_oauth_shop", shop, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  });

  return NextResponse.redirect(installUrl);
}
