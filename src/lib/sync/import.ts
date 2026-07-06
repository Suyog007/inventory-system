// Channel-agnostic import orchestrator.
//
// Given a ChannelConnection, fetches all listings via the adapter, parses
// card-specific fields, and upserts Card/Variant/Image/Listing rows.
//
// Idempotent: calling twice with no Shopify-side changes produces the same DB state.
// Uses Listing.externalId (per channel) as the unique key for upsert.

import { db } from "@/lib/db";
import { parseShopifyCard } from "@/lib/parser";
import { getAdapterForConnection } from "@/lib/channels";
import type { ChannelListingSnapshot } from "@/lib/channels/_adapter";

export interface ImportResult {
  syncRunId: string;
  productsAdded: number;
  productsUpdated: number;
  productsDeleted: number;
  errors: string[];
}

export async function importFromChannel(opts: {
  channelConnectionId: string;
  updatedSince?: Date;
  // If true: full pull (no updatedSince filter) AND soft-delete local listings
  // that weren't seen this pass. The safety net for missed delete webhooks.
  reconcile?: boolean;
}): Promise<ImportResult> {
  const connection = await db.channelConnection.findUniqueOrThrow({
    where: { id: opts.channelConnectionId },
  });

  const adapter = getAdapterForConnection(connection);

  const kind = opts.reconcile ? "RECONCILE" : opts.updatedSince ? "REFRESH" : "IMPORT";
  const syncRun = await db.syncRun.create({
    data: { channelConnectionId: connection.id, kind },
  });

  let productsAdded = 0;
  let productsUpdated = 0;
  let productsDeleted = 0;
  const errors: string[] = [];
  const seenVariantGids = new Set<string>();

  try {
    for await (const snapshot of adapter.importCatalog({
      // Reconcile forces a full pull (ignores updatedSince)
      updatedSince: opts.reconcile ? undefined : opts.updatedSince,
    })) {
      for (const v of snapshot.variants) seenVariantGids.add(v.externalId);
      try {
        const isNew = await upsertSnapshot(connection.id, snapshot);
        if (isNew) productsAdded++;
        else productsUpdated++;
      } catch (err) {
        const msg = `Failed to upsert ${snapshot.externalId}: ${err instanceof Error ? err.message : String(err)}`;
        console.error("[import]", msg);
        errors.push(msg);
      }
    }

    if (opts.reconcile) {
      // Soft-delete any local listing for this connection NOT seen this pass.
      const local = await db.listing.findMany({
        where: {
          channelConnectionId: connection.id,
          deletedAt: null,
          // Only consider listings that already have a real external ID
          // (skip "local-..." placeholders that haven't reached Shopify yet).
          NOT: { externalId: { startsWith: "local-" } },
        },
        select: { id: true, externalId: true },
      });
      const stale = local.filter((l) => !seenVariantGids.has(l.externalId));
      if (stale.length > 0) {
        await db.listing.updateMany({
          where: { id: { in: stale.map((s) => s.id) } },
          data: { deletedAt: new Date(), status: "DELISTED" },
        });
        productsDeleted = stale.length;
      }
    }
  } catch (err) {
    const msg = `Import aborted: ${err instanceof Error ? err.message : String(err)}`;
    console.error("[import]", msg);
    errors.push(msg);
  }

  await db.syncRun.update({
    where: { id: syncRun.id },
    data: {
      completedAt: new Date(),
      productsAdded,
      productsUpdated,
      productsDeleted,
      errors: errors.length > 0 ? errors : undefined,
    },
  });

  return {
    syncRunId: syncRun.id,
    productsAdded,
    productsUpdated,
    productsDeleted,
    errors,
  };
}

