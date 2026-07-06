import { db } from "@/lib/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Channel } from "@prisma/client";
import {
  DollarSign,
  Percent,
  Handshake,
  Trash2,
  Sparkles,
  Info,
} from "lucide-react";
import MinOfferForm from "./min-offer-form";
import RulesForm from "./rules-form";
import NewProfileForm from "./new-profile-form";
import { deleteProfile } from "./actions";
import { Alert, Badge, PageHeader, SectionCard } from "@/lib/ui";

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
      <Alert variant="warning" icon={Info}>
        No pricing profiles yet. Run <code>npm run db:seed</code> to bootstrap
        the default profile.
      </Alert>
    );
  }

  const activeProfileId =
    params.profile ?? profiles.find((p) => p.isDefault)?.id ?? profiles[0].id;
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
      <PageHeader
        icon={DollarSign}
        title="Pricing"
        subtitle="Per-channel pricing rules and named profiles applied at push time."
      />

      <SectionCard>
        <div className="flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Pricing profiles</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Each card is assigned one profile. Editing a profile updates every
          card using it on next save.
        </p>
        <div className="flex flex-wrap gap-2 mb-6">
          {profiles.map((p) => {
            const isActive = p.id === activeProfileId;
            return (
              <a
                key={p.id}
                href={`/settings/pricing?profile=${p.id}`}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition-all ${
                  isActive
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-transparent shadow-md shadow-blue-500/20"
                    : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {p.isDefault && (
                  <Sparkles
                    className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-amber-500"}`}
                  />
                )}
                {p.name}
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {p._count.cards}
                </span>
              </a>
            );
          })}
        </div>
        <div className="border-t border-gray-100 pt-4">
          <NewProfileForm profiles={profiles} />
        </div>
      </SectionCard>

      <SectionCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Handshake className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">
              Global minimum offer default
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Sets a floor for buyer offers as a % of Listing Price. Consumed by
              channels that support offers (eBay etc.). Shopify ignores this.
            </p>
          </div>
          <Badge variant="indigo" icon={Sparkles}>
            {activeProfile.name}
          </Badge>
        </div>
        <MinOfferForm
          profileId={activeProfile.id}
          defaultEnabled={activeProfile.minOfferEnabled}
          defaultPercent={activeProfile.minOfferPercent}
        />
      </SectionCard>

      <SectionCard>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Custom pricing</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Adjust per-channel prices as a % of the card&apos;s Listing Price.
              A card&apos;s Shopify price becomes{" "}
              <code>listingPrice × (1 + Shopify%)</code>.
            </p>
          </div>
          <Badge variant="indigo" icon={Sparkles}>
            {activeProfile.name}
          </Badge>
        </div>
        <RulesForm
          profileId={activeProfile.id}
          defaults={ruleDefaults}
          connectedChannels={connectedChannels}
        />
      </SectionCard>

      {!activeProfile.isDefault && (
        <SectionCard className="border-rose-200 bg-rose-50/30">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-rose-900">Danger zone</h2>
              <p className="text-xs text-rose-700 mt-1 mb-3">
                Deleting this profile detaches every card using it. Those cards
                fall back to 0% rules until reassigned.
              </p>
              <form action={deleteProfile.bind(null, activeProfile.id)}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 text-sm text-rose-700 hover:text-rose-800 font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete &ldquo;{activeProfile.name}&rdquo;
                </button>
              </form>
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
