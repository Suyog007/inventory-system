"use client";

import { useState } from "react";
import { Trash2, Check, X } from "lucide-react";
import { deleteCard } from "../actions";
import { buttonClass } from "@/lib/ui";

export default function DeleteCardButton({ cardId }: { cardId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={buttonClass("secondary")}
      >
        <Trash2 className="w-4 h-4 text-rose-500" />
        Delete
      </button>
    );
  }

  return (
    <form
      action={deleteCard.bind(null, cardId)}
      className="flex items-center gap-2 bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5"
    >
      <span className="text-sm text-rose-800 font-medium">Delete this card?</span>
      <button type="submit" className={buttonClass("danger", "sm")}>
        <Check className="w-3.5 h-3.5" />
        Yes
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className={buttonClass("ghost", "sm")}
      >
        <X className="w-3.5 h-3.5" />
        Cancel
      </button>
    </form>
  );
}
