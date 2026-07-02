import Link from "next/link";
import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { ROADMAP_STATUSES } from "@/lib/constants";
import { roadmapVoteTotals } from "@/lib/roadmap-votes";
import { RoadmapItemRow } from "./RoadmapItemRow";
import ImportDialog from "@/app/components/ImportDialog";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function RoadmapAdminPage() {
  const { org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const items = await db.roadmapItem.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  const itemIds = items.map((i) => i.id);

  const [upvoteCounts, downvoteCounts, pendingSuggestions] = await Promise.all([
    itemIds.length > 0
      ? db.roadmapVote.groupBy({
          by: ["itemId"],
          where: { itemId: { in: itemIds }, voteType: "UP" },
          _count: true,
        })
      : [],
    itemIds.length > 0
      ? db.roadmapVote.groupBy({
          by: ["itemId"],
          where: { itemId: { in: itemIds }, voteType: "DOWN" },
          _count: true,
        })
      : [],
    db.roadmapSuggestion.count({ where: { status: "PENDING" } }),
  ]);

  const upMap = Object.fromEntries(
    (upvoteCounts as { itemId: string; _count: number }[]).map((u) => [u.itemId, u._count]),
  );
  const downMap = Object.fromEntries(
    (downvoteCounts as { itemId: string; _count: number }[]).map((d) => [d.itemId, d._count]),
  );

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h2>Roadmap</h2>
          <p>Manage feature requests and prioritize your roadmap.</p>
        </div>
        <div className={styles.headerActions}>
          {pendingSuggestions > 0 && (
            <Link href="/roadmap/suggestions" className="btn-secondary">
              {pendingSuggestions} pending suggestion{pendingSuggestions !== 1 ? "s" : ""}
            </Link>
          )}
          <Link href="/roadmap/create" className="btn-primary">
            Add Item
          </Link>
        </div>
      </header>

      <div className={styles.itemList}>
        {items.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No roadmap items yet. Add your first feature request!</p>
          </div>
        ) : (
          items.map((item) => {
            const statusMeta = ROADMAP_STATUSES.find((s) => s.value === item.status);
            const totals = roadmapVoteTotals(
              item.importedUpvotes,
              item.importedDownvotes,
              (upMap[item.id] as number) ?? 0,
              (downMap[item.id] as number) ?? 0,
            );
            return (
              <RoadmapItemRow
                key={item.id}
                item={{
                  id: item.id,
                  title: item.title,
                  description: item.description,
                  status: item.status,
                  createdAt: item.createdAt.toISOString(),
                  upvotes: totals.upvotes,
                  downvotes: totals.downvotes,
                }}
                statusColor={statusMeta?.color ?? "#6b7280"}
                statusLabel={statusMeta?.label ?? item.status}
              />
            );
          })
        )}
      </div>

      {items.length < 3 && <ImportDialog type="roadmap" />}
    </div>
  );
}
