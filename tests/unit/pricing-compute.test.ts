import { describe, it, expect } from "vitest";
import {
  computeChannelPrice,
  toAdjustmentMap,
} from "@/lib/pricing/compute";

const RULES = [
  { channel: "SHOPIFY" as const, priceAdjustPercent: 0 },
  { channel: "EBAY" as const, priceAdjustPercent: 15 },
  { channel: "WHATNOT" as const, priceAdjustPercent: 15 },
  { channel: "MYCARDPOST" as const, priceAdjustPercent: -5 },
];

describe("computeChannelPrice", () => {
  it("returns base price when the rule is 0%", () => {
    expect(computeChannelPrice(100, RULES, "SHOPIFY")).toBe(100);
  });

  it("adds a positive % on top of base", () => {
    expect(computeChannelPrice(100, RULES, "EBAY")).toBe(115);
  });

  it("subtracts for a negative %", () => {
    expect(computeChannelPrice(100, RULES, "MYCARDPOST")).toBe(95);
  });

  it("falls back to 0% when no rule exists for a channel", () => {
    // TIKTOK is not in RULES — should behave as 0%.
    expect(computeChannelPrice(100, RULES, "TIKTOK")).toBe(100);
  });

  it("rounds to 2 decimal places", () => {
    // 33.33 * 1.15 = 38.3295 → 38.33
    expect(computeChannelPrice(33.33, RULES, "EBAY")).toBe(38.33);
  });
});

describe("toAdjustmentMap", () => {
  it("keys rules by channel enum value", () => {
    const map = toAdjustmentMap(RULES);
    expect(map.SHOPIFY).toBe(0);
    expect(map.EBAY).toBe(15);
    expect(map.MYCARDPOST).toBe(-5);
  });
});
