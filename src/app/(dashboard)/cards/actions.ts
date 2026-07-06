"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flushOutboxNow } from "@/lib/sync/outbox";
import type { ParseSource } from "@/lib/parser";
import { renderText, renderHtml, resolveTokenValues } from "@/lib/templates/render";

const cardFieldsSchema = z.object({
  vendor: z.string().optional(),
  manufacturer: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  // Card structured fields (all optional)
  player: z.string().optional(),
  setName: z.string().optional(),
  year: z.string().optional(),
  cardNumber: z.string().optional(),
  variantName: z.string().optional(),
  grader: z.string().optional(),
  grade: z.string().optional(),
  certNumber: z.string().optional(),
  autographAuthentication: z.string().optional(),
  autographGrade: z.string().optional(),
  population: z.string().optional(),
  populationHigher: z.string().optional(),
  rarity: z.string().optional(),
  tcgplayerId: z.string().optional(),
  game: z.string().optional(),
  sport: z.string().optional(),
  league: z.string().optional(),
  team: z.string().optional(),
  condition: z.string().optional(),
  tags: z.string().optional(),
  imageUrls: z.string().optional(),
  // Variant + listing fields
  sku: z.string().optional(),
  quantity: z.string().optional(),
  listingPrice: z.string().min(1, "Listing price is required"),
  purchaseDate: z.string().optional(),
  purchasedFrom: z.string().optional(),
  itemCost: z.string().optional(),
  // Marketplace overrides — apply to every Listing tied to this card.
  useTitleTemplate: z.string().optional(),
  useDescriptionTemplate: z.string().optional(),
  titleOverride: z.string().optional(),
  descriptionHtmlOverride: z.string().optional(),
  pricingProfileId: z.string().optional(),
  // Which channels to publish to. Empty string / undefined = inventory only.
  channelConnectionIds: z.string().optional(),
});

export type CardActionResult =
  | { error: string }
  | { success: string; cardId: string }
  | undefined;

// Renders the canonical title + description that will be stored on Card.
// - Use Template on → look up the category's default (channel=null) template,
//   render with the card's structured fields.
// - Use Template off → use the user-supplied override text.
// The result becomes both Card.title / Card.descriptionHtml (used for dashboard
// display + fallback) AND the value the outbox pushes to Shopify.
//
// Structured-field types are relaxed to `Record<string, unknown>` here because
// callers hand us plain form output (numbers, strings) rather than Prisma
// Decimal instances. The render layer only ever stringifies values, so this is
// safe.
async function computeRenderedTitleAndDescription(opts: {
  categoryId: string;
  useTitleTemplate: boolean;
  useDescriptionTemplate: boolean;
  titleOverride: string | null;
  descriptionHtmlOverride: string | null;
  cardFields: Record<string, unknown>;
  variantFields: Record<string, unknown>;
}): Promise<{ title: string; descriptionHtml: string }> {
  const category = await db.category.findUnique({
    where: { id: opts.categoryId },
    include: { templates: { where: { channel: null } } },
  });

  // Inject the category name so {Category} tokens resolve.
  const cardWithCategory = {
    ...opts.cardFields,
    category: category ? { name: category.name } : null,
  };
  const tokens = resolveTokenValues(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cardWithCategory as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    opts.variantFields as any,
  );

  let title = "";
  if (opts.useTitleTemplate) {
    const t = category?.templates.find((t) => t.kind === "TITLE");
    title = t ? renderText(t.body, tokens) : "";
  } else {
    title = opts.titleOverride ?? "";
  }
  if (!title) title = "(Untitled)";

  let descriptionHtml = "";
  if (opts.useDescriptionTemplate) {
    const t = category?.templates.find((t) => t.kind === "DESCRIPTION");
    descriptionHtml = t ? renderHtml(t.body, tokens) : "";
  } else {
    descriptionHtml = opts.descriptionHtmlOverride ?? "";
  }

  return { title, descriptionHtml };
}

