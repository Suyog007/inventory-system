// Shopify Admin GraphQL mutations used by the outbox worker.

export const PRODUCT_CREATE = /* GraphQL */ `
  mutation ProductCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        onlineStoreUrl
        variants(first: 1) {
          nodes {
            id
            sku
            price
            inventoryItem {
              id
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const PRODUCT_UPDATE = /* GraphQL */ `
  mutation ProductUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        onlineStoreUrl
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const PRODUCT_VARIANTS_BULK_UPDATE = /* GraphQL */ `
  mutation ProductVariantsBulkUpdate(
    $productId: ID!
    $variants: [ProductVariantsBulkInput!]!
  ) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants {
        id
        sku
        price
        inventoryItem {
          id
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const PRODUCT_DELETE = /* GraphQL */ `
  mutation ProductDelete($input: ProductDeleteInput!) {
    productDelete(input: $input) {
      deletedProductId
      userErrors {
        field
        message
      }
    }
  }
`;

// Activates an inventory item at a location. Required for newly-created
// variants before inventorySetQuantities will actually take effect.
// Shopify requires @idempotent on the field (not the mutation); arg is `key`.
export const INVENTORY_ACTIVATE = /* GraphQL */ `
  mutation InventoryActivate(
    $inventoryItemId: ID!
    $locationId: ID!
    $idempotencyKey: String!
  ) {
    inventoryActivate(
      inventoryItemId: $inventoryItemId
      locationId: $locationId
    ) @idempotent(key: $idempotencyKey) {
      inventoryLevel {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Adjusts inventory by a delta (positive or negative). In newer API versions
// each change requires changeFromQuantity for race protection, and the field
// requires @idempotent. We pass the queried current as both reference and key.
export const INVENTORY_ADJUST_QUANTITIES = /* GraphQL */ `
  mutation InventoryAdjustQuantities(
    $input: InventoryAdjustQuantitiesInput!
    $idempotencyKey: String!
  ) {
    inventoryAdjustQuantities(input: $input) @idempotent(key: $idempotencyKey) {
      userErrors {
        field
        message
      }
    }
  }
`;

// Publishes a publishable resource (product) to a set of channel publications.
// Needed after productCreate; Shopify products default to no channels.
export const PUBLISHABLE_PUBLISH = /* GraphQL */ `
  mutation PublishablePublish($id: ID!, $input: [PublicationInput!]!) {
    publishablePublish(id: $id, input: $input) {
      userErrors {
        field
        message
      }
    }
  }
`;

// Attaches media (images) to a product by URL.
// Shopify fetches each URL asynchronously and hosts a copy on their CDN.
export const PRODUCT_CREATE_MEDIA = /* GraphQL */ `
  mutation ProductCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
    productCreateMedia(productId: $productId, media: $media) {
      media {
        ... on MediaImage {
          id
        }
      }
      mediaUserErrors {
        field
        message
        code
      }
    }
  }
`;

// Creates a webhook subscription. Shopify will POST to callbackUrl when the
// topic fires (e.g. PRODUCTS_DELETE, ORDERS_CREATE).
export const WEBHOOK_SUBSCRIPTION_CREATE = /* GraphQL */ `
  mutation WebhookSubscriptionCreate(
    $topic: WebhookSubscriptionTopic!
    $webhookSubscription: WebhookSubscriptionInput!
  ) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
      webhookSubscription {
        id
        topic
        endpoint {
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Removes a webhook subscription (used to clean up stale registrations).
export const WEBHOOK_SUBSCRIPTION_DELETE = /* GraphQL */ `
  mutation WebhookSubscriptionDelete($id: ID!) {
    webhookSubscriptionDelete(id: $id) {
      deletedWebhookSubscriptionId
      userErrors {
        field
        message
      }
    }
  }
`;

// Stages a file upload to Shopify's CDN (Google Cloud Storage under the hood).
// Returns a target URL + parameters for a multipart POST + a resourceUrl that
// can later be passed to productCreateMedia.
export const STAGED_UPLOADS_CREATE = /* GraphQL */ `
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Deletes media from a product. Used on UPDATE before re-adding current images
// (simpler than diffing; small media counts make this acceptable).
export const PRODUCT_DELETE_MEDIA = /* GraphQL */ `
  mutation ProductDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
    productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
      deletedMediaIds
      mediaUserErrors {
        field
        message
        code
      }
    }
  }
`;
