import { db } from "@/lib/db";
import Link from "next/link";
import Image from "next/image";
import { formatGraderGrade, formatPrice } from "@/lib/format";
import type { Prisma } from "@prisma/client";
import CardsFilterBar from "./filter-bar";
import { Plus, Layers3, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Badge,
  ChannelPill,
  EmptyState,
  PageHeader,
  buttonClass,
} from "@/lib/ui";

const PAGE_SIZE = 50;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    grader?: string;
    view?: string;
    page?: string;
  }>;
}

export default async function CardsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const categoryFilter = params.category?.trim() ?? "";
  const graderFilter = params.grader?.trim().toUpperCase() ?? "";
  const view: "grid" | "table" = params.view === "table" ? "table" : "grid";
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
      orderBy: { name: "asc" },
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
    <div className="space-y-6">
      <PageHeader
        icon={Layers3}
        title="Cards"
        subtitle={`${total.toLocaleString()} ${total === 1 ? "card" : "cards"} in your inventory`}
        action={
          <Link href="/cards/new" className={buttonClass("primary")}>
            <Plus className="w-4 h-4" />
            Add card
          </Link>
        }
      />

      <CardsFilterBar
        defaultQ={q}
        defaultCategory={categoryFilter}
        defaultGrader={graderFilter}
        defaultView={view}
        categories={categories}
        graders={graders}
      />

      {cards.length === 0 ? (
        <EmptyState
          icon={Layers3}
          title={
            q || categoryFilter || graderFilter
              ? "No cards match those filters"
              : "No cards yet"
          }
          description={
            q || categoryFilter || graderFilter
              ? "Try loosening the filters or resetting them."
              : "Connect Shopify and run an Import — or add a card manually."
          }
          action={
            !(q || categoryFilter || graderFilter)
              ? { href: "/cards/new", label: "Add your first card" }
              : undefined
          }
        />
      ) : view === "grid" ? (
        <CardsGrid cards={cards} />
      ) : (
        <CardsTable cards={cards} />
      )}

      {totalPages > 1 && (
        <Pager
          page={page}
          totalPages={totalPages}
          q={q}
          category={categoryFilter}
          grader={graderFilter}
          view={view}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────

type CardRow = Awaited<
  ReturnType<typeof db.card.findMany<{
    include: {
      images: true;
      category: true;
      variants: { include: { listings: { include: { channelConnection: true } } } };
    };
  }>>
>[number];

function CardsGrid({ cards }: { cards: CardRow[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
      {cards.map((card) => {
        const variant = card.variants[0];
        const listings = variant?.listings.filter((l) => !l.deletedAt) ?? [];
        const image = card.images[0];
        const price = variant?.listingPrice;
        return (
          <Link
            key={card.id}
            href={`/cards/${card.id}`}
            className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all overflow-hidden flex flex-col"
          >
            <div className="aspect-[3/4] relative bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden">
              {image ? (
                <Image
                  src={image.url}
                  alt={image.altText ?? card.title}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 20vw"
                  className="object-contain group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
              {card.grader && card.grade && (
                <div className="absolute top-2 left-2">
                  <div className="bg-white/90 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[10px] font-bold text-gray-900 shadow-sm">
                    {card.grader} {card.grade.toString()}
                  </div>
                </div>
              )}
              {listings.length > 0 && (
                <div className="absolute top-2 right-2 flex flex-col gap-0.5">
                  {listings.slice(0, 3).map((l) => (
                    <div
                      key={l.id}
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white shadow"
                      title={`Live on ${l.channelConnection.channel}`}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 flex-1 flex flex-col min-h-0">
              <div className="text-xs text-gray-500 mb-0.5">
                {card.category?.name ?? "—"}
              </div>
              <div className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">
                {card.title}
              </div>
              {card.player && (
                <div className="text-xs text-gray-600 mt-1 truncate">
                  {card.player}
                </div>
              )}
              <div className="mt-auto pt-3 flex items-end justify-between">
                <div>
                  <div className="text-base font-bold text-gray-900 flex items-baseline gap-1.5">
                    {formatPrice(price)}
                    {variant && variant.quantity > 1 && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                        × {variant.quantity}
                      </span>
                    )}
                  </div>
                  {variant && variant.quantity > 1 && (
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {formatPrice(Number(price?.toString() ?? 0) * variant.quantity)}{" "}
                      total
                    </div>
                  )}
                </div>
                {listings.length === 0 ? (
                  <Badge variant="neutral">inventory</Badge>
                ) : (
                  <div className="flex items-center gap-1">
                    {listings.slice(0, 2).map((l) => (
                      <ChannelPill
                        key={l.id}
                        channel={l.channelConnection.channel}
                      />
                    ))}
                    {listings.length > 2 && (
                      <span className="text-[10px] text-gray-500 font-medium">
                        +{listings.length - 2}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function CardsTable({ cards }: { cards: CardRow[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
            <th className="p-3 w-16"></th>
            <th className="p-3">Title</th>
            <th className="p-3">Category</th>
            <th className="p-3">Grade</th>
            <th className="p-3">SKU</th>
            <th className="p-3">Qty</th>
            <th className="p-3">Price</th>
            <th className="p-3">Channels</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {cards.map((card) => {
            const variant = card.variants[0];
            const listings =
              variant?.listings.filter((l) => !l.deletedAt) ?? [];
            const image = card.images[0];
            return (
              <tr
                key={card.id}
                className="hover:bg-gray-50 transition-colors group"
              >
                <td className="p-3">
                  <Link href={`/cards/${card.id}`}>
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-gray-100 to-gray-200 overflow-hidden relative group-hover:ring-2 group-hover:ring-blue-400 transition">
                      {image ? (
                        <Image
                          src={image.url}
                          alt={image.altText ?? ""}
                          fill
                          sizes="48px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="p-3">
                  <Link
                    href={`/cards/${card.id}`}
                    className="font-medium text-gray-900 hover:text-blue-600 line-clamp-1"
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
                <td className="p-3 text-sm text-gray-700">
                  {card.category?.name ?? "—"}
                </td>
                <td className="p-3 text-sm text-gray-700">
                  {formatGraderGrade(card.grader, card.grade)}
                </td>
                <td className="p-3 text-sm font-mono text-gray-700">
                  {variant?.sku ?? "—"}
                </td>
                <td className="p-3 text-sm">
                  {variant ? (
                    variant.quantity > 1 ? (
                      <Badge variant="warning">× {variant.quantity}</Badge>
                    ) : (
                      <span className="text-gray-700">{variant.quantity}</span>
                    )
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="p-3 text-sm font-semibold text-gray-900">
                  {formatPrice(variant?.listingPrice)}
                  {variant && variant.quantity > 1 && (
                    <div className="text-[10px] text-gray-500 font-normal">
                      {formatPrice(
                        Number(variant.listingPrice.toString()) * variant.quantity,
                      )}{" "}
                      total
                    </div>
                  )}
                </td>
                <td className="p-3">
                  {listings.length === 0 ? (
                    <Badge variant="neutral">inventory only</Badge>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {listings.map((l) => (
                        <ChannelPill
                          key={l.id}
                          channel={l.channelConnection.channel}
                        />
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
  );
}

function Pager({
  page,
  totalPages,
  q,
  category,
  grader,
  view,
}: {
  page: number;
  totalPages: number;
  q: string;
  category: string;
  grader: string;
  view: string;
}) {
  const build = (n: number) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (category) p.set("category", category);
    if (grader) p.set("grader", grader);
    if (view) p.set("view", view);
    p.set("page", String(n));
    return `/cards?${p.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-sm text-gray-600 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
      <span>
        Page <span className="font-semibold text-gray-900">{page}</span> of{" "}
        <span className="font-semibold text-gray-900">{totalPages}</span>
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link
            href={build(page - 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium transition"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Link>
        )}
        {page < totalPages && (
          <Link
            href={build(page + 1)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 font-medium transition"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
