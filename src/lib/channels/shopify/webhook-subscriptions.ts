// Registers Shopify webhook subscriptions for our app's topics.
//
// Idempotent strategy: query existing subscriptions for our topics, delete any
// that don't match the current callback URL, then create new ones. Safe to
// call repeatedly (e.g. after a tunnel URL change).

import type { ShopifyClient } from "./client";
import { WEBHOOK_SUBSCRIPTIONS_QUERY } from "./queries";
import {
  WEBHOOK_SUBSCRIPTION_CREATE,
  WEBHOOK_SUBSCRIPTION_DELETE,
} from "./mutations";
import {
  SHOPIFY_WEBHOOK_TOPICS,
  topicToGraphqlEnum,
} from "./webhook-topics";

export interface WebhookRegistrationResult {
  callbackUrl: string;
  registered: string[];
  removed: string[];
  errors: string[];
}

export async function registerShopifyWebhooks(
  client: ShopifyClient,
  callbackUrl: string,
): Promise<WebhookRegistrationResult> {
  const result: WebhookRegistrationResult = {
    callbackUrl,
    registered: [],
    removed: [],
    errors: [],
  };

  // Shopify requires HTTPS for webhook callbacks. Fail-fast in dev with a clear message.
  if (!callbackUrl.startsWith("https://")) {
    result.errors.push(
      `Webhook callback URL must be HTTPS (got: ${callbackUrl}). Set WEBHOOK_BASE_URL to your tunnel URL.`,
    );
    return result;
  }

  // 1. Fetch existing subscriptions
  const existing = await client.graphql<{
    webhookSubscriptions: {
      nodes: Array<{
        id: string;
        topic: string;
        endpoint: { callbackUrl?: string } | null;
      }>;
    };
  }>(WEBHOOK_SUBSCRIPTIONS_QUERY);

  const ourGqlTopics = new Set(SHOPIFY_WEBHOOK_TOPICS.map(topicToGraphqlEnum));

  // 2. Delete stale subscriptions for OUR topics (wrong URL or duplicates)
  const toDelete: Array<{ id: string; topic: string }> = [];
  const keptByTopic = new Map<string, string>(); // topic -> existing subscription id we keep
  for (const sub of existing.webhookSubscriptions.nodes) {
    if (!ourGqlTopics.has(sub.topic)) continue;
    const currentUrl = sub.endpoint?.callbackUrl;
    if (currentUrl === callbackUrl && !keptByTopic.has(sub.topic)) {
      keptByTopic.set(sub.topic, sub.id); // already pointing at us, keep it
    } else {
      toDelete.push({ id: sub.id, topic: sub.topic });
    }
  }
  for (const d of toDelete) {
    try {
      await client.graphql(WEBHOOK_SUBSCRIPTION_DELETE, { id: d.id });
      result.removed.push(d.topic);
    } catch (err) {
      result.errors.push(
        `delete ${d.topic}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 3. Create any missing subscriptions
  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    const gqlTopic = topicToGraphqlEnum(topic);
    if (keptByTopic.has(gqlTopic)) {
      result.registered.push(topic); // already in place
      continue;
    }
    try {
      const created = await client.graphql<{
        webhookSubscriptionCreate: {
          webhookSubscription: { id: string } | null;
          userErrors: Array<{ field: string[]; message: string }>;
        };
      }>(WEBHOOK_SUBSCRIPTION_CREATE, {
        topic: gqlTopic,
        webhookSubscription: { callbackUrl, format: "JSON" },
      });
      if (created.webhookSubscriptionCreate.userErrors.length) {
        result.errors.push(
          `create ${topic}: ${JSON.stringify(created.webhookSubscriptionCreate.userErrors)}`,
        );
      } else if (created.webhookSubscriptionCreate.webhookSubscription) {
        result.registered.push(topic);
      }
    } catch (err) {
      result.errors.push(
        `create ${topic}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
