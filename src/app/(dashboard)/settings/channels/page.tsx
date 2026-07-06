import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  Store,
  CheckCircle2,
  Unplug,
  Zap,
  Lock,
} from "lucide-react";
import ConnectShopifyForm from "./connect-shopify-form";
import ImportButton from "./import-button";
import RegisterWebhooksButton from "./register-webhooks-button";
import { disconnectChannel } from "./actions";
import { Alert, Badge, PageHeader, SectionCard } from "@/lib/ui";

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

const UPCOMING_CHANNELS = [
  "eBay",
  "TikTok Shop",
  "Whatnot",
  "Square",
  "Walmart",
  "Loupe",
  "My Card Post",
  "Mascot Network",
  "Mercury",
];

export default async function ChannelsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const successMsg =
    params.connected === "shopify" ? "Shopify connected successfully." : null;
  const errorMsg = params.error
    ? ERROR_MESSAGES[params.error] ?? params.error
    : null;

  const connections = await db.channelConnection.findMany({
    where: {
      deletedAt: null,
      NOT: { shopDomain: { startsWith: "test-" } },
    },
    orderBy: { installedAt: "desc" },
  });

  const shopifyConnection = connections.find((c) => c.channel === "SHOPIFY");
  const defaultShop = process.env.SHOPIFY_STORE;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Store}
        title="Channels"
        subtitle="Marketplaces and storefronts your inventory publishes to."
      />

      {successMsg && (
        <Alert variant="success" icon={CheckCircle2}>
          {successMsg}
        </Alert>
      )}
      {errorMsg && <Alert variant="error">{errorMsg}</Alert>}

      <SectionCard>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Store className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Shopify</h2>
              {shopifyConnection ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  Connected to{" "}
                  <span className="font-mono">
                    {shopifyConnection.shopDomain}
                  </span>{" "}
                  ·{" "}
                  {new Date(shopifyConnection.installedAt).toLocaleDateString()}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-0.5">
                  Not connected — enter your store domain to begin.
                </p>
              )}
            </div>
          </div>
          {shopifyConnection && (
            <Badge variant="success" icon={CheckCircle2}>
              Connected
            </Badge>
          )}
        </div>

        {shopifyConnection ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Catalog import
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Pull all products from Shopify into your local inventory.
                </p>
                <ImportButton connectionId={shopifyConnection.id} />
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mb-2">
                  <Lock className="w-4 h-4 text-blue-500" />
                  Webhook subscriptions
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Real-time product / order / inventory events. Set{" "}
                  <code className="text-[10px]">WEBHOOK_BASE_URL</code> first.
                </p>
                <RegisterWebhooksButton connectionId={shopifyConnection.id} />
              </div>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <form action={disconnectChannel.bind(null, shopifyConnection.id)}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 text-sm text-rose-600 hover:text-rose-700 font-medium"
                >
                  <Unplug className="w-3.5 h-3.5" />
                  Disconnect
                </button>
              </form>
            </div>
          </div>
        ) : (
          <ConnectShopifyForm defaultShop={defaultShop} />
        )}
      </SectionCard>

      <SectionCard title="Other channels">
        <p className="text-sm text-gray-500 mb-4">
          These marketplaces will slot into the same multi-channel flow when
          their adapters are built.
        </p>
        <div className="flex flex-wrap gap-2">
          {UPCOMING_CHANNELS.map((name) => (
            <Badge key={name} variant="neutral">
              {name} · coming soon
            </Badge>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
