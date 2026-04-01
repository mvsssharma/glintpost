"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useRoadmap } from "./useRoadmap";
import { ROADMAP_STATUSES, DEFAULT_PRIMARY_COLOR } from "@/lib/constants";
import { getVisitorId, getExistingVisitorId } from "@/lib/visitor";
import { getAllowedOrigins, getParentOrigin, isAllowedOrigin } from "@/lib/post-message";
import styles from "./page.module.css";

const STATUS_FILTERS = [
  { value: "ALL", label: "All" },
  ...ROADMAP_STATUSES.filter((s) => s.value !== "ARCHIVED"),
];

function RoadmapContent() {
  const searchParams = useSearchParams();
  const apiKey = searchParams.get("apiKey");
  const visitorIdParam = searchParams.get("visitorId");
  const themeParam = searchParams.get("theme");
  const primaryColorParam = searchParams.get("primaryColor");
  const [visitorId, setVisitorId] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState<Set<string>>(() => getAllowedOrigins(null));
  const [theme, setTheme] = useState<{ primaryColor: string; widgetTheme: string } | null>(
    themeParam ? { primaryColor: primaryColorParam ?? DEFAULT_PRIMARY_COLOR, widgetTheme: themeParam } : null
  );

  // Lazy visitorId: only read existing ID on mount, never create on page load
  useEffect(() => {
    setVisitorId(getExistingVisitorId(visitorIdParam));
  }, [visitorIdParam]);

  // Ensure visitorId exists (create if needed) — only call on user interaction
  const ensureVisitorId = useCallback((): string => {
    const id = getVisitorId(visitorIdParam);
    setVisitorId(id);
    return id;
  }, [visitorIdParam]);

  useEffect(() => {
    if (!apiKey) return;
    fetch("/api/config", { headers: { "x-api-key": apiKey } })
      .then((res) => (res.ok ? res.json() : null))
      .then((config: { primaryColor?: string; widgetTheme?: string; allowedDomain?: string | null } | null) => {
        if (config) {
          const origins = getAllowedOrigins(config.allowedDomain ?? null);
          setAllowedOrigins(origins);
          setTheme({
            primaryColor: config.primaryColor ?? DEFAULT_PRIMARY_COLOR,
            widgetTheme: config.widgetTheme ?? "light",
          });
          window.parent.postMessage(
            { type: "GLINTPOST_ROADMAP_CONFIG", primaryColor: config.primaryColor },
            getParentOrigin(origins)
          );
        }
      })
      .catch(() => {});
  }, [apiKey]);

  // Track roadmap widget view anonymously (no visitorId)
  useEffect(() => {
    if (!apiKey) return;
    fetch("/api/roadmap/track", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify({}),
    }).catch(() => {});
  }, [apiKey]);

  const [isEmbedded, setIsEmbedded] = useState(false);

  useEffect(() => {
    setIsEmbedded(window.parent !== window);
  }, []);

  const closeWidget = useCallback(() => {
    window.parent.postMessage({ type: "GLINTPOST_ROADMAP_CLOSE" }, getParentOrigin(allowedOrigins));
  }, [allowedOrigins]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!isAllowedOrigin(e.origin, allowedOrigins)) return;
      if (e.data?.type === "GLINTPOST_ROADMAP_OPENED") {
        // Could trigger data refresh here if needed
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [allowedOrigins]);

  const {
    items,
    loading,
    error,
    filter,
    setFilter,
    sortBy,
    setSortBy,
    voteOnItem,
    submitSuggestion,
  } = useRoadmap(apiKey, visitorId, ensureVisitorId);

  const [suggestionText, setSuggestionText] = useState("");
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSuggest = async () => {
    if (!suggestionText.trim()) return;
    setSubmitting(true);
    try {
      const result = await submitSuggestion(suggestionText.trim());
      if (result.action === "merged" && result.matchedItem) {
        setAlert({
          type: "success",
          message: `Similar feature exists: "${result.matchedItem.title}". Your vote has been added!`,
        });
      } else {
        setAlert({
          type: "success",
          message: "Thanks! Your suggestion has been submitted for review.",
        });
      }
      setSuggestionText("");
      setSuggestionOpen(false);
    } catch (err) {
      setAlert({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to submit",
      });
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 5000);
    return () => clearTimeout(t);
  }, [alert]);

  if (!apiKey) {
    return <div className={styles.empty}>Missing API key parameter.</div>;
  }

  if (!theme) {
    return <div style={{ background: "transparent" }} />;
  }

  const themeStyle = theme?.primaryColor
    ? { ["--widget-primary" as string]: theme.primaryColor }
    : undefined;
  const themeClass = theme?.widgetTheme === "dark" ? styles.dark : styles.light;

  return (
    <div className={`${styles.container} ${themeClass}`} style={themeStyle}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Roadmap</h1>
          <p className={styles.subtitle}>Vote on features or suggest new ones</p>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.suggestBtn}
            onClick={() => setSuggestionOpen(!suggestionOpen)}
          >
            {suggestionOpen ? "Cancel" : "+ Suggest"}
          </button>
          {isEmbedded && (
            <button onClick={closeWidget} className={styles.closeBtn} aria-label="Close">
              &times;
            </button>
          )}
        </div>
      </header>

      {alert && (
        <div className={`${styles.alert} ${styles[alert.type]}`}>
          {alert.message}
        </div>
      )}

      {suggestionOpen && (
        <div className={styles.suggestionForm}>
          <textarea
            value={suggestionText}
            onChange={(e) => setSuggestionText(e.target.value)}
            placeholder="Describe the feature you'd like to see..."
            className={styles.textarea}
            rows={3}
          />
          <button
            className={styles.submitBtn}
            onClick={handleSuggest}
            disabled={submitting || suggestionText.trim().length < 5}
          >
            {submitting ? "Submitting..." : "Submit suggestion"}
          </button>
        </div>
      )}

      <div className={styles.controls}>
        <div className={styles.filters}>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              className={`${styles.filterBtn} ${filter === s.value ? styles.filterActive : ""}`}
              onClick={() => setFilter(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className={styles.sortToggle}>
          <button
            className={`${styles.sortBtn} ${sortBy === "votes" ? styles.sortActive : ""}`}
            onClick={() => setSortBy("votes")}
          >
            Top voted
          </button>
          <button
            className={`${styles.sortBtn} ${sortBy === "newest" ? styles.sortActive : ""}`}
            onClick={() => setSortBy("newest")}
          >
            Newest
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading roadmap...</div>
      ) : error ? (
        <div className={styles.empty}>{error}</div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>No items yet. Be the first to suggest a feature!</div>
      ) : (
        <div className={styles.itemList}>
          {items.map((item) => {
            const net = item.upvotes - item.downvotes;
            const statusMeta = ROADMAP_STATUSES.find((s) => s.value === item.status);
            return (
              <div key={item.id} className={styles.itemCard}>
                <div className={styles.voteCol}>
                  <button
                    className={`${styles.voteBtn} ${item.myVote === "UP" ? styles.votedUp : ""}`}
                    onClick={() => voteOnItem(item.id, "UP")}
                    aria-label="Upvote"
                  >
                    &#9650;
                  </button>
                  <span className={styles.voteCount}>{net}</span>
                  <button
                    className={`${styles.voteBtn} ${item.myVote === "DOWN" ? styles.votedDown : ""}`}
                    onClick={() => voteOnItem(item.id, "DOWN")}
                    aria-label="Downvote"
                  >
                    &#9660;
                  </button>
                </div>
                <div className={styles.itemContent}>
                  <div className={styles.itemHeader}>
                    <h3 className={styles.itemTitle}>{item.title}</h3>
                    {statusMeta && (
                      <span
                        className={styles.statusBadge}
                        style={{ background: statusMeta.color }}
                      >
                        {statusMeta.label}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className={styles.itemDesc}>{item.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <footer className={styles.footer}>
        Powered by <strong>GlintPost</strong>
      </footer>
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <Suspense fallback={<div style={{ background: "transparent" }} />}>
      <RoadmapContent />
    </Suspense>
  );
}
