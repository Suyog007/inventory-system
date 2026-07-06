// Per-topic handlers for incoming Shopify webhooks.
//
// Philosophy: do the minimum work the webhook NEEDS to do immediately.
// Bulk state updates (e.g. re-importing product fields) are deferred to
// reconciliation. Time-sensitive things (instant delist on sale) happen here.

import { db } from "@/lib/db";

interface ShopifyOrderLine {
  variant_id?: number | string;
  quantity?: number;
  price?: string;
  title?: string;
}

interface ShopifyOrderPayload {
  id?: number | string;
  email?: string;
  total_price?: string;
  customer?: { first_name?: string; last_name?: string };
  line_items?: ShopifyOrderLine[];
  created_at?: string;
}

export async function handleShopifyTopic(
  connectionId: string,
  topic: string,
  payload: Record<string, unknown>,
): Promise<void> {
  switch (topic) {
    case "products/delete":
      await handleProductDelete(connectionId, payload);
      return;
    case "orders/create":
      await handleOrderCreate(connectionId, payload as ShopifyOrderPayload);
      return;
    case "products/create":
    case "products/update":
    case "inventory_levels/update":
      // Logged + recorded in WebhookEvent. Reconciliation picks up actual
      // data changes. (Direct upsert from webhook payload would require
      // mirroring Shopify's REST shape — deferred to a later slice.)
      return;
    default:
      console.warn("[shopify-webhook] unhandled topic:", topic);
  }
}

async function handleProductDelete(
  connectionId: string,
  payload: Record<string, unknown>,
) {
  const id = payload.id;
  if (id == null) return;
  const productGid = `gid://shopify/Product/${id}`;

  // Only unlist on THIS channel. The Card + Variant stay as inventory records
  // so the user can re-list them on Shopify (or any other channel) later.
  // If the merchant sold the card through Shopify checkout, the orders/create
  // webhook records the sale + decrements Variant.quantity before this fires
  // — inventory is still the right place for it.
  await db.listing.updateMany({
    where: {
      channelConnectionId: connectionId,
      externalParentId: productGid,
      deletedAt: null,
    },
    data: { deletedAt: new Date(), status: "DELISTED" },
  });
}

async function handleOrderCreate(
  connectionId: string,
  payload: ShopifyOrderPayload,
) {
  if (!payload.id) return;
  const externalOrderId = String(payload.id);

  // Idempotency: skip if we already recorded this order
  const existing = await db.order.findUnique({
    where: {
      channelConnectionId_externalOrderId: {
        channelConnectionId: connectionId,
        externalOrderId,
      },
    },
  });
  if (existing) return;

  const total = payload.total_price ? Number.parseFloat(payload.total_price) : 0;
  const customerName = [payload.customer?.first_name, payload.customer?.last_name]
    .filter(Boolean)
    .join(" ");

  const order = await db.order.create({
    data: {
      channelConnectionId: connectionId,
      externalOrderId,
      customerEmail: payload.email ?? null,
      customerName: customerName || null,
      total,
      status: "PAID",
      placedAt: payload.created_at ? new Date(payload.created_at) : new Date(),
    },
  });

  // For each line item, find the matching Listing by variant GID, record an
  // OrderLine, decrement Variant.quantity, and (when quantity reaches 0)
  // enqueue DELETE_LISTING on other channels for the same Variant.
  for (const line of payload.line_items ?? []) {
    if (!line.variant_id) continue;
    const variantGid = `gid://shopify/ProductVariant/${line.variant_id}`;
    const listing = await db.listing.findFirst({
      where: { channelConnectionId: connectionId, externalId: variantGid },
      include: { variant: { include: { listings: { where: { deletedAt: null } } } } },
    });
    if (!listing) continue;

    await db.orderLine.create({
      data: {
        orderId: order.id,
        listingId: listing.id,
        quantity: line.quantity ?? 1,
        priceAtSale: line.price ? Number.parseFloat(line.price) : 0,
        titleAtSale: line.title ?? "",
      },
    });

    const newQty = Math.max(0, listing.variant.quantity - (line.quantity ?? 1));
    await db.variant.update({
      where: { id: listing.variant.id },
      data: { quantity: newQty },
    });

    if (newQty === 0) {
      // Instant delist on all OTHER channels carrying this same Variant
      for (const other of listing.variant.listings) {
        if (other.id === listing.id) continue;
        await db.outboxItem.create({
          data: {
            channelConnectionId: other.channelConnectionId,
            operation: "DELETE_LISTING",
            targetType: "Listing",
            targetId: other.id,
            payload: { listingId: other.id },
          },
        });
      }
    }
  }
}
