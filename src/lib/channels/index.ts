// Channel adapter factory: given a ChannelConnection row, returns the
// concrete ChannelAdapter for that channel.
//
// Every new channel (eBay, TikTok, Whatnot, ...) registers here.

import type { Channel } from "@prisma/client";
import { decryptToken } from "@/lib/crypto";
import { ShopifyAdapter } from "@/lib/channels/shopify/adapter";
import type { ChannelAdapter } from "@/lib/channels/_adapter";

export interface ChannelConnectionLike {
  id: string;
  channel: Channel;
  shopDomain: string | null;
  accessToken: string; // encrypted
}

export function getAdapterForConnection(
  connection: ChannelConnectionLike,
): ChannelAdapter {
  const token = decryptToken(connection.accessToken);
  switch (connection.channel) {
    case "SHOPIFY": {
      if (!connection.shopDomain) {
        throw new Error("Shopify connection has no shopDomain");
      }
      return new ShopifyAdapter(connection.shopDomain, token);
    }
    default:
      throw new Error(`No adapter implemented for channel: ${connection.channel}`);
  }
}
