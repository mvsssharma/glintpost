import Link from "next/link";
import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import AnnouncementActions from "./AnnouncementActions";
import ImportDialog from "@/app/components/ImportDialog";
import { formatDate } from "@/lib/format";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { org } = await requireOrg();
  const db = getOrgPrisma(org.id);
  const { status: statusFilter } = await searchParams;

  const activeFilter = statusFilter === "PUBLISHED"
    ? "PUBLISHED"
    : statusFilter === "DRAFT"
      ? "DRAFT"
      : statusFilter === "ACTIVE"
        ? "ACTIVE"
        : "ALL";

  const now = new Date();

  // Independent queries — parallelize to avoid a waterfall.
  const [announcements, announcementCount] = (await Promise.all([
    db.announcement.findMany({
      orderBy: { createdAt: "desc" },
      ...(activeFilter === "PUBLISHED"
        ? { where: { status: "PUBLISHED" } }
        : activeFilter === "DRAFT"
          ? { where: { status: "DRAFT" } }
          : activeFilter === "ACTIVE"
            ? { where: { status: "PUBLISHED", startDate: { lte: now }, endDate: { gte: now } } }
            : {}),
      include: {
        _count: {
          select: {
            events: { where: { type: "VIEW" } },
          },
        },
      },
    }),
    db.announcement.count(),
  ])) as [
    Array<{
      id: string;
      title: string;
      displayType: string;
      priority: number;
      status: string;
      startDate: Date;
      endDate: Date;
      createdAt: Date;
      _count: { events: number };
    }>,
    number,
  ];
  // Import is a migration aid — only offered while the section is nearly empty
  const showImport = announcementCount < 3;

  const annIds = announcements.map((a) => a.id);
  // One pass for both remaining types; VIEW already comes from the _count above.
  const eventCounts = await db.announcementEvent.groupBy({
    by: ["announcementId", "type"],
    where: { announcementId: { in: annIds }, type: { in: ["APPEAR", "CLICK"] } },
    _count: true,
  });
  const countsByType = (wanted: string) =>
    Object.fromEntries(
      eventCounts
        .filter((c: { type: string }) => c.type === wanted)
        .map((c: { announcementId: string; _count: number }) => [c.announcementId, c._count])
    );
  const appearMap = countsByType("APPEAR");
  const clickMap = countsByType("CLICK");

  const items = announcements.map((a) => ({
    ...a,
    // Banners record APPEAR when shown and VIEW only once expanded, so the two
    // are meaningfully different there. Overlays are shown as content outright
    // and never record APPEAR.
    appearances: (appearMap[a.id] as number) ?? 0,
    views: a._count.events,
    clicks: (clickMap[a.id] as number) ?? 0,
    isActive: a.status === "PUBLISHED" && a.startDate <= now && a.endDate >= now,
  }));

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h2>Announcements</h2>
          <p>Push notifications to your users via overlays and banners.</p>
        </div>
        <Link href="/announcements/create" className="btn-primary">
          Create Announcement
        </Link>
      </header>

      <div className={styles.filterTabs}>
        <Link
          href="/announcements"
          className={`${styles.filterTab} ${activeFilter === "ALL" ? styles.filterTabActive : ""}`}
        >
          All
        </Link>
        <Link
          href="/announcements?status=DRAFT"
          className={`${styles.filterTab} ${activeFilter === "DRAFT" ? styles.filterTabActive : ""}`}
        >
          Drafts
        </Link>
        <Link
          href="/announcements?status=PUBLISHED"
          className={`${styles.filterTab} ${activeFilter === "PUBLISHED" ? styles.filterTabActive : ""}`}
        >
          Published
        </Link>
        <Link
          href="/announcements?status=ACTIVE"
          className={`${styles.filterTab} ${activeFilter === "ACTIVE" ? styles.filterTabActive : ""}`}
        >
          Active Now
        </Link>
      </div>

      <div className={styles.postList}>
        {items.length === 0 ? (
          <div className={styles.emptyState}>
            <p>
              {activeFilter === "DRAFT"
                ? "No drafts yet."
                : activeFilter === "PUBLISHED"
                  ? "No published announcements yet."
                  : activeFilter === "ACTIVE"
                    ? "No active announcements right now."
                    : "No announcements yet. Create your first one!"}
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className={styles.postCard}>
              <div className={styles.postInfo}>
                <h3 className={styles.postTitle}>{item.title}</h3>
                <div className={styles.postMeta}>
                  <span className={`${styles.status} ${item.status === "DRAFT" ? styles.statusDraft : item.isActive ? styles.statusActive : styles.statusPublished}`}>
                    {item.isActive ? "ACTIVE" : item.status}
                  </span>
                  <span className={styles.typeBadge}>
                    {item.displayType === "TOP_BANNER" ? "Banner" : "Overlay"}
                  </span>
                  <span className={styles.priority}>P{item.priority}</span>
                  <span className={styles.date}>
                    {formatDate(item.startDate)} – {formatDate(item.endDate)}
                  </span>
                  <span className={styles.stats}>
                    {/* Appearances only mean something for banners, which are
                        shown as a teaser before the content is opened. */}
                    {item.displayType === "TOP_BANNER" && `${item.appearances} appearances · `}
                    {item.views} views · {item.clicks} clicks
                  </span>
                </div>
              </div>
              <AnnouncementActions announcementId={item.id} />
            </div>
          ))
        )}
      </div>

      {showImport && <ImportDialog type="announcements" />}
    </div>
  );
}
