// Title/description parser for Shopify products.
//
// Strategies, tried in order of confidence:
//   1. TEMPLATED_DESCRIPTION — Mascot's templated key-value block in description
//      ("Player - X Card Number - Y Set - Z Grader - PSA Grade - 10 ..."). Most accurate.
//   2. TITLE_ONLY — heuristic parse of the title. Extracts year + cardNumber + grader + grade
//      mechanically. Set/player are not extracted from title alone (too ambiguous).
//   3. IMPORT_UNPARSED — nothing matched.
//
// Pure function. No DB calls. Output is for upserting Card rows.

export type ParseSource =
  | "TITLE_ONLY"
  | "TEMPLATED_DESCRIPTION"
  | "MANUAL_OVERRIDE"
  | "CERT_LOOKUP"
  | "SCANNER"
  | "IMPORT_UNPARSED";

export interface ParsedCardFields {
  player?: string;
  setName?: string;
  year?: number;
  cardNumber?: string;
  variantName?: string;
  grader?: string;
  grade?: number;
  certNumber?: string;
  sport?: string;
  league?: string;
  team?: string;
  // Condition is for ungraded cards (Mint/NM/EX). Current parsers don't extract it
  // but the field is here so the actions.ts merge function compiles cleanly.
  condition?: string;
}

export interface ParseResult {
  fields: ParsedCardFields;
  parseSource: ParseSource;
}

const GRADERS = ["PSA", "BGS", "CGC", "SGC", "MBA"] as const;
const GRADER_PATTERN = `(?:${GRADERS.join("|")})`;

// =============================================================================
// Strategy 1: Templated description (Mascot format)
// =============================================================================

// Each field in the templated block ends at the next field's label.
// We anchor on the labels for predictable extraction.
const TEMPLATE_FIELD_LABELS = [
  "Player",
  "Card Number",
  "Set",
  "Grader",
  "Grade",
  "Autograph Grade",
  "Certification Number",
  "Grade Population",
  "Sport",
  "League",
  "Team",
] as const;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTemplateField(text: string, label: string): string | undefined {
  // Match: `<label> - <value>` where value ends at the next known label or end of text.
  // Use a lookahead for any of the other labels OR end of string.
  const otherLabels = TEMPLATE_FIELD_LABELS.filter((l) => l !== label);
  // Terminate the captured value when we see the next label OR a prose terminator.
  // Don't use "." as a terminator — grade values like "9.5" contain periods.
  const lookahead = `(?=\\s+(?:${otherLabels.join("|")})\\s*-|$|See our Store)`;
  // Escape the label (Card Number has a space)
  const escapedLabel = label.replace(/\s/g, "\\s+");
  const re = new RegExp(`\\b${escapedLabel}\\s*-\\s*(.*?)${lookahead}`, "i");
  const m = text.match(re);
  if (!m) return undefined;
  const value = m[1].trim();
  return value.length > 0 ? value : undefined;
}

function tryParseTemplatedDescription(
  descriptionHtml: string,
): ParsedCardFields | null {
  const text = stripHtml(descriptionHtml);

  // Must contain at least two distinctive labels to count as Mascot template
  const hasPlayerLabel = /\bPlayer\s*-/.test(text);
  const hasGraderOrCert = /\b(?:Grader|Certification Number)\s*-/.test(text);
  if (!hasPlayerLabel || !hasGraderOrCert) return null;

  const fields: ParsedCardFields = {};

  const player = extractTemplateField(text, "Player");
  if (player) fields.player = player;

  const cardNumber = extractTemplateField(text, "Card Number");
  if (cardNumber) fields.cardNumber = cardNumber;

  const set = extractTemplateField(text, "Set");
  if (set) {
    // The "Set" value often starts with a year, e.g. "2022 Panini Father's Day".
    // Pull year out into its own field and strip from set.
    const yearMatch = set.match(/^(19|20)\d{2}\b\s*/);
    if (yearMatch) {
      fields.year = Number.parseInt(yearMatch[0].trim(), 10);
      fields.setName = set.slice(yearMatch[0].length).trim() || set;
    } else {
      fields.setName = set;
    }
  }

  const grader = extractTemplateField(text, "Grader");
  if (grader) fields.grader = grader.toUpperCase();

  const gradeRaw = extractTemplateField(text, "Grade");
  if (gradeRaw) {
    const n = Number.parseFloat(gradeRaw);
    if (!Number.isNaN(n)) fields.grade = n;
  }

  const cert = extractTemplateField(text, "Certification Number");
  if (cert) fields.certNumber = cert;

  const sport = extractTemplateField(text, "Sport");
  if (sport) fields.sport = sport;

  const league = extractTemplateField(text, "League");
  if (league) fields.league = league;

  const team = extractTemplateField(text, "Team");
  if (team) fields.team = team;

  return fields;
}

// =============================================================================
// Strategy 2: Title-only heuristics
// =============================================================================

function tryParseTitle(title: string): ParsedCardFields | null {
  const fields: ParsedCardFields = {};

  // Year: 4-digit year (19xx or 20xx) typically at the start
  const yearMatch = title.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) fields.year = Number.parseInt(yearMatch[1], 10);

  // Card number: # followed by alphanumeric (e.g., #20, #RC19, #TG02)
  const cardNumMatch = title.match(/#([A-Z0-9]+)/i);
  if (cardNumMatch) fields.cardNumber = `#${cardNumMatch[1].toUpperCase()}`;

  // Grader + grade at the end of the title (e.g., "PSA 10", "BGS 9.5")
  const graderMatch = title.match(
    new RegExp(`\\b(${GRADER_PATTERN})\\s+(\\d+(?:\\.\\d+)?)\\s*$`, "i"),
  );
  if (graderMatch) {
    fields.grader = graderMatch[1].toUpperCase();
    fields.grade = Number.parseFloat(graderMatch[2]);
  }

  // Return null if we got nothing useful at all
  const hasAny = Object.keys(fields).length > 0;
  return hasAny ? fields : null;
}

// =============================================================================
// Public API
// =============================================================================

export function parseShopifyCard(opts: {
  title: string;
  descriptionHtml?: string | null;
  productType?: string | null;
}): ParseResult {
  const { title, descriptionHtml, productType } = opts;

  // For sealed boxes / sealed wax, still try to extract year + variant from title
  // but skip grader/grade (they don't apply).
  const isSealed =
    typeof productType === "string" &&
    /\b(sealed|box|wax|pack)\b/i.test(productType);

  // Try templated description first (highest accuracy)
  if (descriptionHtml) {
    const tplFields = tryParseTemplatedDescription(descriptionHtml);
    if (tplFields) {
      return { fields: tplFields, parseSource: "TEMPLATED_DESCRIPTION" };
    }
  }

  // Fall back to title parsing
  const titleFields = tryParseTitle(title);
  if (titleFields) {
    if (isSealed) {
      delete titleFields.grader;
      delete titleFields.grade;
    }
    return { fields: titleFields, parseSource: "TITLE_ONLY" };
  }

  // Nothing worked
  return { fields: {}, parseSource: "IMPORT_UNPARSED" };
}
