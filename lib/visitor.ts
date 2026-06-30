"use client";

const STORAGE_KEY = "glintpost_visitor_id";

/**
 * Get or create a persistent visitor ID for the current browser.
 * Shared across all GlintPost widgets (changelog + roadmap + feedback).
 * Accepts an optional override (e.g. from GlintPostConfig.visitorId).
 *
 * GDPR note: Only call this when the user takes an explicit action
 * (like, vote, submit) — never on passive page load.
 */
export function getVisitorId(override?: string | null): string {
  if (override) return override;
  if (typeof window === "undefined") return "";

  let id: string | null = null;
  try { id = localStorage.getItem(STORAGE_KEY); } catch {}
  if (!id) {
    try {
      id = "v_" + crypto.randomUUID();
    } catch {
      id = "v_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }
  return id;
}

/**
 * Return the existing visitor ID without creating one.
 * Returns empty string if no visitor ID exists yet.
 */
export function getExistingVisitorId(override?: string | null): string {
  if (override) return override;
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) || "";
}

/**
 * Clear all GlintPost visitor data from localStorage.
 * Used by GlintPost.destroy() for consent withdrawal.
 */
export function clearVisitorData(): void {
  if (typeof window === "undefined") return;

  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("glintpost_changelog_last_seen");
  localStorage.removeItem("glintpost_interactions");

  // Clear all feedback submission markers
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key && key.startsWith("glintpost_feedback_")) {
      localStorage.removeItem(key);
    }
  }
}
