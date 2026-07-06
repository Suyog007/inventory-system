-- Phase 1: Category, Template, PricingProfile + new columns on Card/Variant/Listing.

-- CreateEnum
CREATE TYPE "TemplateKind" AS ENUM ('TITLE', 'DESCRIPTION', 'SKU');

-- CreateTable: Category
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shopifyCategoryId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE INDEX "Category_deletedAt_idx" ON "Category"("deletedAt");

-- CreateTable: Template
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "channel" "Channel",
    "kind" "TemplateKind" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Template_categoryId_channel_kind_idx" ON "Template"("categoryId", "channel", "kind");

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: PricingProfile
CREATE TABLE "PricingProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "minOfferEnabled" BOOLEAN NOT NULL DEFAULT false,
    "minOfferPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "PricingProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingProfile_name_key" ON "PricingProfile"("name");
CREATE INDEX "PricingProfile_deletedAt_idx" ON "PricingProfile"("deletedAt");

-- CreateTable: PricingProfileRule
CREATE TABLE "PricingProfileRule" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "priceAdjustPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PricingProfileRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PricingProfileRule_profileId_channel_key" ON "PricingProfileRule"("profileId", "channel");

-- AddForeignKey
ALTER TABLE "PricingProfileRule" ADD CONSTRAINT "PricingProfileRule_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PricingProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: Card — new fields + FKs
ALTER TABLE "Card" ADD COLUMN "manufacturer" TEXT;
ALTER TABLE "Card" ADD COLUMN "autographAuthentication" TEXT;
ALTER TABLE "Card" ADD COLUMN "autographGrade" DECIMAL(4,1);
ALTER TABLE "Card" ADD COLUMN "population" INTEGER;
ALTER TABLE "Card" ADD COLUMN "populationHigher" INTEGER;
ALTER TABLE "Card" ADD COLUMN "rarity" TEXT;
ALTER TABLE "Card" ADD COLUMN "tcgplayerId" TEXT;
ALTER TABLE "Card" ADD COLUMN "game" TEXT;
ALTER TABLE "Card" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Card" ADD COLUMN "pricingProfileId" TEXT;

-- CreateIndex
CREATE INDEX "Card_categoryId_idx" ON "Card"("categoryId");
CREATE INDEX "Card_pricingProfileId_idx" ON "Card"("pricingProfileId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Card" ADD CONSTRAINT "Card_pricingProfileId_fkey" FOREIGN KEY ("pricingProfileId") REFERENCES "PricingProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Variant — canonical price + purchase tracking
ALTER TABLE "Variant" ADD COLUMN "listingPrice" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Variant" ADD COLUMN "purchaseDate" TIMESTAMP(3);
ALTER TABLE "Variant" ADD COLUMN "purchasedFrom" TEXT;
ALTER TABLE "Variant" ADD COLUMN "itemCost" DECIMAL(12,2);

-- Backfill: lift the first Listing.price into Variant.listingPrice so pricing
-- computations start from an accurate canonical value for existing rows.
UPDATE "Variant" v
SET "listingPrice" = COALESCE(
    (SELECT l."price"
       FROM "Listing" l
      WHERE l."variantId" = v."id"
        AND l."deletedAt" IS NULL
      ORDER BY l."createdAt" ASC
      LIMIT 1),
    0
);

-- AlterTable: Listing — per-channel template overrides
ALTER TABLE "Listing" ADD COLUMN "useTitleTemplate" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Listing" ADD COLUMN "useDescriptionTemplate" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Listing" ADD COLUMN "useSkuTemplate" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Listing" ADD COLUMN "titleOverride" TEXT;
ALTER TABLE "Listing" ADD COLUMN "descriptionHtmlOverride" TEXT;
ALTER TABLE "Listing" ADD COLUMN "skuOverride" TEXT;

-- Existing rows had free-typed titles/descriptions on Card; flip their template
-- flags to false so the current text is preserved as an override rather than
-- being overwritten by an empty template on first push.
UPDATE "Listing" l
SET "useTitleTemplate" = false,
    "useDescriptionTemplate" = false,
    "useSkuTemplate" = false,
    "titleOverride" = c."title",
    "descriptionHtmlOverride" = c."descriptionHtml",
    "skuOverride" = v."sku"
FROM "Variant" v, "Card" c
WHERE l."variantId" = v."id"
  AND v."cardId" = c."id";
