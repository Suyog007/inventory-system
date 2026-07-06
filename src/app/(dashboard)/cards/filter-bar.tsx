"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X, LayoutGrid, List } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface Props {
  defaultQ: string;
  defaultCategory: string;
  defaultGrader: string;
  defaultView: "grid" | "table";
  categories: Category[];
  graders: string[];
}

export default function CardsFilterBar({
  defaultQ,
  defaultCategory,
  defaultGrader,
  defaultView,
  categories,
  graders,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(defaultQ);
  const [category, setCategory] = useState(defaultCategory);
  const [grader, setGrader] = useState(defaultGrader);

  function apply(nextView?: "grid" | "table") {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    if (category) params.set("category", category);
    else params.delete("category");
    if (grader) params.set("grader", grader);
    else params.delete("grader");
    if (nextView) params.set("view", nextView);
    params.delete("page");
    router.push(`/cards?${params.toString()}`);
  }

  function reset() {
    setQ("");
    setCategory("");
    setGrader("");
    router.push(`/cards`);
  }

  const filtersActive = Boolean(q || category || grader);
  const inputClass =
    "px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") apply();
            }}
            placeholder="Search title, player, cert#, SKU..."
            className={`${inputClass} w-full pl-9`}
          />
          {q && (
            <button
              type="button"
              onClick={() => {
                setQ("");
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={grader}
          onChange={(e) => setGrader(e.target.value)}
          className={inputClass}
        >
          <option value="">All graders</option>
          {graders.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => apply()}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg font-medium text-sm hover:bg-gray-800 shadow-sm transition-all"
        >
          Apply
        </button>

        {filtersActive && (
          <button
            type="button"
            onClick={reset}
            className="text-gray-600 px-3 py-2 text-sm hover:text-gray-900 transition inline-flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            Reset
          </button>
        )}

        <div className="ml-auto flex items-center gap-0 bg-gray-100 rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => apply("grid")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
              defaultView === "grid"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => apply("table")}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
              defaultView === "table"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
            aria-label="Table view"
          >
            <List className="w-3.5 h-3.5" />
            Table
          </button>
        </div>
      </div>
    </div>
  );
}
