"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import RichTextEditor from "@/app/components/RichTextEditor";
import { useAIRefine, RefineButton, RefinePreview } from "@/app/components/AIRefine";
import AudiencePicker, { type AudienceTargeting } from "../../audiences/AudiencePicker";
import styles from "../form.module.css";

function defaultDatetime(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function CreateAnnouncementForm({ aiConfigured }: { aiConfigured: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [displayType, setDisplayType] = useState<"OVERLAY" | "TOP_BANNER">("OVERLAY");
  const [priority, setPriority] = useState(0);
  const [startDate, setStartDate] = useState(defaultDatetime(0));
  const [endDate, setEndDate] = useState(defaultDatetime(7));
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

  const hasContent = content.replace(/<[^>]*>/g, "").trim().length > 0;

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Title is required.";
    const textContent = content.replace(/<[^>]*>/g, "").trim();
    if (!textContent) errs.content = "Content is required.";
    if (!startDate) errs.startDate = "Start date is required.";
    if (!endDate) errs.endDate = "End date is required.";
    if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
      errs.endDate = "End date must be after start date.";
    }
    return errs;
  };

  const handleSubmit = async (status: "DRAFT" | "PUBLISHED") => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content,
          imageUrl: imageUrl || null,
          videoUrl: videoUrl || null,
          ctaText: ctaText || null,
          ctaUrl: ctaUrl || null,
          displayType,
          priority,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          ...targeting,
          status,
        }),
      });

      if (res.ok) {
        router.push("/announcements");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to create announcement.");
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
          className={`${styles.titleInput} ${errors.title ? styles.titleError : ""}`}
          value={title}
          onChange={(e) => { setTitle(e.target.value); clearError("title"); }}
          placeholder="Announcement title… *"
          autoFocus
        />
        {errors.title && <p className={styles.errorText}>{errors.title}</p>}

        <div className={styles.contentLabel}>
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
          <RichTextEditor value={content} onChange={(v) => { setContent(v); clearError("content"); }} height={200} />
        </div>
        {errors.content && <p className={styles.errorText}>{errors.content}</p>}

        <div className={styles.fieldGroup}>
          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Display Type</label>
              <select value={displayType} onChange={(e) => setDisplayType(e.target.value as "OVERLAY" | "TOP_BANNER")}>
                <option value="OVERLAY">Full-screen Overlay</option>
                <option value="TOP_BANNER">Top Banner</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Priority (higher = shown first)</label>
              <input type="number" min={0} max={1000} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={`${styles.field} ${errors.startDate ? styles.fieldHasError : ""}`}>
              <label>Start Date <span className={styles.required}>*</span></label>
              <input type="datetime-local" value={startDate} onChange={(e) => { setStartDate(e.target.value); clearError("startDate"); }} />
              {errors.startDate && <p className={styles.errorText}>{errors.startDate}</p>}
            </div>
            <div className={`${styles.field} ${errors.endDate ? styles.fieldHasError : ""}`}>
              <label>End Date <span className={styles.required}>*</span></label>
              <input type="datetime-local" value={endDate} onChange={(e) => { setEndDate(e.target.value); clearError("endDate"); }} />
              {errors.endDate && <p className={styles.errorText}>{errors.endDate}</p>}
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>Image URL (optional)</label>
              <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
            </div>
            <div className={styles.field}>
              <label>Video URL (optional)</label>
              <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label>CTA Button Text (optional)</label>
              <input type="text" value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Learn more" />
            </div>
            <div className={styles.field}>
              <label>CTA URL (optional)</label>
              <input type="text" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="/features or https://..." />
            </div>
          </div>
        </div>

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
