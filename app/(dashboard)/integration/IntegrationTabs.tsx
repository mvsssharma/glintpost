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
    try { id = "v_" + crypto.randomUUID(); }
    catch { id = "v_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); }
    localStorage.setItem(KEY, id);
  }
  return id;
}

const visitorId = getVisitorId();

// --- Describe the current visitor (for audience targeting) ---
// Same keys you would pass via window.GlintPostConfig.datalayer.
// Omit or leave empty to only see posts with no audience targeting.
const datalayer = { plan: "pro", role: "admin" };

// --- Fetch changelog posts ---
const res = await fetch("${appUrl}/api/changelog/posts", {
  headers: { "x-api-key": "${apiKey}" }
});
const posts = await res.json();
// Each post: { id, title, content, createdAt, likes, dislikes, targeting }

// --- Filter by audience targeting ---
// Posts can target audiences; matching is client-side (visitor attributes
// never leave the browser). Load the matcher helper once on your page:
//   <script src="${appUrl}/glintpost-targeting.js"></script>
// then keep only the posts this visitor should see:
const visible = window.GlintPost.filterVisible(posts, datalayer);

// --- Like a post ---
await fetch("${appUrl}/api/changelog/track", {
  method: "POST",
  headers: {
    "x-api-key": "${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "LIKE",    // "LIKE" | "DISLIKE" | "VIEW"
    postId: visible[0].id,
    visitorId        // required for LIKE/DISLIKE
  })
});`;
}

function getAnnouncementHeadlessSnippet(appUrl: string, apiKey: string): string {
  return `// --- Visitor ID ---
// Generate a unique visitor ID per browser and persist it.
// Used for per-visitor view/click deduplication.
// If your users are logged in, you can use their user ID instead.
function getVisitorId() {
  const KEY = "glintpost_visitor_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    try { id = "v_" + crypto.randomUUID(); }
    catch { id = "v_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); }
    localStorage.setItem(KEY, id);
  }
  return id;
}

const visitorId = getVisitorId();

// --- Describe the current visitor (for audience targeting) ---
const datalayer = { plan: "pro", role: "admin" };

// --- Fetch active announcements (already filtered to the live window) ---
const res = await fetch("${appUrl}/api/announcements/active", {
  headers: { "x-api-key": "${apiKey}" }
});
const announcements = await res.json();
// Each: { id, title, content, imageUrl, videoUrl, ctaText, ctaUrl,
//         displayType, priority, targeting, startDate, endDate }
// Sorted by priority (highest first).

// --- Filter by audience targeting ---
// Load the matcher helper once on your page:
//   <script src="${appUrl}/glintpost-targeting.js"></script>
const visible = window.GlintPost.filterVisible(announcements, datalayer);
// Typically show the first match once per session, then track it:
const announcement = visible[0];

