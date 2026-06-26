import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import ConnectShopifyForm from "./connect-shopify-form";
import ImportButton from "./import-button";
import { disconnectChannel } from "./actions";

interface PageProps {
  searchParams: Promise<{ connected?: string; error?: string }>;
}

const ERROR_MESSAGES: Record<string, string> = {
  missing_params: "Shopify callback was missing required parameters.",
  state_mismatch:
    "OAuth state did not match. This can happen if the install took too long. Try again.",
  shop_mismatch: "The shop on the callback didn't match the one you started with.",
  invalid_shop: "Invalid Shopify shop domain.",
  token_exchange_failed:
    "Failed to exchange OAuth code for an access token. Check the server logs.",
};

export default async function ChannelsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const successMsg =
    params.connected === "shopify" ? "Shopify connected successfully." : null;
  const errorMsg = params.error ? ERROR_MESSAGES[params.error] ?? params.error : null;

  const connections = await db.channelConnection.findMany({
    where: { deletedAt: null },
    orderBy: { installedAt: "desc" },
  });

  const shopifyConnection = connections.find((c) => c.channel === "SHOPIFY");
  const defaultShop = process.env.SHOPIFY_STORE;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Channels</h1>
        <p className="text-gray-600 mt-1">
          Connect the marketplaces you sell on. Only Shopify is supported in Slice 2.
        </p>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">
          {errorMsg}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Shopify</h2>
            {shopifyConnection ? (
              <p className="text-sm text-gray-500 mt-1">
                Connected to{" "}
                <span className="font-mono">{shopifyConnection.shopDomain}</span> ·
                installed{" "}
                {new Date(shopifyConnection.installedAt).toLocaleDateString()}
              </p>
            ) : (
              <p className="text-sm text-gray-500 mt-1">
                Not connected. Enter your store domain to begin.
              </p>
            )}
          </div>
          {shopifyConnection && (
            <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-700">
              CONNECTED
            </span>
          )}
        </div>

        {shopifyConnection ? (
          <div className="space-y-4">
            <ImportButton connectionId={shopifyConnection.id} />
            <form action={disconnectChannel.bind(null, shopifyConnection.id)}>
              <button
                type="submit"
                className="text-red-600 hover:underline text-sm"
              >
                Disconnect
              </button>
            </form>
          </div>
        ) : (
          <ConnectShopifyForm defaultShop={defaultShop} />
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 opacity-60">
        <h2 className="text-lg font-semibold mb-1">Other channels</h2>
        <p className="text-sm text-gray-500">
          eBay, TikTok Shop, Whatnot, Square, etc. — coming in later slices.
        </p>
      </div>
    </div>
  );
}
