// Shopify ChannelAdapter — implements the contract from src/lib/channels/_adapter.ts.
// In Slice 2a, the OAuth + token storage exist but the data operations are stubs.
// Real implementations land in 2b (parser), 2c (import), 2e (outbox worker), etc.

import type {
  ChannelAdapter,
  ChannelListingSnapshot,
  ChannelUpsertInput,
  ChannelUpsertResult,
  ListingStatus,
  ParsedWebhook,
  WebhookInput,
  WebhookVerification,
} from "@/lib/channels/_adapter";
import { ShopifyClient } from "./client";
import { verifyShopifyHmac } from "./webhooks";
import {
  INVENTORY_LEVEL_QUERY,
  PRODUCTS_QUERY,
  PRODUCT_MEDIA_QUERY,
  SHOP_CONFIG_QUERY,
} from "./queries";
import {
  INVENTORY_ACTIVATE,
  INVENTORY_ADJUST_QUANTITIES,
  PRODUCT_CREATE,
  PRODUCT_CREATE_MEDIA,
  PRODUCT_DELETE,
  PRODUCT_DELETE_MEDIA,
  PRODUCT_UPDATE,
  PRODUCT_VARIANTS_BULK_UPDATE,
  PUBLISHABLE_PUBLISH,
} from "./mutations";

interface ShopifyProductNode {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string | null;
  vendor: string | null;
  productType: string | null;
  tags: string[];
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
  updatedAt: string;
  onlineStoreUrl: string | null;
  category: { id: string } | null;
  variants: {
    nodes: Array<{
      id: string;
      sku: string | null;
      price: string;
      compareAtPrice: string | null;
      inventoryQuantity: number | null;
      title: string;
    }>;
  };
  images: {
    nodes: Array<{
      id: string;
      url: string;
      altText: string | null;
    }>;
  };
}

interface ProductsQueryData {
  products: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: ShopifyProductNode[];
  };
}

function mapStatus(s: ShopifyProductNode["status"]): ListingStatus {
  // Shopify and our enum happen to use the same three values for products
  return s;
}

interface ShopConfig {
  locationId: string;
  onlineStorePublicationId: string | null;
}

export class ShopifyAdapter implements ChannelAdapter {
  readonly channel = "SHOPIFY" as const;
  private shopConfigCache: ShopConfig | null = null;

  constructor(
    private readonly shop: string,
    private readonly accessToken: string,
  ) {}

  protected getClient(): ShopifyClient {
    return new ShopifyClient(this.shop, this.accessToken);
  }

  // Lazy: fetched on first need, cached on this instance.
  protected async getShopConfig(): Promise<ShopConfig> {
    if (this.shopConfigCache) return this.shopConfigCache;
    const data = await this.getClient().graphql<{
      locations: { nodes: Array<{ id: string; name: string }> };
      publications: { nodes: Array<{ id: string; name: string }> };
    }>(SHOP_CONFIG_QUERY);

    const location = data.locations.nodes[0];
    if (!location) {
      throw new Error("Shopify shop has no locations");
    }
    const onlineStore = data.publications.nodes.find(
      (p) => p.name === "Online Store",
    );
    this.shopConfigCache = {
      locationId: location.id,
      onlineStorePublicationId: onlineStore?.id ?? null,
    };
    return this.shopConfigCache;
  }

