"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/app/components/RichTextEditor";
import TargetingRulesEditor from "../TargetingRulesEditor";
import type { TargetingRuleSet } from "@/types/targeting";
import styles from "../form.module.css";

export default function CreatePostPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetingRules, setTargetingRules] = useState<TargetingRuleSet | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required.";
    const textContent = content.replace(/<[^>]*>/g, "").trim();
    if (!textContent) errs.content = "Content is required.";
    return errs;
  };

  const handleSubmit = async (status: "DRAFT" | "PUBLISHED") => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, status, targetingRules }),
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
          onChange={(e) => { setTitle(e.target.value); setErrors((prev) => { const { title: _, ...rest } = prev; return rest; }); }}
          placeholder="Post title… *"
          autoFocus
        />
        {errors.title && <p className={styles.errorText}>{errors.title}</p>}

        <div className={styles.contentLabel}>Content <span className={styles.required}>*</span></div>
        <div className={`${styles.editorWrapper} ${errors.content ? styles.editorError : ""}`}>
          <RichTextEditor value={content} onChange={(v) => { setContent(v); setErrors((prev) => { const { content: _, ...rest } = prev; return rest; }); }} height={480} />
        </div>
        {errors.content && <p className={styles.errorText}>{errors.content}</p>}

        <TargetingRulesEditor value={targetingRules} onChange={setTargetingRules} />

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
    </div>
  );
}
