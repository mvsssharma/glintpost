// Server-side targeting helpers: rule validation against the attribute
// registry, cache invalidation, and serve-time resolution of audienceIds
// into the self-contained payload the widget matchers consume.

import { cacheInvalidate } from "@/lib/cache";
import { getOrgPrisma } from "@/lib/db";
import { ruleError } from "@/lib/attributes";
import { ValidationError } from "@/lib/errors";
import type {
  Attribute,
  AttributeType,
  AudienceRule,
  AudienceRuleSet,
  ResolvedAudience,
  ResolvedTargeting,
} from "@/types/targeting";

/** Resolved targeting is baked into both cached widget payloads. */
export function invalidateTargetingCaches(orgId: string): void {
  cacheInvalidate(orgId, "announcements");
  cacheInvalidate(orgId, "changelog-posts");
}

/**
 * Validate that the given audience ids all belong to the org, returning the
 * de-duplicated list. Throws if any id is unknown. Empty/undefined → [].
 */
export async function resolveAudienceRefs(
  db: ReturnType<typeof getOrgPrisma>,
  audienceIds: string[] | undefined,
): Promise<string[]> {
  if (!audienceIds || audienceIds.length === 0) return [];
  const unique = [...new Set(audienceIds)];
  const found = await db.audience.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  if (found.length !== unique.length) {
    throw new ValidationError("One or more selected audiences no longer exist");
  }
  return unique;
}

type AttrLite = { type: AttributeType; values: string[] };

/**
 * Validate an audience rule set against the org's attributes. Throws a
 * ValidationError on the first problem, otherwise returns silently.
 */
export function validateAudienceRules(
  ruleSet: AudienceRuleSet,
  attributesByKey: Map<string, AttrLite>,
): void {
  for (const rule of ruleSet.rules) {
    const attr = attributesByKey.get(rule.attributeKey);
    const err = ruleError(attr, rule.op, rule.value);
    if (err) {
      throw new ValidationError(`${rule.attributeKey}: ${err}`);
    }
  }
}

export function attributeMap(attributes: Attribute[]): Map<string, AttrLite> {
  return new Map(attributes.map((a) => [a.key, { type: a.type, values: a.values }]));
}

/**
 * How many posts + announcements reference each audience id, keyed by id.
 * Powers the "used by N" badge on the audiences list.
 */
export async function audienceUsageCounts(
  db: ReturnType<typeof getOrgPrisma>,
): Promise<Map<string, number>> {
  const [posts, announcements] = await Promise.all([
    db.post.findMany({ select: { audienceIds: true } }),
    db.announcement.findMany({ select: { audienceIds: true } }),
  ]);
  const usage = new Map<string, number>();
  for (const row of [...posts, ...announcements]) {
    for (const id of row.audienceIds) usage.set(id, (usage.get(id) ?? 0) + 1);
  }
  return usage;
}

/**
 * Load the org's audiences + attributes as lookup maps for serve-time
 * resolution. One query each; both collections are small per org.
 */
export async function loadTargetingContext(db: ReturnType<typeof getOrgPrisma>): Promise<{
  audiencesById: Map<string, AudienceRuleSet>;
  attributesByKey: Map<string, AttrLite>;
}> {
  const [audiences, attributes] = await Promise.all([
    db.audience.findMany({ select: { id: true, rules: true } }),
    db.attribute.findMany({ select: { key: true, type: true, values: true } }),
  ]);
  return {
    audiencesById: new Map(
      audiences.map((a) => [a.id, a.rules as unknown as AudienceRuleSet]),
    ),
    attributesByKey: new Map(
      attributes.map((a) => [a.key, { type: a.type as AttributeType, values: a.values }]),
    ),
  };
}

/** Denormalize a stored audience into a resolved audience (attribute type inlined, unknown attrs dropped). */
function resolveAudience(
  ruleSet: AudienceRuleSet,
  attributesByKey: Map<string, AttrLite>,
): ResolvedAudience {
  const rules = ruleSet.rules
    .filter((r: AudienceRule) => attributesByKey.has(r.attributeKey))
    .map((r: AudienceRule) => ({
      attributeKey: r.attributeKey,
      type: attributesByKey.get(r.attributeKey)!.type,
      op: r.op,
      value: r.value,
    }));
  return { operator: ruleSet.operator, rules };
}

/**
 * Build the serve-time targeting payload for an item. Returns null when the
 * item targets no (resolvable) audiences — i.e. it is shown to everyone.
 */
export function resolveTargeting(
  audienceIds: string[],
  audienceMatch: string,
  audiencesById: Map<string, AudienceRuleSet>,
  attributesByKey: Map<string, AttrLite>,
): ResolvedTargeting | null {
  if (!audienceIds || audienceIds.length === 0) return null;

  const audiences = audienceIds
    .map((id) => audiencesById.get(id))
    .filter((r): r is AudienceRuleSet => r !== undefined)
    .map((ruleSet) => resolveAudience(ruleSet, attributesByKey))
    // Drop audiences left with no evaluable rules (all attributes deleted).
    .filter((a) => a.rules.length > 0);

  if (audiences.length === 0) return null;

  return { match: audienceMatch === "AND" ? "AND" : "OR", audiences };
}
