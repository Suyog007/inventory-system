"use client";

import { useState } from "react";
import { Trash2, Check, X } from "lucide-react";
import { deleteCategory } from "./actions";

// Two-stage delete: first click shows an inline confirmation, second click
// commits. Matches the pattern used by DeleteCardButton on card detail so the
// remove action feels consistent across the app.
export default function RemoveCategoryButton({
  categoryId,
  categoryName,
}: {
  categoryId: string;
  categoryName: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="group inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-medium transition"
      >
        <Trash2 className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
        Remove
      </button>
    );
  }

  return (
    <form
      action={deleteCategory.bind(null, categoryId)}
      className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg px-2 py-1"
    >
      <span className="text-xs text-rose-800 font-medium">
        Delete &ldquo;{categoryName}&rdquo;?
      </span>
      <button
        type="submit"
        className="inline-flex items-center gap-0.5 text-xs bg-rose-600 hover:bg-rose-700 text-white px-2 py-0.5 rounded font-medium transition"
      >
        <Check className="w-3 h-3" />
        Yes
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="inline-flex items-center gap-0.5 text-xs text-gray-600 hover:text-gray-900 px-1.5 py-0.5 rounded font-medium transition"
      >
        <X className="w-3 h-3" />
        Cancel
      </button>
    </form>
  );
}
