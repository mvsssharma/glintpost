"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import styles from "./AIRefine.module.css";

export type Refinement = { content: string; warnings: string[] };

/**
 * Shared "Refine with AI" behaviour for rich-text editors (changelog posts,
 * announcements, …). Calls the dashboard-only refine endpoint, which holistically
 * rewrites the current editor HTML in place — keeping media, links, formatting and
 * code untouched — using the org's shared nomenclature.
 *
 * Errors are surfaced via the returned `error` string (render it in the UI) rather
 * than a blocking `alert()`.
 */
export function useAIRefine() {
  const [isRefining, setIsRefining] = useState(false);
  const [refinement, setRefinement] = useState<Refinement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runRefine = async (content: string) => {
    if (isRefining) return;
    if (!content.replace(/<[^>]*>/g, "").trim()) return;
    setError(null);
    setIsRefining(true);
    try {
      const res = await fetch("/api/internal/posts/ai-refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (res.ok) {
        setRefinement({ content: data.content, warnings: data.terminologyWarnings ?? [] });
      } else {
        setError(data.error || "Refine failed.");
      }
    } catch {
      setError("Could not reach the refine service.");
    } finally {
      setIsRefining(false);
    }
  };

  return { isRefining, refinement, setRefinement, runRefine, error, clearError: () => setError(null) };
}

export function RefineButton({
  aiConfigured,
  hasContent,
  isRefining,
  onClick,
}: {
  aiConfigured: boolean;
  hasContent: boolean;
  isRefining: boolean;
  onClick: () => void;
}) {
  return (
    <span
      className={styles.refineControl}
      title={aiConfigured ? "" : "Configure an AI provider in Settings → AI configuration"}
    >
      {isRefining && (
        <span className={styles.refineHint}>Large posts can take up to a minute</span>
      )}
      <button
        type="button"
        className={`btn-secondary ${styles.refineButton}`}
        onClick={onClick}
        disabled={!aiConfigured || !hasContent || isRefining}
      >
        {isRefining ? "Refining…" : "✨ Refine with AI"}
      </button>
    </span>
  );
}

export function RefinePreview({
  refinement,
  onApply,
  onCancel,
}: {
  refinement: Refinement;
  onApply: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // showModal() gives native focus-trapping/Escape/backdrop; close on unmount so a
  // replaced dialog can't leave the top-layer stale.
  useEffect(() => {
    const dlg = dialogRef.current;
    if (dlg && !dlg.open) dlg.showModal();
    return () => { if (dlg?.open) dlg.close(); };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="ai-refine-title"
      // Escape fires `cancel`; prevent the default silent close so we run cleanup.
      onCancel={(e) => { e.preventDefault(); onCancel(); }}
      // Click on the backdrop (target is the <dialog> itself) closes it.
      onClick={(e) => { if (e.target === dialogRef.current) onCancel(); }}
    >
      <div className={styles.panel}>
        <h3 id="ai-refine-title" className={styles.title}>AI refine — review before applying</h3>
        <p className={styles.subtitle}>
          Your editor is unchanged. Preview the refined version below and apply it if it looks good.
        </p>

        {refinement.warnings.length > 0 && (
          <div className={styles.warnings}>
            <strong>Terminology check:</strong>
            <ul className={styles.warningsList}>
              {refinement.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        <div
          className={styles.preview}
          dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(refinement.content) }}
        />

        <div className={styles.actions}>
          <button type="button" className="btn-secondary" onClick={onCancel}>Discard</button>
          <button type="button" className="btn-primary" onClick={onApply} autoFocus>Apply changes</button>
        </div>
      </div>
    </dialog>
  );
}
