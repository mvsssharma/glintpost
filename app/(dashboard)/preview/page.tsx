import { requireOrg } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/constants";
import PreviewContent from "./PreviewContent";
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

      <PreviewContent
        apiKey={org.apiKey}
        theme={org.settings?.widgetTheme ?? "light"}
        primaryColor={org.settings?.primaryColor ?? DEFAULT_PRIMARY_COLOR}
      />
    </div>
  );
}
