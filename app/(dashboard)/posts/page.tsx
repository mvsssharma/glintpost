import Link from "next/link";
import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import PostActions from "./PostActions";
import ImportDialog from "@/app/components/ImportDialog";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { org } = await requireOrg();
  const db = getOrgPrisma(org.id);
  const { status: statusFilter } = await searchParams;

  const activeFilter = statusFilter === "PUBLISHED" ? "PUBLISHED" : statusFilter === "DRAFT" ? "DRAFT" : "ALL";

  const rawPosts = (await db.post.findMany({
    orderBy: { createdAt: "desc" },
    ...(activeFilter !== "ALL" && { where: { status: activeFilter } }),
    include: {
      translations: { where: { locale: "en" }, take: 1 },
      _count: {
        select: {
          changelogEvents: { where: { type: "LIKE" } },
        },
      },
    },
  })) as Array<{
    id: string;
    status: string;
    createdAt: Date;
    translations: Array<{ title: string; content: string }>;
    _count: { changelogEvents: number };
  }>;

  // _count only supports one filter per relation, so query dislikes separately
  const postIds = rawPosts.map((p) => p.id);
  const dislikeCounts = await db.changelogEvent.groupBy({
    by: ["postId"],
    where: { postId: { in: postIds }, type: "DISLIKE" },
    _count: true,
  });
  const dislikeMap = Object.fromEntries(
    dislikeCounts.map((d: { postId: string | null; _count: number }) => [d.postId, d._count])
  );

  const posts = rawPosts.map((post) => ({
    ...post,
    likes: post._count.changelogEvents,
    dislikes: (dislikeMap[post.id] as number) ?? 0,
  }));

  // Import is a migration aid — only offer it while the section is nearly empty
  const showImport = (await db.post.count()) < 3;

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

      <div className={styles.filterTabs}>
        <Link
          href="/posts"
          className={`${styles.filterTab} ${activeFilter === "ALL" ? styles.filterTabActive : ""}`}
        >
          All
        </Link>
        <Link
          href="/posts?status=DRAFT"
          className={`${styles.filterTab} ${activeFilter === "DRAFT" ? styles.filterTabActive : ""}`}
        >
          Drafts
        </Link>
        <Link
          href="/posts?status=PUBLISHED"
          className={`${styles.filterTab} ${activeFilter === "PUBLISHED" ? styles.filterTabActive : ""}`}
        >
          Published
        </Link>
      </div>

      <div className={styles.postList}>
        {posts.length === 0 ? (
          <div className={styles.emptyState}>
            <p>
              {activeFilter === "DRAFT"
                ? "No drafts yet."
                : activeFilter === "PUBLISHED"
                  ? "No published posts yet."
                  : "No posts yet. Create your first release announcement!"}
            </p>
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
                    <span className={`${styles.status} ${post.status === "DRAFT" ? styles.statusDraft : styles.statusPublished}`}>
                      {post.status}
                    </span>
                    <span className={styles.date}>
                      {new Date(post.createdAt).toLocaleDateString()}
                    </span>
                    <span className={styles.reactions} style={{ display: "inline-flex", gap: "1rem" }}>
                      <span>👍 {post.likes}</span>
                      <span>👎 {post.dislikes}</span>
                    </span>
                  </div>
                </div>
                <PostActions postId={post.id} />
              </div>
            );
          })
        )}
      </div>

      {showImport && <ImportDialog type="posts" />}
    </div>
  );
}
