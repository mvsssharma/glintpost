"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import RichTextEditor from "@/app/components/RichTextEditor";
import AudiencePicker, { type AudienceTargeting } from "../../../audiences/AudiencePicker";
import { hasRichContent } from "@/lib/rich-text";
import styles from "../../form.module.css";

interface PostData {
  id: string;
  status: "DRAFT" | "PUBLISHED";
  audienceIds: string[];
  audienceMatch: "AND" | "OR";
  translations: Array<{ locale: string; title: string; content: string }>;
}

export default function EditPostPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [targeting, setTargeting] = useState<AudienceTargeting>({ audienceIds: [], audienceMatch: "OR" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
        setTargeting({
          audienceIds: post.audienceIds ?? [],
          audienceMatch: post.audienceMatch ?? "OR",
        });
      } catch {
        setError("Failed to load post");
      } finally {
        setIsLoading(false);
      }
    }
    loadPost();
  }, [params.id]);

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required.";
    if (!hasRichContent(content)) errs.content = "Content is required.";
    return errs;
  };

  const handleSave = async (newStatus?: "DRAFT" | "PUBLISHED") => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/posts/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          ...targeting,
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
          className={`${styles.titleInput} ${errors.title ? styles.titleError : ""}`}
          value={title}
          onChange={(e) => { setTitle(e.target.value); setErrors((prev) => { const { title: _, ...rest } = prev; return rest; }); }}
          placeholder="Post title… *"
        />
        {errors.title && <p className={styles.errorText}>{errors.title}</p>}

        <div className={styles.contentLabel}>Content <span className={styles.required}>*</span></div>
        <div className={`${styles.editorWrapper} ${errors.content ? styles.editorError : ""}`}>
          <RichTextEditor value={content} onChange={(v) => { setContent(v); setErrors((prev) => { const { content: _, ...rest } = prev; return rest; }); }} height={480} />
        </div>
        {errors.content && <p className={styles.errorText}>{errors.content}</p>}

        <AudiencePicker {...targeting} onChange={setTargeting} />

        <div className={styles.actions}>
          {status === "DRAFT" && (
            <button
              type="button"
              className="btn-secondary"
              disabled={isSaving}
              onClick={() => handleSave("DRAFT")}
            >
              {isSaving ? "Saving…" : "Save Draft"}
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            disabled={isSaving}
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
