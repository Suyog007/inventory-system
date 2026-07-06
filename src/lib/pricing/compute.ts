// Channel-price computation from a pricing profile.
//
// Pattern: canonical `listingPrice` lives on Variant. Per-channel prices are
// computed by applying that channel's `priceAdjustPercent` from the card's
// PricingProfile. Missing rule → 0% (list at base price).
//
// Used by the outbox to build each channel's `Listing.price` at push time and
// by the sales-channels sidebar to preview what a card will list for.

import type { Channel, PricingProfileRule } from "@prisma/client";

export type ProfileRules = Pick<
  PricingProfileRule,
  "channel" | "priceAdjustPercent"
>[];

export function computeChannelPrice(
  basePrice: number,
  rules: ProfileRules,
  channel: Channel,
): number {
  const rule = rules.find((r) => r.channel === channel);
  const pct = rule?.priceAdjustPercent ?? 0;
  const raw = basePrice * (1 + pct / 100);
  return Math.round(raw * 100) / 100;
}

// Map channel → % adjustment. Convenient for passing to the UI as a plain
// object without leaking Prisma types.
export function toAdjustmentMap(rules: ProfileRules): Record<Channel, number> {
  const out: Record<string, number> = {};
  for (const r of rules) out[r.channel] = r.priceAdjustPercent;
  return out as Record<Channel, number>;
}
