"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveMinOffer, type PricingActionResult } from "./actions";

interface Props {
  profileId: string;
  defaultEnabled: boolean;
  defaultPercent: number;
}

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

export default function MinOfferForm({
  profileId,
  defaultEnabled,
  defaultPercent,
}: Props) {
  const [enabled, setEnabled] = useState(defaultEnabled);
  const [percent, setPercent] = useState(defaultPercent);
  const [result, formAction] = useActionState<PricingActionResult, FormData>(
    saveMinOffer,
    undefined,
  );

  const listingPct = 100 + percent;

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="profileId" value={profileId} />
      <div className="flex items-center justify-between">
        <span className="font-medium">Enabled</span>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            name="enabled"
            value="1"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4"
          />
          {enabled ? "ON" : "OFF"}
        </label>
      </div>

      <div>
        <label className="block text-sm mb-1">As a % of Listing Price</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPercent((p) => p - 1)}
            className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-50"
          >
            −
          </button>
          <div className="relative flex-1 max-w-[120px]">
            <input
              type="number"
              name="percent"
              value={percent}
              onChange={(e) =>
                setPercent(Number.parseInt(e.target.value, 10) || 0)
              }
              className="w-full p-2 pr-8 border border-gray-300 rounded text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              %
            </span>
          </div>
          <button
            type="button"
            onClick={() => setPercent((p) => p + 1)}
            className="w-8 h-8 border border-gray-300 rounded hover:bg-gray-50"
          >
            +
          </button>
          <span className="text-sm text-red-600 ml-2">
            {listingPct}% of Listing Price
          </span>
        </div>
      </div>

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
