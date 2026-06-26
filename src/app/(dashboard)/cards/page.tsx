import { db } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import {
  CARD_STATUS_STYLES,
  formatGraderGrade,
  formatPrice,
} from "@/lib/format";
import type { CardStatus, Prisma } from "@prisma/client";
import CardsFilterBar from "./filter-bar";

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    grader?: string;
    page?: string;
  }>;
}

export default async function CardsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const statusFilter = (params.status?.trim() || "") as CardStatus | "";
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
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(graderFilter ? { grader: graderFilter } : {}),
  };

  const [total, cards] = await Promise.all([
    db.card.count({ where }),
    db.card.findMany({
      where,
      include: {
        images: { take: 1, orderBy: { position: "asc" } },
        variants: {
          take: 1,
          orderBy: { position: "asc" },
          include: {
            listings: {
              where: { deletedAt: null },
              take: 1,
              orderBy: { createdAt: "asc" },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Distinct graders for filter dropdown
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
        defaultStatus={statusFilter}
        defaultGrader={graderFilter}
        graders={graders}
      />

      {cards.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          {q || statusFilter || graderFilter
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
                <th className="p-3">Player</th>
                <th className="p-3">Grade</th>
                <th className="p-3">SKU</th>
                <th className="p-3">Price</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card) => {
                const variant = card.variants[0];
                const listing = variant?.listings[0];
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
                    <td className="p-3 text-sm">{card.player ?? "—"}</td>
                    <td className="p-3 text-sm">
                      {formatGraderGrade(card.grader, card.grade)}
                    </td>
                    <td className="p-3 text-sm font-mono">
                      {variant?.sku ?? "—"}
                    </td>
                    <td className="p-3 text-sm">{formatPrice(listing?.price)}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs rounded font-medium ${CARD_STATUS_STYLES[card.status]}`}
                      >
                        {card.status}
                      </span>
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
                href={buildPageHref({ q, status: statusFilter, grader: graderFilter, page: page - 1 })}
                className="px-3 py-1 rounded border hover:bg-gray-100"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildPageHref({ q, status: statusFilter, grader: graderFilter, page: page + 1 })}
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
  status?: string;
  grader?: string;
  page: number;
}): string {
  const params = new URLSearchParams();
  if (opts.q) params.set("q", opts.q);
  if (opts.status) params.set("status", opts.status);
  if (opts.grader) params.set("grader", opts.grader);
  params.set("page", String(opts.page));
  return `/cards?${params.toString()}`;
}
