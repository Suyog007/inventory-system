import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { decryptToken } from "@/lib/crypto";
import { ShopifyClient } from "@/lib/channels/shopify/client";
import { stageImageUpload } from "@/lib/channels/shopify/uploads";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 413 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 415 });
  }

  const conn = await db.channelConnection.findFirst({
    where: { channel: "SHOPIFY", deletedAt: null },
  });
  if (!conn?.shopDomain) {
    return NextResponse.json(
      { error: "No Shopify connection. Connect one in Settings → Channels." },
      { status: 400 },
    );
  }

  try {
    const client = new ShopifyClient(conn.shopDomain, decryptToken(conn.accessToken));
    const { resourceUrl } = await stageImageUpload(client, file);
    return NextResponse.json({ url: resourceUrl });
  } catch (err) {
    console.error("[upload]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
