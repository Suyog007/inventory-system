"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import TiptapEditor from "@/lib/editor/tiptap";
import {
  saveTemplates,
  type TemplateActionResult,
} from "./actions";
import { renderText, renderHtml, TEMPLATE_TOKENS } from "@/lib/templates/render";

interface ExampleCard {
  id: string;
  tokens: Record<string, string>;
  label: string;
}

interface Props {
  categoryId: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultSku: string;
  examples: ExampleCard[];
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
    >
      {pending ? "Saving..." : "Save templates"}
    </button>
  );
}

export default function TemplateEditor({
  categoryId,
  defaultTitle,
  defaultDescription,
  defaultSku,
  examples,
}: Props) {
  const boundAction = saveTemplates.bind(null, categoryId);
  const [result, formAction] = useActionState<TemplateActionResult, FormData>(
    boundAction,
    undefined,
  );

  // Local state so the preview updates as the user types.
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription);
  const [sku, setSku] = useState(defaultSku);
  const [exampleIdx, setExampleIdx] = useState(0);

  const example = examples[exampleIdx];
  const tokens = example?.tokens ?? {};

  const previewTitle = example ? renderText(title, tokens) : title;
  const previewSku = example ? renderText(sku, tokens) : sku;
  const previewDescriptionHtml = example
    ? renderHtml(description, tokens)
    : description;

  const inputClass =
    "w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <form
        action={formAction}
        className="lg:col-span-3 space-y-5"
      >
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-1">Marketplace title template</h2>
          <p className="text-xs text-gray-500 mb-3">
            Blank fields are silently skipped. Use{" "}
            <code>{"{Token}"}</code> to insert card data.
          </p>
          <input
            name="titleTemplate"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-1">Marketplace description template</h2>
          <p className="text-xs text-gray-500 mb-3">
            Rich text. Use <code>{"{Token}"}</code> anywhere.
          </p>
          <TiptapEditor
            name="descriptionTemplate"
            defaultValue={defaultDescription}
            onChange={setDescription}
          />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="font-semibold mb-1">SKU template</h2>
          <p className="text-xs text-gray-500 mb-3">
            Applied per channel. Graded cards auto-fall-back to the certification
            number when this is blank.
          </p>
          <input
            name="skuTemplate"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="{CertificationNumber}"
            className={inputClass}
          />
        </div>

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

        <SubmitButton />
      </form>

      <div className="lg:col-span-2 space-y-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Available tokens</h3>
          </div>
          <div className="flex flex-wrap gap-1">
            {TEMPLATE_TOKENS.map((t) => (
              <code
                key={t}
                className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded"
              >
                {"{"}
                {t}
                {"}"}
              </code>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Example</h3>
            {examples.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setExampleIdx((i) => (i + 1) % examples.length)
                }
                className="text-xs text-blue-600 hover:underline"
              >
                View another example →
              </button>
            )}
          </div>

          {examples.length === 0 ? (
            <p className="text-sm text-gray-500">
              Add a card to this category to see live examples.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  {example.label}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  Title
                </div>
                <div className="p-2 border border-gray-200 rounded bg-gray-50">
                  {previewTitle || (
                    <span className="text-gray-400">empty</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  Description
                </div>
                <div
                  className="p-2 border border-gray-200 rounded bg-gray-50 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: previewDescriptionHtml }}
                />
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
                  SKU
                </div>
                <div className="p-2 border border-gray-200 rounded bg-gray-50 font-mono text-xs">
                  {previewSku || (
                    <span className="text-gray-400">empty</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
