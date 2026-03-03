import Link from "next/link";
import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function PostsPage() {
  const { org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const posts = (await db.post.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      translations: { where: { locale: "en" }, take: 1 },
      _count: { select: { engagements: true } },
    },
  })) as Array<{
    id: string;
    status: string;
    createdAt: Date;
    translations: Array<{ title: string; content: string }>;
    _count: { engagements: number };
  }>;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h2>Changelog Posts</h2>
          <p>Manage your feature releases and announcements.</p>
        </div>
        <Link href="/posts/create" className="btn-primary">
          Create Post
        </Link>
      </header>

      <div className={styles.postList}>
        {posts.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No posts yet. Create your first release announcement!</p>
          </div>
        ) : (
          posts.map((post) => {
            const title =
              post.translations[0]?.title ?? "Untitled";
            return (
              <div key={post.id} className={styles.postCard}>
                <div className={styles.postInfo}>
                  <h3 className={styles.postTitle}>{title}</h3>
                  <div className={styles.postMeta}>
                    <span className={styles.status}>{post.status}</span>
                    <span className={styles.date}>
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                    <span className={styles.engagements}>
                      {post._count.engagements} engagements
                    </span>
                  </div>
                </div>
                <div className={styles.postActions}>
                  <button className="btn-secondary">Edit</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
