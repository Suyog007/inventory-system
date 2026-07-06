// Template rendering — turns `{Token}` placeholders into card/variant values.
//
// One resolver, three usages: title (plain text), description (HTML), SKU (plain text).
// Missing tokens render as empty strings; runs of whitespace collapse to a single
// space so "{Year} {Manufacturer} {Set}" doesn't leave gaps when Manufacturer is blank.
//
// Adapter-agnostic. The outbox worker calls resolveTokenValues() + renderText()
// (or renderHtml() for description) before handing the strings to any channel
// adapter's pushUpsert.

import type { Card, Category, Variant } from "@prisma/client";

// Tokens exposed to templates. Keep in one place so the editor can offer
// autocomplete/chips and the resolver can enumerate what's available.
export const TEMPLATE_TOKENS = [
  "Title",
  "Year",
  "Manufacturer",
  "Vendor",
  "Set",
  "Player",
  "CardNumber",
  "Parallel",
  "Grader",
  "Grade",
  "AutographAuthentication",
  "AutographGrade",
  "CertificationNumber",
  "Population",
  "PopulationHigher",
  "Sport",
  "League",
  "Team",
  "Game",
  "Rarity",
  "TCGplayerID",
  "Condition",
  "SKU",
  "Quantity",
  "ItemCost",
  "Category",
  "DescriptionHtml",
] as const;

export type TemplateToken = (typeof TEMPLATE_TOKENS)[number];

// Fields we need from Card + Variant to resolve every token. Callers can widen
// the type; we only read what's declared here.
type CardForTemplate = Pick<
  Card,
  | "title"
  | "descriptionHtml"
  | "vendor"
  | "manufacturer"
  | "year"
  | "setName"
  | "player"
  | "cardNumber"
  | "variantName"
  | "grader"
  | "grade"
  | "certNumber"
  | "autographAuthentication"
  | "autographGrade"
  | "population"
  | "populationHigher"
  | "sport"
  | "league"
  | "team"
  | "game"
  | "rarity"
  | "tcgplayerId"
  | "condition"
> & { category?: Pick<Category, "name"> | null };

type VariantForTemplate = Pick<
  Variant,
  "sku" | "quantity" | "itemCost"
>;

export function resolveTokenValues(
  card: CardForTemplate,
  variant: VariantForTemplate,
): Record<TemplateToken, string> {
  const s = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    // Prisma Decimal has a toString(); numbers stringify directly.
    return String(v).trim();
  };

  return {
    Title: s(card.title),
    Year: s(card.year),
    Manufacturer: s(card.manufacturer),
    Vendor: s(card.vendor),
    Set: s(card.setName),
    Player: s(card.player),
    CardNumber: s(card.cardNumber),
    Parallel: s(card.variantName),
    Grader: s(card.grader),
    Grade: s(card.grade),
    AutographAuthentication: s(card.autographAuthentication),
    AutographGrade: s(card.autographGrade),
    CertificationNumber: s(card.certNumber),
    Population: s(card.population),
    PopulationHigher: s(card.populationHigher),
    Sport: s(card.sport),
    League: s(card.league),
    Team: s(card.team),
    Game: s(card.game),
    Rarity: s(card.rarity),
    TCGplayerID: s(card.tcgplayerId),
    Condition: s(card.condition),
    SKU: s(variant.sku),
    Quantity: s(variant.quantity),
    ItemCost: s(variant.itemCost),
    Category: s(card.category?.name),
    DescriptionHtml: card.descriptionHtml ?? "",
  };
}

// Plain-text template rendering: for titles and SKUs.
// Replaces {Token} with its value, then collapses runs of whitespace so blank
// tokens don't leave awkward double-spaces or `#{empty}` fragments.
export function renderText(
  body: string,
  tokens: Record<string, string>,
): string {
  const substituted = body.replace(/\{(\w+)\}/g, (_, name: string) => {
    return tokens[name] ?? "";
  });
  // Collapse whitespace; also clean up `# ` orphaned punctuation left by empty
  // {CardNumber} substitutions like "#{CardNumber}".
  return substituted
    .replace(/#(?=\s|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// HTML template rendering: for descriptions.
// Values inserted into HTML get escaped to prevent breaking the markup or
// creating XSS if a card field ever contains angle brackets. The template body
// itself is trusted (author is an admin editing settings).
// Exception: {DescriptionHtml} passes through raw so the Legacy category
// template `{DescriptionHtml}` can preserve the imported HTML.
export function renderHtml(
  body: string,
  tokens: Record<string, string>,
): string {
  return body.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (name === "DescriptionHtml") return tokens[name] ?? "";
    return escapeHtml(tokens[name] ?? "");
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