  async *importCatalog(opts: {
    updatedSince?: Date;
  }): AsyncIterable<ChannelListingSnapshot> {
    const client = this.getClient();
    const query = opts.updatedSince
      ? `updated_at:>=${opts.updatedSince.toISOString()}`
      : undefined;
    let cursor: string | null = null;

    for (;;) {
      const data: ProductsQueryData = await client.graphql<ProductsQueryData>(
        PRODUCTS_QUERY,
        { cursor, query },
      );
      for (const p of data.products.nodes) {
        yield {
          externalId: p.id,
          externalUrl: p.onlineStoreUrl ?? undefined,
          title: p.title,
          descriptionHtml: p.descriptionHtml ?? undefined,
          vendor: p.vendor ?? undefined,
          productType: p.productType ?? undefined,
          categoryId: p.category?.id ?? undefined,
          status: mapStatus(p.status),
          tags: p.tags ?? [],
          variants: p.variants.nodes.map((v, idx) => ({
            externalId: v.id,
            sku: v.sku ?? undefined,
            price: Number.parseFloat(v.price),
            quantity: v.inventoryQuantity ?? 0,
            position: idx + 1,
            title: v.title,
          })),
          images: p.images.nodes.map((img, idx) => ({
            externalId: img.id,
            url: img.url,
            altText: img.altText ?? undefined,
            position: idx,
          })),
          updatedAt: new Date(p.updatedAt),
        };
      }
      if (!data.products.pageInfo.hasNextPage) break;
      cursor = data.products.pageInfo.endCursor;
    }
  }

