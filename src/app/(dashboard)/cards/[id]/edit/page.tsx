import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import EditCardForm from "./edit-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCardPage({ params }: PageProps) {
  const { id } = await params;
  const card = await db.card.findUnique({
    where: { id },
    include: {
      variants: {
        orderBy: { position: "asc" },
        take: 1,
        include: {
          listings: { where: { deletedAt: null }, take: 1, orderBy: { createdAt: "asc" } },
        },
      },
      cardTags: { include: { tag: true } },
      images: { orderBy: { position: "asc" } },
    },
  });

  if (!card || card.deletedAt) notFound();

  const variant = card.variants[0];
  const listing = variant?.listings[0];

  const defaults = {
    title: card.title,
    descriptionHtml: card.descriptionHtml ?? "",
    vendor: card.vendor ?? "",
    productType: card.productType ?? "",
    shopifyCategoryId: card.shopifyCategoryId ?? "",
    status: card.status,
    player: card.player ?? "",
    setName: card.setName ?? "",
    year: card.year ?? "",
    cardNumber: card.cardNumber ?? "",
    variantName: card.variantName ?? "",
    grader: card.grader ?? "",
    grade: card.grade?.toString() ?? "",
    certNumber: card.certNumber ?? "",
    sport: card.sport ?? "",
    league: card.league ?? "",
    team: card.team ?? "",
    condition: card.condition ?? "",
    tags: card.cardTags.map((ct) => ct.tag.name).join(", "),
    imageUrls: card.images.map((img) => img.url).join("\n"),
    sku: variant?.sku ?? "",
    quantity: variant?.quantity ?? 0,
    price: listing?.price.toString() ?? "",
  };

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href={`/cards/${id}`} className="text-sm text-gray-600 hover:underline">
          ← Back to card
        </Link>
        <h1 className="text-2xl font-bold mt-2">Edit card</h1>
        <p className="text-sm text-gray-500 mt-1">
          Changes save to your DB immediately and sync to Shopify in the background.
        </p>
      </div>

      <EditCardForm cardId={card.id} defaults={defaults} />
    </div>
  );
}
