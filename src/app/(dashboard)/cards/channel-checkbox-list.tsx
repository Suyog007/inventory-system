"use client";

import { useState } from "react";
import { formatPrice } from "@/lib/format";

interface Channel {
  id: string;
  channel: string;
  shopDomain: string | null;
}

interface ActiveListingInfo {
  channelConnectionId: string;
  externalId: string;
  externalUrl: string | null;
}

interface Props {
  channels: Channel[];
  defaultSelectedIds?: string[];
  basePrice?: number;
  // (channelConnectionId → % adjustment) — Phase 4 will populate this from the
  // card's pricing profile. Phase 3 renders every channel at 0% (base price).
  priceAdjustments?: Record<string, number>;
  activeListings?: ActiveListingInfo[];
}

// Sales Channels sidebar: checkbox per channel, per-channel price preview,
// "View Listing" links for channels that already have this card live.
export default function ChannelCheckboxList({
  channels,
  defaultSelectedIds = [],
  basePrice = 0,
  priceAdjustments = {},
  activeListings = [],
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(defaultSelectedIds),
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(channels.map((c) => c.id)));
  }

  function selectNone() {
    setSelected(new Set());
  }

  const activeByChannel = new Map(
    activeListings.map((l) => [l.channelConnectionId, l]),
  );

  function priceFor(channelId: string): number {
    const pct = priceAdjustments[channelId] ?? 0;
    return basePrice * (1 + pct / 100);
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 sticky top-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Sales channels</h2>
        <div className="flex gap-3 text-xs">
          <button
            type="button"
            onClick={selectAll}
            className="text-blue-600 hover:underline"
          >
            List to all
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="text-gray-600 hover:underline"
          >
            Clear
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-3">
        Uncheck all to keep this card in inventory without publishing anywhere.
      </p>

      {channels.length === 0 ? (
        <p className="text-sm text-gray-500">
          No channels connected yet. Add one in Settings → Channels.
        </p>
      ) : (
        <div className="space-y-2">
          {channels.map((c) => {
            const active = activeByChannel.get(c.id);
            const checked = selected.has(c.id);
            return (
              <label
                key={c.id}
                className={`block p-3 border rounded cursor-pointer transition ${
                  checked
                    ? "border-blue-300 bg-blue-50"
                    : "border-gray-200 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.id)}
                    className="w-4 h-4 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{c.channel}</span>
                      <span className="text-xs text-gray-700 font-medium">
                        {checked ? (
                          <>List for {formatPrice(priceFor(c.id))}</>
                        ) : (
                          <span className="text-gray-400">not listed</span>
                        )}
                      </span>
                    </div>
                    {c.shopDomain && (
                      <div className="text-xs text-gray-500 font-mono truncate">
                        {c.shopDomain}
                      </div>
                    )}
                    {active && (
                      <div className="mt-1 flex items-center gap-2 text-xs">
                        <code className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-mono">
                          {shortExternalId(active.externalId)}
                        </code>
                        {active.externalUrl && (
                          <a
                            href={active.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View listing ↗
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      <input
        type="hidden"
        name="channelConnectionIds"
        value={[...selected].join(",")}
      />
    </div>
  );
}

function shortExternalId(id: string): string {
  // Trim Shopify GIDs like "gid://shopify/ProductVariant/127343143" to the last segment
  const last = id.split("/").pop() ?? id;
  return last.length > 24 ? `${last.slice(0, 20)}…` : last;
}
