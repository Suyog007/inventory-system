"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateCard, type CardActionResult } from "../../actions";
import CardFormFields from "../../card-form-fields";

interface Props {
  cardId: string;
  defaults: Parameters<typeof CardFormFields>[0]["defaults"];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-6 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

export default function EditCardForm({ cardId, defaults }: Props) {
  const boundAction = updateCard.bind(null, cardId);
  const [result, formAction] = useActionState<CardActionResult, FormData>(
    boundAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-5">
      <CardFormFields defaults={defaults} />

      {result && "error" in result && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded">
          {result.error}
        </div>
      )}
      {result && "success" in result && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-3 rounded">
          {result.success}
        </div>
      )}

      <div className="flex items-center gap-3">
        <SubmitButton />
        <a href={`/cards/${cardId}`} className="text-gray-600 hover:underline">
          Cancel
        </a>
      </div>
    </form>
  );
}
