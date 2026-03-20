"use client";

import { useState } from "react";
import styles from "./page.module.css";

export function CopyFormId({ formId }: { formId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const el = document.createElement("textarea");
      el.value = formId;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={styles.copyIdBtn}
      title={`Copy form ID: ${formId}`}
    >
      {copied ? "Copied!" : "Copy ID"}
    </button>
  );
}
