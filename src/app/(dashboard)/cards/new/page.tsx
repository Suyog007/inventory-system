import { db } from "@/lib/db";
import Link from "next/link";
import NewCardForm from "./new-form";

// Pre-fill the most-common vendor / manufacturer / category from existing cards
// so the form starts with reasonable defaults instead of empty inputs.
async function getCommonDefaults() {
  const [vendorRow, manufacturerRow, categoryRow] = await Promise.all([
    db.card.groupBy({
      by: ["vendor"],
      where: { deletedAt: null, vendor: { not: null } },
      _count: { vendor: true },
      orderBy: { _count: { vendor: "desc" } },
      take: 1,
    }),
    db.card.groupBy({
      by: ["manufacturer"],
      where: { deletedAt: null, manufacturer: { not: null } },
      _count: { manufacturer: true },
      orderBy: { _count: { manufacturer: "desc" } },
      take: 1,
    }),
    db.card.groupBy({
      by: ["categoryId"],
      where: { deletedAt: null, categoryId: { not: null } },
      _count: { categoryId: true },
      orderBy: { _count: { categoryId: "desc" } },
      take: 1,
    }),
  ]);
  return {
    vendor: vendorRow[0]?.vendor ?? "",
    manufacturer: manufacturerRow[0]?.manufacturer ?? "",
    categoryId: categoryRow[0]?.categoryId ?? "",
  };
}

export default async function NewCardPage() {
  const [connections, categories, pricingProfiles, defaults] = await Promise.all([
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
    getCommonDefaults(),
  ]);

  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <Link href="/cards" className="text-sm text-gray-600 hover:underline">
          ← Back to cards
        </Link>
        <h1 className="text-2xl font-bold mt-2">Add a new card</h1>
        <p className="text-sm text-gray-500 mt-1">
          Saved locally and queued for sync to the channels you check.
        </p>
      </div>

      {categories.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 p-4 rounded">
          Create at least one category first in{" "}
          <Link href="/settings/categories" className="underline">
            Settings → Categories
          </Link>
          .
        </div>
      ) : (
        <NewCardForm
          channels={connections}
          categories={categories}
          pricingProfiles={pricingProfiles}
          defaults={defaults}
        />
      )}
    </div>
  );
}
