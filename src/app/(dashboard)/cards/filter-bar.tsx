"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

interface Category {
  id: string;
  name: string;
}

interface Props {
  defaultQ: string;
  defaultCategory: string;
  defaultGrader: string;
  categories: Category[];
  graders: string[];
}

export default function CardsFilterBar({
  defaultQ,
  defaultCategory,
  defaultGrader,
  categories,
  graders,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(defaultQ);
  const [category, setCategory] = useState(defaultCategory);
  const [grader, setGrader] = useState(defaultGrader);

  function apply() {
    const params = new URLSearchParams(searchParams.toString());
    if (q) params.set("q", q);
    else params.delete("q");
    if (category) params.set("category", category);
    else params.delete("category");
    if (grader) params.set("grader", grader);
    else params.delete("grader");
    params.delete("page");
    router.push(`/cards?${params.toString()}`);
  }

  function reset() {
    setQ("");
    setCategory("");
    setGrader("");
    router.push(`/cards`);
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-3 items-center">
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") apply();
        }}
        placeholder="Search title, player, cert#, SKU..."
        className="flex-1 min-w-[260px] p-2 border border-gray-300 rounded"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="p-2 border border-gray-300 rounded bg-white"
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
        className="p-2 border border-gray-300 rounded bg-white"
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
        onClick={apply}
        className="bg-gray-900 text-white px-4 py-2 rounded font-medium hover:bg-gray-800"
      >
        Apply
      </button>
      <button
        type="button"
        onClick={reset}
        className="text-gray-600 px-2 py-2 hover:underline"
      >
        Reset
      </button>
    </div>
  );
}
