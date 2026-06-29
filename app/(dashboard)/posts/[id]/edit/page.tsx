"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import RichTextEditor from "@/app/components/RichTextEditor";
import TargetingRulesEditor from "../../TargetingRulesEditor";
import type { TargetingRuleSet } from "@/types/targeting";
import styles from "../../form.module.css";

interface PostData {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  targetingRules: TargetingRuleSet | null;
  translations: Array<{ locale: string; title: string; content: string }>;
}

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [targetingRules, setTargetingRules] = useState<TargetingRuleSet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPost() {
      try {
        const res = await fetch(`/api/posts/${params.id}`);
        if (!res.ok) {
          setError("Post not found");
          return;
        }
        const post: PostData = await res.json();
        const enTranslation = post.translations.find((t) => t.locale === "en");
        setTitle(enTranslation?.title ?? "");
        setContent(enTranslation?.content ?? "");
        setStatus(post.status);
        setTargetingRules(post.targetingRules ?? null);
      } catch {
        setError("Failed to load post");
      } finally {
        setIsLoading(false);
      }
    }
    loadPost();
  }, [params.id]);

  const handleSave = async (newStatus?: "DRAFT" | "PUBLISHED") => {
    setIsSaving(true);
    try {
      const res = await fetch(`/api/posts/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          targetingRules,
          ...(newStatus && { status: newStatus }),
        }),
      });

      if (res.ok) {
        router.push("/posts");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save post.");
      }
    } catch {
      alert("An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <p>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p>{error}</p>
        <button className="btn-secondary" onClick={() => router.push("/posts")}>
          Back to Posts
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={() => router.back()} aria-label="Go back">
          &#8592;
        </button>
        <h2>Edit Post</h2>
      </header>

      <div className={styles.form}>
        <input
          type="text"
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Post title…"
        />

        <div className={styles.contentLabel}>Content</div>
        <div className={styles.editorWrapper}>
          <RichTextEditor value={content} onChange={setContent} height={480} />
        </div>

        <TargetingRulesEditor value={targetingRules} onChange={setTargetingRules} />

        <div className={styles.actions}>
          {status === "DRAFT" && (
            <button
              type="button"
              className="btn-secondary"
              disabled={isSaving || !title.trim() || !content.trim()}
              onClick={() => handleSave("DRAFT")}
            >
              {isSaving ? "Saving…" : "Save Draft"}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={isSaving || !title.trim() || !content.trim()}
            onClick={() => handleSave(status === "PUBLISHED" ? undefined : "PUBLISHED")}
          >
            {isSaving
              ? "Saving…"
              : status === "PUBLISHED"
                ? "Save Changes"
                : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
}
