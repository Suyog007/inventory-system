import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Channel } from "@prisma/client";
import MinOfferForm from "./min-offer-form";
import RulesForm from "./rules-form";
import NewProfileForm from "./new-profile-form";
import { deleteProfile } from "./actions";

interface PageProps {
  searchParams: Promise<{ profile?: string }>;
}

export default async function PricingPage({ searchParams }: PageProps) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const params = await searchParams;

  const [profiles, connections] = await Promise.all([
    db.pricingProfile.findMany({
      where: { deletedAt: null },
      include: { rules: true, _count: { select: { cards: true } } },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    }),
    db.channelConnection.findMany({
      where: {
        deletedAt: null,
        NOT: { shopDomain: { startsWith: "test-" } },
      },
      select: { channel: true },
    }),
  ]);

  if (profiles.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 p-4 rounded">
        No pricing profiles yet. Run <code>npm run db:seed</code> to bootstrap
        the default profile.
      </div>
    );
  }

  const activeProfileId =
    params.profile ??
    profiles.find((p) => p.isDefault)?.id ??
    profiles[0].id;
  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) ?? profiles[0];

  const ruleDefaults: Record<string, number> = {};
  for (const channel of Object.values(Channel)) ruleDefaults[channel] = 0;
  for (const r of activeProfile.rules) {
    ruleDefaults[r.channel] = r.priceAdjustPercent;
  }

  const connectedChannels = [...new Set(connections.map((c) => c.channel))];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Pricing</h1>
        <p className="text-gray-600 mt-1">
          Rules apply at push time. Change a profile and every card assigned to
          it recomputes on next update.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">Pricing profiles</h2>
            <p className="text-xs text-gray-500 mt-1">
              Each card is assigned one profile. Editing a profile updates every
              card using it on next save.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-6">
          {profiles.map((p) => {
            const isActive = p.id === activeProfileId;
            return (
              <a
                key={p.id}
                href={`/settings/pricing?profile=${p.id}`}
                className={`px-3 py-1.5 rounded text-sm font-medium border transition ${
                  isActive
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-300 hover:bg-gray-50"
                }`}
              >
                {p.name}
                {p.isDefault && (
                  <span className="ml-2 text-xs opacity-70">(default)</span>
                )}
                <span className="ml-2 text-xs opacity-70">
                  · {p._count.cards} card{p._count.cards === 1 ? "" : "s"}
                </span>
              </a>
            );
          })}
        </div>

        <div className="border-t border-gray-100 pt-4">
          <NewProfileForm profiles={profiles} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold mb-1">
          Global Minimum Offer Default — {activeProfile.name}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Sets a floor for buyer offers as a % of Listing Price. Consumed by
          channels that support offers (eBay etc.). Shopify ignores this today.
        </p>
        <MinOfferForm
          profileId={activeProfile.id}
          defaultEnabled={activeProfile.minOfferEnabled}
          defaultPercent={activeProfile.minOfferPercent}
        />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold mb-1">
          Custom Pricing — {activeProfile.name}
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Adjust per-channel prices as a % of the card&apos;s Listing Price. A
          card&apos;s Shopify price becomes{" "}
          <code>listingPrice × (1 + Shopify%)</code>.
        </p>
        <RulesForm
          profileId={activeProfile.id}
          defaults={ruleDefaults}
          connectedChannels={connectedChannels}
        />
      </div>

      {!activeProfile.isDefault && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-3 text-red-700">Danger zone</h2>
          <form action={deleteProfile.bind(null, activeProfile.id)}>
            <button
              type="submit"
              className="text-red-600 hover:underline text-sm"
            >
              Delete profile &ldquo;{activeProfile.name}&rdquo;
            </button>
            <p className="text-xs text-gray-500 mt-1">
              Cards assigned to this profile keep their reference and will fall
              back to 0% rules until reassigned.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}
