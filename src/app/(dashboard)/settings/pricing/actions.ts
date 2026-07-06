"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { Channel } from "@prisma/client";

export type PricingActionResult =
  | { error: string }
  | { success: string }
  | undefined;

const minOfferSchema = z.object({
  profileId: z.string().min(1),
  enabled: z.string().optional(), // checkbox: "1" | undefined
  percent: z.string().min(1),
});

export async function saveMinOffer(
  _prev: PricingActionResult,
  formData: FormData,
): Promise<PricingActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Forbidden" };

  const parsed = minOfferSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const pct = Number.parseInt(parsed.data.percent, 10);
  if (!Number.isInteger(pct)) return { error: "Percent must be an integer." };

  await db.pricingProfile.update({
    where: { id: parsed.data.profileId },
    data: {
      minOfferEnabled: parsed.data.enabled === "1",
      minOfferPercent: pct,
    },
  });
  revalidatePath("/settings/pricing");
  return { success: "Minimum offer default saved." };
}

const rulesSchema = z.object({
  profileId: z.string().min(1),
  // Everything else comes in as `rule_<CHANNEL>` fields.
});

export async function saveRules(
  _prev: PricingActionResult,
  formData: FormData,
): Promise<PricingActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Forbidden" };

  const entries = Object.fromEntries(formData);
  const parsed = rulesSchema.safeParse(entries);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { profileId } = parsed.data;

  for (const channel of Object.values(Channel)) {
    const raw = entries[`rule_${channel}`];
    if (typeof raw !== "string") continue;
    const pct = Number.parseInt(raw, 10);
    if (!Number.isInteger(pct)) continue;

    await db.pricingProfileRule.upsert({
      where: { profileId_channel: { profileId, channel } },
      create: { profileId, channel, priceAdjustPercent: pct },
      update: { priceAdjustPercent: pct },
    });
  }

  revalidatePath("/settings/pricing");
  return { success: "Custom pricing saved." };
}

const profileSchema = z.object({
  name: z.string().min(1, "Name is required"),
  cloneFromId: z.string().optional(),
});

export async function createProfile(
  _prev: PricingActionResult,
  formData: FormData,
): Promise<PricingActionResult> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return { error: "Forbidden" };

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await db.pricingProfile.findUnique({
    where: { name: parsed.data.name },
  });
  if (existing && !existing.deletedAt) {
    return { error: "A profile with that name already exists." };
  }

  const cloneFrom = parsed.data.cloneFromId
    ? await db.pricingProfile.findUnique({
        where: { id: parsed.data.cloneFromId },
        include: { rules: true },
      })
    : null;

  // First-run bootstrap: if no active profile exists yet, the one being
  // created becomes the system default so the outbox has something to fall
  // back on and the pricing rules table gets a home.
  const activeCount = await db.pricingProfile.count({
    where: { deletedAt: null },
  });

  let profile;
  if (existing?.deletedAt) {
    // A soft-deleted row still holds the unique name. Restore it in place
    // instead of failing on the unique constraint.
    profile = await db.pricingProfile.update({
      where: { id: existing.id },
      data: {
        deletedAt: null,
        isDefault: activeCount === 0,
        minOfferEnabled: cloneFrom?.minOfferEnabled ?? existing.minOfferEnabled,
        minOfferPercent: cloneFrom?.minOfferPercent ?? existing.minOfferPercent,
      },
    });
  } else {
    profile = await db.pricingProfile.create({
      data: {
        name: parsed.data.name,
        isDefault: activeCount === 0,
        minOfferEnabled: cloneFrom?.minOfferEnabled ?? false,
        minOfferPercent: cloneFrom?.minOfferPercent ?? 0,
      },
    });
  }

  // Seed rules — either cloned or all-zero. Upsert so restored profiles
  // pick up new clone-source values while keeping the row identity of any
  // pre-existing rule attached to this profile id.
  for (const channel of Object.values(Channel)) {
    const source = cloneFrom?.rules.find((r) => r.channel === channel);
    await db.pricingProfileRule.upsert({
      where: { profileId_channel: { profileId: profile.id, channel } },
      create: {
        profileId: profile.id,
        channel,
        priceAdjustPercent: source?.priceAdjustPercent ?? 0,
      },
      update: source
        ? { priceAdjustPercent: source.priceAdjustPercent }
        : {},
    });
  }

  revalidatePath("/settings/pricing");
  return { success: `Profile "${profile.name}" created.` };
}

export async function deleteProfile(profileId: string) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return;

  const profile = await db.pricingProfile.findUnique({
    where: { id: profileId },
  });
  if (!profile || profile.isDefault) return;

  await db.pricingProfile.update({
    where: { id: profileId },
    data: { deletedAt: new Date() },
  });
  revalidatePath("/settings/pricing");
}
