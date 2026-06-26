"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { importFromChannel } from "@/lib/sync/import";

export type SyncActionResult =
  | {
      ok: true;
      productsAdded: number;
      productsUpdated: number;
      productsDeleted: number;
      errors: string[];
    }
  | { ok: false; error: string }
  | undefined;

export async function refreshFromShopify(
  connectionId: string,
  _prev: SyncActionResult,
  _formData: FormData,
): Promise<SyncActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Forbidden" };

  const lastRun = await db.syncRun.findFirst({
    where: { channelConnectionId: connectionId, completedAt: { not: null } },
    orderBy: { startedAt: "desc" },
  });
  const updatedSince = lastRun?.startedAt ?? undefined;

  try {
    const result = await importFromChannel({
      channelConnectionId: connectionId,
      updatedSince,
    });
    revalidatePath("/sync");
    revalidatePath("/cards");
    return {
      ok: true,
      productsAdded: result.productsAdded,
      productsUpdated: result.productsUpdated,
      productsDeleted: result.productsDeleted,
      errors: result.errors,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reconcileShopify(
  connectionId: string,
  _prev: SyncActionResult,
  _formData: FormData,
): Promise<SyncActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { ok: false, error: "Forbidden" };

  try {
    const result = await importFromChannel({
      channelConnectionId: connectionId,
      reconcile: true,
    });
    revalidatePath("/sync");
    revalidatePath("/cards");
    return {
      ok: true,
      productsAdded: result.productsAdded,
      productsUpdated: result.productsUpdated,
      productsDeleted: result.productsDeleted,
      errors: result.errors,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
