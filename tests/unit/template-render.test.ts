import { describe, it, expect } from "vitest";
import {
  resolveTokenValues,
  renderText,
  renderHtml,
} from "@/lib/templates/render";

// Prisma Decimal values in DB rows expose toString(). Fake them with strings
// so this test stays a pure unit test with no Prisma runtime dependency.

const SAMPLE_CARD = {
  title: "2018 Topps Archives The Sandlot Timmy Timmons #SL-TIM PSA 9",
  descriptionHtml: "<p>Old body</p>",
  vendor: "Panini",
  manufacturer: "Topps",
  year: 2018,
  setName: "Archives",
  player: "Timmy Timmons",
  cardNumber: "SL-TIM",
  variantName: "The Sandlot",
  grader: "PSA",
  grade: "9",
  certNumber: "132447473",
  autographAuthentication: null,
  autographGrade: null,
  population: 19,
  populationHigher: null,
  sport: "Baseball",
  league: null,
  team: null,
  game: null,
  rarity: null,
  tcgplayerId: null,
  condition: null,
  category: { name: "Sports Cards" },
};

const SAMPLE_VARIANT = {
  sku: null,
  quantity: 1,
  itemCost: "30",
};

describe("resolveTokenValues", () => {
  it("builds a full token map from card + variant fields", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens = resolveTokenValues(SAMPLE_CARD as any, SAMPLE_VARIANT as any);
    expect(tokens.Player).toBe("Timmy Timmons");
    expect(tokens.Set).toBe("Archives");
    expect(tokens.Year).toBe("2018");
    expect(tokens.CardNumber).toBe("SL-TIM");
    expect(tokens.Grader).toBe("PSA");
    expect(tokens.Grade).toBe("9");
    expect(tokens.CertificationNumber).toBe("132447473");
    expect(tokens.Population).toBe("19");
    expect(tokens.Sport).toBe("Baseball");
    expect(tokens.Category).toBe("Sports Cards");
    expect(tokens.ItemCost).toBe("30");
  });

  it("returns empty strings for null / undefined fields", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens = resolveTokenValues(SAMPLE_CARD as any, SAMPLE_VARIANT as any);
    expect(tokens.League).toBe("");
    expect(tokens.Game).toBe("");
    expect(tokens.AutographAuthentication).toBe("");
  });
});

describe("renderText", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens = resolveTokenValues(SAMPLE_CARD as any, SAMPLE_VARIANT as any);

  it("substitutes {Token} placeholders", () => {
    expect(renderText("{Year} {Player}", tokens)).toBe("2018 Timmy Timmons");
  });

  it("silently drops missing tokens and collapses whitespace", () => {
    expect(
      renderText("{Year} {Manufacturer} {League} {Player}", tokens),
    ).toBe("2018 Topps Timmy Timmons");
  });

  it("cleans up orphan '#' when CardNumber is empty", () => {
    const empty = { ...tokens, CardNumber: "" };
    expect(renderText("{Player} #{CardNumber} {Grader}", empty)).toBe(
      "Timmy Timmons PSA",
    );
  });

  it("renders a realistic Sports Cards title template", () => {
    const body =
      "{Year} {Manufacturer} {Set} {Player} #{CardNumber} {Parallel} {Grader} {Grade}";
    expect(renderText(body, tokens)).toBe(
      "2018 Topps Archives Timmy Timmons #SL-TIM The Sandlot PSA 9",
    );
  });
});

describe("renderHtml", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tokens = resolveTokenValues(SAMPLE_CARD as any, SAMPLE_VARIANT as any);

  it("preserves surrounding HTML and inserts values", () => {
    const body = "<p>You are buying a {Player} {Grader} {Grade}</p>";
    expect(renderHtml(body, tokens)).toBe(
      "<p>You are buying a Timmy Timmons PSA 9</p>",
    );
  });

  it("HTML-escapes values to avoid breaking markup / XSS", () => {
    const dangerous = { ...tokens, Player: '<script>bad()</script>' };
    expect(renderHtml("<p>{Player}</p>", dangerous)).toBe(
      "<p>&lt;script&gt;bad()&lt;/script&gt;</p>",
    );
  });

  it("passes {DescriptionHtml} through raw for the Legacy category", () => {
    const withHtml = { ...tokens, DescriptionHtml: "<p><b>hi</b></p>" };
    expect(renderHtml("{DescriptionHtml}", withHtml)).toBe("<p><b>hi</b></p>");
  });
});
