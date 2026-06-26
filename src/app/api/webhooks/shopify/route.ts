// Single Shopify webhook endpoint.
//
// 1. Verify HMAC against app's Client Secret.
// 2. Identify which ChannelConnection the webhook belongs to (by shop domain).
// 3. Idempotency check via WebhookEvent.externalEventId.
// 4. Record the WebhookEvent (audit log).
// 5. Dispatch to the per-topic handler.
//
// Returns 200 even on handler errors after the event is recorded, so Shopify
// doesn't retry forever. The error is captured in WebhookEvent.error for later
// debugging via reconciliation.

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyShopifyHmac } from "@/lib/channels/shopify/webhooks";
import { handleShopifyTopic } from "@/lib/channels/shopify/webhook-handlers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const hdrs = await headers();
  const hmac = hdrs.get("x-shopify-hmac-sha256");
  const topic = hdrs.get("x-shopify-topic") ?? "unknown";
  const eventId = hdrs.get("x-shopify-webhook-id") ?? undefined;
  const shopDomain = hdrs.get("x-shopify-shop-domain") ?? "";

  if (!verifyShopifyHmac(rawBody, hmac ?? undefined)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const connection = await db.channelConnection.findFirst({
    where: { channel: "SHOPIFY", shopDomain, deletedAt: null },
  });
  if (!connection) {
    return NextResponse.json({ error: "no connection" }, { status: 404 });
  }

  // Idempotency check via WebhookEvent unique (connection, eventId)
  if (eventId) {
    const existing = await db.webhookEvent.findUnique({
      where: {
        channelConnectionId_externalEventId: {
          channelConnectionId: connection.id,
          externalEventId: eventId,
        },
      },
    });
    if (existing) {
      return NextResponse.json({ ok: true, deduped: true });
    }
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    // Empty or invalid JSON — record with empty payload
  }

  const event = await db.webhookEvent.create({
    data: {
      channelConnectionId: connection.id,
      topic,
      externalEventId: eventId ?? null,
      payload: payload as Prisma.InputJsonValue,
      hmacValid: true,
      receivedAt: new Date(),
    },
  });

  await db.channelConnection.update({
    where: { id: connection.id },
    data: { lastWebhookAt: new Date() },
  });

  let error: string | null = null;
  try {
    await handleShopifyTopic(connection.id, topic, payload);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error("[shopify-webhook] handler error", { topic, err });
  }

  await db.webhookEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date(), error },
  });

  return NextResponse.json({ ok: true });
}
