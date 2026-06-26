import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  CARD_STATUS_STYLES,
  LISTING_STATUS_STYLES,
  PARSE_SOURCE_STYLES,
  formatGraderGrade,
  formatPrice,
} from "@/lib/format";
import DeleteCardButton from "./delete-button";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CardDetailPage({ params }: PageProps) {
  const { id } = await params;

  const card = await db.card.findUnique({
    where: { id },
    include: {
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

  const fields: Array<{ label: string; value: React.ReactNode }> = [
    { label: "Player", value: card.player },
    { label: "Set", value: card.setName },
    { label: "Year", value: card.year },
    { label: "Card #", value: card.cardNumber },
    { label: "Variant", value: card.variantName },
    {
      label: "Grade",
      value: formatGraderGrade(card.grader, card.grade),
    },
    { label: "Cert #", value: card.certNumber },
    { label: "Sport", value: card.sport },
    { label: "League", value: card.league },
    { label: "Team", value: card.team },
    { label: "Condition", value: card.condition },
    { label: "Vendor", value: card.vendor },
    { label: "Product type", value: card.productType },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Link href="/cards" className="text-sm text-gray-600 hover:underline">
          ← Back to cards
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold">{card.title}</h1>
            <div className="flex gap-2 mt-2">
              <span
                className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${CARD_STATUS_STYLES[card.status]}`}
              >
                {card.status}
              </span>
              <span
                className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${PARSE_SOURCE_STYLES[card.parseSource]}`}
              >
                {card.parseSource}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/cards/${card.id}/edit`}
              className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
            >
              Edit
            </Link>
            <DeleteCardButton cardId={card.id} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: images */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="font-semibold mb-3">Images</h2>
            {card.images.length === 0 ? (
              <p className="text-sm text-gray-500">No images.</p>
            ) : (
              <div className="space-y-3">
                {card.images.map((img) => (
                  <Image
                    key={img.id}
                    src={img.url}
                    alt={img.altText ?? ""}
                    width={400}
                    height={400}
                    className="w-full rounded object-contain bg-gray-50"
                    unoptimized
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: structured fields */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold mb-4">Card details</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {fields.map((f) => (
                <div key={f.label}>
                  <dt className="text-gray-500 text-xs uppercase tracking-wider">
                    {f.label}
                  </dt>
                  <dd className="mt-0.5">{f.value || "—"}</dd>
                </div>
              ))}
            </dl>
            {card.cardTags.length > 0 && (
              <div className="mt-4">
                <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                  Tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {card.cardTags.map((ct) => (
                    <span
                      key={ct.tagId}
                      className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded"
                    >
                      {ct.tag.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {card.descriptionHtml && (
              <details className="mt-4">
                <summary className="text-sm text-gray-600 cursor-pointer">
                  Original description
                </summary>
                <div
                  className="mt-2 prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: card.descriptionHtml }}
                />
              </details>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold mb-4">Variants &amp; inventory</h2>
            {card.variants.length === 0 ? (
              <p className="text-sm text-gray-500">No variants.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">SKU</th>
                    <th className="pb-2">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {card.variants.map((v) => (
                    <tr key={v.id} className="border-t">
                      <td className="py-2">{v.name}</td>
                      <td className="py-2 font-mono text-xs">{v.sku ?? "—"}</td>
                      <td className="py-2">{v.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="font-semibold mb-4">Listings per channel</h2>
            {card.variants.flatMap((v) => v.listings).length === 0 ? (
              <p className="text-sm text-gray-500">Not listed on any channel.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="pb-2">Channel</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Price</th>
                    <th className="pb-2">Last sync</th>
                    <th className="pb-2">Link</th>
                  </tr>
                </thead>
                <tbody>
                  {card.variants.flatMap((v) =>
                    v.listings.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="py-2">{l.channelConnection.channel}</td>
                        <td className="py-2">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${LISTING_STATUS_STYLES[l.status]}`}
                          >
                            {l.status}
                          </span>
                        </td>
                        <td className="py-2">{formatPrice(l.price)}</td>
                        <td className="py-2 text-xs text-gray-500">
                          {new Date(l.lastSyncedAt).toLocaleString()}
                        </td>
                        <td className="py-2">
                          {l.externalUrl && (
                            <a
                              href={l.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline text-xs"
                            >
                              Open ↗
                            </a>
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
