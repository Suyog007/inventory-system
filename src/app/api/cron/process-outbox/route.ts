// Outbox processing cron.
//
// Vercel Cron hits this every minute (see vercel.json) with
// Authorization: Bearer <CRON_SECRET>. Drains pending OutboxItems by
// invoking the same processNextBatch() that the standalone worker uses.
//
// Local dev: the long-running `npm run worker` script keeps working as before;
// this endpoint is just the serverless equivalent.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { processNextBatch } from "@/lib/sync/outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Vercel: bump beyond Hobby's 10s when on Pro

async function handler() {
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

  try {
    const processed = await processNextBatch(50);
    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error("[cron-process-outbox]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

// Vercel Cron uses GET by default; allow POST too for manual / curl triggering.
export const GET = handler;
export const POST = handler;
