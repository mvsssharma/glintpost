"use client";

import { useState, useEffect, useRef } from "react";
import { WIDGETS } from "@/lib/widgets";
import styles from "./page.module.css";

function hasSlideover(widget: (typeof WIDGETS)[number]) {
  return widget.integrations.some((i) => i.mode === "slideover");
}

export default function PreviewContent({
  apiKey,
  theme,
  primaryColor,
}: {
  apiKey: string;
  theme: string;
  primaryColor: string;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const widget = WIDGETS[activeIdx];
  const isSlideover = hasSlideover(widget);

  useEffect(() => {
    if (!isSlideover) return;

    // Clean up any existing widget badges/containers
    document
      .querySelectorAll(
        ".glintpost-changelog-badge, .glintpost-changelog-container, .glintpost-roadmap-badge, .glintpost-roadmap-container"
      )
      .forEach((el) => el.remove());

    // Reset initialization flags so scripts can re-run
    (window as Record<string, unknown>).GlintPostChangelogInitialized = false;
    (window as Record<string, unknown>).GlintPostRoadmapInitialized = false;

    // Remove old widget scripts
    document
      .querySelectorAll(
        WIDGETS.map((w) => `script[src*="${w.script}"]`).join(", ")
      )
      .forEach((el) => el.remove());

    // Load the selected widget script
    const script = document.createElement("script");
    script.src = `/${widget.script}`;
    script.setAttribute("data-api-key", apiKey);
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, [activeIdx, apiKey, widget.script, isSlideover]);

  // Clean up slideover artifacts when switching to inline widget
  useEffect(() => {
    if (isSlideover) return;

    document
      .querySelectorAll(
        ".glintpost-changelog-badge, .glintpost-changelog-container, .glintpost-roadmap-badge, .glintpost-roadmap-container"
      )
      .forEach((el) => el.remove());

    (window as Record<string, unknown>).GlintPostChangelogInitialized = false;
    (window as Record<string, unknown>).GlintPostRoadmapInitialized = false;

    document
      .querySelectorAll(
        WIDGETS.map((w) => `script[src*="${w.script}"]`).join(", ")
      )
      .forEach((el) => el.remove());
  }, [isSlideover]);

  return (
    <>
      <div className={styles.widgetPicker}>
        {WIDGETS.map((w, i) => (
          <button
            key={w.key}
            className={`${styles.pickerBtn} ${activeIdx === i ? styles.pickerActive : ""}`}
            onClick={() => setActiveIdx(i)}
          >
            {w.label}
          </button>
        ))}
      </div>

      {isSlideover ? (
        <div className={styles.previewArea} ref={containerRef}>
          <div className={styles.mockSite}>
            <div className={styles.mockNav} />
            <div className={styles.mockContent}>
              <div className={styles.mockHeading} />
              <div className={styles.mockLine} />
              <div className={styles.mockLine} style={{ width: "80%" }} />
              <div className={styles.mockLine} style={{ width: "60%" }} />
            </div>
          </div>
          <p className={styles.hint}>
            Try it out &mdash; click the floating button on the bottom right
          </p>
        </div>
      ) : (
        <iframe
          src={`${widget.pagePath}?apiKey=${apiKey}&theme=${theme}&primaryColor=${encodeURIComponent(primaryColor)}`}
          className={styles.inlineIframe}
          title={`${widget.label} preview`}
          scrolling="no"
          style={{ background: theme === "dark" ? "hsl(224 71% 4%)" : "hsl(220 10% 98%)" }}
        />
      )}
    </>
  );
}
