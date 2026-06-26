import { db } from "@/lib/db";
import Link from "next/link";
import NewCardForm from "./new-form";

// Find the most common existing vendor / productType to pre-fill the form.
// Avoids the "vendor defaulted to shop name" surprise.
async function getCommonDefaults() {
  const [vendorRow, typeRow, categoryRow] = await Promise.all([
    db.card.groupBy({
      by: ["vendor"],
      where: { deletedAt: null, vendor: { not: null } },
      _count: { vendor: true },
      orderBy: { _count: { vendor: "desc" } },
      take: 1,
    }),
    db.card.groupBy({
      by: ["productType"],
      where: { deletedAt: null, productType: { not: null } },
      _count: { productType: true },
      orderBy: { _count: { productType: "desc" } },
      take: 1,
    }),
    db.card.groupBy({
      by: ["shopifyCategoryId"],
      where: { deletedAt: null, shopifyCategoryId: { not: null } },
      _count: { shopifyCategoryId: true },
      orderBy: { _count: { shopifyCategoryId: "desc" } },
      take: 1,
    }),
  ]);
  return {
    vendor: vendorRow[0]?.vendor ?? "",
    productType: typeRow[0]?.productType ?? "",
    shopifyCategoryId: categoryRow[0]?.shopifyCategoryId ?? "",
  };
}

export default async function NewCardPage() {
  const [connections, defaults] = await Promise.all([
    db.channelConnection.findMany({
      where: { deletedAt: null },
      orderBy: { installedAt: "asc" },
      select: { id: true, channel: true, shopDomain: true },
    }),
    getCommonDefaults(),
  ]);

  return (
    <div className="max-w-4xl space-y-4">
      <div>
        <Link href="/cards" className="text-sm text-gray-600 hover:underline">
          ← Back to cards
        </Link>
        <h1 className="text-2xl font-bold mt-2">Add a new card</h1>
        <p className="text-sm text-gray-500 mt-1">
          Saved to your DB and queued for sync to the selected channel.
        </p>
      </div>

      {connections.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 p-4 rounded">
          Connect a channel first in{" "}
          <Link href="/settings/channels" className="underline">
            Settings → Channels
          </Link>
          .
        </div>
      ) : (
        <NewCardForm channels={connections} defaults={defaults} />
      )}
    </div>
  );
}
