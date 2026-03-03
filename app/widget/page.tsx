"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

interface Post {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

function WidgetContent() {
  const searchParams = useSearchParams();
  const apiKey = searchParams.get("apiKey");
  const visitorId = searchParams.get("visitorId");
  const datalayerParam = searchParams.get("datalayer");

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [interactedPosts, setInteractedPosts] = useState<
    Record<string, "LIKE" | "DISLIKE">
  >({});

  useEffect(() => {
    const stored = localStorage.getItem("glintpost_interactions");
    if (stored) {
      try {
        setInteractedPosts(JSON.parse(stored));
      } catch {}
    }

    if (!apiKey) return;

    fetch(`/api/widget/posts?apiKey=${apiKey}`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPosts(data);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });

    window.parent.postMessage({ type: "GLINTPOST_WIDGET_LOADED" }, "*");

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === "GLINTPOST_WIDGET_OPENED") {
        trackEvent("VIEW", null);
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [apiKey]);

  const trackEvent = async (
    type: "LIKE" | "DISLIKE" | "VIEW",
    postId: string | null
  ) => {
    if (!postId && type !== "VIEW") return;
    if (postId && interactedPosts[postId]) return;

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
      } catch {}
    }

    try {
      await fetch(`/api/track?apiKey=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          postId,
          visitorId,
          datalayer,
        }),
      });
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
  };

  const closeWidget = () => {
    window.parent.postMessage({ type: "GLINTPOST_WIDGET_CLOSE" }, "*");
  };

  if (loading) return <div className={styles.loading}>Loading updates...</div>;

  return (
    <div className={styles.widget}>
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
                  className={styles.content}
                  dangerouslySetInnerHTML={{ __html: post.content }}
                />
                <div className={styles.actions}>
                  <button
                    onClick={() => trackEvent("LIKE", post.id)}
                    className={`${styles.reactionBtn} ${interaction === "LIKE" ? styles.activeReaction : ""}`}
                    disabled={!!interaction}
                  >
                    👍
                  </button>
                  <button
                    onClick={() => trackEvent("DISLIKE", post.id)}
                    className={`${styles.reactionBtn} ${interaction === "DISLIKE" ? styles.activeReaction : ""}`}
                    disabled={!!interaction}
                  >
                    👎
                  </button>
                </div>
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
