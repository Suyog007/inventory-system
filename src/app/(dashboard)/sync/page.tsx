import { db } from "@/lib/db";
import Link from "next/link";
import RefreshButton from "./refresh-button";
import {
  RefreshCw,
  Clock,
  AlertCircle,
  Inbox,
  CheckCircle2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge, ChannelPill, PageHeader, SectionCard } from "@/lib/ui";

export default async function SyncPage() {
  const connections = await db.channelConnection.findMany({
    where: {
      deletedAt: null,
      NOT: { shopDomain: { startsWith: "test-" } },
    },
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
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        icon={RefreshCw}
        title="Sync"
        subtitle="Pull updates from your channels and inspect sync activity."
      />

      {/* Outbox stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectionCard>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">Outbox queue</h2>
              <p className="text-xs text-gray-500">
                Pending changes waiting to reach the channels.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-blue-50 p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-blue-700">
                <Clock className="w-3.5 h-3.5" />
                Pending
              </div>
              <div className="mt-1 text-2xl font-bold text-blue-700">
                {pendingOutbox}
              </div>
            </div>
            <div
              className={`rounded-xl p-4 ${failedOutbox > 0 ? "bg-rose-50" : "bg-gray-50"}`}
            >
              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${failedOutbox > 0 ? "text-rose-700" : "text-gray-600"}`}
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Failed
              </div>
              <div
                className={`mt-1 text-2xl font-bold ${failedOutbox > 0 ? "text-rose-700" : "text-gray-400"}`}
              >
                {failedOutbox}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Items are processed by the outbox worker. Run{" "}
            <code className="bg-gray-100 px-1 rounded text-[10px]">
              npm run worker
            </code>{" "}
            in dev.
          </p>
        </SectionCard>

        <SectionCard>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">
                Refresh from channels
              </h2>
              <p className="text-xs text-gray-500">
                Pull the latest catalog if webhooks aren&apos;t reaching us.
              </p>
            </div>
          </div>
          {connections.length === 0 ? (
            <p className="text-sm text-gray-500">
              No channels connected.{" "}
              <Link
                href="/settings/channels"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Connect one →
              </Link>
            </p>
          ) : (
            <div className="space-y-3">
              {connections.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-gray-200 p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <ChannelPill channel={c.channel} />
                    {c.shopDomain && (
                      <span className="text-xs font-mono text-gray-500 truncate">
                        {c.shopDomain}
                      </span>
                    )}
                    {c.lastWebhookAt ? (
                      <Badge variant="success" icon={Wifi}>
                        webhooks live
                      </Badge>
                    ) : (
                      <Badge variant="warning" icon={WifiOff}>
                        no webhooks
                      </Badge>
                    )}
                  </div>
                  <RefreshButton
                    connectionId={c.id}
                    label={
                      c.lastWebhookAt
                        ? `Last webhook ${new Date(c.lastWebhookAt).toLocaleString()}`
                        : "No webhooks received yet"
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* Runs table */}
      <SectionCard padding="p-0">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <RefreshCw className="w-4 h-4 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Recent sync runs</h2>
          <span className="text-xs text-gray-500 ml-auto">
            latest {recentRuns.length}
          </span>
        </div>
        {recentRuns.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center mb-3">
              <RefreshCw className="w-5 h-5" />
            </div>
            <p className="text-sm text-gray-500">
              No sync runs yet. Import a channel to see runs here.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <th className="p-3 pl-6">Channel</th>
                <th className="p-3">Kind</th>
                <th className="p-3">Started</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Result</th>
                <th className="p-3 pr-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentRuns.map((r) => {
                const duration = r.completedAt
                  ? `${Math.round((+new Date(r.completedAt) - +new Date(r.startedAt)) / 100) / 10}s`
                  : "—";
                const errorCount = Array.isArray(r.errors) ? r.errors.length : 0;
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 pl-6">
                      <ChannelPill channel={r.channelConnection.channel} />
                    </td>
                    <td className="p-3 text-sm font-medium text-gray-800">
                      {r.kind}
                    </td>
                    <td className="p-3 text-xs text-gray-500">
                      {new Date(r.startedAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-xs text-gray-600">{duration}</td>
                    <td className="p-3 text-sm">
                      <span className="text-emerald-600 font-medium">
                        +{r.productsAdded}
                      </span>{" "}
                      <span className="text-blue-600 font-medium">
                        ~{r.productsUpdated}
                      </span>{" "}
                      <span className="text-rose-600 font-medium">
                        −{r.productsDeleted}
                      </span>
                    </td>
                    <td className="p-3 pr-6">
                      {errorCount > 0 ? (
                        <Badge variant="danger" icon={AlertCircle}>
                          {errorCount} error{errorCount === 1 ? "" : "s"}
                        </Badge>
                      ) : r.completedAt ? (
                        <Badge variant="success" icon={CheckCircle2}>
                          complete
                        </Badge>
                      ) : (
                        <Badge variant="info">running</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </SectionCard>
    </div>
  );
}
