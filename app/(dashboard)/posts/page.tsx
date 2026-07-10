import Link from "next/link";
import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import PostActions from "./PostActions";
import ImportDialog from "@/app/components/ImportDialog";
import { formatDate } from "@/lib/format";
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

  // Independent queries — parallelize to avoid a waterfall.
  const [rawPosts, postCount] = (await Promise.all([
    db.post.findMany({
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
    }),
    db.post.count(),
  ])) as [
    Array<{
      id: string;
      status: string;
      createdAt: Date;
      translations: Array<{ title: string; content: string }>;
      _count: { changelogEvents: number };
    }>,
    number,
  ];
  // Import is a migration aid — only offered while the section is nearly empty
  const showImport = postCount < 3;

  // _count allows one filter per relation, so dislikes need their own (dependent) query
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
                      {formatDate(post.createdAt)}
                    </span>
                    <span className={styles.reactions}>
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
