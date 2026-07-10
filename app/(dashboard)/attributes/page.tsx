import { requireOrg } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import type { Attribute } from "@/types/targeting";
import AttributesManager, { type DiscoveredKey } from "./AttributesManager";

export const dynamic = "force-dynamic";

export default async function AttributesPage() {
  const { org } = await requireOrg();
  const db = getOrgPrisma(org.id);

  const [attributes, observed] = await Promise.all([
    db.attribute.findMany({ orderBy: { label: "asc" } }),
    db.observedAttribute.findMany({ orderBy: { lastSeenAt: "desc" }, take: 100 }),
  ]);

  const discovered: DiscoveredKey[] = observed.map((o) => ({
    key: o.key,
    inferredType: o.inferredType,
  }));

  return (
    <AttributesManager
      initialAttributes={attributes as Attribute[]}
      discovered={discovered}
    />
  );
}
