import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { FeedbackFormBuilder } from "../FeedbackFormBuilder";
import type { FeedbackQuestion } from "@/types";
import styles from "../page.module.css";

export const dynamic = "force-dynamic";

export default async function EditFeedbackFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const { org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const form = await db.feedbackForm.findFirst({
    where: { id: formId },
  });

  if (!form) notFound();

  return (
    <div className={styles.containerNarrow}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h2>Edit feedback form</h2>
            <p>Update questions, toggle visibility, or change the form title.</p>
          </div>
          <Link href="/feedback" className="btn-secondary">
            Back to forms
          </Link>
        </div>
      </header>

      <FeedbackFormBuilder
        formId={form.id}
        existingForm={{
          title: form.title,
          enabled: form.enabled,
          questions: form.questions as unknown as FeedbackQuestion[],
        }}
      />
    </div>
  );
}
