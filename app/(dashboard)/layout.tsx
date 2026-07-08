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
      <Sidebar
        orgName={org.name}
        userName={session.user.name ?? session.user.email ?? ""}
        billingEnabled={process.env.ENABLE_BILLING !== "false"}
      />
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
