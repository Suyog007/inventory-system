"use client";

import { useState } from "react";

const SHOP_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export default function ConnectShopifyForm({
  defaultShop,
}: {
  defaultShop?: string;
}) {
  const [shop, setShop] = useState(defaultShop ?? "");
  const valid = SHOP_RE.test(shop.trim());

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    // Hard navigation to the install route; it redirects to Shopify
    window.location.href = `/api/channels/shopify/install?shop=${encodeURIComponent(
      shop.trim(),
    )}`;
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2 items-center">
      <input
        type="text"
        value={shop}
        onChange={(e) => setShop(e.target.value)}
        placeholder="your-store.myshopify.com"
        className="flex-1 max-w-sm p-2 border border-gray-300 rounded"
      />
      <button
        type="submit"
        disabled={!valid}
        className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        Connect Shopify
      </button>
    </form>
  );
}
