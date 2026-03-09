import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { session, org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const [postsCount, widgetOpens, postViews, likesCount, dislikesCount] = await Promise.all([
    db.post.count(),
    db.engagementEvent.count({ where: { type: "VIEW", postId: null } }),
    db.engagementEvent.count({ where: { type: "VIEW", postId: { not: null } } }),
    db.engagementEvent.count({ where: { type: "LIKE" } }),
    db.engagementEvent.count({ where: { type: "DISLIKE" } }),
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
          <h3>Widget Opens</h3>
          <div className={styles.statValue}>{widgetOpens}</div>
        </div>
        <div className={styles.statCard}>
          <h3>Post Views</h3>
          <div className={styles.statValue}>{postViews}</div>
        </div>
        <div className={styles.statCard}>
          <h3>Likes</h3>
          <div className={styles.statValue}>{likesCount}</div>
        </div>
        <div className={styles.statCard}>
          <h3>Dislikes</h3>
          <div className={styles.statValue}>{dislikesCount}</div>
        </div>
      </div>
    </div>
  );
}
