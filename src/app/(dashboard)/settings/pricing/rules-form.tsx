"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveRules, type PricingActionResult } from "./actions";
import { Channel } from "@prisma/client";
import { formatPrice } from "@/lib/format";

interface Props {
  profileId: string;
  defaults: Record<string, number>; // channel → percent
  connectedChannels: Channel[];
}

const PREVIEW_LISTING = 100;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "Saving..." : "Save"}
    </button>
  );
}

export default function RulesForm({
  profileId,
  defaults,
  connectedChannels,
}: Props) {
  const [values, setValues] = useState<Record<string, number>>(defaults);
  const [result, formAction] = useActionState<PricingActionResult, FormData>(
    saveRules,
    undefined,
  );

  const allChannels = Object.values(Channel);
  const connected = new Set(connectedChannels);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="profileId" value={profileId} />
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-gray-500">
          <tr>
            <th className="pb-2">Marketplace</th>
            <th className="pb-2 text-center">Custom Price</th>
            <th className="pb-2 text-right">${PREVIEW_LISTING} Listing</th>
          </tr>
        </thead>
        <tbody>
          {allChannels.map((channel) => {
            const pct = values[channel] ?? 0;
            const preview = PREVIEW_LISTING * (1 + pct / 100);
            const isConnected = connected.has(channel);
            return (
              <tr key={channel} className="border-t">
                <td className="py-3">
                  <span className={isConnected ? "" : "text-gray-400"}>
                    {channel}
                    {!isConnected && (
                      <span className="ml-2 text-xs text-gray-400">
                        (not connected)
                      </span>
                    )}
                  </span>
                </td>
                <td className="py-3">
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-gray-400">
                      {pct >= 0 ? "+" : ""}
                    </span>
                    <input
                      type="number"
                      name={`rule_${channel}`}
                      value={pct}
                      onChange={(e) =>
                        setValues((v) => ({
                          ...v,
                          [channel]: Number.parseInt(e.target.value, 10) || 0,
                        }))
                      }
                      className="w-20 p-1 border border-gray-300 rounded text-sm text-center"
                    />
                    <span className="text-gray-400 text-xs">%</span>
                  </div>
                </td>
                <td className="py-3 text-right">{formatPrice(preview)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {result && "error" in result && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded text-sm">
          {result.error}
        </div>
      )}
      {result && "success" in result && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-2 rounded text-sm">
          {result.success}
        </div>
      )}

      <SubmitButton />
    </form>
  );
}
