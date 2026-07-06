"use client";

// Thin TipTap wrapper: WYSIWYG editor that produces HTML matching what our
// template renderer can consume. Toolbar is intentionally lean — bold, italic,
// underline, headings, bullet/ordered lists, link. Anything richer belongs in a
// future rich-editor phase.

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useState } from "react";

interface Props {
  name: string; // hidden input name so the value posts with the form
  defaultValue?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
}

export default function TiptapEditor({
  name,
  defaultValue = "",
  onChange,
}: Props) {
  const [html, setHtml] = useState(defaultValue);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
    ],
    content: defaultValue,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const value = editor.getHTML();
      setHtml(value);
      onChange?.(value);
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[220px] p-3 focus:outline-none",
      },
    },
  });

  // Keep the hidden input in sync when the editor rehydrates with a new default
  // (e.g. switching between categories).
  useEffect(() => {
    if (editor && defaultValue !== editor.getHTML()) {
      editor.commands.setContent(defaultValue);
      setHtml(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValue]);

  if (!editor) {
    return (
      <div className="border border-gray-300 rounded bg-gray-50 h-[280px] animate-pulse" />
    );
  }

  const btn = (active: boolean) =>
    `px-2 py-1 text-xs rounded ${
      active
        ? "bg-blue-100 text-blue-700"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div className="border border-gray-300 rounded bg-white">
      <div className="flex flex-wrap gap-1 border-b border-gray-200 p-2">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={btn(editor.isActive("bold"))}
        >
          <b>B</b>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={btn(editor.isActive("italic"))}
        >
          <i>I</i>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={btn(editor.isActive("strike"))}
        >
          <s>S</s>
        </button>
        <span className="w-px bg-gray-200 mx-1" />
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          className={btn(editor.isActive("heading", { level: 2 }))}
        >
          H2
        </button>
        <button
          type="button"
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          className={btn(editor.isActive("heading", { level: 3 }))}
        >
          H3
        </button>
        <span className="w-px bg-gray-200 mx-1" />
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={btn(editor.isActive("bulletList"))}
        >
          •≡
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={btn(editor.isActive("orderedList"))}
        >
          1.≡
        </button>
        <span className="w-px bg-gray-200 mx-1" />
        <button
          type="button"
          onClick={() => {
            const url = window.prompt("URL");
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
          className={btn(editor.isActive("link"))}
        >
          🔗
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().unsetLink().run()}
          className="px-2 py-1 text-xs rounded text-gray-500 hover:bg-gray-100"
        >
          ⛔
        </button>
      </div>
      <EditorContent editor={editor} />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
