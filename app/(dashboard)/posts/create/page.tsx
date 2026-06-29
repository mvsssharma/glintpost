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

  const handleSubmit = async (status: "DRAFT" | "PUBLISHED") => {
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
        <h2>New Announcement</h2>
      </header>

      <div className={styles.form}>
        <input
          type="text"
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title…"
          autoFocus
        />

        <div className={styles.contentLabel}>Content</div>
        <div className={styles.editorWrapper}>
          <RichTextEditor value={content} onChange={setContent} height={480} />
        </div>

        <TargetingRulesEditor value={targetingRules} onChange={setTargetingRules} />

        <div className={styles.actions}>
          <button
            type="button"
            className="btn-secondary"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            onClick={() => handleSubmit("DRAFT")}
          >
            {isSubmitting ? "Saving…" : "Save as Draft"}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            onClick={() => handleSubmit("PUBLISHED")}
          >
            {isSubmitting ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
