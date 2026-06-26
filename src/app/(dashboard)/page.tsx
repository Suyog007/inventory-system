import { db } from "@/lib/db";
import { auth } from "@/auth";
import Link from "next/link";
import { formatPrice } from "@/lib/format";

export default async function DashboardPage() {
  const session = await auth();

  const [
    totalCards,
    statusCounts,
    listingsAgg,
    activeListings,
    connections,
    recentRuns,
    outboxCounts,
    recentOrders,
  ] = await Promise.all([
    db.card.count({ where: { deletedAt: null } }),
    db.card.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { status: true },
    }),
    db.$queryRaw<Array<{ total: string | null }>>`
      SELECT COALESCE(SUM(l.price * v.quantity), 0)::text AS total
      FROM "Listing" l
      JOIN "Variant" v ON v.id = l."variantId"
      WHERE l."deletedAt" IS NULL AND l.status = 'ACTIVE'
    `,
    db.listing.count({ where: { deletedAt: null, status: "ACTIVE" } }),
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
  ]);

  const statusMap = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.status]),
  );
  const outboxMap = Object.fromEntries(
    outboxCounts.map((o) => [o.status, o._count.status]),
  );
  const totalValue = Number(listingsAgg[0]?.total ?? 0);
  const pendingOutbox = (outboxMap.PENDING ?? 0) + (outboxMap.PROCESSING ?? 0);
  const failedOutbox = outboxMap.FAILED ?? 0;

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Welcome, {session?.user?.name || session?.user?.email}.
        </p>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Cards" value={totalCards.toString()} href="/cards" />
        <Stat label="Active listings" value={activeListings.toString()} />
        <Stat label="Inventory value" value={formatPrice(totalValue)} />
        <Stat
          label="Channels connected"
          value={connections.length.toString()}
          href="/settings/channels"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — health */}
        <div className="space-y-6 lg:col-span-1">
          <Card title="Outbox queue" linkHref="/sync" linkLabel="View sync →">
            <div className="grid grid-cols-2 text-sm">
              <div>
                <div className="text-gray-500 text-xs uppercase">Pending</div>
                <div className="text-2xl font-semibold">{pendingOutbox}</div>
              </div>
              <div>
                <div className="text-gray-500 text-xs uppercase">Failed</div>
                <div
                  className={`text-2xl font-semibold ${failedOutbox > 0 ? "text-red-700" : ""}`}
                >
                  {failedOutbox}
                </div>
              </div>
            </div>
            {failedOutbox > 0 && (
              <p className="text-xs text-red-700 mt-3">
                Failed items need attention. Open Sync to investigate.
              </p>
            )}
          </Card>

          <Card title="Status breakdown">
            <div className="space-y-2 text-sm">
              <Row label="Active" value={statusMap.ACTIVE ?? 0} />
              <Row label="Draft" value={statusMap.DRAFT ?? 0} />
              <Row label="Archived" value={statusMap.ARCHIVED ?? 0} />
            </div>
          </Card>

          <Card title="Quick actions">
            <div className="space-y-2 text-sm">
              <QuickLink href="/cards/new" label="+ Add card" />
              <QuickLink href="/sync" label="Refresh from Shopify" />
              <QuickLink href="/settings/channels" label="Manage channels" />
            </div>
          </Card>
        </div>

        {/* RIGHT — activity */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Recent sync runs" linkHref="/sync" linkLabel="View all →">
            {recentRuns.length === 0 ? (
              <p className="text-sm text-gray-500">
                No syncs yet. Connect a channel and click Import.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left pb-2">When</th>
                    <th className="text-left pb-2">Channel</th>
                    <th className="text-left pb-2">Kind</th>
                    <th className="text-right pb-2">+</th>
                    <th className="text-right pb-2">~</th>
                    <th className="text-right pb-2">−</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="py-2 text-xs text-gray-500">
                        {new Date(r.startedAt).toLocaleString()}
                      </td>
                      <td className="py-2">{r.channelConnection.channel}</td>
                      <td className="py-2">{r.kind}</td>
                      <td className="py-2 text-right">{r.productsAdded}</td>
                      <td className="py-2 text-right">{r.productsUpdated}</td>
                      <td className="py-2 text-right">{r.productsDeleted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card title="Recent orders">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-gray-500">
                No orders yet. Once webhooks are wired up (needs a public URL),
                sold-on-channel events will show here.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-xs text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="text-left pb-2">When</th>
                    <th className="text-left pb-2">Channel</th>
                    <th className="text-left pb-2">Order</th>
                    <th className="text-right pb-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((o) => (
                    <tr key={o.id} className="border-t">
                      <td className="py-2 text-xs text-gray-500">
                        {new Date(o.placedAt).toLocaleString()}
                      </td>
                      <td className="py-2">{o.channelConnection.channel}</td>
                      <td className="py-2 font-mono text-xs">
                        {o.externalOrderId}
                      </td>
                      <td className="py-2 text-right">{formatPrice(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="hover:opacity-90 transition">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function Card({
  title,
  children,
  linkHref,
  linkLabel,
}: {
  title: string;
  children: React.ReactNode;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{title}</h2>
        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            className="text-sm text-blue-600 hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block py-2 px-3 -mx-3 rounded hover:bg-gray-50 text-gray-900"
    >
      {label}
    </Link>
  );
}
