"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCategory,
  updateCategory,
  type CategoryActionResult,
} from "./actions";
import ShopifyCategoryPicker from "./shopify-category-picker";

interface Props {
  category?: {
    id: string;
    name: string;
    shopifyCategoryId: string | null;
    position: number;
  };
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function CategoryForm({ category }: Props) {
  const boundAction = category
    ? updateCategory.bind(null, category.id)
    : createCategory;
  const [result, formAction] = useActionState<CategoryActionResult, FormData>(
    boundAction,
    undefined,
  );

  const inputClass =
    "w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
            Name <span className="text-red-600">*</span>
          </span>
          <input
            name="name"
            required
            defaultValue={category?.name ?? ""}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
            Shopify Category
          </span>
          <ShopifyCategoryPicker
            name="shopifyCategoryId"
            defaultValue={category?.shopifyCategoryId ?? ""}
          />
        </label>
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1">
            Sort position
          </span>
          <input
            name="position"
            type="number"
            min="0"
            defaultValue={category?.position ?? 0}
            className={inputClass}
          />
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

      <SubmitButton label={category ? "Save changes" : "Add category"} />
    </form>
  );
}
