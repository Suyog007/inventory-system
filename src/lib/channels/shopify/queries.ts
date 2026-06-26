// GraphQL strings for Shopify Admin API.

// Returns the shop's primary location ID + the Online Store publication ID.
// We query these once on first push and cache in ChannelConnection.metadata.
export const SHOP_CONFIG_QUERY = /* GraphQL */ `
  query ShopConfig {
    locations(first: 1) {
      nodes {
        id
        name
      }
    }
    publications(first: 20) {
      nodes {
        id
        name
      }
    }
  }
`;

// Returns all webhook subscriptions configured on the shop. Used to find
// stale registrations (e.g. pointing at an old tunnel URL) before re-creating.
export const WEBHOOK_SUBSCRIPTIONS_QUERY = /* GraphQL */ `
  query WebhookSubscriptions {
    webhookSubscriptions(first: 50) {
      nodes {
        id
        topic
        endpoint {
          ... on WebhookHttpEndpoint {
            callbackUrl
          }
        }
      }
    }
  }
`;

// Returns the existing media IDs on a product. Used before replacing on UPDATE.
export const PRODUCT_MEDIA_QUERY = /* GraphQL */ `
  query ProductMedia($id: ID!) {
    product(id: $id) {
      media(first: 50) {
        nodes {
          id
        }
      }
    }
  }
`;

// Returns the current "available" quantity for an inventory item at a location.
// Used before inventoryAdjustQuantities to compute delta.
export const INVENTORY_LEVEL_QUERY = /* GraphQL */ `
  query InventoryLevel($inventoryItemId: ID!, $locationId: ID!) {
    inventoryItem(id: $inventoryItemId) {
      inventoryLevel(locationId: $locationId) {
        quantities(names: ["available"]) {
          name
          quantity
        }
      }
    }
  }
`;

export const PRODUCTS_QUERY = /* GraphQL */ `
  query Products($cursor: String, $query: String) {
    products(first: 50, after: $cursor, query: $query) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        descriptionHtml
        vendor
        productType
        tags
        status
        updatedAt
        onlineStoreUrl
        category {
          id
        }
        variants(first: 25) {
          nodes {
            id
            sku
            price
            compareAtPrice
            inventoryQuantity
            title
          }
        }
        images(first: 10) {
          nodes {
            id
            url
            altText
          }
        }
      }
    }
  }
`;
