"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { createRoadmapItem, type RoadmapActionState } from "@/app/actions/roadmap";
import { ROADMAP_STATUSES } from "@/lib/constants";
import styles from "./page.module.css";

export default function CreateRoadmapItemPage() {
  const router = useRouter();
  const [state, action, pending] = useActionState<RoadmapActionState, FormData>(
    async (prev, formData) => {
      const result = await createRoadmapItem(prev, formData);
      if (result.success) {
        router.push("/roadmap");
        router.refresh();
      }
      return result;
    },
    {},
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Add Roadmap Item</h2>
      </header>

      <form action={action} className={styles.form}>
        {state.error && <div className={styles.error}>{state.error}</div>}

        <div className={styles.formGroup}>
          <label htmlFor="title">Title <span className="text-danger">*</span></label>
          <input
            type="text"
            id="title"
            name="title"
            className="input-field"
            placeholder="e.g., Dark mode support"
            required
            minLength={3}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="description">Description (optional)</label>
          <textarea
            id="description"
            name="description"
            className="input-field"
            placeholder="Describe the feature in more detail..."
            rows={4}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="status">Initial status</label>
          <select id="status" name="status" className="input-field">
            {ROADMAP_STATUSES.filter((s) => s.value !== "ARCHIVED").map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.back()}
          >
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? "Creating..." : "Create Item"}
          </button>
        </div>
      </form>
    </div>
  );
}
