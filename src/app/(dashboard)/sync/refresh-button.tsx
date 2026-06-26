"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  refreshFromShopify,
  reconcileShopify,
  type SyncActionResult,
} from "./actions";

function Btn({
  pending,
  label,
  pendingLabel,
  variant = "primary",
}: {
  pending: boolean;
  label: string;
  pendingLabel: string;
  variant?: "primary" | "secondary";
}) {
  const classes =
    variant === "primary"
      ? "bg-blue-600 text-white hover:bg-blue-700"
      : "bg-gray-100 text-gray-900 hover:bg-gray-200 border border-gray-300";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`px-4 py-2 rounded font-medium disabled:opacity-50 ${classes}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

function StatusLine({ result }: { result: SyncActionResult }) {
  if (!result) return null;
  if (!result.ok) return <p className="text-sm text-red-700">✗ {result.error}</p>;
  return (
    <p className="text-sm text-green-700">
      ✓ {result.productsAdded} added · {result.productsUpdated} updated
      {result.productsDeleted > 0 && ` · ${result.productsDeleted} marked deleted`}
      {result.errors.length > 0 &&
        ` · ${result.errors.length} error${result.errors.length === 1 ? "" : "s"}`}
    </p>
  );
}

function RefreshForm({ connectionId }: { connectionId: string }) {
  const bound = refreshFromShopify.bind(null, connectionId);
  const [result, action] = useActionState<SyncActionResult, FormData>(bound, undefined);
  return (
    <form action={action} className="space-y-2">
      <RefreshSubmit />
      <StatusLine result={result} />
    </form>
  );
}

function RefreshSubmit() {
  const { pending } = useFormStatus();
  return <Btn pending={pending} label="Refresh" pendingLabel="Refreshing..." />;
}

function ReconcileForm({ connectionId }: { connectionId: string }) {
  const bound = reconcileShopify.bind(null, connectionId);
  const [result, action] = useActionState<SyncActionResult, FormData>(bound, undefined);
  return (
    <form action={action} className="space-y-2">
      <ReconcileSubmit />
      <StatusLine result={result} />
    </form>
  );
}

function ReconcileSubmit() {
  const { pending } = useFormStatus();
  return (
    <Btn
      pending={pending}
      label="Reconcile now"
      pendingLabel="Reconciling..."
      variant="secondary"
    />
  );
}

export default function RefreshButton({
  connectionId,
  label,
}: {
  connectionId: string;
  label?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-start">
        <RefreshForm connectionId={connectionId} />
        <ReconcileForm connectionId={connectionId} />
      </div>
      {label && <p className="text-xs text-gray-500">{label}</p>}
    </div>
  );
}
