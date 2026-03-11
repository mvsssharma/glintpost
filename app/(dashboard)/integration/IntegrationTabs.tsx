"use client";

import { useState } from "react";
import { WIDGETS, type WidgetConfig, type EmbedOption } from "@/lib/widgets";
import styles from "./page.module.css";

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
