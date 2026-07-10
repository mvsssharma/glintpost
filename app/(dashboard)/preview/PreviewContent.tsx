"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { WIDGETS_WITH_FEEDBACK as WIDGETS } from "@/lib/widgets";
import { synthesizeDatalayer } from "@/lib/attributes";
import type { Attribute, AudienceRuleSet } from "@/types/targeting";
import styles from "./page.module.css";

export interface PreviewAudience {
  id: string;
  name: string;
  rules: AudienceRuleSet;
}

function hasSlideover(widget: (typeof WIDGETS)[number]) {
  return widget.integrations.some((i) => i.mode === "slideover");
}

const WIDGET_DOM_SELECTOR = [
  ".glintpost-changelog-badge",
  ".glintpost-changelog-tab",
  ".glintpost-changelog-container",
  ".glintpost-roadmap-badge",
  ".glintpost-roadmap-container",
  ".glintpost-feedback-badge",
  ".glintpost-feedback-tab",
  ".glintpost-feedback-container",
  ".glintpost-announcement-overlay",
  ".glintpost-announcement-banner",
].join(", ");

function cleanupWidgets() {
  document.querySelectorAll(WIDGET_DOM_SELECTOR).forEach((el) => el.remove());

  document.querySelectorAll("style").forEach((el) => {
    if (el.innerHTML.includes("glintpost-")) el.remove();
  });

  const win = window as unknown as Record<string, unknown>;
  win.GlintPostChangelogInitialized = false;
  win.GlintPostRoadmapInitialized = false;
  win.GlintPostFeedbackInitialized = false;
  win.GlintPostAnnouncementInitialized = false;
  win.GlintPostLoaderInitialized = false;

  win.__glintpost_badges = [];
  win.__glintpost_tabs = [];

  document
    .querySelectorAll(
      [...WIDGETS.map((w) => `script[src*="${w.script}"]`), 'script[src*="announcement-widget.js"]', 'script[src*="widget.js"][data-api-key]'].join(", ")
    )
    .forEach((el) => el.remove());

  try {
    localStorage.removeItem("glintpost_ann_session");
    localStorage.removeItem("glintpost_ann_seen");
  } catch {}
}

type ViewportMode = "desktop" | "mobile";

const ANNOUNCEMENT_IDX = WIDGETS.length;
const TAB_LABELS = [...WIDGETS.map((w) => w.label), "Announcements"];