async function upsertSnapshot(
  channelConnectionId: string,
  snapshot: ChannelListingSnapshot,
): Promise<boolean> {
  const variantGids = snapshot.variants.map((v) => v.externalId);

  // Find any existing Listing for any variant of this product.
  // All variants of a single product share one Card, so any one of them tells us
  // which Card to update.
  const existingListings = await db.listing.findMany({
    where: { channelConnectionId, externalId: { in: variantGids } },
    include: { variant: true },
  });

  const parsed = parseShopifyCard({
    title: snapshot.title,
    descriptionHtml: snapshot.descriptionHtml ?? undefined,
    productType: snapshot.productType ?? undefined,
  });

  // Pull tags into Tag/CardTag (drop existing first for idempotency)
  const tagNames = snapshot.tags.filter((t) => t.trim().length > 0);

  // Best-effort category match by name; defaults get seeded, so most existing
  // productType values ("Sports Cards", "TCG/CCG", etc.) resolve cleanly.
  let categoryId: string | null = null;
  if (snapshot.productType) {
    const category = await db.category.findFirst({
      where: {
        deletedAt: null,
        name: { equals: snapshot.productType, mode: "insensitive" },
      },
    });
    categoryId = category?.id ?? null;
  }

  // Every card in this app should have a pricing profile; default to the system default.
  const defaultProfile = await db.pricingProfile.findFirst({
    where: { isDefault: true, deletedAt: null },
  });

  const cardData = {
    title: snapshot.title,
    descriptionHtml: snapshot.descriptionHtml ?? null,
    vendor: snapshot.vendor ?? null,
    productType: snapshot.productType ?? null, // legacy fallback for outbox pushes
    shopifyCategoryId: snapshot.categoryId ?? null, // legacy fallback
    categoryId,
    pricingProfileId: defaultProfile?.id ?? null,
    status: mapCardStatus(snapshot.status),
    parseSource: parsed.parseSource,
    player: parsed.fields.player ?? null,
    setName: parsed.fields.setName ?? null,
    year: parsed.fields.year ?? null,
    cardNumber: parsed.fields.cardNumber ?? null,
    variantName: parsed.fields.variantName ?? null,
    grader: parsed.fields.grader ?? null,
    grade: parsed.fields.grade ?? null,
    certNumber: parsed.fields.certNumber ?? null,
    sport: parsed.fields.sport ?? null,
    league: parsed.fields.league ?? null,
    team: parsed.fields.team ?? null,
  };

  let cardId: string;
  let isNew: boolean;

  if (existingListings.length > 0) {
    cardId = existingListings[0].variant.cardId;
    await db.card.update({
      where: { id: cardId },
      data: { ...cardData, deletedAt: null }, // un-soft-delete if it was deleted
    });
    isNew = false;
  } else {
    const card = await db.card.create({ data: cardData });
    cardId = card.id;
    isNew = true;
  }

  // Replace tags (simple model: deleteMany then connect)
  await db.cardTag.deleteMany({ where: { cardId } });
  for (const name of tagNames) {
    const tag = await db.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    await db.cardTag.create({ data: { cardId, tagId: tag.id } });
  }

  // Upsert variants + listings
  for (const v of snapshot.variants) {
    const existing = existingListings.find((l) => l.externalId === v.externalId);
    let variantId: string;

    if (existing) {
      variantId = existing.variantId;
      await db.variant.update({
        where: { id: variantId },
        data: {
          name: v.title,
          sku: v.sku ?? null,
          quantity: v.quantity,
          position: v.position,
          // First imported price becomes the canonical listingPrice if none set yet.
          ...(existing.variant.listingPrice.toString() === "0"
            ? { listingPrice: v.price }
            : {}),
          deletedAt: null,
        },
      });
    } else {
      const variant = await db.variant.create({
        data: {
          cardId,
          name: v.title,
          sku: v.sku ?? null,
          quantity: v.quantity,
          position: v.position,
          listingPrice: v.price,
        },
      });
      variantId = variant.id;
    }

    await db.listing.upsert({
      where: {
        channelConnectionId_externalId: {
          channelConnectionId,
          externalId: v.externalId,
        },
      },
      create: {
        variantId,
        channelConnectionId,
        externalId: v.externalId,
        externalParentId: snapshot.externalId,
        externalUrl: snapshot.externalUrl ?? null,
        status: snapshot.status,
        price: v.price,
        lastSyncedAt: new Date(),
      },
      update: {
        externalParentId: snapshot.externalId,
        externalUrl: snapshot.externalUrl ?? null,
        status: snapshot.status,
        price: v.price,
        lastSyncedAt: new Date(),
        deletedAt: null,
      },
    });
  }

  // Replace images (delete + recreate; simpler than diff for now)
  await db.image.deleteMany({ where: { cardId } });
  if (snapshot.images.length > 0) {
    await db.image.createMany({
      data: snapshot.images.map((img) => ({
        cardId,
        url: img.url,
        altText: img.altText ?? null,
        position: img.position,
        shopifyImageId: img.externalId ?? null,
      })),
    });
  }

  return isNew;
}

function mapCardStatus(s: ChannelListingSnapshot["status"]) {
  // Same three values in our schema; just narrows the type.
  return s;
}
