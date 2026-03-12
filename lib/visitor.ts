"use client";

const STORAGE_KEY = "glintpost_visitor_id";

/**
 * Get or create a persistent visitor ID for the current browser.
 * Shared across all GlintPost widgets (changelog + roadmap).
 * Accepts an optional override (e.g. from GlintPostConfig.visitorId).
 */
export function getVisitorId(override?: string | null): string {
  if (override) return override;
  if (typeof window === "undefined") return "";

  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = "v_" + crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