export default function PreviewContent({
  apiKey,
  theme,
  primaryColor,
  audiences,
  attributes,
}: {
  apiKey: string;
  theme: string;
  primaryColor: string;
  audiences: PreviewAudience[];
  attributes: Attribute[];
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [viewport, setViewport] = useState<ViewportMode>("desktop");
  const [personaId, setPersonaId] = useState<string>(""); // "" = Everyone (all content)
  const containerRef = useRef<HTMLDivElement>(null);

  const attrMap = useMemo(
    () => new Map(attributes.map((a) => [a.key, { type: a.type, values: a.values }])),
    [attributes],
  );
  const persona = personaId ? audiences.find((a) => a.id === personaId) ?? null : null;
  // Synthesize a datalayer that satisfies the chosen audience; null = show all.
  const datalayer = useMemo(
    () => (persona ? synthesizeDatalayer(persona.rules, attrMap) : null),
    [persona, attrMap],
  );
  const previewShowAll = !persona;
  const datalayerJson = datalayer ? JSON.stringify(datalayer) : "";
  // Serialize for effect deps so injected widgets re-init on persona change.
  const personaKey = personaId + "|" + datalayerJson;
  const isAnnouncement = activeIdx === ANNOUNCEMENT_IDX;
  const widget = isAnnouncement ? null : WIDGETS[activeIdx];
  const isSlideover = widget ? hasSlideover(widget) : false;
  const widgetScript = widget?.script ?? null;

  useEffect(() => {
    // Injected widgets read persona from window.GlintPostConfig at load.
    const win = window as unknown as Record<string, unknown>;
    win.GlintPostConfig = {
      ...(datalayer ? { datalayer } : {}),
      previewShowAll,
    };

    if (isAnnouncement) {
      cleanupWidgets();

      const script = document.createElement("script");
      script.src = "/announcement-widget.js";
      script.setAttribute("data-api-key", apiKey);
      script.defer = true;
      document.body.appendChild(script);

      return () => {
        script.remove();
        cleanupWidgets();
      };
    }

    if (!isSlideover || !widgetScript) return;

    cleanupWidgets();

    const script = document.createElement("script");
    script.src = `/${widgetScript}`;
    script.setAttribute("data-api-key", apiKey);
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
      cleanupWidgets();
    };
    // personaKey re-inits injected widgets when the previewed audience changes.
  }, [activeIdx, apiKey, widgetScript, isSlideover, isAnnouncement, datalayer, previewShowAll, personaKey]);

  useEffect(() => {
    if (isSlideover || isAnnouncement) return;
    cleanupWidgets();
  }, [isSlideover, isAnnouncement]);

  const targetingParam = persona
    ? `&datalayer=${encodeURIComponent(datalayerJson)}`
    : "&preview=all";
  const iframeSrc = widget
    ? `${widget.pagePath}?apiKey=${apiKey}&theme=${theme}&primaryColor=${encodeURIComponent(primaryColor)}${targetingParam}`
    : "";
  const iframeBackground = theme === "dark" ? "hsl(224 71% 4%)" : "hsl(220 10% 98%)";

  return (
    <>
      <div className={styles.controlsRow}>
        <div className={styles.widgetPicker}>
          {TAB_LABELS.map((label, i) => (
            <button
              key={label}
              className={`${styles.pickerBtn} ${activeIdx === i ? styles.pickerActive : ""}`}
              onClick={() => setActiveIdx(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {audiences.length > 0 && (
          <label className={styles.personaPicker}>
            <span className={styles.personaLabel}>Preview as</span>
            <select
              className={styles.personaSelect}
              value={personaId}
              onChange={(e) => setPersonaId(e.target.value)}
            >
              <option value="">Everyone (all content)</option>
              {audiences.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </label>
        )}

        <div className={styles.viewportPicker}>
          <button
            className={`${styles.viewportBtn} ${viewport === "desktop" ? styles.viewportActive : ""}`}
            onClick={() => setViewport("desktop")}
            title="Desktop preview"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </button>
          <button
            className={`${styles.viewportBtn} ${viewport === "mobile" ? styles.viewportActive : ""}`}
            onClick={() => setViewport("mobile")}
            title="Mobile preview"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {persona && (
        <p className={styles.personaNote}>
          {datalayer && Object.keys(datalayer).length > 0 ? (
            <>Simulating a visitor with{" "}
              <code>
                {Object.entries(datalayer)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(", ")}
              </code>
              . Items targeting any audience these attributes match will appear —
              use this to spot cross-audience overlap.
            </>
          ) : (
            <>This audience has no rules our preview can simulate.</>
          )}
        </p>
      )}

      {isAnnouncement ? (
        <div className={styles.previewArea} ref={containerRef}>
          <div className={styles.mockSite}>
            <div className={styles.mockNav} />
            <div className={styles.mockContent}>
              <div className={styles.mockHeading} />
              <div className={styles.mockLine} />
              <div className={`${styles.mockLine} ${styles.mockLineShort}`} />
              <div className={`${styles.mockLine} ${styles.mockLineShorter}`} />
            </div>
          </div>
          <p className={styles.hint}>
            Publish an announcement to see it appear here automatically
          </p>
        </div>
      ) : isSlideover ? (
        viewport === "mobile" ? (
          <div className={styles.mobileFrame}>
            <div className={styles.mobileNotch} />
            <iframe
              src={iframeSrc}
              className={styles.mobileIframe}
              title={`${widget!.label} mobile preview`}
              style={{ background: iframeBackground }}
            />
          </div>
        ) : (
          <div className={styles.previewArea} ref={containerRef}>
            <div className={styles.mockSite}>
              <div className={styles.mockNav} />
              <div className={styles.mockContent}>
                <div className={styles.mockHeading} />
                <div className={styles.mockLine} />
                <div className={`${styles.mockLine} ${styles.mockLineShort}`} />
                <div className={`${styles.mockLine} ${styles.mockLineShorter}`} />
              </div>
            </div>
            <p className={styles.hint}>
              Try it out &mdash; click the floating button on the bottom right
            </p>
          </div>
        )
      ) : viewport === "mobile" ? (
        <div className={styles.mobileFrame}>
          <div className={styles.mobileNotch} />
          <iframe
            src={iframeSrc}
            className={styles.mobileIframe}
            title={`${widget!.label} mobile preview`}
            scrolling="no"
            style={{ background: iframeBackground }}
          />
        </div>
      ) : (
        <iframe
          src={iframeSrc}
          className={styles.inlineIframe}
          title={`${widget!.label} preview`}
          scrolling="no"
          style={{ background: iframeBackground }}
        />
      )}
    </>
  );
}
