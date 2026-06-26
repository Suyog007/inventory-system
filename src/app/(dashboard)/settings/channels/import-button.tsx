"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { runImport, type ImportActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-gray-900 text-white px-4 py-2 rounded font-medium hover:bg-gray-800 disabled:opacity-50"
    >
      {pending ? "Importing..." : "Import all from Shopify"}
    </button>
  );
}

export default function ImportButton({ connectionId }: { connectionId: string }) {
  const boundAction = runImport.bind(null, connectionId);
  const [result, formAction] = useActionState<ImportActionResult, FormData>(
    boundAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <SubmitButton />
      {result?.ok === true && (
        <div className="text-sm">
          <p className="text-green-700">
            ✓ {result.productsAdded} added, {result.productsUpdated} updated.
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-1 text-red-700 list-disc list-inside">
              {result.errors.slice(0, 5).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {result.errors.length > 5 && (
                <li>...and {result.errors.length - 5} more (see server logs)</li>
              )}
            </ul>
          )}
        </div>
      )}
      {result?.ok === false && (
        <p className="text-sm text-red-700">✗ {result.error}</p>
      )}
    </form>
  );
}
