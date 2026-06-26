// Small display helpers used across the dashboard UI.

import type { CardStatus, ListingStatus, ParseSource } from "@prisma/client";

export function formatPrice(
  amount: number | string | { toString: () => string } | null | undefined,
): string {
  if (amount == null) return "—";
  const n = typeof amount === "number" ? amount : Number(amount.toString());
  if (Number.isNaN(n)) return "—";
  return `$${n.toFixed(2)}`;
}

export function formatGraderGrade(
  grader: string | null,
  grade: number | string | { toString: () => string } | null,
): string {
  if (!grader) return "—";
  if (grade == null) return grader;
  return `${grader} ${grade.toString()}`;
}

export const CARD_STATUS_STYLES: Record<CardStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  DRAFT: "bg-gray-100 text-gray-700",
  ARCHIVED: "bg-yellow-100 text-yellow-800",
};

export const LISTING_STATUS_STYLES: Record<ListingStatus, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  DRAFT: "bg-gray-100 text-gray-700",
  ARCHIVED: "bg-yellow-100 text-yellow-800",
  SOLD: "bg-blue-100 text-blue-700",
  DELISTED: "bg-red-100 text-red-700",
};

export const PARSE_SOURCE_STYLES: Record<ParseSource, string> = {
  TEMPLATED_DESCRIPTION: "bg-green-100 text-green-700",
  TITLE_ONLY: "bg-yellow-100 text-yellow-800",
  MANUAL_OVERRIDE: "bg-blue-100 text-blue-700",
  CERT_LOOKUP: "bg-blue-100 text-blue-700",
  SCANNER: "bg-purple-100 text-purple-700",
  IMPORT_UNPARSED: "bg-red-100 text-red-700",
};
