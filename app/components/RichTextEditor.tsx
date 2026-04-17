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

  // Intercept clipboard image paste — upload to R2 instead of embedding base64
  useEffect(() => {
    if (!mounted) return;
    const quill = quillRef.current?.getEditor();
    if (!quill) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      uploadFile(file).then((url) => {
        if (url) insertImage(url);
      });
    };

    quill.root.addEventListener("paste", handlePaste);
    return () => quill.root.removeEventListener("paste", handlePaste);
  }, [mounted, uploadFile, insertImage]);

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
