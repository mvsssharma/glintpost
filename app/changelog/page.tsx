"use client";

import { useEffect, useState, useMemo, Suspense, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/constants";
import { getVisitorId, getExistingVisitorId } from "@/lib/visitor";
import { getAllowedOrigins, postToParent, isAllowedOrigin } from "@/lib/post-message";
import styles from "./page.module.css";

const fetcher = ([url, apiKey]: [string, string]) =>
  fetch(url, { headers: { "x-api-key": apiKey } }).then((res) => {
    if (!res.ok) throw new Error("Fetch failed");
    return res.json();
  });

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

  const { data: config } = useSWR<{ primaryColor?: string; widgetTheme?: string; allowedDomain?: string | null }>(
    apiKey ? ["/api/config", apiKey] : null,
    fetcher
  );

  const { data: postsData, error: postsError } = useSWR<Post[]>(
    apiKey ? ["/api/changelog/posts", apiKey] : null,
    fetcher
  );

  const posts = Array.isArray(postsData) ? postsData : [];
  const loading = (!postsData && !postsError) || !config;

  const theme = themeParam
    ? { primaryColor: primaryColorParam ?? DEFAULT_PRIMARY_COLOR, widgetTheme: themeParam }
    : config
    ? {
        primaryColor: config.primaryColor ?? DEFAULT_PRIMARY_COLOR,
        widgetTheme: config.widgetTheme ?? "light",
      }
    : null;

  const allowedOrigins = config ? getAllowedOrigins(config.allowedDomain ?? null) : getAllowedOrigins(null);
  const allowedOriginsRef = useRef(allowedOrigins);
  allowedOriginsRef.current = allowedOrigins;
  const [interactedPosts, setInteractedPosts] = useState<
    Record<string, "LIKE" | "DISLIKE">
  >({});
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    setVisitorId(getExistingVisitorId(visitorIdParam));
  }, [visitorIdParam]);

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

      const effectiveVisitorId = type !== "VIEW" ? ensureVisitorId() : visitorId;

      const prevInteractions = { ...interactedPosts };
      if (postId && type !== "VIEW") {
        const alreadyInteracted = interactedPosts[postId];
        if (alreadyInteracted === type) {
          const updated = { ...interactedPosts };
          delete updated[postId];
          setInteractedPosts(updated);
          localStorage.setItem("glintpost_interactions", JSON.stringify(updated));
        } else {
          const updated = { ...interactedPosts, [postId]: type as "LIKE" | "DISLIKE" };
          setInteractedPosts(updated);
          localStorage.setItem("glintpost_interactions", JSON.stringify(updated));
        }
      }

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
  }, []);

  useEffect(() => {
    if (config) {
      postToParent(
        { type: "GLINTPOST_CHANGELOG_CONFIG", primaryColor: config.primaryColor },
        allowedOriginsRef.current
      );
    }
  }, [config]);

  useEffect(() => {
    if (postsData) {
      postToParent({ type: "GLINTPOST_CHANGELOG_LOADED" }, allowedOriginsRef.current);
    }
  }, [postsData]);

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
