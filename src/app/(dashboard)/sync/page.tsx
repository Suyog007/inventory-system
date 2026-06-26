import { db } from "@/lib/db";
import Link from "next/link";
import RefreshButton from "./refresh-button";

export default async function SyncPage() {
  const connections = await db.channelConnection.findMany({
    where: { deletedAt: null },
    orderBy: { installedAt: "asc" },
  });

  const recentRuns = await db.syncRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 20,
    include: { channelConnection: true },
  });

  const pendingOutbox = await db.outboxItem.count({
    where: { status: { in: ["PENDING", "PROCESSING"] } },
  });
  const failedOutbox = await db.outboxItem.count({
    where: { status: "FAILED" },
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Sync</h1>
        <p className="text-gray-600 mt-1">
          Pull updates from your channels and see recent sync activity.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-3">Outbox queue</h2>
          <div className="grid grid-cols-2 text-sm">
            <div>
              <div className="text-gray-500 text-xs uppercase">Pending</div>
              <div className="text-2xl">{pendingOutbox}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs uppercase">Failed</div>
              <div className={`text-2xl ${failedOutbox > 0 ? "text-red-700" : ""}`}>
                {failedOutbox}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Items are processed by the outbox worker. Run{" "}
            <code className="bg-gray-100 px-1 rounded">npm run worker</code> in dev.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-3">Refresh from channels</h2>
          {connections.length === 0 ? (
            <p className="text-sm text-gray-500">
              No channels connected.{" "}
              <Link href="/settings/channels" className="text-blue-600 hover:underline">
                Connect one
              </Link>
              .
            </p>
          ) : (
            <div className="space-y-3">
              {connections.map((c) => (
                <div key={c.id}>
                  <div className="text-sm mb-1">
                    <span className="font-medium">{c.channel}</span>
                    {c.shopDomain && (
                      <span className="text-gray-500 ml-2 text-xs font-mono">
                        {c.shopDomain}
                      </span>
                    )}
                  </div>
                  <RefreshButton
                    connectionId={c.id}
                    label={
                      c.lastWebhookAt
                        ? `Last webhook: ${new Date(c.lastWebhookAt).toLocaleString()}`
                        : "No webhooks received yet"
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Recent sync runs</h2>
        </div>
        {recentRuns.length === 0 ? (
          <div className="p-6 text-sm text-gray-500">No sync runs yet.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wider">
              <tr>
                <th className="text-left p-3">Channel</th>
                <th className="text-left p-3">Kind</th>
                <th className="text-left p-3">Started</th>
                <th className="text-left p-3">Duration</th>
                <th className="text-left p-3">Added</th>
                <th className="text-left p-3">Updated</th>
                <th className="text-left p-3">Errors</th>
              </tr>
            </thead>
            <tbody>
              {recentRuns.map((r) => {
                const duration = r.completedAt
                  ? `${Math.round((+new Date(r.completedAt) - +new Date(r.startedAt)) / 100) / 10}s`
                  : "—";
                const errorCount = Array.isArray(r.errors) ? r.errors.length : 0;
                return (
                  <tr key={r.id} className="border-t text-sm">
                    <td className="p-3">{r.channelConnection.channel}</td>
                    <td className="p-3">{r.kind}</td>
                    <td className="p-3 text-xs text-gray-500">
                      {new Date(r.startedAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-xs">{duration}</td>
                    <td className="p-3">{r.productsAdded}</td>
                    <td className="p-3">{r.productsUpdated}</td>
                    <td className={`p-3 ${errorCount > 0 ? "text-red-700" : ""}`}>
                      {errorCount > 0 ? errorCount : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
