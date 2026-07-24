"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";
import type ReactQuillType from "react-quill-new";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 300,
        background: "hsl(var(--bg-main))",
        borderRadius: 8,
        border: "1px solid hsl(var(--border-light))",
      }}
    />
  ),
});

export default function RichTextEditor({
  value,
  onChange,
  height = 300,
}: {
  value: string;
  onChange: (val: string) => void;
  height?: number;
}) {
  const [mounted, setMounted] = useState(false);
  const quillRef = useRef<ReactQuillType>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const uploadFile = useCallback(async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    if (!res.ok) return null;
    const data = await res.json();
    return data.url ?? null;
  }, []);

  const insertImage = useCallback((url: string) => {
    const quill = quillRef.current?.getEditor();
    if (!quill) return;
    const range = quill.getSelection(true);
    const index = range?.index ?? 0;
    quill.insertEmbed(index, "image", url);
    quill.setSelection({ index: index + 1, length: 0 });
  }, []);

  const imageHandler = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.click();
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await uploadFile(file);
      if (url) insertImage(url);
    };
  }, [uploadFile, insertImage]);

  // Keep modules stable so Quill doesn't reinitialise on every render
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, false] }],
          ["bold", "italic", "underline", "strike"],
          [{ list: "ordered" }, { list: "bullet" }],
          ["link", "image", "video"],
          ["clean"],
        ],
        handlers: { image: imageHandler },
      },
    }),
    [imageHandler]
  );

  // Intercept pasted screenshots and upload them, instead of letting Quill
  // embed the bytes as a base64 data URI (which bloats the stored document and
  // never reaches object storage).
  //
  // Two things this has to get right, both of which it previously got wrong:
  //
  // 1. It runs in the CAPTURE phase on `document`, not on `quill.root`. Quill
  //    registers its own clipboard listener on `quill.root` when the editor is
  //    constructed, and at the target listeners fire in registration order — so
  //    a bubble-phase listener here would run only after Quill had already
  //    converted the image to base64.
  // 2. The editor is resolved inside the handler, not when the effect runs.
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      // Resolved lazily, per paste. Reading the ref when the effect runs gets
      // null — ReactQuill has not attached it yet — and since nothing in the
      // dependency list changes once the editor appears, an early return there
      // means the listener is never attached at all.
      const quill = quillRef.current?.getEditor();
      if (!quill || !quill.root.contains(e.target as Node)) return;

      const data = e.clipboardData;
      if (!data) return;

      // Only take over when the clipboard is image-only, as a screenshot is.
      // When HTML is also present (copying an image out of a web page), Quill's
      // normal handling keeps the remote URL and the surrounding formatting —
      // better than replacing it all with a bare uploaded image.
      if (Array.from(data.types).includes("text/html")) return;

      const files = Array.from(data.items)
        .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((f): f is File => f !== null);
      if (files.length === 0) return;

      e.preventDefault();
      e.stopPropagation();

      // Sequential so multiple images keep their pasted order.
      (async () => {
        for (const file of files) {
          const url = await uploadFile(file);
          if (url) insertImage(url);
        }
      })();
    };

    document.addEventListener("paste", handlePaste, true);
    return () => document.removeEventListener("paste", handlePaste, true);
  }, [uploadFile, insertImage]);

  if (!mounted)
    return (
      <div
        style={{
          height: 300,
          background: "hsl(var(--bg-main))",
          borderRadius: 8,
          border: "1px solid hsl(var(--border-light))",
        }}
      />
    );

  return (
    <ReactQuill
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {...({ ref: quillRef } as any)}
      theme="snow"
      value={value}
      onChange={onChange}
      modules={modules}
      style={{ height, marginBottom: 50 }}
    />
  );
}
