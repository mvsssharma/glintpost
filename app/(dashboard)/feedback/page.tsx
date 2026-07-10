import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import styles from "./page.module.css";
import { DeleteFormButton } from "./DeleteFormButton";
import { CopyFormId } from "./CopyFormId";

export const dynamic = "force-dynamic";

export default async function FeedbackPage() {
  const { org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const forms = await db.feedbackForm.findMany({
    include: { _count: { select: { responses: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h2>Feedback</h2>
            <p>Create and manage feedback forms for your visitors. Each form can have up to 3 questions.</p>
          </div>
          <Link href="/feedback/new" className="btn-primary">
            + New form
          </Link>
        </div>
      </header>

      {forms.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No feedback forms yet. Create your first form to start collecting feedback.</p>
        </div>
      ) : (
        <div className={styles.formList}>
          {forms.map((form) => (
            <div key={form.id} className={styles.formCard}>
              <div className={styles.formCardHeader}>
                <div className={styles.formCardTitle}>
                  <h3>{form.title}</h3>
                  <span
                    className={`${styles.statusBadge} ${form.enabled ? styles.statusActive : styles.statusDisabled}`}
                  >
                    {form.enabled ? "Live" : "Disabled"}
                  </span>
                </div>
                <DeleteFormButton formId={form.id} formTitle={form.title} />
              </div>
              <div className={styles.formCardMeta}>
                <span>{form._count.responses} response{form._count.responses !== 1 ? "s" : ""}</span>
                <span>&middot;</span>
                <span>Created {formatDate(form.createdAt)}</span>
              </div>
              <div className={styles.formCardActions}>
                <Link href={`/feedback/${form.id}`} className="btn-secondary">
                  Edit
                </Link>
                <Link href={`/feedback/${form.id}/responses`} className="btn-secondary">
                  {form._count.responses > 0
                    ? `View responses (${form._count.responses})`
                    : "View responses"}
                </Link>
                <CopyFormId formId={form.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
