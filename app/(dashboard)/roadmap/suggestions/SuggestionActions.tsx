"use client";

import { useTransition } from "react";
import { handleSuggestion } from "@/app/actions/roadmap";
import styles from "./page.module.css";

export function SuggestionActions({ suggestionId }: { suggestionId: string }) {
  const [isPending, startTransition] = useTransition();

  const act = (action: "create" | "dismiss") => {
    startTransition(async () => {
      await handleSuggestion(suggestionId, action);
    });
  };

  return (
    <div className={styles.actions} style={{ opacity: isPending ? 0.5 : 1 }}>
      <button
        className={styles.createBtn}
        onClick={() => act("create")}
        disabled={isPending}
      >
        Create item
      </button>
      <button
        className={styles.dismissBtn}
        onClick={() => act("dismiss")}
        disabled={isPending}
      >
        Dismiss
      </button>
    </div>
  );
}
