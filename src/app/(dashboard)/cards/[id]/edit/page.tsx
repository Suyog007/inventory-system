import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import EditCardForm from "./edit-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCardPage({ params }: PageProps) {
  const { id } = await params;
  const [card, connections, categories, pricingProfiles] = await Promise.all([
    db.card.findUnique({
      where: { id },
      include: {
        pricingProfile: { include: { rules: true } },
        variants: {
          orderBy: { position: "asc" },
          take: 1,
          include: {
            listings: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" },
              include: { channelConnection: true },
            },
          },
        },
        cardTags: { include: { tag: true } },
        images: { orderBy: { position: "asc" } },
      },
    }),
    db.channelConnection.findMany({
      where: { deletedAt: null },
      orderBy: { installedAt: "asc" },
      select: { id: true, channel: true, shopDomain: true },
    }),
    db.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    db.pricingProfile.findMany({
      where: { deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  if (!card || card.deletedAt) notFound();

  const variant = card.variants[0];
  const activeChannelIds =
    variant?.listings.map((l) => l.channelConnectionId) ?? [];
  const activeListings =
    variant?.listings.map((l) => ({
      channelConnectionId: l.channelConnectionId,
      externalId: l.externalId,
      externalUrl: l.externalUrl,
    })) ?? [];
  const basePrice = Number(variant?.listingPrice.toString() ?? 0);
  // Per-channel adjustment map from the card's pricing profile.
  const priceAdjustments: Record<string, number> = {};
  if (card.pricingProfile) {
    // Map channel-name (enum) → % on the connection ID for the sidebar.
    const byChannel = new Map(
      card.pricingProfile.rules.map((r) => [r.channel, r.priceAdjustPercent]),
    );
    for (const conn of connections) {
      priceAdjustments[conn.id] = byChannel.get(conn.channel) ?? 0;
    }
  }
  // Marketplace overrides are per-Listing but this card's Listings are kept in
  // sync by syncListings(). Read the first Listing as the source of truth for
  // the shared UI.
  const marketplaceSource = variant?.listings[0];

  const defaults = {
    vendor: card.vendor ?? "",
    manufacturer: card.manufacturer ?? "",
    categoryId: card.categoryId ?? "",
    player: card.player ?? "",
    setName: card.setName ?? "",
    year: card.year ?? "",
    cardNumber: card.cardNumber ?? "",
    variantName: card.variantName ?? "",
    grader: card.grader ?? "",
    grade: card.grade?.toString() ?? "",
    certNumber: card.certNumber ?? "",
    autographAuthentication: card.autographAuthentication ?? "",
    autographGrade: card.autographGrade?.toString() ?? "",
    population: card.population?.toString() ?? "",
    populationHigher: card.populationHigher?.toString() ?? "",
    rarity: card.rarity ?? "",
    tcgplayerId: card.tcgplayerId ?? "",
    game: card.game ?? "",
    sport: card.sport ?? "",
    league: card.league ?? "",
    team: card.team ?? "",
    condition: card.condition ?? "",
    tags: card.cardTags.map((ct) => ct.tag.name).join(", "),
    imageUrls: card.images.map((img) => img.url).join("\n"),
    sku: variant?.sku ?? "",
    quantity: variant?.quantity ?? 0,
    listingPrice: variant?.listingPrice.toString() ?? "",
    purchaseDate: variant?.purchaseDate
      ? variant.purchaseDate.toISOString().slice(0, 10)
      : "",
    purchasedFrom: variant?.purchasedFrom ?? "",
    itemCost: variant?.itemCost?.toString() ?? "",
    useTitleTemplate: marketplaceSource?.useTitleTemplate ?? true,
    useDescriptionTemplate: marketplaceSource?.useDescriptionTemplate ?? true,
    // Fall back to Card.title/descriptionHtml when there's no explicit override
    // yet so unchecking "Use template" starts with the current value.
    titleOverride: marketplaceSource?.titleOverride ?? card.title,
    descriptionHtmlOverride:
      marketplaceSource?.descriptionHtmlOverride ?? card.descriptionHtml ?? "",
  };

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <Link href={`/cards/${id}`} className="text-sm text-gray-600 hover:underline">
          ← Back to card
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit card</h1>
        <p className="text-sm text-gray-500 mt-1">
          Changes save immediately and sync to checked channels in the background.
        </p>
      </div>

      <EditCardForm
        cardId={card.id}
        channels={connections}
        categories={categories}
        pricingProfiles={pricingProfiles}
        activeChannelIds={activeChannelIds}
        activeListings={activeListings}
        basePrice={basePrice}
        priceAdjustments={priceAdjustments}
        defaults={{ ...defaults, pricingProfileId: card.pricingProfileId ?? "" }}
      />
    </div>
  );
}
