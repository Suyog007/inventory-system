// ChannelAdapter — every channel module (Shopify, eBay, TikTok, etc.)
// implements this interface. The sync engine speaks ONLY to this interface,
// never to a specific channel's API directly.

export type ChannelName =
  | "SHOPIFY"
  | "EBAY"
  | "TIKTOK"
  | "WHATNOT"
  | "SQUARE"
  | "WALMART"
  | "LOUPE"
  | "MYCARDPOST"
  | "MASCOTNETWORK"
  | "MERCURY";

export type ListingStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

// What we fetch FROM a channel (during import / refresh / reconcile)
export interface ChannelListingSnapshot {
  externalId: string;
  externalUrl?: string;
  title: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  categoryId?: string;
  status: ListingStatus;
  tags: string[];
  variants: Array<{
    externalId: string;
    sku?: string;
    price: number;
    quantity: number;
    position: number;
    title: string;
  }>;
  images: Array<{
    externalId?: string;
    url: string;
    altText?: string;
    position: number;
  }>;
  updatedAt: Date;
}

// What we push TO a channel (during create / update)
export interface ChannelUpsertInput {
  title: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  tags: string[];
  status: ListingStatus;
  variant: {
    sku?: string;
    price: number;
    quantity: number;
  };
  // Image URLs to attach to the listing. Channel fetches each URL and hosts a copy.
  // Currently pushed only on CREATE; update-side image management is deferred.
  images?: Array<{ url: string; altText?: string }>;
  // Channel-specific category (e.g. Shopify Standard Product Taxonomy GID).
  // Not all channels use this.
  categoryId?: string;
  // For UPDATE: the existing channel external IDs. Omit for CREATE.
  externalId?: string; // listing-level (variant GID on Shopify)
  externalParentId?: string; // parent product (product GID on Shopify); null for flat channels
}

export interface ChannelUpsertResult {
  externalId: string;
  externalParentId?: string;
  externalUrl?: string;
}

export interface WebhookVerification {
  valid: boolean;
  error?: string;
}

export interface ParsedWebhook {
  topic: string;
  externalEventId?: string;
  payload: Record<string, unknown>;
}

export interface WebhookInput {
  rawBody: string;
  headers: Record<string, string>;
}

// The interface every channel implementation must satisfy.
export interface ChannelAdapter {
  readonly channel: ChannelName;

  /**
   * Pull listings from the channel. Returns an async iterable so callers
   * can stream large catalogs without loading everything into memory.
   */
  importCatalog(opts: {
    updatedSince?: Date;
  }): AsyncIterable<ChannelListingSnapshot>;

  /**
   * Create or update a listing on the channel.
   * Returns the resulting external ID + URL.
   */
  pushUpsert(input: ChannelUpsertInput): Promise<ChannelUpsertResult>;

  /**
   * Delete (or archive) a listing on the channel.
   */
  pushDelete(externalId: string): Promise<void>;

  /**
   * Verify an incoming webhook's signature (HMAC, etc.).
   * Called BEFORE any handler logic.
   */
  verifyWebhook(input: WebhookInput): WebhookVerification;

  /**
   * Parse an incoming webhook into a normalized shape.
   * Called AFTER verification.
   */
  handleWebhook(input: WebhookInput): ParsedWebhook;
}
