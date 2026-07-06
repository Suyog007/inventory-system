"use client";

import { useEffect, useRef, useState } from "react";

interface TaxonomyResult {
  id: string;
  name: string;
  fullName: string;
  isLeaf: boolean;
}

interface Props {
  name: string; // hidden input name — the form receives the selected GID
  defaultValue?: string; // existing GID to hydrate the label
}

// Search-as-you-type picker for Shopify's Standard Product Taxonomy.
// Types are debounced 300ms then hit /api/shopify-taxonomy?q=. Selection
// stores the GID in a hidden input so the surrounding form posts it as normal.
export default function ShopifyCategoryPicker({
  name,
  defaultValue = "",
}: Props) {
  const [gid, setGid] = useState(defaultValue);
  const [label, setLabel] = useState<string>("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TaxonomyResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resolve the existing GID to a human label on first mount.
  useEffect(() => {
    if (!gid) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/shopify-taxonomy?id=${encodeURIComponent(gid)}`,
        );
        const data = (await res.json()) as {
          result: TaxonomyResult | null;
          error?: string;
        };
        if (cancelled) return;
        if (data.result) setLabel(data.result.fullName);
      } catch {
        // Silent — user still sees the raw GID as a fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the results panel on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, []);

  // Debounced search.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/shopify-taxonomy?q=${encodeURIComponent(query)}`,
        );
        const data = (await res.json()) as {
          results?: TaxonomyResult[];
          error?: string;
        };
        if (data.error) setError(data.error);
        setResults(data.results ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Search failed");
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function select(r: TaxonomyResult) {
    setGid(r.id);
    setLabel(r.fullName);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  function clear() {
    setGid("");
    setLabel("");
    setQuery("");
    setResults([]);
  }

  const inputClass =
    "w-full p-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={gid} />

      {gid && !open ? (
        <div className="flex items-center gap-2 p-2 border border-gray-300 rounded bg-gray-50">
          <div className="flex-1 min-w-0">
            <div className="text-sm truncate">{label || "(resolving…)"}</div>
            <div className="text-xs font-mono text-gray-500 truncate">
              {gid}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-blue-600 hover:underline shrink-0"
          >
            Change
          </button>
          <button
            type="button"
            onClick={clear}
            className="text-xs text-red-600 hover:underline shrink-0"
          >
            Clear
          </button>
        </div>
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search Shopify taxonomy (e.g. trading cards)"
            className={inputClass}
          />
          {open && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded shadow-lg max-h-72 overflow-auto">
              {loading && (
                <div className="p-2 text-xs text-gray-500">Searching…</div>
              )}
              {error && (
                <div className="p-2 text-xs text-red-600">{error}</div>
              )}
              {!loading &&
                !error &&
                query.trim().length >= 2 &&
                results.length === 0 && (
                  <div className="p-2 text-xs text-gray-500">
                    No matches for &ldquo;{query}&rdquo;.
                  </div>
                )}
              {!loading && query.trim().length < 2 && (
                <div className="p-2 text-xs text-gray-500">
                  Type at least 2 characters to search.
                </div>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => select(r)}
                  className="block w-full text-left p-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-sm">{r.fullName}</div>
                  <div className="text-xs text-gray-500 font-mono truncate">
                    {r.id} {r.isLeaf ? "· leaf" : "· branch"}
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
