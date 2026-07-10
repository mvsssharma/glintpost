import { requireOrg } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { getOrgPrisma } from "@/lib/db";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/constants";
import type { Attribute, AudienceRuleSet } from "@/types/targeting";
import PreviewContent, { type PreviewAudience } from "./PreviewContent";
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

  const db = getOrgPrisma(org.id);
  const [audiences, attributes] = await Promise.all([
    db.audience.findMany({ orderBy: { name: "asc" } }),
    db.attribute.findMany({ orderBy: { label: "asc" } }),
  ]);

  const previewAudiences: PreviewAudience[] = audiences.map((a) => ({
    id: a.id,
    name: a.name,
    rules: a.rules as unknown as AudienceRuleSet,
  }));

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
        audiences={previewAudiences}
        attributes={attributes as Attribute[]}
      />
    </div>
  );
}
