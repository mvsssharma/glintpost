import { requireOrg } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db";
import { FeedbackFormBuilder } from "./FeedbackFormBuilder";
import styles from "./page.module.css";
import Link from "next/link";
import type { FeedbackQuestion } from "@/types";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const { org } = await requireOrg();

  const form = await prisma.feedbackForm.findUnique({
    where: { orgId: org.id },
    include: { _count: { select: { responses: true } } },
  });

  const responseCount = form?._count?.responses ?? 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h2>Feedback</h2>
            <p>Configure a feedback form for your visitors. Max 3 questions.</p>
          </div>
          {form && (
            <Link href="/feedback/responses" className="btn-secondary">
              {responseCount > 0
                ? `View responses (${responseCount})`
                : "View responses"}
            </Link>
          )}
        </div>
      </header>

      <FeedbackFormBuilder
        existingForm={
          form
            ? {
                title: form.title,
                enabled: form.enabled,
                questions: form.questions as unknown as FeedbackQuestion[],
              }
            : null
        }
      />
    </div>
  );
}
