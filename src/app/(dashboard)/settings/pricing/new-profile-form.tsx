"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createProfile, type PricingActionResult } from "./actions";
import { Alert, buttonClass } from "@/lib/ui";

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
    <button type="submit" disabled={pending} className={buttonClass("primary")}>
      <Plus className="w-4 h-4" />
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
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition";

  const canClone = profiles.length > 0;

  return (
    <form action={formAction} className="space-y-3">
      <div
        className={`grid grid-cols-1 gap-3 ${canClone ? "md:grid-cols-2" : ""}`}
      >
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">
            Name <span className="text-red-600">*</span>
          </span>
          <input
            name="name"
            required
            placeholder={canClone ? "High-margin, Auction, …" : "Default"}
            className={inputClass}
          />
        </label>
        {canClone && (
          <label className="block">
            <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">
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
        )}
      </div>

      {result && "error" in result && (
        <Alert variant="error">{result.error}</Alert>
      )}
      {result && "success" in result && (
        <Alert variant="success">{result.success}</Alert>
      )}

      <SubmitButton />
    </form>
  );
}
