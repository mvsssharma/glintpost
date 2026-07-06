"use client";

import { useEffect, useState, useMemo, Suspense, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/constants";
import { getVisitorId, getExistingVisitorId } from "@/lib/visitor";
import { getAllowedOrigins, postToParent, isAllowedOrigin } from "@/lib/post-message";
import styles from "./page.module.css";

interface TargetingRule {
  param: string;
  op: string;
  value: string | string[];
}

interface TargetingRuleSet {
  operator: "AND" | "OR";
  rules: TargetingRule[];
}

interface Post {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  likes: number;
  dislikes: number;
  targetingRules: TargetingRuleSet | null;
}

function matchesTargetingRules(
  post: Post,
  datalayer: Record<string, string> | null
): boolean {
  if (!post.targetingRules) return true;
  if (!datalayer) return false;

  const { operator, rules } = post.targetingRules;

  const evalRule = (rule: TargetingRule): boolean => {
    const actual = datalayer[rule.param] ?? "";
    switch (rule.op) {
      case "equals":
        return actual === rule.value;
      case "not_equals":
        return actual !== rule.value;
      case "contains":
        return typeof rule.value === "string" &&
          actual.toLowerCase().includes(rule.value.toLowerCase());
      case "in":
        return Array.isArray(rule.value) && rule.value.includes(actual);
      default:
        return false;
    }
  };

  return operator === "AND"
    ? rules.every(evalRule)
    : rules.some(evalRule);
}

function ReactionButtons({
  post,
  interaction,
  onLike,
  onDislike,
}: {
  post: Post;
  interaction?: "LIKE" | "DISLIKE";
  onLike: () => void;
  onDislike: () => void;
}) {
  const likeCount = post.likes + (interaction === "LIKE" ? 1 : 0);
  const dislikeCount = post.dislikes + (interaction === "DISLIKE" ? 1 : 0);

  return (
    <div className={styles.actions}>
      <button
        onClick={onLike}
        className={`${styles.reactionBtn} ${interaction === "LIKE" ? styles.activeReaction : ""}`}
      >
        👍 {likeCount > 0 && <span className={styles.count}>{likeCount}</span>}
      </button>
      <button
        onClick={onDislike}
        className={`${styles.reactionBtn} ${interaction === "DISLIKE" ? styles.activeReaction : ""}`}
      >
        👎 {dislikeCount > 0 && <span className={styles.count}>{dislikeCount}</span>}
      </button>
    </div>
  );
}

function ChangelogContent() {
  const searchParams = useSearchParams();
  const apiKey = searchParams.get("apiKey");
  const visitorIdParam = searchParams.get("visitorId");
  const datalayerParam = searchParams.get("datalayer");
  const [visitorId, setVisitorId] = useState("");
  const themeParam = searchParams.get("theme");
  const primaryColorParam = searchParams.get("primaryColor");

  const parsedDatalayer = useMemo(() => {
    if (!datalayerParam) return null;
    try { return JSON.parse(datalayerParam) as Record<string, string>; }
    catch { return null; }
  }, [datalayerParam]);

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<{ primaryColor: string; widgetTheme: string } | null>(
    themeParam ? { primaryColor: primaryColorParam ?? DEFAULT_PRIMARY_COLOR, widgetTheme: themeParam } : null
  );
  const [allowedOrigins, setAllowedOrigins] = useState<Set<string>>(() => getAllowedOrigins(null));
  const allowedOriginsRef = useRef(allowedOrigins);
  allowedOriginsRef.current = allowedOrigins;
  const [interactedPosts, setInteractedPosts] = useState<
    Record<string, "LIKE" | "DISLIKE">
  >({});
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

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

  const trackEvent = useCallback(
    async (
      type: "LIKE" | "DISLIKE" | "VIEW",
      postId: string | null
    ) => {
      if (!postId && type !== "VIEW") return;

      // For interactions, ensure visitorId exists (lazy creation)
      const effectiveVisitorId = type !== "VIEW" ? ensureVisitorId() : visitorId;

      // Optimistic update for LIKE/DISLIKE
      const prevInteractions = { ...interactedPosts };
      if (postId && type !== "VIEW") {
        const alreadyInteracted = interactedPosts[postId];
        if (alreadyInteracted === type) {
          // Toggle off
          const updated = { ...interactedPosts };
          delete updated[postId];
          setInteractedPosts(updated);
          localStorage.setItem("glintpost_interactions", JSON.stringify(updated));
        } else {
          // Toggle on
          const updated = { ...interactedPosts, [postId]: type as "LIKE" | "DISLIKE" };
          setInteractedPosts(updated);
          localStorage.setItem("glintpost_interactions", JSON.stringify(updated));
        }
      }

      // Only include datalayer on user interactions, not passive views
      let datalayer: Record<string, string> | undefined;
      if (type !== "VIEW" && datalayerParam) {
        try {
          datalayer = JSON.parse(datalayerParam);
        } catch { }
      }

      try {
        const res = await fetch("/api/changelog/track", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-api-key": apiKey! },
          body: JSON.stringify({
            type,
            postId,
            visitorId: type !== "VIEW" ? effectiveVisitorId : undefined,
            datalayer,
          }),
        });
        // Revert optimistic update on server error
        if (!res.ok && postId && type !== "VIEW") {
          setInteractedPosts(prevInteractions);
          localStorage.setItem("glintpost_interactions", JSON.stringify(prevInteractions));
        }
      } catch {
        if (postId && type !== "VIEW") {
          setInteractedPosts(prevInteractions);
          localStorage.setItem("glintpost_interactions", JSON.stringify(prevInteractions));
        }
      }
    },
    [apiKey, datalayerParam, interactedPosts, visitorId, ensureVisitorId]
  );

  useEffect(() => {
    const stored = localStorage.getItem("glintpost_interactions");
    if (stored) {
      try {
        setInteractedPosts(JSON.parse(stored));
      } catch { }
    }

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
          postToParent(
            { type: "GLINTPOST_CHANGELOG_CONFIG", primaryColor: config.primaryColor },
            origins
          );
        }
      })
      .catch(() => { });

    fetch("/api/changelog/posts", { headers: { "x-api-key": apiKey } })
      .then((res) => res.json())
      .then((data: Post[]) => {
        if (Array.isArray(data)) {
          setPosts(data);
        }
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error(err);
        setLoading(false);
      });

    postToParent({ type: "GLINTPOST_CHANGELOG_LOADED" }, allowedOriginsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!isAllowedOrigin(e.origin, allowedOrigins)) return;
      if (e.data?.type === "GLINTPOST_CHANGELOG_OPENED") {
        trackEvent("VIEW", null);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [trackEvent, allowedOrigins]);

  const closeWidget = () => {
    postToParent({ type: "GLINTPOST_CHANGELOG_CLOSE" }, allowedOrigins);
  };

  if (loading || !theme) return <div className={styles.loading} style={{ background: "transparent" }} />;

  const themeStyle = theme?.primaryColor
    ? { ["--widget-primary" as string]: theme.primaryColor }
    : undefined;

  const themeClass = theme?.widgetTheme === "dark" ? styles.dark : styles.light;

  const visiblePosts = posts.filter((p) => matchesTargetingRules(p, parsedDatalayer));

  const selectedPost = selectedPostId
    ? visiblePosts.find((p) => p.id === selectedPostId)
    : null;

  if (selectedPost) {
    const interaction = interactedPosts[selectedPost.id];
    return (
      <div className={`${styles.widget} ${themeClass}`} style={themeStyle}>
        <header className={styles.header}>
          <button
            onClick={() => setSelectedPostId(null)}
            className={styles.backBtn}
          >
            &#8592; Back
          </button>
          <button onClick={closeWidget} className={styles.closeBtn}>
            &times;
          </button>
        </header>

        <div className={styles.detail}>
          <span className={styles.date}>
            {new Date(selectedPost.createdAt).toLocaleDateString()}
          </span>
          <h3 className={styles.detailTitle}>{selectedPost.title}</h3>
          <div
            className={styles.detailContent}
            dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(selectedPost.content) }}
          />
          <ReactionButtons
            post={selectedPost}
            interaction={interaction}
            onLike={() => trackEvent("LIKE", selectedPost.id)}
            onDislike={() => trackEvent("DISLIKE", selectedPost.id)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.widget} ${themeClass}`} style={themeStyle}>
      <header className={styles.header}>
        <h2>Latest Updates</h2>
        <button onClick={closeWidget} className={styles.closeBtn}>
          &times;
        </button>
      </header>

      <div className={styles.feed}>
        {visiblePosts.length === 0 ? (
          <p className={styles.empty}>No recent updates.</p>
        ) : (
          visiblePosts.map((post) => {
            const interaction = interactedPosts[post.id];
            return (
              <article key={post.id} className={styles.postCard}>
                <span className={styles.date}>
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
                <h3 className={styles.title}>{post.title}</h3>
                <div
                  className={styles.contentPreview}
                  dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(post.content) }}
                />
                <button
                  className={styles.viewMore}
                  onClick={() => {
                    trackEvent("VIEW", post.id);
                    setSelectedPostId(post.id);
                  }}
                >
                  View more
                </button>
                <ReactionButtons
                  post={post}
                  interaction={interaction}
                  onLike={() => trackEvent("LIKE", post.id)}
                  onDislike={() => trackEvent("DISLIKE", post.id)}
                />
              </article>
            );
          })
        )}
      </div>

      <footer className={styles.footer}>
        Powered by <strong>GlintPost</strong>
      </footer>
    </div>
  );
}

export default function ChangelogPage() {
  return (
    <Suspense fallback={<div className={styles.loading} style={{ background: "transparent" }} />}>
      <ChangelogContent />
    </Suspense>
  );
}
