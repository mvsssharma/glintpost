"use client";

import { useState, useTransition } from "react";
import { handleSuggestion } from "@/app/actions/roadmap";
import styles from "./page.module.css";

export function SuggestionActions({ suggestionId }: { suggestionId: string }) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const dismiss = () => {
    startTransition(async () => {
      await handleSuggestion(suggestionId, "dismiss");
    });
  };

  const createItem = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      await handleSuggestion(suggestionId, "create", undefined, title.trim(), description.trim() || undefined);
      setShowForm(false);
    });
  };

  if (showForm) {
    return (
      <div className={styles.createForm} style={{ opacity: isPending ? 0.5 : 1 }}>
        <input
          type="text"
          className={styles.createInput}
          placeholder="Roadmap item title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={isPending}
          autoFocus
        />
        <textarea
          className={styles.createTextarea}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={isPending}
          rows={2}
        />
        <div className={styles.createFormActions}>
          <button
            className={styles.createBtn}
            onClick={createItem}
            disabled={isPending || title.trim().length < 3}
          >
            {isPending ? "Creating..." : "Create"}
          </button>
          <button
            className={styles.dismissBtn}
            onClick={() => setShowForm(false)}
            disabled={isPending}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.actions} style={{ opacity: isPending ? 0.5 : 1 }}>
      <button
        className={styles.createBtn}
        onClick={() => setShowForm(true)}
        disabled={isPending}
      >
        Create item
      </button>
      <button
        className={styles.dismissBtn}
        onClick={dismiss}
        disabled={isPending}
      >
        Dismiss
      </button>
    </div>
  );
}
