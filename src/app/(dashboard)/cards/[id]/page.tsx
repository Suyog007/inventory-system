import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LISTING_STATUS_STYLES,
  formatGraderGrade,
  formatPrice,
} from "@/lib/format";
import DeleteCardButton from "./delete-button";
import {
  ArrowLeft,
  Pencil,
  ImageIcon,
  Award,
  Package,
  Radio,
  ExternalLink,
  Tags,
  DollarSign,
  Info,
} from "lucide-react";
import {
  Badge,
  ChannelPill,
  SectionCard,
  buttonClass,
} from "@/lib/ui";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

type Tab = "details" | "listings" | "variants";

export default async function CardDetailPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const search = await searchParams;
  const tab: Tab = (search.tab === "listings" || search.tab === "variants"
    ? search.tab
    : "details") as Tab;

  const card = await db.card.findUnique({
    where: { id },
    include: {
      category: true,
      pricingProfile: true,
      images: { orderBy: { position: "asc" } },
      variants: {
        where: { deletedAt: null },
        orderBy: { position: "asc" },
        include: {
          listings: {
            where: { deletedAt: null },
            include: { channelConnection: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      cardTags: { include: { tag: true } },
    },
  });

  if (!card || card.deletedAt) notFound();

  const hero = card.images[0];
  const variant = card.variants[0];
  const listings = card.variants.flatMap((v) => v.listings);
  const listingsCount = listings.length;

  const detailsFields: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Player", value: card.player },
    { label: "Set", value: card.setName },
    { label: "Year", value: card.year },
    { label: "Card #", value: card.cardNumber },
    { label: "Parallel / Variety", value: card.variantName },
    { label: "Manufacturer", value: card.manufacturer },
    { label: "Vendor (Shopify)", value: card.vendor },
    { label: "Grader", value: card.grader },
    { label: "Grade", value: card.grade?.toString() },
    { label: "Cert #", value: card.certNumber },
    { label: "Autograph Auth.", value: card.autographAuthentication },
    { label: "Autograph Grade", value: card.autographGrade?.toString() },
    { label: "Population", value: card.population },
    { label: "Population Higher", value: card.populationHigher },
    { label: "Game (TCG)", value: card.game },
    { label: "Rarity (TCG)", value: card.rarity },
    { label: "TCGplayer ID", value: card.tcgplayerId },
    { label: "Sport", value: card.sport },
    { label: "League", value: card.league },
    { label: "Team", value: card.team },
    { label: "Condition", value: card.condition },
  ];

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div>
        <Link
          href="/cards"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to cards
        </Link>
        <div className="flex items-start justify-between mt-3 gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 leading-tight">
              {card.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {card.category && (
                <Badge variant="purple" icon={Tags}>
                  {card.category.name}
                </Badge>
              )}
              {card.grader && card.grade && (
                <Badge variant="info" icon={Award}>
                  {formatGraderGrade(card.grader, card.grade)}
                </Badge>
              )}
              {card.pricingProfile && (
                <Badge variant="indigo" icon={DollarSign}>
                  {card.pricingProfile.name}
                </Badge>
              )}
              {listingsCount > 0 ? (
                <Badge variant="success" icon={Radio}>
                  Live on {listingsCount} channel
                  {listingsCount === 1 ? "" : "s"}
                </Badge>
              ) : (
                <Badge variant="neutral">Inventory only</Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link href={`/cards/${card.id}/edit`} className={buttonClass("primary")}>
              <Pencil className="w-4 h-4" />
              Edit
            </Link>
            <DeleteCardButton cardId={card.id} />
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — image + quick stats */}
        <div className="space-y-6">
          <SectionCard padding="p-4">
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 relative">
              {hero ? (
                <Image
                  src={hero.url}
                  alt={hero.altText ?? card.title}
                  fill
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2">
                  <ImageIcon className="w-10 h-10" />
                  <span className="text-xs">No image</span>
                </div>
              )}
            </div>
            {card.images.length > 1 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {card.images.slice(1, 6).map((img) => (
                  <div
                    key={img.id}
                    className="aspect-square rounded-lg overflow-hidden bg-gray-100 relative"
                  >
                    <Image
                      src={img.url}
                      alt={img.altText ?? ""}
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Snapshot">
            <dl className="space-y-3 text-sm">
              <QuickStat
                label="Listing price"
                value={formatPrice(variant?.listingPrice)}
                tone="emerald"
              />
              <QuickStat
                label="Item cost"
                value={formatPrice(variant?.itemCost)}
                tone="gray"
              />
              <QuickStat
                label="Quantity"
                value={variant?.quantity?.toString() ?? "—"}
                tone="gray"
              />
              <QuickStat
                label="SKU"
                value={variant?.sku ?? "—"}
                tone="gray"
                mono
              />
              {card.certNumber && (
                <QuickStat
                  label="Cert #"
                  value={card.certNumber}
                  tone="blue"
                  mono
                />
              )}
            </dl>
          </SectionCard>

          {card.cardTags.length > 0 && (
            <SectionCard title="Tags">
              <div className="flex flex-wrap gap-1">
                {card.cardTags.map((ct) => (
                  <Badge key={ct.tagId} variant="neutral">
                    {ct.tag.name}
                  </Badge>
                ))}
              </div>
            </SectionCard>
          )}
        </div>

        {/* RIGHT — tabbed content */}
        <div className="lg:col-span-2 space-y-6">
          <TabBar cardId={card.id} active={tab} listingsCount={listingsCount} />

          {tab === "details" && (
            <>
              <SectionCard title="Card details">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {detailsFields.map((f) => (
                    <div key={f.label}>
                      <dt className="text-gray-500 text-xs uppercase tracking-wider font-medium">
                        {f.label}
                      </dt>
                      <dd className="mt-0.5 text-gray-900">
                        {f.value || <span className="text-gray-300">—</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </SectionCard>

              {card.descriptionHtml && (
                <SectionCard title="Description">
                  <div
                    className="prose prose-sm max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{ __html: card.descriptionHtml }}
                  />
                </SectionCard>
              )}
            </>
          )}

          {tab === "listings" && (
            <SectionCard title="Listings by channel">
              {listings.length === 0 ? (
                <div className="text-center py-8">
                  <div className="mx-auto w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
                    <Radio className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    Not listed anywhere
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    This card is in your inventory only. Edit and check a
                    channel to publish.
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {listings.map((l) => (
                    <div
                      key={l.id}
                      className="py-4 first:pt-0 last:pb-0 flex items-center gap-4"
                    >
                      <ChannelPill channel={l.channelConnection.channel} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${LISTING_STATUS_STYLES[l.status]}`}
                          >
                            {l.status}
                          </span>
                          <span className="font-semibold text-gray-900">
                            {formatPrice(l.price)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Last synced{" "}
                          {new Date(l.lastSyncedAt).toLocaleString()}
                        </div>
                        {l.externalId &&
                          !l.externalId.startsWith("local-") && (
                            <div className="text-xs font-mono text-gray-400 mt-0.5 truncate">
                              {l.externalId}
                            </div>
                          )}
                      </div>
                      {l.externalUrl && (
                        <a
                          href={l.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium shrink-0"
                        >
                          View
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {tab === "variants" && (
            <SectionCard title="Variants & inventory">
              {card.variants.length === 0 ? (
                <p className="text-sm text-gray-500">No variants.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-gray-500 uppercase tracking-wider">
                      <tr>
                        <th className="px-2 py-2 font-semibold">Name</th>
                        <th className="px-2 py-2 font-semibold">SKU</th>
                        <th className="px-2 py-2 font-semibold">Qty</th>
                        <th className="px-2 py-2 font-semibold">List price</th>
                        <th className="px-2 py-2 font-semibold">Cost</th>
                        <th className="px-2 py-2 font-semibold">Purchased</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {card.variants.map((v) => (
                        <tr key={v.id}>
                          <td className="px-2 py-3">
                            <span className="font-medium text-gray-900">
                              {v.name}
                            </span>
                          </td>
                          <td className="px-2 py-3 font-mono text-xs text-gray-700">
                            {v.sku ?? "—"}
                          </td>
                          <td className="px-2 py-3">
                            <Badge
                              variant={
                                v.quantity > 0 ? "success" : "neutral"
                              }
                            >
                              {v.quantity}
                            </Badge>
                          </td>
                          <td className="px-2 py-3 font-semibold text-gray-900">
                            {formatPrice(v.listingPrice)}
                          </td>
                          <td className="px-2 py-3 text-gray-700">
                            {formatPrice(v.itemCost)}
                          </td>
                          <td className="px-2 py-3 text-xs text-gray-600">
                            {v.purchaseDate ? (
                              <div>
                                {new Date(v.purchaseDate).toLocaleDateString()}
                                {v.purchasedFrom && (
                                  <div className="text-gray-500">
                                    {v.purchasedFrom}
                                  </div>
                                )}
                              </div>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────

function TabBar({
  cardId,
  active,
  listingsCount,
}: {
  cardId: string;
  active: Tab;
  listingsCount: number;
}) {
  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType; badge?: string }> = [
    { id: "details", label: "Details", icon: Info },
    {
      id: "listings",
      label: "Listings",
      icon: Radio,
      badge: listingsCount > 0 ? listingsCount.toString() : undefined,
    },
    { id: "variants", label: "Variants", icon: Package },
  ];
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-1 inline-flex">
      {tabs.map((t) => {
        const isActive = active === t.id;
        const Icon = t.icon;
        return (
          <Link
            key={t.id}
            href={`/cards/${cardId}?tab=${t.id}`}
            scroll={false}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? "bg-gray-900 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon className="w-4 h-4" />
            {t.label}
            {t.badge && (
              <span
                className={`ml-0.5 px-1.5 py-0.5 rounded text-xs font-semibold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-gray-200 text-gray-700"
                }`}
              >
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

function QuickStat({
  label,
  value,
  tone,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  tone: "emerald" | "gray" | "blue";
  mono?: boolean;
}) {
  const toneClasses = {
    emerald: "text-emerald-700",
    gray: "text-gray-900",
    blue: "text-blue-700",
  };
  return (
    <div className="flex items-center justify-between">
      <dt className="text-gray-500 text-xs">{label}</dt>
      <dd
        className={`font-semibold ${toneClasses[tone]} ${mono ? "font-mono text-xs" : "text-sm"}`}
      >
        {value}
      </dd>
    </div>
  );
}
