"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import RichTextEditor from "@/app/components/RichTextEditor";
import TargetingRulesEditor from "../../../posts/TargetingRulesEditor";
import type { TargetingRuleSet } from "@/types/targeting";
import styles from "../../form.module.css";

interface AnnouncementData {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  displayType: "OVERLAY" | "TOP_BANNER";
  priority: number;
  startDate: string;
  endDate: string;
  status: "DRAFT" | "PUBLISHED";
  targetingRules: TargetingRuleSet | null;
  views: number;
  clicks: number;
}

function toLocalDatetime(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function EditAnnouncementPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [displayType, setDisplayType] = useState<"OVERLAY" | "TOP_BANNER">("OVERLAY");
  const [priority, setPriority] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  const [targetingRules, setTargetingRules] = useState<TargetingRuleSet | null>(null);
  const [views, setViews] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/announcements/${params.id}`);
        if (!res.ok) {
          setError("Announcement not found");
          return;
        }
        const data: AnnouncementData = await res.json();
        setTitle(data.title);
        setContent(data.content);
        setImageUrl(data.imageUrl ?? "");
        setVideoUrl(data.videoUrl ?? "");
        setCtaText(data.ctaText ?? "");
        setCtaUrl(data.ctaUrl ?? "");
        setDisplayType(data.displayType);
        setPriority(data.priority);
        setStartDate(toLocalDatetime(data.startDate));
        setEndDate(toLocalDatetime(data.endDate));
        setStatus(data.status);
        setTargetingRules(data.targetingRules ?? null);
        setViews(data.views);
        setClicks(data.clicks);
      } catch {
        setError("Failed to load announcement");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [params.id]);

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

  const handleSave = async (newStatus?: "DRAFT" | "PUBLISHED") => {
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/announcements/${params.id}`, {
        method: "PUT",
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
          targetingRules,
          ...(newStatus && { status: newStatus }),
        }),
      });

      if (res.ok) {
        router.push("/announcements");
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to save announcement.");
      }
    } catch {
      alert("An error occurred.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className={styles.container}><p>Loading...</p></div>;
  }

  if (error) {
    return (
      <div className={styles.container}>
        <p>{error}</p>
        <button className="btn-secondary" onClick={() => router.push("/announcements")}>
          Back to Announcements
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
        <h2>Edit Announcement</h2>
      </header>

      {(views > 0 || clicks > 0) && (
        <div className={styles.analyticsBar}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{views}</span>
            <span className={styles.statLabel}>Views</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{clicks}</span>
            <span className={styles.statLabel}>Clicks</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{views > 0 ? ((clicks / views) * 100).toFixed(1) + "%" : "–"}</span>
            <span className={styles.statLabel}>CTR</span>
          </div>
        </div>
      )}

      <div className={styles.form}>
        <input
          type="text"
          className={`${styles.titleInput} ${errors.title ? styles.titleError : ""}`}
          value={title}
          onChange={(e) => { setTitle(e.target.value); setErrors((prev) => { const { title: _, ...rest } = prev; return rest; }); }}
          placeholder="Announcement title… *"
        />
        {errors.title && <p className={styles.errorText}>{errors.title}</p>}

        <div className={styles.contentLabel}>Content <span className={styles.required}>*</span></div>
        <div className={`${styles.editorWrapper} ${errors.content ? styles.editorError : ""}`}>
          <RichTextEditor value={content} onChange={(v) => { setContent(v); setErrors((prev) => { const { content: _, ...rest } = prev; return rest; }); }} height={200} />
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
              <input type="datetime-local" value={startDate} onChange={(e) => { setStartDate(e.target.value); setErrors((prev) => { const { startDate: _, ...rest } = prev; return rest; }); }} />
              {errors.startDate && <p className={styles.errorText}>{errors.startDate}</p>}
            </div>
            <div className={`${styles.field} ${errors.endDate ? styles.fieldHasError : ""}`}>
              <label>End Date <span className={styles.required}>*</span></label>
              <input type="datetime-local" value={endDate} onChange={(e) => { setEndDate(e.target.value); setErrors((prev) => { const { endDate: _, ...rest } = prev; return rest; }); }} />
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

        <TargetingRulesEditor value={targetingRules} onChange={setTargetingRules} />

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
