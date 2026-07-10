import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { audienceUsageCounts } from "@/lib/targeting-server";
import type { Attribute, AudienceRuleSet } from "@/types/targeting";
import AudiencesManager, { type AudienceRow } from "./AudiencesManager";

export const dynamic = "force-dynamic";

export default async function AudiencesPage() {
  const { org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const [audiences, attributes, usage] = await Promise.all([
    db.audience.findMany({ orderBy: { name: "asc" } }),
    db.attribute.findMany({ orderBy: { label: "asc" } }),
    audienceUsageCounts(db),
  ]);

  const rows: AudienceRow[] = audiences.map((a) => ({
    id: a.id,
    name: a.name,
    rules: a.rules as unknown as AudienceRuleSet,
    usageCount: usage.get(a.id) ?? 0,
  }));

  return (
    <AudiencesManager
      initialAudiences={rows}
      attributes={attributes as Attribute[]}
    />
  );
}
