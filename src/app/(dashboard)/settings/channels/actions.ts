"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { importFromChannel } from "@/lib/sync/import";
import { decryptToken } from "@/lib/crypto";
import { ShopifyClient } from "@/lib/channels/shopify/client";
import { getWebhookCallbackUrl } from "@/lib/channels/shopify/config";
import { registerShopifyWebhooks } from "@/lib/channels/shopify/webhook-subscriptions";

export async function disconnectChannel(connectionId: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return;

  await db.channelConnection.update({
    where: { id: connectionId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/settings/channels");
}

export type ImportActionResult =
  | {
      ok: true;
      productsAdded: number;
      productsUpdated: number;
      productsDeleted: number;
      errors: string[];
    }
  | { ok: false; error: string }
  | undefined;

export type WebhookRegResult =
  | { ok: true; callbackUrl: string; registered: string[]; removed: string[]; errors: string[] }
  | { ok: false; error: string }
  | undefined;

export async function registerWebhooks(
  connectionId: string,
  _prev: WebhookRegResult,
  _formData: FormData,
): Promise<WebhookRegResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Forbidden" };

  const conn = await db.channelConnection.findUnique({ where: { id: connectionId } });
  if (!conn || conn.deletedAt || conn.channel !== "SHOPIFY") {
    return { ok: false, error: "Connection not found." };
  }

  try {
    const client = new ShopifyClient(conn.shopDomain!, decryptToken(conn.accessToken));
    const result = await registerShopifyWebhooks(client, getWebhookCallbackUrl());
    revalidatePath("/settings/channels");
    return { ok: true, ...result };
  } catch (err) {
    console.error("[registerWebhooks] failed:", err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runImport(
  connectionId: string,
  _prev: ImportActionResult,
  _formData: FormData,
): Promise<ImportActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return { ok: false, error: "Forbidden" };
  }

  try {
    const result = await importFromChannel({ channelConnectionId: connectionId });
    revalidatePath("/settings/channels");
    revalidatePath("/cards");
    return {
      ok: true,
      productsAdded: result.productsAdded,
      productsUpdated: result.productsUpdated,
      productsDeleted: result.productsDeleted,
      errors: result.errors,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
