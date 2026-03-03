import { requireOrg } from "@/lib/auth-helpers";
import { Sidebar } from "./sidebar";
import styles from "./dashboard.module.css";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { session, org } = await requireOrg();

  return (
    <div className={styles.layout}>
      <Sidebar orgName={org.name} />
      <main className={styles.main}>
        <header className={styles.header}>
          <span className={styles.headerTitle}>{org.name}</span>
          <div className={styles.headerActions}>
            <div className={styles.avatar}>
              {(session.user.name ?? session.user.email)?.[0]?.toUpperCase()}
            </div>
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
