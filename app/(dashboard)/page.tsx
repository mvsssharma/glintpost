import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { session, org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const [
    postsCount,
    widgetOpens,
    postViews,
    postLikes,
    postDislikes,
    roadmapItemsCount,
    roadmapViews,
    upvotes,
    downvotes,
    pendingSuggestions,
  ] = await Promise.all([
    db.post.count(),
    db.changelogEvent.count({ where: { type: "VIEW", postId: null } }),
    db.changelogEvent.count({ where: { type: "VIEW", postId: { not: null } } }),
    db.changelogEvent.count({ where: { type: "LIKE" } }),
    db.changelogEvent.count({ where: { type: "DISLIKE" } }),
    db.roadmapItem.count(),
    db.roadmapView.count(),
    db.roadmapVote.count({ where: { voteType: "UP" } }),
    db.roadmapVote.count({ where: { voteType: "DOWN" } }),
    db.roadmapSuggestion.count({ where: { status: "PENDING" } }),
  ]);

  const displayName =
    session.user.name || session.user.email?.split("@")[0] || "there";

  return (
    <div className={styles.dashboard}>
      <header className={styles.welcome}>
        <h2>Welcome back, {displayName}!</h2>
        <p>Here&apos;s a quick overview of your GlintPost widgets.</p>
      </header>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Changelog</h3>
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Posts</h3>
              <span className={styles.tipIcon} data-tip="Total changelog posts published">?</span>
            </div>
            <div className={styles.statValue}>{postsCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Views</h3>
              <span className={styles.tipIcon} data-tip="Times the changelog widget was opened">?</span>
            </div>
            <div className={styles.statValue}>{widgetOpens}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Reads</h3>
              <span className={styles.tipIcon} data-tip="Individual post detail views by visitors">?</span>
            </div>
            <div className={styles.statValue}>{postViews}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Likes</h3>
              <span className={styles.tipIcon} data-tip="Positive reactions on changelog posts">?</span>
            </div>
            <div className={styles.statValue}>{postLikes}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Dislikes</h3>
              <span className={styles.tipIcon} data-tip="Negative reactions on changelog posts">?</span>
            </div>
            <div className={styles.statValue}>{postDislikes}</div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Roadmap</h3>
        <div className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Items</h3>
              <span className={styles.tipIcon} data-tip="Features listed on your public roadmap">?</span>
            </div>
            <div className={styles.statValue}>{roadmapItemsCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Views</h3>
              <span className={styles.tipIcon} data-tip="Times the roadmap widget was opened">?</span>
            </div>
            <div className={styles.statValue}>{roadmapViews}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Upvotes</h3>
              <span className={styles.tipIcon} data-tip="Total upvotes across all roadmap items">?</span>
            </div>
            <div className={styles.statValue}>{upvotes}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Downvotes</h3>
              <span className={styles.tipIcon} data-tip="Total downvotes across all roadmap items">?</span>
            </div>
            <div className={styles.statValue}>{downvotes}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statHeader}>
              <h3>Suggestions</h3>
              <span className={styles.tipIcon} data-tip="User-submitted feature ideas awaiting review">?</span>
            </div>
            <div className={styles.statValue}>{pendingSuggestions}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
