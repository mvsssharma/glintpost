"use client";

import { useState, useCallback } from "react";
import { WIDGETS_WITH_FEEDBACK, type WidgetConfig, type EmbedOption } from "@/lib/widgets";
import { maskSecret } from "@/lib/mask";
import styles from "./page.module.css";

function CopyCodeBlock({ displayCode, copyCode }: { displayCode: string; copyCode: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(copyCode);
    } catch {
      const el = document.createElement("textarea");
      el.value = copyCode;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [copyCode]);

  return (
    <div className={styles.codeBlock}>
      <button
        onClick={handleCopy}
        className={`${styles.copyBtn} ${copied ? styles.copyBtnCopied : ""}`}
        title="Copy to clipboard"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      <pre>
        <code>{displayCode}</code>
      </pre>
    </div>
  );
}

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

function getFeedbackHeadlessSnippet(appUrl: string, apiKey: string): string {
  return `// --- Visitor ID ---
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

// --- Fetch feedback form config ---
// Pass formId to target a specific form, or omit for the first enabled form
const formId = "YOUR_FORM_ID"; // Copy from Feedback → Copy ID
const res = await fetch("${appUrl}/api/feedback/form?formId=" + formId, {
  headers: { "x-api-key": "${apiKey}" }
});
const form = await res.json();
// form: { id, title, questions: [{ id, text, type, options?, required }] }

// --- Submit feedback ---
await fetch("${appUrl}/api/feedback/submit", {
  method: "POST",
  headers: {
    "x-api-key": "${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    formId: form.id,
    visitorId,
    answers: [
      { questionId: form.questions[0].id, value: "Option A" },
      { questionId: form.questions[1].id, value: 9 }
    ]
  })
});`;
}

function getCodeSnippet(
  option: EmbedOption,
  widget: WidgetConfig,
  appUrl: string,
  apiKey: string
): string {
  const isFeedback = widget.key === "feedback";
  const formIdComment = `  <!-- Copy the Form ID from Feedback page -->`;
  const formIdAttr = `  data-form-id="YOUR_FORM_ID"`;

  switch (option.mode) {
    case "slideover":
      if (isFeedback) {
        return `<!-- GlintPost ${widget.label} Widget -->\n${formIdComment}\n<script\n  src="${appUrl}/${widget.script}"\n  data-api-key="${apiKey}"\n${formIdAttr}\n  defer\n></script>`;
      }
      return `<!-- GlintPost ${widget.label} Widget -->\n<script\n  src="${appUrl}/${widget.script}"\n  data-api-key="${apiKey}"\n  defer\n></script>`;
    case "inline":
      if (isFeedback) {
        return `<!-- Replace YOUR_FORM_ID with the Form ID from Feedback page -->\n<iframe\n  src="${appUrl}${widget.pagePath}?apiKey=${apiKey}&formId=YOUR_FORM_ID"\n  style="width:100%;height:600px;border:none;border-radius:8px;"\n></iframe>`;
      }
      return `<iframe\n  src="${appUrl}${widget.pagePath}?apiKey=${apiKey}"\n  style="width:100%;height:600px;border:none;border-radius:8px;"\n></iframe>`;
    case "hosted":
      if (isFeedback) {
        return `${appUrl}${widget.pagePath}?apiKey=${apiKey}&formId=YOUR_FORM_ID`;
      }
      return `${appUrl}${widget.pagePath}?apiKey=${apiKey}`;
    case "headless":
      if (widget.key === "changelog") return getChangelogHeadlessSnippet(appUrl, apiKey);
      if (isFeedback) return getFeedbackHeadlessSnippet(appUrl, apiKey);
      return getRoadmapHeadlessSnippet(appUrl, apiKey);
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
  const widget = WIDGETS_WITH_FEEDBACK[activeIdx];

  return (
    <>
      <div className={`${styles.tabs} ${styles.narrow}`}>
        {WIDGETS_WITH_FEEDBACK.map((w, i) => (
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
          <div className={styles.cardIntro}>
            {opt.recommended ? (
              <div className={styles.optionHeader}>
                <h3>{opt.title}</h3>
                <span className={styles.recommendedBadge}>Recommended</span>
              </div>
            ) : (
              <h3>{opt.title}</h3>
            )}
            <p>{opt.description}</p>
          </div>
          <CopyCodeBlock
            displayCode={getCodeSnippet(opt, widget, appUrl, maskSecret(apiKey))}
            copyCode={getCodeSnippet(opt, widget, appUrl, apiKey)}
          />
        </div>
      ))}
    </>
  );
}
