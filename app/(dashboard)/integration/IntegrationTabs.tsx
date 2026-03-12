"use client";

import { useState } from "react";
import { WIDGETS, type WidgetConfig, type EmbedOption } from "@/lib/widgets";
import styles from "./page.module.css";

function getChangelogHeadlessSnippet(appUrl: string, apiKey: string): string {
  return `// --- Visitor ID ---
// Generate a unique visitor ID per browser and persist it.
// This is used for like/dislike deduplication.
// If your users are logged in, you can use their user ID instead.
function getVisitorId() {
  const KEY = "glintpost_visitor_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "v_" + crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

const visitorId = getVisitorId();

// --- Fetch changelog posts ---
const res = await fetch("${appUrl}/api/changelog/posts", {
  headers: { "x-api-key": "${apiKey}" }
});
const posts = await res.json();
// Each post: { id, title, content, createdAt, likes, dislikes }

// --- Like a post ---
await fetch("${appUrl}/api/changelog/track", {
  method: "POST",
  headers: {
    "x-api-key": "${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "LIKE",    // "LIKE" | "DISLIKE" | "VIEW"
    postId: posts[0].id,
    visitorId        // required for LIKE/DISLIKE
  })
});`;
}

function getRoadmapHeadlessSnippet(appUrl: string, apiKey: string): string {
  return `// --- Visitor ID ---
// Generate a unique visitor ID per browser and persist it.
// This is used for vote deduplication and tracking.
// If your users are logged in, you can use their user ID instead.
function getVisitorId() {
  const KEY = "glintpost_visitor_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "v_" + crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

const visitorId = getVisitorId();

// --- Fetch roadmap items (with visitor's votes) ---
const res = await fetch(
  "${appUrl}/api/roadmap/items?visitorId=" + visitorId,
  { headers: { "x-api-key": "${apiKey}" } }
);
const items = await res.json();
// Each item: { id, title, description, status, upvotes, downvotes, myVote }

// --- Vote on an item ---
await fetch("${appUrl}/api/roadmap/vote", {
  method: "POST",
  headers: {
    "x-api-key": "${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    itemId: items[0].id,
    visitorId,
    voteType: "UP"   // "UP" | "DOWN"
  })
});

// --- Submit a suggestion ---
await fetch("${appUrl}/api/roadmap/suggest", {
  method: "POST",
  headers: {
    "x-api-key": "${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    text: "Add dark mode support",
    visitorId
  })
});`;
}

function getCodeSnippet(
  option: EmbedOption,
  widget: WidgetConfig,
  appUrl: string,
  apiKey: string
): string {
  switch (option.mode) {
    case "slideover":
      return `<!-- GlintPost ${widget.label} Widget -->\n<script\n  src="${appUrl}/${widget.script}"\n  data-api-key="${apiKey}"\n  defer\n></script>`;
    case "inline":
      return `<iframe\n  src="${appUrl}${widget.pagePath}?apiKey=${apiKey}"\n  style="width:100%;height:600px;border:none;border-radius:8px;"\n></iframe>`;
    case "hosted":
      return `${appUrl}${widget.pagePath}?apiKey=${apiKey}`;
    case "headless":
      return widget.key === "changelog"
        ? getChangelogHeadlessSnippet(appUrl, apiKey)
        : getRoadmapHeadlessSnippet(appUrl, apiKey);
    case "advanced":
      return `<script>\n  window.GlintPostConfig = {\n    visitorId: "user_123",\n    datalayer: {\n      plan: "pro",\n      role: "admin"\n    }\n  };\n</script>`;
  }
}

export default function IntegrationTabs({
  apiKey,
  appUrl,
}: {
  apiKey: string;
  appUrl: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const widget = WIDGETS[activeIdx];

  return (
    <>
      <div className={styles.tabs}>
        {WIDGETS.map((w, i) => (
          <button
            key={w.key}
            className={`${styles.tab} ${activeIdx === i ? styles.tabActive : ""}`}
            onClick={() => setActiveIdx(i)}
          >
            {w.label}
          </button>
        ))}
      </div>

      {widget.integrations.map((opt) => (
        <div key={opt.mode} className={styles.card}>
          {opt.recommended ? (
            <div className={styles.optionHeader}>
              <h3>{opt.title}</h3>
              <span className={styles.recommendedBadge}>Recommended</span>
            </div>
          ) : (
            <h3>{opt.title}</h3>
          )}
          <p>{opt.description}</p>
          <div className={styles.codeBlock}>
            <pre>
              <code>{getCodeSnippet(opt, widget, appUrl, apiKey)}</code>
            </pre>
          </div>
        </div>
      ))}
    </>
  );
}