  async pushUpsert(input: ChannelUpsertInput): Promise<ChannelUpsertResult> {
    const client = this.getClient();
    const productInput: Record<string, unknown> = {
      title: input.title,
      descriptionHtml: input.descriptionHtml ?? "",
      vendor: input.vendor ?? null,
      productType: input.productType ?? null,
      tags: input.tags,
      status: input.status,
    };
    if (input.categoryId) {
      productInput.category = input.categoryId;
    }

    let productGid: string;
    let variantGid: string;
    let onlineStoreUrl: string | null = null;

    let inventoryItemId: string | null = null;
    let isCreate = false;

    if (input.externalParentId) {
      // UPDATE existing product
      const updateData = await client.graphql<{
        productUpdate: {
          product: { id: string; onlineStoreUrl: string | null } | null;
          userErrors: Array<{ field: string[]; message: string }>;
        };
      }>(PRODUCT_UPDATE, {
        input: { id: input.externalParentId, ...productInput },
      });
      if (updateData.productUpdate.userErrors.length) {
        throw new Error(
          `Shopify productUpdate: ${JSON.stringify(updateData.productUpdate.userErrors)}`,
        );
      }
      productGid = input.externalParentId;
      onlineStoreUrl = updateData.productUpdate.product?.onlineStoreUrl ?? null;
      if (!input.externalId) {
        throw new Error(
          "UPDATE requires externalId (variant GID) in addition to externalParentId",
        );
      }
      variantGid = input.externalId;
      // inventoryItemId will be fetched after variant update below
    } else {
      // CREATE new product
      isCreate = true;
      const createData = await client.graphql<{
        productCreate: {
          product: {
            id: string;
            onlineStoreUrl: string | null;
            variants: {
              nodes: Array<{
                id: string;
                inventoryItem: { id: string };
              }>;
            };
          } | null;
          userErrors: Array<{ field: string[]; message: string }>;
        };
      }>(PRODUCT_CREATE, { input: productInput });
      if (createData.productCreate.userErrors.length) {
        throw new Error(
          `Shopify productCreate: ${JSON.stringify(createData.productCreate.userErrors)}`,
        );
      }
      const product = createData.productCreate.product;
      if (!product) throw new Error("Shopify productCreate returned no product");
      productGid = product.id;
      onlineStoreUrl = product.onlineStoreUrl;
      const firstVariant = product.variants.nodes[0];
      if (!firstVariant) throw new Error("Shopify productCreate returned no variant");
      variantGid = firstVariant.id;
      inventoryItemId = firstVariant.inventoryItem.id;
    }

    // Update variant SKU + price + enable inventory tracking.
    // We always set tracked:true so Shopify shows real qty instead of "not tracked".
    const variantData = await client.graphql<{
      productVariantsBulkUpdate: {
        productVariants: Array<{
          id: string;
          inventoryItem: { id: string };
        }>;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(PRODUCT_VARIANTS_BULK_UPDATE, {
      productId: productGid,
      variants: [
        {
          id: variantGid,
          price: input.variant.price.toFixed(2),
          inventoryItem: {
            tracked: true,
            ...(input.variant.sku !== undefined ? { sku: input.variant.sku } : {}),
          },
        },
      ],
    });
    if (variantData.productVariantsBulkUpdate.userErrors.length) {
      throw new Error(
        `Shopify productVariantsBulkUpdate: ${JSON.stringify(variantData.productVariantsBulkUpdate.userErrors)}`,
      );
    }
    if (!inventoryItemId) {
      inventoryItemId =
        variantData.productVariantsBulkUpdate.productVariants[0]?.inventoryItem.id ?? null;
    }

    // ─────────────────────────────────────────────────────────────────────
    // Post-create steps below are BEST EFFORT. Wrapped in try/catch so that
    // ANY failure (scope error, transient outage, etc.) is logged but does
    // NOT throw — because if we throw after productCreate already succeeded,
    // the outbox retry would call productCreate again and duplicate the Shopify
    // product. The main create/update has already happened; these are extras.
    // ─────────────────────────────────────────────────────────────────────

    // Push absolute inventory quantity at the shop's primary location.
    // For brand-new variants, we must first call inventoryActivate so the
    // inventoryLevel exists at the location; otherwise inventorySetQuantities
    // silently no-ops and Shopify keeps showing 0 in stock.
    if (inventoryItemId) {
      try {
        const { locationId } = await this.getShopConfig();

        // Ensure the variant is stocked at this location (idempotent —
        // already-activated items return ALREADY_ACTIVATED userError which we ignore).
        // uniqueKey for @idempotent: deterministic per (item, location) so retries are safe.
        const activateData = await client.graphql<{
          inventoryActivate: {
            inventoryLevel: { id: string } | null;
            userErrors: Array<{ field: string[]; message: string }>;
          };
        }>(INVENTORY_ACTIVATE, {
          inventoryItemId,
          locationId,
          idempotencyKey: `activate:${inventoryItemId}:${locationId}`,
        });
        const activateErrs = activateData.inventoryActivate.userErrors.filter(
          (e) => !/already/i.test(e.message),
        );
        if (activateErrs.length) {
          console.warn(
            "[shopify] inventory activate userErrors:",
            JSON.stringify(activateErrs),
          );
        }

        // Query the current "available" quantity, then adjust by delta.
        // (Set-style mutations now require compareQuantity / changeFromQuantity
        // for race protection; adjust-by-delta is simpler and just as correct
        // for single-user flow.)
        const levelData = await client.graphql<{
          inventoryItem: {
            inventoryLevel: {
              quantities: Array<{ name: string; quantity: number }>;
            } | null;
          } | null;
        }>(INVENTORY_LEVEL_QUERY, { inventoryItemId, locationId });
        const current =
          levelData.inventoryItem?.inventoryLevel?.quantities.find(
            (q) => q.name === "available",
          )?.quantity ?? 0;
        const delta = input.variant.quantity - current;

        if (delta !== 0) {
          const invData = await client.graphql<{
            inventoryAdjustQuantities: {
              userErrors: Array<{ field: string[]; message: string }>;
            };
          }>(INVENTORY_ADJUST_QUANTITIES, {
            input: {
              reason: "correction",
              name: "available",
              referenceDocumentUri: `inventory-ags://outbox/${Date.now()}`,
              changes: [
                {
                  inventoryItemId,
                  locationId,
                  delta,
                  changeFromQuantity: current,
                },
              ],
            },
            // Unique per (item, location, target) so the same logical request retries safely.
            idempotencyKey: `adjust:${inventoryItemId}:${locationId}:${input.variant.quantity}`,
          });
          if (invData.inventoryAdjustQuantities.userErrors.length) {
            console.warn(
              "[shopify] inventory adjust userErrors:",
              JSON.stringify(invData.inventoryAdjustQuantities.userErrors),
            );
          }
        }
      } catch (err) {
        console.warn("[shopify] inventory push failed (non-fatal):", err);
      }
    }

    // On CREATE, publish to Online Store so shoppers can see the listing.
    if (isCreate) {
      try {
        const { onlineStorePublicationId } = await this.getShopConfig();
        if (onlineStorePublicationId) {
          const pubData = await client.graphql<{
            publishablePublish: {
              userErrors: Array<{ field: string[]; message: string }>;
            };
          }>(PUBLISHABLE_PUBLISH, {
            id: productGid,
            input: [{ publicationId: onlineStorePublicationId }],
          });
          if (pubData.publishablePublish.userErrors.length) {
            console.warn(
              "[shopify] publish userErrors:",
              JSON.stringify(pubData.publishablePublish.userErrors),
            );
          }
        }
      } catch (err) {
        console.warn("[shopify] publish failed (non-fatal):", err);
      }
    }

    // Image sync.
    //   CREATE: just push the local URLs.
    //   UPDATE: delete all existing Shopify media, then push the current local URLs.
    //           Simpler than diffing; volumes are tiny (1-3 images per card).
    // Either way, wrapped in try/catch so an image API failure doesn't fail the whole upsert.
    if (input.images) {
      try {
        // On UPDATE, wipe what's currently on Shopify.
        if (!isCreate) {
          const existing = await client.graphql<{
            product: { media: { nodes: Array<{ id: string }> } } | null;
          }>(PRODUCT_MEDIA_QUERY, { id: productGid });
          const existingIds =
            existing.product?.media.nodes.map((n) => n.id) ?? [];
          if (existingIds.length > 0) {
            const deleteData = await client.graphql<{
              productDeleteMedia: {
                mediaUserErrors: Array<{ field: string[]; message: string; code: string }>;
              };
            }>(PRODUCT_DELETE_MEDIA, {
              productId: productGid,
              mediaIds: existingIds,
            });
            if (deleteData.productDeleteMedia.mediaUserErrors.length) {
              console.warn(
                "[shopify] image delete userErrors:",
                JSON.stringify(deleteData.productDeleteMedia.mediaUserErrors),
              );
            }
          }
        }

        // Add the current local images.
        if (input.images.length > 0) {
          const mediaData = await client.graphql<{
            productCreateMedia: {
              mediaUserErrors: Array<{ field: string[]; message: string; code: string }>;
            };
          }>(PRODUCT_CREATE_MEDIA, {
            productId: productGid,
            media: input.images.map((img) => ({
              mediaContentType: "IMAGE",
              originalSource: img.url,
              alt: img.altText ?? "",
            })),
          });
          if (mediaData.productCreateMedia.mediaUserErrors.length) {
            console.warn(
              "[shopify] image push userErrors:",
              JSON.stringify(mediaData.productCreateMedia.mediaUserErrors),
            );
          }
        }
      } catch (err) {
        console.warn("[shopify] image sync failed (non-fatal):", err);
      }
    }

    return {
      externalId: variantGid,
      externalParentId: productGid,
      externalUrl: onlineStoreUrl ?? undefined,
    };
  }

  async pushDelete(externalParentId: string): Promise<void> {
    // For Shopify, deletion is at the product level (externalParentId), which
    // cascades to all variants. The argument here IS the product GID.
    const client = this.getClient();
    const data = await client.graphql<{
      productDelete: {
        deletedProductId: string | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    }>(PRODUCT_DELETE, { input: { id: externalParentId } });
    if (data.productDelete.userErrors.length) {
      throw new Error(
        `Shopify productDelete: ${JSON.stringify(data.productDelete.userErrors)}`,
      );
    }
  }

  verifyWebhook(input: WebhookInput): WebhookVerification {
    const headerValue =
      input.headers["x-shopify-hmac-sha256"] ??
      input.headers["X-Shopify-Hmac-SHA256"];
    const valid = verifyShopifyHmac(input.rawBody, headerValue);
    return valid ? { valid: true } : { valid: false, error: "HMAC mismatch" };
  }

  handleWebhook(input: WebhookInput): ParsedWebhook {
    const topic =
      input.headers["x-shopify-topic"] ??
      input.headers["X-Shopify-Topic"] ??
      "unknown";
    const externalEventId =
      input.headers["x-shopify-webhook-id"] ??
      input.headers["X-Shopify-Webhook-Id"];
    const payload = JSON.parse(input.rawBody) as Record<string, unknown>;
    return { topic, externalEventId, payload };
  }
}
