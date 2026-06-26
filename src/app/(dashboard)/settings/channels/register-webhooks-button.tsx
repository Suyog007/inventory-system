"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registerWebhooks, type WebhookRegResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-sm bg-gray-100 text-gray-900 border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-200 disabled:opacity-50"
    >
      {pending ? "Registering..." : "Register / refresh webhooks"}
    </button>
  );
}

export default function RegisterWebhooksButton({ connectionId }: { connectionId: string }) {
  const bound = registerWebhooks.bind(null, connectionId);
  const [result, action] = useActionState<WebhookRegResult, FormData>(
    bound,
    undefined,
  );

  return (
    <form action={action} className="space-y-2">
      <SubmitButton />
      {result?.ok === true && (
        <div className="text-xs space-y-1">
          <p className="text-green-700">
            ✓ Subscribed: {result.registered.length} · removed stale: {result.removed.length}
          </p>
          <p className="text-gray-500 font-mono break-all">
            callbackUrl: {result.callbackUrl}
          </p>
          {result.errors.length > 0 && (
            <ul className="text-red-700 list-disc list-inside">
              {result.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {result?.ok === false && (
        <p className="text-xs text-red-700">✗ {result.error}</p>
      )}
    </form>
  );
}
