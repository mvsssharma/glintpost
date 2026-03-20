"use client";

import { useState, useCallback } from "react";
import { maskSecret } from "@/lib/mask";
import styles from "./page.module.css";

export function ApiKeyDisplay({ apiKey }: { apiKey: string }) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const masked = maskSecret(apiKey);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
    } catch {
      const el = document.createElement("textarea");
      el.value = apiKey;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [apiKey]);

  return (
    <div className={styles.apiKeyBlock}>
      <code className={styles.apiKeyValue}>
        {visible ? apiKey : masked}
      </code>
      <div className={styles.apiKeyActions}>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className={styles.apiKeyBtn}
          title={visible ? "Hide API key" : "Show API key"}
        >
          {visible ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className={`${styles.apiKeyBtn} ${copied ? styles.apiKeyBtnCopied : ""}`}
          title="Copy API key"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}
