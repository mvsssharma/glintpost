import { requireOrg } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function PreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ apiKey?: string }>;
}) {
  const { org } = await requireOrg();
  const params = await searchParams;

  // Only allow previewing your own widget
  if (params.apiKey !== org.apiKey) {
    redirect("/settings");
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2>Widget Preview</h2>
        <p>This is how the GlintPost widget will appear on your site.</p>
      </header>

      <div className={styles.previewArea}>
        <div className={styles.mockSite}>
          <div className={styles.mockNav} />
          <div className={styles.mockContent}>
            <div className={styles.mockHeading} />
            <div className={styles.mockLine} />
            <div className={styles.mockLine} style={{ width: "80%" }} />
            <div className={styles.mockLine} style={{ width: "60%" }} />
          </div>
        </div>
      </div>

      {/* Widget script loads at the bottom */}
      <script
        src="/widget.js"
        data-api-key={org.apiKey}
        defer
      />
    </div>
  );
}
