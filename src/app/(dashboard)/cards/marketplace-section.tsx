"use client";

import { useState } from "react";
import TiptapEditor from "@/lib/editor/tiptap";

interface Props {
  defaultUseTitleTemplate?: boolean;
  defaultUseDescriptionTemplate?: boolean;
  defaultTitleOverride?: string;
  defaultDescriptionOverride?: string;
}

// The single point of entry for a card's title + description. What gets typed
// (or auto-rendered from the category template) is what shows in the dashboard
// AND what gets pushed to every channel. No separate "local" title.
export default function MarketplaceSection({
  defaultUseTitleTemplate = true,
  defaultUseDescriptionTemplate = true,
  defaultTitleOverride = "",
  defaultDescriptionOverride = "",
}: Props) {
  const [useTitleTemplate, setUseTitleTemplate] = useState(
    defaultUseTitleTemplate,
  );
  const [useDescTemplate, setUseDescTemplate] = useState(
    defaultUseDescriptionTemplate,
  );

  const inputClass =
    "w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-5">
      <h2 className="font-semibold">Title &amp; description</h2>
      <p className="text-xs text-gray-500 -mt-3">
        What&apos;s displayed in your dashboard and pushed to every channel.
        Auto-generate from the category template or lock it and type your own.
      </p>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-wider text-gray-500">
            Title
            {!useTitleTemplate && <span className="text-red-600 ml-0.5">*</span>}
          </span>
          <label className="text-xs flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              name="useTitleTemplate"
              value="1"
              checked={useTitleTemplate}
              onChange={(e) => setUseTitleTemplate(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Use template
          </label>
        </div>
        {useTitleTemplate ? (
          <div className="text-xs italic text-gray-500 p-2 border border-dashed border-gray-300 rounded">
            Auto-generated from the category&apos;s title template.
          </div>
        ) : (
          <input
            name="titleOverride"
            defaultValue={defaultTitleOverride}
            required
            className={inputClass}
          />
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs uppercase tracking-wider text-gray-500">
            Description
          </span>
          <label className="text-xs flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              name="useDescriptionTemplate"
              value="1"
              checked={useDescTemplate}
              onChange={(e) => setUseDescTemplate(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            Use template
          </label>
        </div>
        {useDescTemplate ? (
          <div className="text-xs italic text-gray-500 p-2 border border-dashed border-gray-300 rounded">
            Auto-generated from the category&apos;s description template.
          </div>
        ) : (
          <TiptapEditor
            name="descriptionHtmlOverride"
            defaultValue={defaultDescriptionOverride}
          />
        )}
      </div>
    </div>
  );
}
