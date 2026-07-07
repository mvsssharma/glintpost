/**
 * Learned nomenclature — zero-config terminology derived from the org's own content.
 *
 * Two producers:
 *  - deriveTerms(): deterministic, no LLM. Cold-start seed + always-available fallback.
 *  - refineNomenclature(): LLM-refined incremental merge (falls back to deterministic).
 *
 * Consumers:
 *  - getEffectiveTerms(): union of persisted nomenclature + fresh deriveTerms, fed to
 *    every AI rewrite prompt and to checkTerms validation.
 *  - checkTerms(): flags terms that were in the source but vanished from the output.
 */
import { llmComplete } from "./llm";
import { logger } from "./logger";

export interface DerivedTerms {
  properNouns: string[];
  domainTerms: string[];
}

export interface StoredNomenclature extends DerivedTerms {
  updatedAt: string;
}

const MAX_TERMS = 15;

// Common words we never treat as proper nouns / domain terms (sentence-initial caps,
// changelog verbs, function words).
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "than", "this", "that", "these",
  "those", "we", "you", "our", "your", "their", "they", "it", "its", "is", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "can", "could", "should", "may", "might", "must", "in", "on", "at", "to", "for", "of",
  "with", "from", "by", "as", "into", "about", "over", "under", "when", "where", "while",
  "now", "new", "add", "added", "adds", "fix", "fixed", "fixes", "update", "updated", "updates",
  "improve", "improved", "improvement", "improvements", "change", "changed", "changes", "release",
  "released", "support", "supports", "supported", "make", "made", "makes", "use", "used", "using",
  "also", "more", "most", "some", "any", "all", "not", "no", "yes", "here", "there", "get", "set",
]);

function tokenizeWords(text: string): string[] {
  return text.split(/[^A-Za-z0-9]+/).filter(Boolean);
}

/** Deterministic extraction — cold-start seed and fallback. No LLM. */
export function deriveTerms(input: { sourceText: string; recentPosts: string[] }): DerivedTerms {
  const { sourceText, recentPosts } = input;
  const allText = [sourceText, ...recentPosts].join("\n");

  // --- Proper nouns / product names ---
  const properCounts = new Map<string, number>();
  const properRe = /\b[A-Z][a-z]+(?:[A-Z][a-zA-Z0-9]+)+\b|\b[A-Z]{2,}\b|\b[A-Z][a-z]{2,}\b/g;
  for (const m of allText.matchAll(properRe)) {
    const w = m[0];
    if (STOPWORDS.has(w.toLowerCase())) continue;
    properCounts.set(w, (properCounts.get(w) ?? 0) + 1);
  }
  const properNouns = [...properCounts.entries()]
    .filter(([w, c]) => c >= 2 || /[a-z][A-Z]/.test(w) || /^[A-Z]{2,}$/.test(w)) // recurring, CamelCase, or acronym
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TERMS)
    .map(([w]) => w);

  // --- Domain terms: frequent lowercase words in source AND in >=2 recent posts ---
  const sourceWords = new Set(
    tokenizeWords(sourceText.toLowerCase()).filter((w) => w.length >= 4 && !STOPWORDS.has(w)),
  );
  const postWordSets = recentPosts.map(
    (p) => new Set(tokenizeWords(p.toLowerCase()).filter((w) => w.length >= 4)),
  );
  const domainCounts = new Map<string, number>();
  for (const w of sourceWords) {
    const inPosts = postWordSets.filter((s) => s.has(w)).length;
    if (inPosts >= 2) domainCounts.set(w, inPosts);
  }
  const domainTerms = [...domainCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TERMS)
    .map(([w]) => w);

  return { properNouns, domainTerms };
}

/** Case-sensitive union for proper nouns, case-insensitive for domain terms. */
export function mergeTerms(a: DerivedTerms, b: DerivedTerms): DerivedTerms {
  const proper = uniqueBy([...a.properNouns, ...b.properNouns], (w) => w).slice(0, MAX_TERMS);
  const domain = uniqueBy([...a.domainTerms, ...b.domainTerms], (w) => w.toLowerCase()).slice(0, MAX_TERMS);
  return { properNouns: proper, domainTerms: domain };
}

