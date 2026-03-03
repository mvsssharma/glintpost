import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { session, org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const [postsCount, viewsCount, likesCount] = await Promise.all([
    db.post.count(),
    db.engagementEvent.count({ where: { type: "VIEW" } }),
    db.engagementEvent.count({ where: { type: "LIKE" } }),
  ]);

  const displayName =
    session.user.name || session.user.email?.split("@")[0] || "there";

  return (
    <div className={styles.dashboard}>
      <header className={styles.welcome}>
        <h2>Welcome back, {displayName}!</h2>
        <p>Here&apos;s a quick overview of your release announcements.</p>
      </header>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <h3>Total Posts</h3>
          <div className={styles.statValue}>{postsCount}</div>
        </div>
        <div className={styles.statCard}>
          <h3>Widget Views</h3>
          <div className={styles.statValue}>{viewsCount}</div>
        </div>
        <div className={styles.statCard}>
          <h3>Likes</h3>
          <div className={styles.statValue}>{likesCount}</div>
        </div>
      </div>
    </div>
  );
}