// --- Track a view (and, on CTA click, a click) ---
await fetch("${appUrl}/api/announcements/track", {
  method: "POST",
  headers: {
    "x-api-key": "${apiKey}",
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    type: "VIEW",    // "VIEW" | "CLICK"
    announcementId: announcement.id,
    visitorId
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
    try { id = "v_" + crypto.randomUUID(); }
    catch { id = "v_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); }
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
// Note: roadmap items are shown to everyone — no audience targeting.

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
    try { id = "v_" + crypto.randomUUID(); }
    catch { id = "v_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15); }
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
// Note: feedback forms are shown to everyone — no audience targeting.

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
    case "tab":
      if (isFeedback) {
        return `<!-- GlintPost ${widget.label} Side Tab -->\n${formIdComment}\n<script\n  src="${appUrl}/${widget.script}"\n  data-api-key="${apiKey}"\n  data-mode="tab"\n${formIdAttr}\n  defer\n></script>`;
      }
      return `<!-- GlintPost ${widget.label} Side Tab -->\n<script\n  src="${appUrl}/${widget.script}"\n  data-api-key="${apiKey}"\n  data-mode="tab"\n  defer\n></script>`;
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

function getAnnouncementSnippet(appUrl: string, apiKey: string): string {
  return `<!-- GlintPost Announcements -->\n<script\n  src="${appUrl}/announcement-widget.js"\n  data-api-key="${apiKey}"\n  defer\n></script>`;
}

function getUnifiedSnippet(appUrl: string, apiKey: string): string {
  return `<!-- GlintPost — loads all enabled widgets automatically -->\n<script\n  src="${appUrl}/widget.js"\n  data-api-key="${apiKey}"\n  defer\n></script>`;
}

const TAB_LABELS = ["All-in-one", ...WIDGETS_WITH_FEEDBACK.map((w) => w.label), "Announcements"];

export default function IntegrationTabs({
  apiKey,
  appUrl,
}: {
  apiKey: string;
  appUrl: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);

  const isUnified = activeIdx === 0;
  const announcementIdx = WIDGETS_WITH_FEEDBACK.length + 1;
  const isAnnouncements = activeIdx === announcementIdx;
  const widget = !isUnified && !isAnnouncements
    ? WIDGETS_WITH_FEEDBACK[activeIdx - 1]
    : null;

  return (
    <>
      <div className={`${styles.tabs} ${styles.narrow}`}>
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            className={`${styles.tab} ${activeIdx === i ? styles.tabActive : ""}`}
            onClick={() => setActiveIdx(i)}
          >
            {label}
          </button>
        ))}
      </div>

      {isUnified ? (
        <>
          <div className={styles.card}>
            <div className={styles.cardIntro}>
              <div className={styles.optionHeader}>
                <h3>Unified Widget Loader</h3>
                <span className={styles.recommendedBadge}>Recommended</span>
              </div>
              <p>
                A single script tag that automatically loads all widgets you&apos;ve enabled in Settings.
                No need to add separate script tags for each widget — enable or disable them from your dashboard.
              </p>
            </div>
            <CopyCodeBlock
              displayCode={getUnifiedSnippet(appUrl, maskSecret(apiKey))}
              copyCode={getUnifiedSnippet(appUrl, apiKey)}
            />
          </div>
          <div className={styles.card}>
            <div className={styles.cardIntro}>
              <h3>Advanced Config</h3>
              <p>
                Pass visitor identity and datalayer variables for targeting. Define this before the widget script loads.
              </p>
            </div>
            <CopyCodeBlock
              displayCode={`<script>\n  window.GlintPostConfig = {\n    visitorId: "user_123",\n    datalayer: {\n      plan: "pro",\n      role: "admin"\n    }\n  };\n</script>`}
              copyCode={`<script>\n  window.GlintPostConfig = {\n    visitorId: "user_123",\n    datalayer: {\n      plan: "pro",\n      role: "admin"\n    }\n  };\n</script>`}
            />
          </div>
        </>
      ) : isAnnouncements ? (
        <>
          <div className={styles.card}>
            <div className={styles.cardIntro}>
              <h3>Announcement Widget</h3>
              <p>
                Shows a full-screen overlay or top banner to your users. Announcements auto-display once per session based on priority and scheduling.
              </p>
            </div>
            <CopyCodeBlock
              displayCode={getAnnouncementSnippet(appUrl, maskSecret(apiKey))}
              copyCode={getAnnouncementSnippet(appUrl, apiKey)}
            />
          </div>
          <div className={styles.card}>
            <div className={styles.cardIntro}>
              <h3>Headless API</h3>
              <p>
                Fetch active announcements via REST API and render them in your own UI.
                Audience-targeted announcements are filtered client-side with the{" "}
                <code>glintpost-targeting.js</code> helper. You generate and persist a visitor ID
                on your side for view/click deduplication. Set your allowed domain in Settings for
                cross-origin access.
              </p>
            </div>
            <CopyCodeBlock
              displayCode={getAnnouncementHeadlessSnippet(appUrl, maskSecret(apiKey))}
              copyCode={getAnnouncementHeadlessSnippet(appUrl, apiKey)}
            />
          </div>
          <div className={styles.card}>
            <div className={styles.cardIntro}>
              <h3>Advanced Config</h3>
              <p>
                Pass visitor identity and datalayer variables for targeting. Define this before the widget script loads.
              </p>
            </div>
            <CopyCodeBlock
              displayCode={`<script>\n  window.GlintPostConfig = {\n    visitorId: "user_123",\n    datalayer: {\n      plan: "pro",\n      role: "admin"\n    }\n  };\n</script>`}
              copyCode={`<script>\n  window.GlintPostConfig = {\n    visitorId: "user_123",\n    datalayer: {\n      plan: "pro",\n      role: "admin"\n    }\n  };\n</script>`}
            />
          </div>
        </>
      ) : widget ? (
        widget.integrations.map((opt) => (
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
        ))
      ) : null}
    </>
  );
}
