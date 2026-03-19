import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import Link from "next/link";
import type { FeedbackQuestion } from "@/types";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

interface FeedbackAnswer {
  questionId: string;
  value: string | number;
}

function computeNps(scores: number[]): number | null {
  if (scores.length === 0) return null;
  const promoters = scores.filter((s) => s >= 9).length;
  const detractors = scores.filter((s) => s <= 6).length;
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

export default async function FeedbackResponsesPage() {
  const { org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const form = await db.feedbackForm.findFirst();

  if (!form) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h2>Feedback responses</h2>
          <p>No feedback form configured yet.</p>
        </header>
        <Link href="/feedback" className="btn-primary">
          Configure form
        </Link>
      </div>
    );
  }

  const questions = form.questions as unknown as FeedbackQuestion[];
  const responses = await db.feedbackResponse.findMany({
    where: { formId: form.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Compute NPS for NPS-type questions
  const npsScores: Record<string, number[]> = {};
  // Compute select tallies
  const selectTallies: Record<string, Record<string, number>> = {};

  for (const q of questions) {
    if (q.type === "NPS") npsScores[q.id] = [];
    if (q.type === "SELECT") selectTallies[q.id] = {};
  }

  for (const r of responses) {
    const ans = r.answers as unknown as FeedbackAnswer[];
    for (const a of ans) {
      if (npsScores[a.questionId] && typeof a.value === "number") {
        npsScores[a.questionId].push(a.value);
      }
      if (selectTallies[a.questionId] && typeof a.value === "string") {
        selectTallies[a.questionId][a.value] =
          (selectTallies[a.questionId][a.value] || 0) + 1;
      }
    }
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h2>Feedback responses</h2>
            <p>{responses.length} response{responses.length !== 1 ? "s" : ""} collected</p>
          </div>
          <Link href="/feedback" className="btn-secondary">
            Edit form
          </Link>
        </div>
      </header>

      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        {questions.map((q) => (
          <div key={q.id} className={styles.summaryCard}>
            <h3 className={styles.summaryTitle}>{q.text}</h3>

            {q.type === "NPS" && (
              <div className={styles.npsResult}>
                <span className={styles.npsScore}>
                  {computeNps(npsScores[q.id] ?? []) ?? "—"}
                </span>
                <span className={styles.npsLabel}>NPS Score</span>
                <div className={styles.npsBreakdown}>
                  <span className={styles.npsPromoters}>
                    {(npsScores[q.id] ?? []).filter((s) => s >= 9).length} promoters
                  </span>
                  <span className={styles.npsPassives}>
                    {(npsScores[q.id] ?? []).filter((s) => s >= 7 && s <= 8).length} passives
                  </span>
                  <span className={styles.npsDetractors}>
                    {(npsScores[q.id] ?? []).filter((s) => s <= 6).length} detractors
                  </span>
                </div>
              </div>
            )}

            {q.type === "SELECT" && (
              <div className={styles.selectResult}>
                {Object.entries(selectTallies[q.id] ?? {})
                  .sort(([, a], [, b]) => b - a)
                  .map(([option, count]) => {
                    const pct = responses.length > 0
                      ? Math.round((count / responses.length) * 100)
                      : 0;
                    return (
                      <div key={option} className={styles.barRow}>
                        <div className={styles.barLabel}>
                          <span>{option}</span>
                          <span className={styles.barCount}>{count} ({pct}%)</span>
                        </div>
                        <div className={styles.barTrack}>
                          <div
                            className={styles.barFill}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {q.type === "TEXT" && (
              <span className={styles.textHint}>
                See individual responses below
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Individual responses */}
      {responses.length > 0 && (
        <section className={styles.responsesSection}>
          <h3 className={styles.sectionTitle}>Individual responses</h3>
          <div className={styles.responsesList}>
            {responses.map((r) => {
              const ans = r.answers as unknown as FeedbackAnswer[];
              return (
                <div key={r.id} className={styles.responseCard}>
                  <span className={styles.responseDate}>
                    {new Date(r.createdAt).toLocaleDateString()} &middot;{" "}
                    {new Date(r.createdAt).toLocaleTimeString()}
                  </span>
                  {ans.map((a) => {
                    const q = questions.find((q) => q.id === a.questionId);
                    if (!q) return null;
                    return (
                      <div key={a.questionId} className={styles.answerRow}>
                        <span className={styles.answerLabel}>{q.text}</span>
                        <span className={styles.answerValue}>
                          {typeof a.value === "number" ? `${a.value}/10` : a.value}
                        </span>
                      </div>
                    );
                  })}
                  {r.visitorId && (
                    <span className={styles.visitorTag}>
                      {r.visitorId.slice(0, 12)}...
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
