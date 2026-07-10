"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/app/components/RichTextEditor";
import { useAIRefine, RefineButton, RefinePreview } from "@/app/components/AIRefine";
import AudiencePicker, { type AudienceTargeting } from "../../audiences/AudiencePicker";
import styles from "../form.module.css";

export default function CreatePostForm({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targeting, setTargeting] = useState<AudienceTargeting>({ audienceIds: [], audienceMatch: "OR" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { isRefining, refinement, setRefinement, runRefine, error: refineError } = useAIRefine();

  const clearError = (field: string) =>
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required.";
    const textContent = content.replace(/<[^>]*>/g, "").trim();
    if (!textContent) errs.content = "Content is required.";
    return errs;
  };

  const hasContent = content.replace(/<[^>]*>/g, "").trim().length > 0;

  const handleSubmit = async (status: "DRAFT" | "PUBLISHED") => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, status, ...targeting }),
      });

      if (res.ok) {
        router.push("/posts");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create post.");
      }
    } catch {
      alert("An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()} aria-label="Go back">
          &#8592;
        </button>
        <h2>New Post</h2>
      </header>

      <div className={styles.form}>
        <input
          type="text"
          className={`${styles.titleInput} ${errors.title ? styles.titleError : ""}`}
          value={title}
          onChange={(e) => { setTitle(e.target.value); clearError("title"); }}
          placeholder="Post title… *"
          autoFocus
        />
        {errors.title && <p className={styles.errorText}>{errors.title}</p>}

        <div className={styles.contentLabel} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Content <span className={styles.required}>*</span></span>
          <RefineButton
            aiConfigured={aiConfigured}
            hasContent={hasContent}
            isRefining={isRefining}
            onClick={() => runRefine(content)}
          />
        </div>
        {refineError && <p className={styles.errorText}>{refineError}</p>}
        <div className={`${styles.editorWrapper} ${errors.content ? styles.editorError : ""}`}>
          <RichTextEditor value={content} onChange={(v) => { setContent(v); clearError("content"); }} height={480} />
        </div>
        {errors.content && <p className={styles.errorText}>{errors.content}</p>}

        <AudiencePicker {...targeting} onChange={setTargeting} />

        <div className={styles.actions}>
          <button
            type="button"
            className="btn-secondary"
            disabled={isSubmitting}
            onClick={() => handleSubmit("DRAFT")}
          >
            {isSubmitting ? "Saving…" : "Save as Draft"}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={isSubmitting}
            onClick={() => handleSubmit("PUBLISHED")}
          >
            {isSubmitting ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      {refinement && (
        <RefinePreview
          refinement={refinement}
          onApply={() => { setContent(refinement.content); setRefinement(null); }}
          onCancel={() => setRefinement(null)}
        />
      )}
    </div>
  );
}
