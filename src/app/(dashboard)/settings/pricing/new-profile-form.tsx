"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createProfile, type PricingActionResult } from "./actions";

interface Profile {
  id: string;
  name: string;
}

interface Props {
  profiles: Profile[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "Creating..." : "Create profile"}
    </button>
  );
}

export default function NewProfileForm({ profiles }: Props) {
  const [result, formAction] = useActionState<PricingActionResult, FormData>(
    createProfile,
    undefined,
  );

  const inputClass =
    "w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
            Name <span className="text-red-600">*</span>
          </span>
          <input
            name="name"
            required
            placeholder="High-margin, Auction, …"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
            Clone rules from
          </span>
          <select name="cloneFromId" className={inputClass}>
            <option value="">-- start blank (all 0%) --</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
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
