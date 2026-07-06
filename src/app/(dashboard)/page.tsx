import { db } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import {
  Layers3,
  DollarSign,
  Radio,
  Store,
  Plus,
  RefreshCw,
  ArrowRight,
  Clock,
  TrendingUp,
  ShoppingBag,
  Tags,
  Inbox,
  AlertCircle,
  ArrowUpRight,
} from "lucide-react";
import {
  Badge,
  ChannelPill,
  PageHeader,
  SectionCard,
} from "@/lib/ui";

export default async function DashboardPage() {
  const session = await auth();

  const [
    totalCards,
    listingsAgg,
    activeListings,
    connections,
    recentRuns,
    outboxCounts,
    recentOrders,
    categoryCounts,
  ] = await Promise.all([
    db.card.count({ where: { deletedAt: null } }),
    // Inventory value = what the user OWNS, regardless of listing state.
    // Inventory-only cards + DRAFT / ARCHIVED / DELISTED listings all still
    // represent real inventory, so we sum from Variant, not Listing.
    db.$queryRaw<Array<{ total: string | null }>>`
      SELECT COALESCE(SUM(v."listingPrice" * v.quantity), 0)::text AS total
      FROM "Variant" v
      JOIN "Card" c ON c.id = v."cardId"
      WHERE v."deletedAt" IS NULL AND c."deletedAt" IS NULL
    `,
    // "Live listings" = any Listing row not soft-deleted (matches the Sales
    // Channels sidebar's live state). Keeps the dashboard number consistent
    // with the SHOPIFY badges on the cards page.
    db.listing.count({ where: { deletedAt: null } }),
    db.channelConnection.findMany({
      where: {
        deletedAt: null,
        NOT: { shopDomain: { startsWith: "test-" } },
      },
      select: { channel: true, shopDomain: true, lastWebhookAt: true },
    }),
    db.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
      include: { channelConnection: { select: { channel: true } } },
    }),
    db.outboxItem.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.order.findMany({
      orderBy: { placedAt: "desc" },
      take: 3,
      include: { channelConnection: { select: { channel: true } } },
    }),
    db.card.groupBy({
      by: ["categoryId"],
      where: { deletedAt: null, categoryId: { not: null } },
      _count: { categoryId: true },
      orderBy: { _count: { categoryId: "desc" } },
      take: 5,
    }),
  ]);

  const outboxMap = Object.fromEntries(
    outboxCounts.map((o) => [o.status, o._count.status]),
  );
  const totalValue = Number(listingsAgg[0]?.total ?? 0);
  const pendingOutbox = (outboxMap.PENDING ?? 0) + (outboxMap.PROCESSING ?? 0);
  const failedOutbox = outboxMap.FAILED ?? 0;

  // Look up category names for the breakdown
  const categoryIds = categoryCounts
    .map((c) => c.categoryId)
    .filter((id): id is string => Boolean(id));
  const categories = categoryIds.length
    ? await db.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const catNameById = new Map(categories.map((c) => [c.id, c.name]));

  const greeting = getGreeting();
  const displayName =
    session?.user?.name || session?.user?.email?.split("@")[0] || "there";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting}, ${displayName}`}
        subtitle="Here's what's happening across your inventory today."
      />

      {/* Hero KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total cards"
          value={totalCards.toLocaleString()}
          icon={Layers3}
          tone="blue"
          href="/cards"
        />
        <KpiCard
          label="Live listings"
          value={activeListings.toLocaleString()}
          icon={Radio}
          tone="emerald"
        />
        <KpiCard
          label="Inventory value"
          value={formatPrice(totalValue)}
          icon={DollarSign}
          tone="violet"
        />
        <KpiCard
          label="Channels connected"
          value={connections.length.toString()}
          icon={Store}
          tone="amber"
          href="/settings/channels"
        />
      </div>

      {/* Alert strip when there's failed sync work */}
      {failedOutbox > 0 && (
        <div className="flex items-start gap-3 bg-rose-50 border border-rose-200 rounded-2xl p-4">
          <div className="w-9 h-9 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-rose-900">
              {failedOutbox} sync job{failedOutbox === 1 ? "" : "s"} failed
            </div>
            <div className="text-sm text-rose-700 mt-0.5">
              Something is preventing these listings from reaching their
              channels. Open Sync to inspect the error.
            </div>
          </div>
          <Link
            href="/sync"
            className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-rose-700 hover:text-rose-900"
          >
            View <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — activity feed */}
        <div className="lg:col-span-2 space-y-6">
          <SectionCard
            title="Recent syncs"
            action={
              <Link
                href="/sync"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
              >
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            }
          >
            {recentRuns.length === 0 ? (
              <EmptyRow
                icon={RefreshCw}
                title="No syncs yet"
                body="Connect a channel and click Import to bring your catalog in."
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {recentRuns.map((r) => {
                  const delta =
                    r.productsAdded + r.productsUpdated + r.productsDeleted;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <RefreshCw className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">
                            {r.kind}
                          </span>
                          <ChannelPill channel={r.channelConnection.channel} />
                          {r.errors ? (
                            <Badge variant="danger">error</Badge>
                          ) : r.completedAt ? (
                            <Badge variant="success">complete</Badge>
                          ) : (
                            <Badge variant="info">running</Badge>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {new Date(r.startedAt).toLocaleString()}
                          {delta > 0 && (
                            <>
                              {" · "}
                              <span className="text-emerald-600">+{r.productsAdded}</span>{" "}
                              <span className="text-blue-600">~{r.productsUpdated}</span>{" "}
                              <span className="text-rose-600">−{r.productsDeleted}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent orders">
            {recentOrders.length === 0 ? (
              <EmptyRow
                icon={ShoppingBag}
                title="No orders yet"
                body="Once webhooks are live, sales from any channel will show here in real time."
              />
            ) : (
              <div className="divide-y divide-gray-100">
                {recentOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 font-mono">
                          {o.externalOrderId}
                        </span>
                        <ChannelPill channel={o.channelConnection.channel} />
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {new Date(o.placedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900">
                      {formatPrice(o.total)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* RIGHT — sidebar column */}
        <div className="space-y-6">
          <SectionCard title="Outbox queue">
            <div className="grid grid-cols-2 gap-4">
              <QueueStat
                label="Pending"
                value={pendingOutbox}
                tone="blue"
                icon={Clock}
              />
              <QueueStat
                label="Failed"
                value={failedOutbox}
                tone={failedOutbox > 0 ? "rose" : "gray"}
                icon={AlertCircle}
              />
            </div>
            <Link
              href="/sync"
              className="mt-4 flex items-center justify-between text-sm text-gray-700 hover:text-gray-900 group"
            >
              <span>Manage sync</span>
              <ArrowUpRight className="w-4 h-4 opacity-40 group-hover:opacity-100 transition" />
            </Link>
          </SectionCard>

          <SectionCard title="Top categories">
            {categoryCounts.length === 0 ? (
              <div className="text-sm text-gray-500">
                No cards categorised yet.
              </div>
            ) : (
              <div className="space-y-3">
                {categoryCounts.map((c) => {
                  const name = catNameById.get(c.categoryId ?? "") ?? "—";
                  const pct = totalCards
                    ? Math.round((c._count.categoryId / totalCards) * 100)
                    : 0;
                  return (
                    <div key={c.categoryId ?? "none"}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5 text-gray-800 font-medium">
                          <Tags className="w-3.5 h-3.5 text-purple-500" />
                          {name}
                        </span>
                        <span className="text-gray-500 text-xs">
                          {c._count.categoryId} · {pct}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Quick actions">
            <div className="space-y-1">
              <QuickAction href="/cards/new" icon={Plus} label="Add card" tone="blue" />
              <QuickAction
                href="/sync"
                icon={RefreshCw}
                label="Refresh from Shopify"
                tone="emerald"
              />
              <QuickAction
                href="/settings/pricing"
                icon={DollarSign}
                label="Edit pricing rules"
                tone="violet"
              />
              <QuickAction
                href="/settings/channels"
                icon={Store}
                label="Manage channels"
                tone="amber"
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

// ─── helpers ───────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

type ToneKey = "blue" | "emerald" | "violet" | "amber" | "rose" | "gray";

const TONE_STYLES: Record<
  ToneKey,
  { bg: string; text: string; iconBg: string; ring: string }
> = {
  blue: {
    bg: "bg-blue-50",
    text: "text-blue-700",
    iconBg: "bg-blue-500",
    ring: "ring-blue-200",
  },
  emerald: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    iconBg: "bg-emerald-500",
    ring: "ring-emerald-200",
  },
  violet: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    iconBg: "bg-violet-500",
    ring: "ring-violet-200",
  },
  amber: {
    bg: "bg-amber-50",
    text: "text-amber-800",
    iconBg: "bg-amber-500",
    ring: "ring-amber-200",
  },
  rose: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    iconBg: "bg-rose-500",
    ring: "ring-rose-200",
  },
  gray: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    iconBg: "bg-gray-400",
    ring: "ring-gray-200",
  },
};

function KpiCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
  trend,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: ToneKey;
  href?: string;
  trend?: string;
}) {
  const t = TONE_STYLES[tone];
  const inner = (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div
          className={`w-11 h-11 rounded-xl ${t.iconBg} text-white flex items-center justify-center shadow-md shadow-${tone}-500/20`}
        >
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${t.text}`}
          >
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="text-2xl font-bold text-gray-900 leading-none">
          {value}
        </div>
        <div className="text-sm text-gray-500 mt-1.5">{label}</div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block group">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function EmptyRow({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="text-center py-6">
      <div className="mx-auto w-10 h-10 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mb-2">
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-sm font-medium text-gray-900">{title}</div>
      <div className="text-xs text-gray-500 mt-0.5">{body}</div>
    </div>
  );
}

function QueueStat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: ToneKey;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const t = TONE_STYLES[tone];
  return (
    <div className={`rounded-xl ${t.bg} p-3`}>
      <div className="flex items-center gap-1.5 text-xs font-medium">
        <Icon className={`w-3.5 h-3.5 ${t.text}`} />
        <span className={t.text}>{label}</span>
      </div>
      <div
        className={`mt-1 text-xl font-bold ${value > 0 ? t.text : "text-gray-400"}`}
      >
        {value}
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  tone,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: ToneKey;
}) {
  const t = TONE_STYLES[tone];
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition group -mx-2"
    >
      <div
        className={`w-8 h-8 rounded-lg ${t.bg} ${t.text} flex items-center justify-center shrink-0`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm text-gray-800 font-medium flex-1">{label}</span>
      <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-600 transition" />
    </Link>
  );
}
