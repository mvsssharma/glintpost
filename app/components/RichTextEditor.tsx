"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

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
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ list: "ordered" }, { list: "bullet" }],
      ["link", "image", "video"],
      ["clean"],
    ],
  };

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
      theme="snow"
      value={value}
      onChange={onChange}
      modules={modules}
      style={{ height: 300, marginBottom: 50 }}
    />
  );
}
