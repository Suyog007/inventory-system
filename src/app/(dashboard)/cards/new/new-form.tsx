"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createCard, type CardActionResult } from "../actions";
import CardFormFields from "../card-form-fields";

interface Channel {
  id: string;
  channel: string;
  shopDomain: string | null;
}

interface Props {
  channels: Channel[];
  defaults?: { vendor?: string; productType?: string; shopifyCategoryId?: string };
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "Creating..." : "Create card"}
    </button>
  );
}

export default function NewCardForm({ channels, defaults }: Props) {
  const [result, formAction] = useActionState<CardActionResult, FormData>(
    createCard,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="font-semibold mb-4">Where to list</h2>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
            Channel <span className="text-red-600">*</span>
          </span>
          <select
            name="channelConnectionId"
            required
            className="w-full p-2 border border-gray-300 rounded text-sm bg-white"
          >
            <option value="">-- pick a connected channel --</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.channel} {c.shopDomain ? `· ${c.shopDomain}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <CardFormFields defaults={defaults} />

      {result && "error" in result && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">
          {result.error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton />
        <a href="/cards" className="text-gray-600 hover:underline">
          Cancel
        </a>
      </div>
    </form>
  );
}
