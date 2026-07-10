/**
 * Persistence + background refresh for the org's learned nomenclature
 * (OrgSettings.nomenclature). See lib/glossary.ts for the term logic.
 */
import { after } from "next/server";
import { getOrgPrisma } from "./db";
import { decrypt } from "./crypto";
import { htmlToText } from "./html-segments";
import { refineNomenclature, type DerivedTerms, type StoredNomenclature } from "./glossary";
import { logger } from "./logger";

// Skip an LLM refresh if the glossary was updated within this window (cost guard).
const DEBOUNCE_MS = 10 * 60 * 1000;

/** Safely parse the OrgSettings.nomenclature JSON column. */
export function readNomenclature(json: unknown): StoredNomenclature | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  const proper = Array.isArray(o.properNouns) ? o.properNouns.filter((x): x is string => typeof x === "string") : [];
  const domain = Array.isArray(o.domainTerms) ? o.domainTerms.filter((x): x is string => typeof x === "string") : [];
  if (proper.length === 0 && domain.length === 0) return null;
  return {
    properNouns: proper,
    domainTerms: domain,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : "",
  };
}

/**
 * Read just the glossary's `updatedAt` — even when the term lists are empty (in which
 * case `readNomenclature` returns null). Used for the refresh debounce so an org whose
 * derived glossary is legitimately empty doesn't hit the LLM on every single post save.
 */
export function readNomenclatureUpdatedAt(json: unknown): string | null {
  if (!json || typeof json !== "object") return null;
  const ts = (json as Record<string, unknown>).updatedAt;
  return typeof ts === "string" && ts ? ts : null;
}

type OrgDb = ReturnType<typeof getOrgPrisma>;

/** Plain-text of the org's most recent published posts (style + term examples). */
export async function getRecentPostTexts(db: OrgDb, limit = 5): Promise<string[]> {
  const posts = await db.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: limit,
    include: { translations: { where: { locale: "en" } } },
  });
  return posts
    .flatMap((p) => p.translations.map((t) => htmlToText(t.content)))
    .filter((s) => s.length > 0);
}

/**
 * Regenerate the org's nomenclature from its own content. Fire-and-forget after a
 * post is created/published. NEVER throws — all errors are swallowed so it can't
 * affect the save that triggered it.
 */
export async function refreshOrgNomenclature(orgId: string, newPlainText: string): Promise<void> {
  try {
    const db = getOrgPrisma(orgId);
    const settings = await db.orgSettings.findUnique({ where: { orgId } });
    if (!settings) return;

    const existing = readNomenclature(settings.nomenclature);
    const lastUpdatedAt = readNomenclatureUpdatedAt(settings.nomenclature);
    if (lastUpdatedAt) {
      const age = Date.now() - new Date(lastUpdatedAt).getTime();
      if (age >= 0 && age < DEBOUNCE_MS) return; // refreshed recently — skip (even if empty)
    }

    const recentPosts = await getRecentPostTexts(db, 5);
    const refined: DerivedTerms = await refineNomenclature({
      existing,
      newText: newPlainText,
      recentPosts,
      settings,
      decryptKey: decrypt,
    });

    const value: StoredNomenclature = { ...refined, updatedAt: new Date().toISOString() };
    await db.orgSettings.update({ where: { orgId }, data: { nomenclature: value } });
  } catch (err) {
    logger.error({ err }, "refreshOrgNomenclature failed");
  }
}

/**
 * Fire-and-forget a nomenclature refresh from post/announcement HTML after the
 * response is sent (`after`). Converts HTML → plain text and skips empty content.
 * Use this from route handlers instead of wiring `after`/`htmlToText` inline.
 */
export function scheduleNomenclatureRefresh(orgId: string, html: string): void {
  const text = htmlToText(html);
  if (!text) return;
  after(() => refreshOrgNomenclature(orgId, text));
}
