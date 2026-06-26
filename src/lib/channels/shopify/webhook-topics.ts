// Topics we subscribe to on install.
//
// Two representations of the same set:
//   - REST_TOPICS: the X-Shopify-Topic header value sent by Shopify on webhook delivery
//     (e.g. "products/delete"). Our handler dispatches on this string.
//   - GRAPHQL_TOPICS: the enum name in WebhookSubscriptionTopic used by
//     webhookSubscriptionCreate (e.g. "PRODUCTS_DELETE").

export const SHOPIFY_WEBHOOK_TOPICS = [
  "products/create",
  "products/update",
  "products/delete",
  "orders/create",
  "inventory_levels/update",
] as const;

export type ShopifyWebhookTopic = (typeof SHOPIFY_WEBHOOK_TOPICS)[number];

/**
 * Map REST-style topic ("products/delete") to GraphQL enum name ("PRODUCTS_DELETE").
 */
export function topicToGraphqlEnum(topic: ShopifyWebhookTopic): string {
  return topic.toUpperCase().replace(/\//g, "_");
}

export const SHOPIFY_WEBHOOK_TOPICS_GQL: string[] = SHOPIFY_WEBHOOK_TOPICS.map(
  topicToGraphqlEnum,
);
