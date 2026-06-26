// Outbox worker: drains pending OutboxItems by calling the appropriate
// ChannelAdapter. Retries on failure with exponential backoff.
//
// Two entry points:
//   processNextBatch(limit) — process up to N pending items in one shot.
//     Called from the long-running worker (src/workers/outbox.ts) and from
//     server actions that want immediate sync after a write.
//   processItem(id) — process one specific item (used by tests).
//
// The worker re-reads source data (Listing/Variant/Card) from the DB at
// processing time rather than relying on payload snapshots. This means
// successive writes to the same Listing always converge to the latest state.

import { db } from "@/lib/db";
import { getAdapterForConnection } from "@/lib/channels";
import type { ChannelUpsertInput } from "@/lib/channels/_adapter";

const MAX_ATTEMPTS = 10;

// Backoff schedule (minutes) keyed by attempt number (1-indexed).
// Attempts >= length cap at the last value.
const BACKOFF_MINUTES = [1, 5, 15, 60, 360, 1440];

function nextBackoffMs(attempts: number): number {
  const idx = Math.min(attempts - 1, BACKOFF_MINUTES.length - 1);
  return BACKOFF_MINUTES[idx] * 60_000;
}

export async function processNextBatch(limit = 10): Promise<number> {
  const items = await db.outboxItem.findMany({
    where: { status: "PENDING", scheduledFor: { lte: new Date() } },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });
  for (const item of items) {
    await processItem(item.id);
  }
  return items.length;
}

export async function processItem(itemId: string): Promise<void> {
  // Atomically CLAIM the item: only one worker / request handler wins.
  // updateMany returns count=0 if the row no longer matches (i.e. someone
  // else already moved it from PENDING to PROCESSING).
  const claim = await db.outboxItem.updateMany({
    where: { id: itemId, status: "PENDING" },
    data: { status: "PROCESSING", attempts: { increment: 1 } },
  });
  if (claim.count === 0) {
    // Someone else already grabbed it. Do nothing.
    return;
  }

  // Now that we own it, fetch with relations.
  const item = await db.outboxItem.findUniqueOrThrow({
    where: { id: itemId },
    include: { channelConnection: true },
  });

  try {
    const adapter = getAdapterForConnection(item.channelConnection);

    switch (item.operation) {
      case "CREATE_LISTING":
      case "UPDATE_LISTING": {
        const { listingId } = item.payload as { listingId: string };
        const listing = await db.listing.findUniqueOrThrow({
          where: { id: listingId },
          include: {
            variant: {
              include: {
                card: {
                  include: {
                    cardTags: { include: { tag: true } },
                    images: { orderBy: { position: "asc" } },
                  },
                },
              },
            },
          },
        });

        // Guard: UPDATE_LISTING requires the listing to already exist on
        // the channel. If externalParentId is missing (e.g. a previous CREATE
        // failed and left a "local-..." placeholder), throw rather than
        // silently fall through to CREATE — that would duplicate on Shopify.
        if (
          item.operation === "UPDATE_LISTING" &&
          (!listing.externalParentId || listing.externalId.startsWith("local-"))
        ) {
          throw new Error(
            `Cannot UPDATE_LISTING for listing ${listingId}: no channel-side ID yet (initial CREATE may have failed). Fix the CREATE outbox item first.`,
          );
        }

        const input: ChannelUpsertInput = {
          title: listing.variant.card.title,
          descriptionHtml: listing.variant.card.descriptionHtml ?? undefined,
          vendor: listing.variant.card.vendor ?? undefined,
          productType: listing.variant.card.productType ?? undefined,
          tags: listing.variant.card.cardTags.map((ct) => ct.tag.name),
          status: listing.status === "ACTIVE" || listing.status === "DRAFT" || listing.status === "ARCHIVED"
            ? listing.status
            : "ACTIVE",
          variant: {
            sku: listing.variant.sku ?? undefined,
            price: Number(listing.price.toString()),
            quantity: listing.variant.quantity,
          },
          images: listing.variant.card.images.map((img) => ({
            url: img.url,
            altText: img.altText ?? undefined,
          })),
          categoryId: listing.variant.card.shopifyCategoryId ?? undefined,
          externalId:
            item.operation === "UPDATE_LISTING" ? listing.externalId : undefined,
          externalParentId:
            item.operation === "UPDATE_LISTING"
              ? listing.externalParentId ?? undefined
              : undefined,
        };

        const result = await adapter.pushUpsert(input);

        // For CREATE, store the new external IDs returned by the channel
        if (item.operation === "CREATE_LISTING") {
          await db.listing.update({
            where: { id: listingId },
            data: {
              externalId: result.externalId,
              externalParentId: result.externalParentId ?? null,
              externalUrl: result.externalUrl ?? null,
              lastSyncedAt: new Date(),
            },
          });
        } else {
          await db.listing.update({
            where: { id: listingId },
            data: { lastSyncedAt: new Date() },
          });
        }
        break;
      }

      case "DELETE_LISTING": {
        const { listingId } = item.payload as { listingId: string };
        const listing = await db.listing.findUnique({
          where: { id: listingId },
        });
        if (!listing) {
          // Listing already gone locally — treat as no-op success
          break;
        }
        // Shopify deletion is at the product level (externalParentId).
        // If externalParentId is missing (older row), fall back to externalId.
        const deleteId = listing.externalParentId ?? listing.externalId;

        // If this is a "local-..." placeholder, the listing never made it to
        // the channel. Nothing to delete remotely — just mark locally and finish.
        const isLocalPlaceholder =
          !listing.externalParentId && deleteId.startsWith("local-");
        if (isLocalPlaceholder) {
          await db.listing.update({
            where: { id: listingId },
            data: { deletedAt: new Date(), status: "DELISTED" },
          });
          break;
        }

        await adapter.pushDelete(deleteId);
        await db.listing.update({
          where: { id: listingId },
          data: { deletedAt: new Date(), status: "DELISTED" },
        });
        break;
      }

      default:
        throw new Error(`Unknown outbox operation: ${item.operation}`);
    }

    await db.outboxItem.update({
      where: { id: itemId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        lastError: null,
      },
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const attempts = item.attempts; // already incremented above

    if (attempts >= MAX_ATTEMPTS) {
      await db.outboxItem.update({
        where: { id: itemId },
        data: { status: "FAILED", lastError: errMsg },
      });
    } else {
      await db.outboxItem.update({
        where: { id: itemId },
        data: {
          status: "PENDING",
          lastError: errMsg,
          scheduledFor: new Date(Date.now() + nextBackoffMs(attempts)),
        },
      });
    }
  }
}

/**
 * Triggered from server actions that want immediate sync after a write.
 * Processes a small batch right now. Pending items not picked up are left
 * for the next batch (worker or the next user action).
 */
export async function flushOutboxNow(limit = 5): Promise<number> {
  return processNextBatch(limit);
}
