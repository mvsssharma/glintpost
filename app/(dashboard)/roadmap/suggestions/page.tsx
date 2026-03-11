import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { SUGGESTION_STATUSES } from "@/lib/constants";
import { SuggestionActions } from "./SuggestionActions";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function SuggestionsPage() {
  const { org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const suggestions = (await db.roadmapSuggestion.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      matchedItem: { select: { id: true, title: true } },
    },
  })) as Array<{
    id: string;
    rawText: string;
    status: string;
    similarityScore: number | null;
    matchedItem: { id: string; title: string } | null;
    createdAt: Date;
  }>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Suggestions</h2>
        <p>Review feature suggestions from your users.</p>
      </header>

      <div className={styles.list}>
        {suggestions.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No suggestions yet.</p>
          </div>
        ) : (
          suggestions.map((s) => {
            const statusMeta = SUGGESTION_STATUSES.find((st) => st.value === s.status);
            return (
              <div key={s.id} className={styles.card}>
                <div className={styles.cardInfo}>
                  <p className={styles.rawText}>&ldquo;{s.rawText}&rdquo;</p>
                  <div className={styles.meta}>
                    <span className={styles.statusBadge}>{statusMeta?.label ?? s.status}</span>
                    {s.matchedItem && (
                      <span className={styles.matched}>
                        Matched: {s.matchedItem.title}
                        {s.similarityScore != null && ` (${Math.round(s.similarityScore * 100)}%)`}
                      </span>
                    )}
                    <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                {s.status === "PENDING" && (
                  <SuggestionActions suggestionId={s.id} />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