function parseOptionalDecimal(s?: string): number | null {
  if (s === undefined || s === "") return null;
  const n = Number.parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function parseOptionalInt(s?: string): number | null {
  if (s === undefined || s === "") return null;
  const n = Number.parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

function normalizeFields(raw: Record<string, FormDataEntryValue>) {
  const parsed = cardFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const d = parsed.data;

  const channelIds = (d.channelConnectionIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Checkboxes only post their `value` when checked; "1" means on.
  const useTitleTemplate = d.useTitleTemplate === "1";
  const useDescriptionTemplate = d.useDescriptionTemplate === "1";

  // Title/description no longer come in as top-level fields — they're computed
  // from the Marketplace section via templates or overrides. Parser is only
  // useful during import; form users type structured fields directly.
  const parseSource: ParseSource = "MANUAL_OVERRIDE";

  return {
    ok: true as const,
    // Everything except title + descriptionHtml — those get computed
    // asynchronously in the caller via computeRenderedTitleAndDescription().
    cardExceptTitle: {
      vendor: d.vendor?.trim() || null,
      manufacturer: d.manufacturer?.trim() || null,
      categoryId: d.categoryId,
      player: d.player?.trim() || null,
      setName: d.setName?.trim() || null,
      year: d.year ? Number.parseInt(d.year, 10) : null,
      cardNumber: d.cardNumber?.trim() || null,
      variantName: d.variantName?.trim() || null,
      grader: d.grader?.trim() ? d.grader.trim().toUpperCase() : null,
      grade: d.grade ? Number.parseFloat(d.grade) : null,
      certNumber: d.certNumber?.trim() || null,
      autographAuthentication: d.autographAuthentication?.trim() || null,
      autographGrade: parseOptionalDecimal(d.autographGrade),
      population: parseOptionalInt(d.population),
      populationHigher: parseOptionalInt(d.populationHigher),
      rarity: d.rarity?.trim() || null,
      tcgplayerId: d.tcgplayerId?.trim() || null,
      game: d.game?.trim() || null,
      sport: d.sport?.trim() || null,
      league: d.league?.trim() || null,
      team: d.team?.trim() || null,
      condition: d.condition?.trim() || null,
      pricingProfileId: d.pricingProfileId?.trim() || null,
    },
    parseSource,
    tagNames: (d.tags ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0),
    imageUrls: (d.imageUrls ?? "")
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter((u) => /^https?:\/\//.test(u)),
    sku: d.sku?.trim() || null,
    quantity: d.quantity ? Number.parseInt(d.quantity, 10) : 0,
    listingPrice: Number.parseFloat(d.listingPrice),
    purchaseDate: d.purchaseDate ? new Date(d.purchaseDate) : null,
    purchasedFrom: d.purchasedFrom?.trim() || null,
    itemCost: parseOptionalDecimal(d.itemCost),
    channelIds,
    marketplace: {
      useTitleTemplate,
      useDescriptionTemplate,
      titleOverride: d.titleOverride?.trim() || null,
      descriptionHtmlOverride: d.descriptionHtmlOverride?.trim() || null,
    },
  };
}

async function syncImages(cardId: string, urls: string[]) {
  await db.image.deleteMany({ where: { cardId } });
  if (urls.length === 0) return;
  await db.image.createMany({
    data: urls.map((url, i) => ({ cardId, url, position: i })),
  });
}

async function syncTags(cardId: string, names: string[]) {
  await db.cardTag.deleteMany({ where: { cardId } });
  for (const name of names) {
    const tag = await db.tag.upsert({
      where: { name },
      create: { name },
      update: {},
    });
    await db.cardTag.create({ data: { cardId, tagId: tag.id } });
  }
}

interface MarketplaceOverrides {
  useTitleTemplate: boolean;
  useDescriptionTemplate: boolean;
  titleOverride: string | null;
  descriptionHtmlOverride: string | null;
}

// Sync the set of Listing rows for a variant against the requested channel IDs.
// - New channel checked → create Listing + enqueue CREATE_LISTING
// - Already active + still checked → enqueue UPDATE_LISTING (price/template changes)
// - Active but unchecked → soft-delete Listing + enqueue DELETE_LISTING
// Marketplace overrides propagate to every Listing tied to this card so all
// channels stay in sync with the user's Use-Template choice.
async function syncListings(opts: {
  variantId: string;
  listingPrice: number;
  desiredChannelIds: string[];
  userId: string;
  marketplace: MarketplaceOverrides;
}) {
  const { variantId, listingPrice, desiredChannelIds, userId, marketplace } =
    opts;

  const existing = await db.listing.findMany({
    where: { variantId },
  });

  const desired = new Set(desiredChannelIds);
  const activeByChannel = new Map<string, (typeof existing)[number]>();
  for (const l of existing) {
    if (!l.deletedAt) activeByChannel.set(l.channelConnectionId, l);
  }

  const listingOverrides = {
    useTitleTemplate: marketplace.useTitleTemplate,
    useDescriptionTemplate: marketplace.useDescriptionTemplate,
    titleOverride: marketplace.titleOverride,
    descriptionHtmlOverride: marketplace.descriptionHtmlOverride,
  };

  // Newly checked → CREATE (or restore soft-deleted).
  for (const channelId of desired) {
    const active = activeByChannel.get(channelId);
    if (active) continue; // handled below as UPDATE

    const softDeleted = existing.find(
      (l) => l.channelConnectionId === channelId && l.deletedAt,
    );
    let listing;
    if (softDeleted) {
      listing = await db.listing.update({
        where: { id: softDeleted.id },
        data: {
          deletedAt: null,
          status: "ACTIVE",
          price: listingPrice,
          externalId: `local-${softDeleted.id}`,
          externalParentId: null,
          externalUrl: null,
          ...listingOverrides,
        },
      });
    } else {
      listing = await db.listing.create({
        data: {
          variantId,
          channelConnectionId: channelId,
          externalId: `local-${variantId}-${channelId}`,
          status: "ACTIVE",
          price: listingPrice,
          ...listingOverrides,
        },
      });
    }

    await db.outboxItem.create({
      data: {
        channelConnectionId: channelId,
        userId,
        operation: "CREATE_LISTING",
        targetType: "Listing",
        targetId: listing.id,
        payload: { listingId: listing.id },
      },
    });
  }

  // Already active → UPDATE (price + template changes will re-render at push).
  for (const [channelId, listing] of activeByChannel) {
    if (!desired.has(channelId)) continue;
    await db.listing.update({
      where: { id: listing.id },
      data: { price: listingPrice, ...listingOverrides },
    });
    await db.outboxItem.create({
      data: {
        channelConnectionId: channelId,
        userId,
        operation: "UPDATE_LISTING",
        targetType: "Listing",
        targetId: listing.id,
        payload: { listingId: listing.id },
      },
    });
  }

  // Active but unchecked → DELETE.
  for (const [channelId, listing] of activeByChannel) {
    if (desired.has(channelId)) continue;
    await db.outboxItem.create({
      data: {
        channelConnectionId: channelId,
        userId,
        operation: "DELETE_LISTING",
        targetType: "Listing",
        targetId: listing.id,
        payload: { listingId: listing.id },
      },
    });
  }
}

export async function updateCard(
  cardId: string,
  _prev: CardActionResult,
  formData: FormData,
): Promise<CardActionResult> {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const n = normalizeFields(Object.fromEntries(formData));
  if (!n.ok) return { error: n.error };

  const card = await db.card.findUnique({
    where: { id: cardId },
    include: { variants: { orderBy: { position: "asc" }, take: 1 } },
  });
  if (!card) return { error: "Card not found" };

  const rendered = await computeRenderedTitleAndDescription({
    categoryId: n.cardExceptTitle.categoryId,
    useTitleTemplate: n.marketplace.useTitleTemplate,
    useDescriptionTemplate: n.marketplace.useDescriptionTemplate,
    titleOverride: n.marketplace.titleOverride,
    descriptionHtmlOverride: n.marketplace.descriptionHtmlOverride,
    cardFields: n.cardExceptTitle,
    variantFields: {
      sku: n.sku,
      quantity: n.quantity,
      itemCost: n.itemCost,
    },
  });

  await db.card.update({
    where: { id: cardId },
    data: {
      ...n.cardExceptTitle,
      title: rendered.title,
      descriptionHtml: rendered.descriptionHtml || null,
      parseSource: n.parseSource,
    },
  });
  await syncTags(cardId, n.tagNames);
  await syncImages(cardId, n.imageUrls);

  const variant = card.variants[0];
  if (variant) {
    await db.variant.update({
      where: { id: variant.id },
      data: {
        sku: n.sku,
        quantity: n.quantity,
        listingPrice: n.listingPrice,
        purchaseDate: n.purchaseDate,
        purchasedFrom: n.purchasedFrom,
        itemCost: n.itemCost,
      },
    });
    await syncListings({
      variantId: variant.id,
      listingPrice: n.listingPrice,
      desiredChannelIds: n.channelIds,
      userId: session.user.id,
      marketplace: n.marketplace,
    });
    await flushOutboxNow(10);
  }

  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/cards");
  redirect(`/cards/${cardId}`);
}

export async function createCard(
  _prev: CardActionResult,
  formData: FormData,
): Promise<CardActionResult> {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const n = normalizeFields(Object.fromEntries(formData));
  if (!n.ok) return { error: n.error };

  // Pick the default pricing profile for new cards.
  const defaultProfile = await db.pricingProfile.findFirst({
    where: { isDefault: true, deletedAt: null },
  });

  const rendered = await computeRenderedTitleAndDescription({
    categoryId: n.cardExceptTitle.categoryId,
    useTitleTemplate: n.marketplace.useTitleTemplate,
    useDescriptionTemplate: n.marketplace.useDescriptionTemplate,
    titleOverride: n.marketplace.titleOverride,
    descriptionHtmlOverride: n.marketplace.descriptionHtmlOverride,
    cardFields: n.cardExceptTitle,
    variantFields: {
      sku: n.sku,
      quantity: n.quantity,
      itemCost: n.itemCost,
    },
  });

  const card = await db.card.create({
    data: {
      ...n.cardExceptTitle,
      title: rendered.title,
      descriptionHtml: rendered.descriptionHtml || null,
      parseSource: n.parseSource,
      // Form value wins; else fall back to system default.
      pricingProfileId:
        n.cardExceptTitle.pricingProfileId ?? defaultProfile?.id ?? null,
    },
  });
  await syncTags(card.id, n.tagNames);
  await syncImages(card.id, n.imageUrls);

  const variant = await db.variant.create({
    data: {
      cardId: card.id,
      name: "Default",
      sku: n.sku,
      quantity: n.quantity,
      listingPrice: n.listingPrice,
      purchaseDate: n.purchaseDate,
      purchasedFrom: n.purchasedFrom,
      itemCost: n.itemCost,
      position: 1,
    },
  });

  await syncListings({
    variantId: variant.id,
    listingPrice: n.listingPrice,
    desiredChannelIds: n.channelIds,
    userId: session.user.id,
    marketplace: n.marketplace,
  });
  await flushOutboxNow(10);

  revalidatePath("/cards");
  redirect(`/cards/${card.id}`);
}

export async function deleteCard(cardId: string) {
  const session = await auth();
  if (!session?.user) return;

  const card = await db.card.findUnique({
    where: { id: cardId },
    include: { variants: { include: { listings: true } } },
  });
  if (!card) return;

  await db.card.update({ where: { id: cardId }, data: { deletedAt: new Date() } });

  for (const v of card.variants) {
    for (const l of v.listings) {
      if (l.deletedAt) continue;
      await db.outboxItem.create({
        data: {
          channelConnectionId: l.channelConnectionId,
          userId: session.user.id,
          operation: "DELETE_LISTING",
          targetType: "Listing",
          targetId: l.id,
          payload: { listingId: l.id },
        },
      });
    }
  }
  await flushOutboxNow(10);

  revalidatePath("/cards");
  redirect("/cards");
}
