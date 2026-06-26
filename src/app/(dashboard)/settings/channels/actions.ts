"use server";

import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { importFromChannel } from "@/lib/sync/import";

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
