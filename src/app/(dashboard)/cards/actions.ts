"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { flushOutboxNow } from "@/lib/sync/outbox";
import { parseShopifyCard, type ParseSource } from "@/lib/parser";

const cardFieldsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  descriptionHtml: z.string().optional(),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  shopifyCategoryId: z.string().optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]),
  // Card structured fields (all optional)
  player: z.string().optional(),
  setName: z.string().optional(),
  year: z.string().optional(),
  cardNumber: z.string().optional(),
  variantName: z.string().optional(),
  grader: z.string().optional(),
  grade: z.string().optional(),
  certNumber: z.string().optional(),
  sport: z.string().optional(),
  league: z.string().optional(),
  team: z.string().optional(),
  condition: z.string().optional(),
  tags: z.string().optional(), // comma-separated
  imageUrls: z.string().optional(), // newline-separated URLs
  // Variant + listing fields
  sku: z.string().optional(),
  quantity: z.string().optional(),
  price: z.string().min(1, "Price is required"),
});

export type CardActionResult =
  | { error: string }
  | { success: string; cardId: string }
  | undefined;

function normalizeFields(raw: Record<string, FormDataEntryValue>) {
  const parsed = cardFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  const d = parsed.data;

  // Auto-parse the description for any structured fields the user left blank.
  // User-provided values always win over parser-inferred values.
  const parseResult = parseShopifyCard({
    title: d.title,
    descriptionHtml: d.descriptionHtml,
    productType: d.productType,
  });
  const p = parseResult.fields;

  // Helper: user value if provided, else parsed, else null
  const merge = <T>(userVal: T | undefined | null, parsedVal: T | undefined): T | null => {
    if (userVal !== undefined && userVal !== null && userVal !== "") return userVal;
    return parsedVal ?? null;
  };

  const userProvidedAnyStructured = [
    d.player,
    d.setName,
    d.year,
    d.cardNumber,
    d.variantName,
    d.grader,
    d.grade,
    d.certNumber,
    d.sport,
    d.league,
    d.team,
    d.condition,
  ].some((v) => v !== undefined && v !== null && v !== "");

  // If user typed any structured field by hand, it's MANUAL_OVERRIDE.
  // Otherwise reflect what the parser found.
  const parseSource: ParseSource = userProvidedAnyStructured
    ? "MANUAL_OVERRIDE"
    : parseResult.parseSource;

  return {
    ok: true as const,
    card: {
      title: d.title,
      descriptionHtml: d.descriptionHtml?.trim() || null,
      vendor: d.vendor?.trim() || null,
      productType: d.productType?.trim() || null,
      shopifyCategoryId: d.shopifyCategoryId?.trim() || null,
      status: d.status,
      player: merge(d.player?.trim(), p.player),
      setName: merge(d.setName?.trim(), p.setName),
      year: merge(d.year ? Number.parseInt(d.year, 10) : null, p.year),
      cardNumber: merge(d.cardNumber?.trim(), p.cardNumber),
      variantName: merge(d.variantName?.trim(), p.variantName),
      grader: merge(
        d.grader?.trim() ? d.grader.trim().toUpperCase() : null,
        p.grader,
      ),
      grade: merge(d.grade ? Number.parseFloat(d.grade) : null, p.grade),
      certNumber: merge(d.certNumber?.trim(), p.certNumber),
      sport: merge(d.sport?.trim(), p.sport),
      league: merge(d.league?.trim(), p.league),
      team: merge(d.team?.trim(), p.team),
      condition: merge(d.condition?.trim(), p.condition),
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
    price: Number.parseFloat(d.price),
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
    include: { variants: { orderBy: { position: "asc" }, take: 1, include: { listings: true } } },
  });
  if (!card) return { error: "Card not found" };

  // Apply changes locally
  await db.card.update({ where: { id: cardId }, data: { ...n.card, parseSource: n.parseSource } });
  await syncTags(cardId, n.tagNames);
  await syncImages(cardId, n.imageUrls);

  const variant = card.variants[0];
  if (variant) {
    await db.variant.update({
      where: { id: variant.id },
      data: { sku: n.sku, quantity: n.quantity },
    });
    const listing = variant.listings[0];
    if (listing) {
      await db.listing.update({
        where: { id: listing.id },
        data: { price: n.price, status: n.card.status },
      });
      // Enqueue outbox
      await db.outboxItem.create({
        data: {
          channelConnectionId: listing.channelConnectionId,
          userId: session.user.id,
          operation: "UPDATE_LISTING",
          targetType: "Listing",
          targetId: listing.id,
          payload: { listingId: listing.id },
        },
      });
      // Try to push immediately so the user sees the sync result without waiting for the worker
      await flushOutboxNow(5);
    }
  }

  revalidatePath(`/cards/${cardId}`);
  revalidatePath("/cards");
  redirect(`/cards/${cardId}`);
}

const createSchema = cardFieldsSchema.extend({
  channelConnectionId: z.string().min(1, "Pick a channel"),
});

export async function createCard(
  _prev: CardActionResult,
  formData: FormData,
): Promise<CardActionResult> {
  const session = await auth();
  if (!session?.user) return { error: "Unauthorized" };

  const raw = Object.fromEntries(formData);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const n = normalizeFields(raw);
  if (!n.ok) return { error: n.error };

  const connection = await db.channelConnection.findUnique({
    where: { id: parsed.data.channelConnectionId },
  });
  if (!connection || connection.deletedAt) {
    return { error: "Channel connection not found." };
  }

  // Create locally (with placeholder externalId; worker will replace after Shopify CREATE)
  const card = await db.card.create({ data: { ...n.card, parseSource: n.parseSource } });
  await syncTags(card.id, n.tagNames);
  await syncImages(card.id, n.imageUrls);
  const variant = await db.variant.create({
    data: { cardId: card.id, name: "Default", sku: n.sku, quantity: n.quantity, position: 1 },
  });
  const placeholder = `local-${card.id}`;
  const listing = await db.listing.create({
    data: {
      variantId: variant.id,
      channelConnectionId: connection.id,
      externalId: placeholder,
      status: n.card.status,
      price: n.price,
    },
  });
  await db.outboxItem.create({
    data: {
      channelConnectionId: connection.id,
      userId: session.user.id,
      operation: "CREATE_LISTING",
      targetType: "Listing",
      targetId: listing.id,
      payload: { listingId: listing.id },
    },
  });
  await flushOutboxNow(5);

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
