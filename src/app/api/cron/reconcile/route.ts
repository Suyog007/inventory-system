// Reconciliation cron endpoint.
//
// Intended to be hit by a scheduler (Vercel Cron, cron, etc.) nightly.
// Requires a Bearer token in Authorization header matching env.CRON_SECRET
// (since this endpoint is excluded from session auth via the proxy matcher).

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { importFromChannel } from "@/lib/sync/import";

export const dynamic = "force-dynamic";

export async function POST() {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 },
    );
  }
  const hdrs = await headers();
  const auth = hdrs.get("authorization") ?? "";
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const connections = await db.channelConnection.findMany({
    where: { deletedAt: null },
  });

  const results: Array<{
    connectionId: string;
    channel: string;
    added: number;
    updated: number;
    deleted: number;
    errors: number;
  }> = [];

  for (const c of connections) {
    try {
      const r = await importFromChannel({
        channelConnectionId: c.id,
        reconcile: true,
      });
      results.push({
        connectionId: c.id,
        channel: c.channel,
        added: r.productsAdded,
        updated: r.productsUpdated,
        deleted: r.productsDeleted,
        errors: r.errors.length,
      });
    } catch (err) {
      console.error("[cron-reconcile] failed for", c.id, err);
      results.push({
        connectionId: c.id,
        channel: c.channel,
        added: 0,
        updated: 0,
        deleted: 0,
        errors: 1,
      });
    }
  }

  return NextResponse.json({ ok: true, results });
}
