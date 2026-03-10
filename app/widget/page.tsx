"use client";

import { useEffect, useState, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

interface Post {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  likes: number;
  dislikes: number;
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
        disabled={!!interaction}
      >
        👍 {likeCount > 0 && <span className={styles.count}>{likeCount}</span>}
      </button>
      <button
        onClick={onDislike}
        className={`${styles.reactionBtn} ${interaction === "DISLIKE" ? styles.activeReaction : ""}`}
        disabled={!!interaction}
      >
        👎 {dislikeCount > 0 && <span className={styles.count}>{dislikeCount}</span>}
      </button>
    </div>
  );
}

function WidgetContent() {
  const searchParams = useSearchParams();
  const apiKey = searchParams.get("apiKey");
  const visitorId = searchParams.get("visitorId");
  const datalayerParam = searchParams.get("datalayer");

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<{ primaryColor: string; widgetTheme: string } | null>(null);
  const [interactedPosts, setInteractedPosts] = useState<
    Record<string, "LIKE" | "DISLIKE">
  >({});
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const trackEvent = useCallback(
    async (
      type: "LIKE" | "DISLIKE" | "VIEW",
      postId: string | null
    ) => {
      if (!postId && type !== "VIEW") return;
      // Only block duplicate LIKE/DISLIKE, always allow VIEW
      if (type !== "VIEW" && postId && interactedPosts[postId]) return;

      const newInteractions = { ...interactedPosts };
      if (postId && type !== "VIEW") {
        newInteractions[postId] = type as "LIKE" | "DISLIKE";
        setInteractedPosts(newInteractions);
        localStorage.setItem(
          "glintpost_interactions",
          JSON.stringify(newInteractions)
        );
      }

      let datalayer: Record<string, string> | undefined;
      if (datalayerParam) {
        try {
          datalayer = JSON.parse(datalayerParam);
        } catch { }
      }

      try {
        const res = await fetch(`/api/track?apiKey=${apiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type,
            postId,
            visitorId,
            datalayer,
          }),
        });
        // Revert optimistic update on server error
        if (!res.ok && postId && type !== "VIEW") {
          const reverted = { ...interactedPosts };
          delete reverted[postId];
          setInteractedPosts(reverted);
          localStorage.setItem(
            "glintpost_interactions",
            JSON.stringify(reverted)
          );
        }
      } catch {
        if (postId && type !== "VIEW") {
          const reverted = { ...interactedPosts };
          delete reverted[postId];
          setInteractedPosts(reverted);
          localStorage.setItem(
            "glintpost_interactions",
            JSON.stringify(reverted)
          );
        }
      }
    },
    [apiKey, datalayerParam, interactedPosts, visitorId]
  );

  useEffect(() => {
    const stored = localStorage.getItem("glintpost_interactions");
    if (stored) {
      try {
        setInteractedPosts(JSON.parse(stored));
      } catch { }
    }

    if (!apiKey) return;

    fetch(`/api/widget/config?apiKey=${apiKey}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((config: { primaryColor?: string; widgetTheme?: string } | null) => {
        if (config) {
          setTheme({
            primaryColor: config.primaryColor ?? "#10b981",
            widgetTheme: config.widgetTheme ?? "light",
          });
          window.parent.postMessage(
            { type: "GLINTPOST_WIDGET_CONFIG", primaryColor: config.primaryColor },
            "*"
          );
        }
      })
      .catch(() => { });

    fetch(`/api/widget/posts?apiKey=${apiKey}`)
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

    window.parent.postMessage({ type: "GLINTPOST_WIDGET_LOADED" }, "*");
  }, [apiKey]);

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "GLINTPOST_WIDGET_OPENED") {
        trackEvent("VIEW", null);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [trackEvent]);

  const closeWidget = () => {
    window.parent.postMessage({ type: "GLINTPOST_WIDGET_CLOSE" }, "*");
  };

  if (loading) return <div className={styles.loading}>Loading updates...</div>;

  const themeStyle = theme?.primaryColor
    ? { ["--widget-primary" as string]: theme.primaryColor }
    : undefined;

  const themeClass = theme?.widgetTheme === "dark" ? styles.dark : styles.light;

  const selectedPost = selectedPostId
    ? posts.find((p) => p.id === selectedPostId)
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
            dangerouslySetInnerHTML={{ __html: selectedPost.content }}
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
        {posts.length === 0 ? (
          <p className={styles.empty}>No recent updates.</p>
        ) : (
          posts.map((post) => {
            const interaction = interactedPosts[post.id];
            return (
              <article key={post.id} className={styles.postCard}>
                <span className={styles.date}>
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
                <h3 className={styles.title}>{post.title}</h3>
                <div
                  className={styles.contentPreview}
                  dangerouslySetInnerHTML={{ __html: post.content }}
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
    </div>
  );
}

export default function WidgetPage() {
  return (
    <Suspense fallback={<div className={styles.loading}>Loading...</div>}>
      <WidgetContent />
    </Suspense>
  );
}
