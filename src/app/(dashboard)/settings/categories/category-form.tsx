"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  createCategory,
  updateCategory,
  type CategoryActionResult,
} from "./actions";
import ShopifyCategoryPicker from "./shopify-category-picker";
import { Alert, buttonClass } from "@/lib/ui";

interface Props {
  category?: {
    id: string;
    name: string;
    shopifyCategoryId: string | null;
  };
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary")}>
      {pending ? "Saving..." : label}
    </button>
  );
}

export default function CategoryForm({ category }: Props) {
  const isEdit = Boolean(category);
  const boundAction = category
    ? updateCategory.bind(null, category.id)
    : createCategory;
  const [result, formAction] = useActionState<CategoryActionResult, FormData>(
    boundAction,
    undefined,
  );

  const formRef = useRef<HTMLFormElement>(null);
  // Bumping this remounts the ShopifyCategoryPicker so its internal state
  // (selected GID + label) clears alongside the plain inputs. Only used in
  // create mode — edits should keep the picker's selection after save.
  const [pickerVersion, setPickerVersion] = useState(0);

  useEffect(() => {
    if (!isEdit && result && "success" in result) {
      formRef.current?.reset();
      setPickerVersion((n) => n + 1);
    }
  }, [result, isEdit]);

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition";

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">
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
          <span className="block text-xs uppercase tracking-wider text-gray-500 mb-1 font-semibold">
            Shopify Category
          </span>
          <ShopifyCategoryPicker
            key={pickerVersion}
            name="shopifyCategoryId"
            defaultValue={category?.shopifyCategoryId ?? ""}
          />
        </label>
      </div>

      {result && "error" in result && (
        <Alert variant="error">{result.error}</Alert>
      )}
      {result && "success" in result && (
        <Alert variant="success">{result.success}</Alert>
      )}

      <SubmitButton label={category ? "Save changes" : "Add category"} />
    </form>
  );
}
