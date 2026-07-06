import { db } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { formatGraderGrade, formatPrice } from "@/lib/format";
import type { Prisma } from "@prisma/client";
import CardsFilterBar from "./filter-bar";

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    grader?: string;
    page?: string;
  }>;
}

export default async function CardsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const categoryFilter = params.category?.trim() ?? "";
  const graderFilter = params.grader?.trim().toUpperCase() ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const where: Prisma.CardWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { player: { contains: q, mode: "insensitive" } },
            { certNumber: { contains: q, mode: "insensitive" } },
            { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(graderFilter ? { grader: graderFilter } : {}),
  };

  const [total, cards, categories] = await Promise.all([
    db.card.count({ where }),
    db.card.findMany({
      where,
      include: {
        images: { take: 1, orderBy: { position: "asc" } },
        category: true,
        variants: {
          take: 1,
          orderBy: { position: "asc" },
          include: {
            listings: {
              where: { deletedAt: null },
              orderBy: { createdAt: "asc" },
              include: { channelConnection: true },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    db.category.findMany({
      where: { deletedAt: null },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const graderRows = await db.card.findMany({
    where: { deletedAt: null, grader: { not: null } },
    select: { grader: true },
    distinct: ["grader"],
  });
  const graders = graderRows.map((r) => r.grader!).filter(Boolean).sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cards</h1>
          <p className="text-gray-600 mt-1">
            {total} {total === 1 ? "card" : "cards"} in your inventory.
          </p>
        </div>
        <Link
          href="/cards/new"
          className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700"
        >
          + Add card
        </Link>
      </div>

      <CardsFilterBar
        defaultQ={q}
        defaultCategory={categoryFilter}
        defaultGrader={graderFilter}
        categories={categories}
        graders={graders}
      />

      {cards.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {q || categoryFilter || graderFilter
            ? "No cards match those filters."
            : "No cards yet. Connect Shopify and run an import."}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-sm font-medium text-gray-700">
                <th className="p-3 w-16"></th>
                <th className="p-3">Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Grade</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Price</th>
                <th className="p-3">Channels</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => {
                const variant = card.variants[0];
                const listings = variant?.listings ?? [];
                const image = card.images[0];
                return (
                  <tr key={card.id} className="border-t hover:bg-gray-50">
                    <td className="p-3">
                      {image ? (
                        <Link href={`/cards/${card.id}`}>
                          <Image
                            src={image.url}
                            alt={image.altText ?? ""}
                            width={48}
                            height={48}
                            className="rounded object-cover w-12 h-12"
                            unoptimized
                          />
                        </Link>
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded" />
                      )}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/cards/${card.id}`}
                        className="font-medium hover:underline"
                      >
                        {card.title}
                      </Link>
                      {card.year && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {card.year}
                          {card.setName && ` · ${card.setName}`}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-sm">{card.category?.name ?? "—"}</td>
                    <td className="p-3 text-sm">
                      {formatGraderGrade(card.grader, card.grade)}
                    </td>
                    <td className="p-3 text-sm font-mono">
                      {variant?.sku ?? "—"}
                    </td>
                    <td className="p-3 text-sm">
                      {formatPrice(variant?.listingPrice)}
                    </td>
                    <td className="p-3 text-xs">
                      {listings.length === 0 ? (
                        <span className="text-gray-400">Inventory only</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {listings.map((l) => (
                            <span
                              key={l.id}
                              className="inline-block px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium"
                            >
                              {l.channelConnection.channel}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="space-x-2">
            {page > 1 && (
              <Link
                href={buildPageHref({
                  q,
                  category: categoryFilter,
                  grader: graderFilter,
                  page: page - 1,
                })}
                className="px-3 py-1 rounded border hover:bg-gray-100"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageHref({
                  q,
                  category: categoryFilter,
                  grader: graderFilter,
                  page: page + 1,
                })}
                className="px-3 py-1 rounded border hover:bg-gray-100"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function buildPageHref(opts: {
  q?: string;
  category?: string;
  grader?: string;
  page: number;
}): string {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.category) params.set("category", opts.category);
  if (opts.grader) params.set("grader", opts.grader);
  params.set("page", String(opts.page));
  return `/cards?${params.toString()}`;
}
