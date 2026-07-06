"use client";

import { useCallback, useRef, useState } from "react";

interface Props {
  // Newline-separated URLs (matches existing form field shape so actions.ts is unchanged).
  defaultValue?: string;
  // Hidden input name — keep "imageUrls" to match the existing form.
  name?: string;
}

export default function ImageDropZone({
  defaultValue = "",
  name = "imageUrls",
}: Props) {
  const [urls, setUrls] = useState<string[]>(
    defaultValue.split(/\r?\n/).map((u) => u.trim()).filter(Boolean),
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  // Independent state for the paste textarea so Enter / newlines behave
  // normally. Users click "Add URLs" (or blur) to move valid entries into
  // the image grid.
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    setError(null);
    const list = Array.from(files);
    if (list.length === 0) return;
    setPendingCount((c) => c + list.length);
    try {
      const results = await Promise.allSettled(
        list.map(async (file) => {
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/uploads/shopify-image", {
            method: "POST",
            body: fd,
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || `Upload failed (${res.status})`);
          }
          const { url } = (await res.json()) as { url: string };
          return url;
        }),
      );
      const newUrls: string[] = [];
      const errors: string[] = [];
      for (const r of results) {
        if (r.status === "fulfilled") newUrls.push(r.value);
        else errors.push(r.reason.message);
      }
      setUrls((u) => [...u, ...newUrls]);
      if (errors.length) {
        setError(errors.slice(0, 3).join("; "));
      }
    } finally {
      setPendingCount((c) => c - list.length);
    }
  }, []);

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      void uploadFiles(e.dataTransfer.files);
    }
  }

  function removeAt(i: number) {
    setUrls((u) => u.filter((_, idx) => idx !== i));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= urls.length) return;
    setUrls((u) => {
      const next = [...u];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // Parse pasteText into valid HTTP(S) URLs, add to grid, and clear the box.
  function commitPastedUrls() {
    const lines = pasteText.split(/\r?\n/).map((u) => u.trim()).filter(Boolean);
    if (lines.length === 0) {
      setPasteText("");
      setPasteError(null);
      return;
    }
    const good: string[] = [];
    const bad: string[] = [];
    for (const line of lines) {
      if (/^https?:\/\//i.test(line)) good.push(line);
      else bad.push(line);
    }
    if (good.length > 0) {
      setUrls((u) => [...u, ...good.filter((v) => !u.includes(v))]);
    }
    if (bad.length > 0) {
      setPasteError(
        `${bad.length} line${bad.length === 1 ? "" : "s"} skipped — must start with http:// or https://`,
      );
    } else {
      setPasteError(null);
    }
    setPasteText("");
  }

  return (
    <div>
      {/* Hidden field that submits with the form — actions.ts splits on newlines */}
      <input type="hidden" name={name} value={urls.join("\n")} />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition ${
          dragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:bg-gray-100"
        }`}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <p className="text-sm text-gray-700">
          {pendingCount > 0
            ? `Uploading ${pendingCount} file${pendingCount > 1 ? "s" : ""}...`
            : "Drag images here, or click to browse"}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          JPEG / PNG / WebP / GIF · up to 20 MB · uploaded directly to Shopify CDN
        </p>
      </div>

      {error && (
        <p className="text-red-600 text-sm mt-2" role="alert">
          {error}
        </p>
      )}

      {urls.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          {urls.map((url, i) => (
            <div
              key={url + i}
              className="relative group border border-gray-200 rounded overflow-hidden bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-full h-32 object-contain bg-gray-50"
              />
              <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
                {i > 0 && (
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    title="Move left"
                    className="bg-white/90 text-xs px-1.5 py-0.5 rounded shadow hover:bg-white"
                  >
                    ←
                  </button>
                )}
                {i < urls.length - 1 && (
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    title="Move right"
                    className="bg-white/90 text-xs px-1.5 py-0.5 rounded shadow hover:bg-white"
                  >
                    →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  title="Remove"
                  className="bg-white/90 text-red-600 text-xs px-1.5 py-0.5 rounded shadow hover:bg-red-50"
                >
                  ×
                </button>
              </div>
              <div className="absolute bottom-1 left-1 text-[10px] bg-gray-900/70 text-white px-1.5 py-0.5 rounded">
                {i === 0 ? "primary" : `#${i + 1}`}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowPaste((s) => !s)}
        className="text-xs text-gray-500 hover:text-gray-700 mt-3 underline"
      >
        {showPaste ? "Hide URL paste" : "Or paste URLs"}
      </button>
      {showPaste && (
        <div className="mt-2 space-y-2">
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            onKeyDown={(e) => {
              // Ctrl/Cmd + Enter to commit; plain Enter still adds a newline.
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                commitPastedUrls();
              }
            }}
            rows={3}
            placeholder={"https://example.com/front.jpg\nhttps://example.com/back.jpg"}
            className="w-full p-2 border border-gray-300 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] text-gray-500">
              One URL per line. Press{" "}
              <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-300 rounded text-[10px]">
                ⌘/Ctrl + Enter
              </kbd>{" "}
              to add.
            </p>
            <button
              type="button"
              onClick={commitPastedUrls}
              disabled={pasteText.trim().length === 0}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Add URLs
            </button>
          </div>
          {pasteError && (
            <p className="text-xs text-amber-700" role="alert">
              {pasteError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
