-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('SHOPIFY', 'EBAY', 'TIKTOK', 'WHATNOT', 'SQUARE', 'WALMART', 'LOUPE', 'MYCARDPOST', 'MASCOTNETWORK', 'MERCURY');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParseSource" AS ENUM ('TITLE_ONLY', 'TEMPLATED_DESCRIPTION', 'MANUAL_OVERRIDE', 'CERT_LOOKUP', 'SCANNER', 'IMPORT_UNPARSED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED', 'SOLD', 'DELISTED');

-- CreateEnum
CREATE TYPE "OutboxOperation" AS ENUM ('CREATE_LISTING', 'UPDATE_LISTING', 'DELETE_LISTING', 'UPDATE_VARIANT_PRICE', 'UPDATE_VARIANT_INVENTORY', 'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'DELETE_PRODUCT');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SyncRunKind" AS ENUM ('IMPORT', 'REFRESH', 'RECONCILE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'REFUNDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "invitedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChannelConnection" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "shopDomain" TEXT,
    "externalAccountId" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "scopes" TEXT NOT NULL,
    "metadata" JSONB,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastWebhookAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ChannelConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "descriptionHtml" TEXT,
    "vendor" TEXT,
    "productType" TEXT,
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "parseSource" "ParseSource" NOT NULL DEFAULT 'IMPORT_UNPARSED',
    "player" TEXT,
    "setName" TEXT,
    "year" INTEGER,
    "cardNumber" TEXT,
    "variantName" TEXT,
    "grader" TEXT,
    "grade" DECIMAL(4,1),
    "certNumber" TEXT,
    "sport" TEXT,
    "league" TEXT,
    "team" TEXT,
    "condition" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Variant" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "sku" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "shopifyImageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardTag" (
    "cardId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "CardTag_pkey" PRIMARY KEY ("cardId","tagId")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "externalUrl" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "price" DECIMAL(12,2) NOT NULL,
    "compareAtPrice" DECIMAL(12,2),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "externalEventId" TEXT,
    "payload" JSONB NOT NULL,
    "hmacValid" BOOLEAN NOT NULL,
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxItem" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "userId" TEXT,
    "operation" "OutboxOperation" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboxItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "kind" "SyncRunKind" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "productsAdded" INTEGER NOT NULL DEFAULT 0,
    "productsUpdated" INTEGER NOT NULL DEFAULT 0,
    "productsDeleted" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "channelConnectionId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "customerEmail" TEXT,
    "customerName" TEXT,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "placedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "listingId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceAtSale" DECIMAL(12,2) NOT NULL,
    "titleAtSale" TEXT NOT NULL,

    CONSTRAINT "OrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- CreateIndex
CREATE INDEX "ChannelConnection_channel_idx" ON "ChannelConnection"("channel");

-- CreateIndex
CREATE INDEX "ChannelConnection_deletedAt_idx" ON "ChannelConnection"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChannelConnection_channel_shopDomain_key" ON "ChannelConnection"("channel", "shopDomain");

-- CreateIndex
CREATE INDEX "Card_player_idx" ON "Card"("player");

-- CreateIndex
CREATE INDEX "Card_setName_idx" ON "Card"("setName");

-- CreateIndex
CREATE INDEX "Card_year_idx" ON "Card"("year");

-- CreateIndex
CREATE INDEX "Card_grader_grade_idx" ON "Card"("grader", "grade");

-- CreateIndex
CREATE INDEX "Card_certNumber_idx" ON "Card"("certNumber");

-- CreateIndex
CREATE INDEX "Card_status_idx" ON "Card"("status");

-- CreateIndex
CREATE INDEX "Card_deletedAt_idx" ON "Card"("deletedAt");

-- CreateIndex
CREATE INDEX "Variant_cardId_idx" ON "Variant"("cardId");

-- CreateIndex
CREATE INDEX "Variant_sku_idx" ON "Variant"("sku");

-- CreateIndex
CREATE INDEX "Variant_deletedAt_idx" ON "Variant"("deletedAt");

-- CreateIndex
CREATE INDEX "Image_cardId_idx" ON "Image"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "CardTag_tagId_idx" ON "CardTag"("tagId");

-- CreateIndex
CREATE INDEX "Listing_status_idx" ON "Listing"("status");

-- CreateIndex
CREATE INDEX "Listing_deletedAt_idx" ON "Listing"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_variantId_channelConnectionId_key" ON "Listing"("variantId", "channelConnectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_channelConnectionId_externalId_key" ON "Listing"("channelConnectionId", "externalId");

-- CreateIndex
CREATE INDEX "WebhookEvent_topic_idx" ON "WebhookEvent"("topic");

-- CreateIndex
CREATE INDEX "WebhookEvent_processedAt_idx" ON "WebhookEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_channelConnectionId_externalEventId_key" ON "WebhookEvent"("channelConnectionId", "externalEventId");

-- CreateIndex
CREATE INDEX "OutboxItem_status_scheduledFor_idx" ON "OutboxItem"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "OutboxItem_channelConnectionId_idx" ON "OutboxItem"("channelConnectionId");

-- CreateIndex
CREATE INDEX "SyncRun_channelConnectionId_kind_startedAt_idx" ON "SyncRun"("channelConnectionId", "kind", "startedAt");

-- CreateIndex
CREATE INDEX "Order_placedAt_idx" ON "Order"("placedAt");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_channelConnectionId_externalOrderId_key" ON "Order"("channelConnectionId", "externalOrderId");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");

-- CreateIndex
CREATE INDEX "OrderLine_listingId_idx" ON "OrderLine"("listingId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTag" ADD CONSTRAINT "CardTag_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardTag" ADD CONSTRAINT "CardTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxItem" ADD CONSTRAINT "OutboxItem_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutboxItem" ADD CONSTRAINT "OutboxItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncRun" ADD CONSTRAINT "SyncRun_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_channelConnectionId_fkey" FOREIGN KEY ("channelConnectionId") REFERENCES "ChannelConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderLine" ADD CONSTRAINT "OrderLine_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