function uniqueBy(arr: string[], key: (s: string) => string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of arr) {
    if (!s) continue;
    const k = key(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** Effective terms for an AI op = persisted glossary ∪ fresh derivation. Pure. */
export function getEffectiveTerms(
  persisted: DerivedTerms | null,
  sourceText: string,
  recentPosts: string[],
): DerivedTerms {
  const derived = deriveTerms({ sourceText, recentPosts });
  if (!persisted) return derived;
  return mergeTerms(persisted, derived);
}

function countOccurrences(haystack: string, needle: string, caseInsensitive: boolean): number {
  if (!needle) return 0;
  const flags = caseInsensitive ? "gi" : "g";
  const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, flags);
  return (haystack.match(re) ?? []).length;
}

/** Flag terms present in the source that vanished from the output. */
export function checkTerms(sourceText: string, outputText: string, terms: DerivedTerms): string[] {
  const warnings: string[] = [];

  for (const term of terms.domainTerms) {
    const inSource = countOccurrences(sourceText, term, true);
    if (inSource >= 2 && countOccurrences(outputText, term, true) === 0) {
      warnings.push(`"${term}" from your original text no longer appears`);
    }
  }
  for (const term of terms.properNouns) {
    const inSource = countOccurrences(sourceText, term, false);
    if (inSource >= 1 && countOccurrences(outputText, term, false) === 0) {
      warnings.push(`"${term}" from your original text no longer appears`);
    }
  }
  return warnings;
}

/**
 * LLM-refined incremental merge of the org glossary. Falls back to a deterministic
 * union if no AI is configured or the call fails. NEVER throws.
 */
export async function refineNomenclature(input: {
  existing: DerivedTerms | null;
  newText: string;
  recentPosts: string[];
  settings: { aiProvider: string | null; aiApiKey: string | null; aiModel: string | null };
  decryptKey: (cipher: string) => Promise<string>;
}): Promise<DerivedTerms> {
  const { existing, newText, recentPosts, settings, decryptKey } = input;
  const deterministic = () =>
    mergeTerms(existing ?? { properNouns: [], domainTerms: [] }, deriveTerms({ sourceText: newText, recentPosts }));

  if (!settings.aiProvider || !settings.aiApiKey || !settings.aiModel) {
    return deterministic();
  }

  try {
    const apiKey = await decryptKey(settings.aiApiKey);
    const system =
      "You maintain a small terminology glossary for a product's changelog. Given the existing glossary and new content, return an UPDATED glossary as JSON: {\"properNouns\":[...],\"domainTerms\":[...]}. " +
      "properNouns = product names and proper nouns (keep exact casing). domainTerms = the audience/domain nouns this product consistently uses (e.g. \"customer\", \"partner\", \"student\"). " +
      "Merge with the existing glossary, drop noise and generic words, keep each list to at most 15 of the most important, stable terms. Return ONLY the JSON object.";
    const user = JSON.stringify({
      existingGlossary: existing ?? { properNouns: [], domainTerms: [] },
      newContent: newText.slice(0, 6000),
      recentExamples: recentPosts.slice(0, 5).map((p) => p.slice(0, 1500)),
    });

    const response = await llmComplete({
      provider: settings.aiProvider,
      apiKey,
      model: settings.aiModel,
      system,
      user,
      maxTokens: 800,
      temperature: 0.1,
      timeoutMs: 30000,
    });

    const parsed = parseTerms(response);
    if (!parsed) return deterministic();
    // Keep existing persisted terms sticky (the LLM may drop a stable term that isn't in
    // the latest content), then add the LLM's terms and the deterministic derivation.
    return mergeTerms(
      mergeTerms(existing ?? { properNouns: [], domainTerms: [] }, parsed),
      deriveTerms({ sourceText: newText, recentPosts }),
    );
  } catch (err) {
    logger.error({ err }, "refineNomenclature failed, using deterministic fallback");
    return deterministic();
  }
}

function parseTerms(text: string): DerivedTerms | null {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  const o = obj as { properNouns?: unknown; domainTerms?: unknown };
  const proper = Array.isArray(o?.properNouns) ? o.properNouns.filter((x): x is string => typeof x === "string") : [];
  const domain = Array.isArray(o?.domainTerms) ? o.domainTerms.filter((x): x is string => typeof x === "string") : [];
  return { properNouns: proper.slice(0, MAX_TERMS), domainTerms: domain.slice(0, MAX_TERMS) };
}
