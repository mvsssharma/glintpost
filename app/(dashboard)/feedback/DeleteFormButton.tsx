"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteFeedbackForm } from "@/app/actions/feedback";
import styles from "./page.module.css";

export function DeleteFormButton({
  formId,
  formTitle,
}: {
  formId: string;
  formTitle: string;
}) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete "${formTitle}"? This will also delete all responses.`)) {
      return;
    }
    setDeleting(true);
    const result = await deleteFeedbackForm(formId);
    if (result.error) {
      alert(result.error);
      setDeleting(false);
    } else {
      router.refresh();
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className={styles.deleteBtn}
      title="Delete form"
    >
      {deleting ? "..." : "×"}
    </button>
  );
}
