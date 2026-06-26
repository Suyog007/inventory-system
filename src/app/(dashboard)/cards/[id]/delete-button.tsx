"use client";

import { useState } from "react";
import { deleteCard } from "../actions";

export default function DeleteCardButton({ cardId }: { cardId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-red-600 hover:underline text-sm"
      >
        Delete card
      </button>
    );
  }

  return (
    <form action={deleteCard.bind(null, cardId)} className="flex items-center gap-2">
      <span className="text-sm text-red-700">Delete this card?</span>
      <button
        type="submit"
        className="bg-red-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-700"
      >
        Yes, delete
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="text-gray-600 hover:underline text-sm"
      >
        Cancel
      </button>
    </form>
  );
}
