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
import { findTemplate } from "@/lib/templates/resolver";
import {
  renderText,
  renderHtml,
  resolveTokenValues,
} from "@/lib/templates/render";
import { computeChannelPrice } from "@/lib/pricing/compute";

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
                    category: true,
                    pricingProfile: { include: { rules: true } },
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

        // Prefer templates from the card's Category; per-listing overrides win
        // when useXTemplate is off. Existing rows had their flags flipped to
        // false during migration, so their stored title/description carries over
        // as an override — they push identically until the user opts back in.
        const card = listing.variant.card;
        const channel = item.channelConnection.channel;
        const tokens = resolveTokenValues(card, listing.variant);

        const title = await resolveField({
          useTemplate: listing.useTitleTemplate,
          override: listing.titleOverride,
          fallback: card.title,
          kind: "TITLE",
          categoryId: card.categoryId,
          channel,
          tokens,
          html: false,
        });

        const descriptionHtml = await resolveField({
          useTemplate: listing.useDescriptionTemplate,
          override: listing.descriptionHtmlOverride,
          fallback: card.descriptionHtml ?? "",
          kind: "DESCRIPTION",
          categoryId: card.categoryId,
          channel,
          tokens,
          html: true,
        });

        // SKU auto-rule: graded cards with a cert# default to the cert as SKU
        // when there's no explicit override and no meaningful SKU template value.
        const rawSku = await resolveField({
          useTemplate: listing.useSkuTemplate,
          override: listing.skuOverride,
          fallback: listing.variant.sku ?? "",
          kind: "SKU",
          categoryId: card.categoryId,
          channel,
          tokens,
          html: false,
        });
        const sku =
          rawSku ||
          (card.grader && card.certNumber ? card.certNumber : undefined) ||
          undefined;

        // Per-channel price: canonical listingPrice × (1 + this channel's %).
        // Also written back to Listing.price so the dashboard reflects the
        // actual pushed value (audit trail + Phase 3 sidebar preview).
        const basePrice = Number(listing.variant.listingPrice.toString());
        const channelPrice = card.pricingProfile
          ? computeChannelPrice(basePrice, card.pricingProfile.rules, channel)
          : basePrice;

        const input: ChannelUpsertInput = {
          title,
          descriptionHtml: descriptionHtml || undefined,
          vendor: card.vendor ?? undefined,
          productType: card.category?.name ?? card.productType ?? undefined,
          tags: card.cardTags.map((ct) => ct.tag.name),
          // Status stays ACTIVE by default; Shopify adapter publishes on create.
          status: "ACTIVE",
          variant: {
            sku,
            price: channelPrice,
            quantity: listing.variant.quantity,
            cost:
              listing.variant.itemCost != null
                ? Number(listing.variant.itemCost.toString())
                : undefined,
          },
          images: card.images.map((img) => ({
            url: img.url,
            altText: img.altText ?? undefined,
          })),
          categoryId:
            card.category?.shopifyCategoryId ?? card.shopifyCategoryId ?? undefined,
          externalId:
            item.operation === "UPDATE_LISTING" ? listing.externalId : undefined,
          externalParentId:
            item.operation === "UPDATE_LISTING"
              ? listing.externalParentId ?? undefined
              : undefined,
        };

        const result = await adapter.pushUpsert(input);

        // Write the pushed SKU back so the UI reflects what actually landed on
        // the channel. Without this, template-rendered SKUs (e.g. cert# for
        // graded cards) show in Shopify but stay blank in our dashboard.
        if (sku && sku !== listing.variant.sku) {
          await db.variant.update({
            where: { id: listing.variantId },
            data: { sku },
          });
        }

        // For CREATE, store the new external IDs returned by the channel
        if (item.operation === "CREATE_LISTING") {
          await db.listing.update({
            where: { id: listingId },
            data: {
              externalId: result.externalId,
              externalParentId: result.externalParentId ?? null,
              externalUrl: result.externalUrl ?? null,
              price: channelPrice,
              lastSyncedAt: new Date(),
            },
          });
        } else {
          await db.listing.update({
            where: { id: listingId },
            data: { price: channelPrice, lastSyncedAt: new Date() },
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

// Resolves a single templated field (title / description / SKU) for a listing.
// Precedence: override > category template > fallback string.
async function resolveField(opts: {
  useTemplate: boolean;
  override: string | null;
  fallback: string;
  kind: "TITLE" | "DESCRIPTION" | "SKU";
  categoryId: string | null;
  channel: Parameters<typeof findTemplate>[0]["channel"];
  tokens: Record<string, string>;
  html: boolean;
}): Promise<string> {
  if (!opts.useTemplate) {
    return opts.override ?? opts.fallback;
  }
  const body = await findTemplate({
    categoryId: opts.categoryId,
    channel: opts.channel,
    kind: opts.kind,
  });
  if (!body) return opts.fallback;
  return opts.html
    ? renderHtml(body, opts.tokens)
    : renderText(body, opts.tokens);
}
