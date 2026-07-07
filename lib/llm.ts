import { decrypt } from "./crypto";
import type { OrgSettings } from "@prisma/client";
import type { Block, OutBlock } from "./html-segments";
import type { DerivedTerms } from "./glossary";
import { logger } from "./logger";

interface SimilarityResult {
  itemId: string;
  title: string;
  score: number;
}

interface ExistingItem {
  id: string;
  title: string;
  description: string | null;
}

/**
 * Check semantic similarity between a suggestion and existing roadmap items.
 * Uses the org's configured LLM provider, falling back to Jaccard word overlap.
 */
export async function findSimilarItems(
  suggestion: string,
  existingItems: ExistingItem[],
  settings: Pick<OrgSettings, "aiProvider" | "aiApiKey" | "aiModel"> | null,
): Promise<SimilarityResult[]> {
  if (existingItems.length === 0) return [];

  if (!settings?.aiProvider || !settings?.aiApiKey || !settings?.aiModel) {
    return fallbackWordOverlap(suggestion, existingItems);
  }

  try {
    const apiKey = await decrypt(settings.aiApiKey);
    return await llmSimilarityCheck(
      suggestion,
      existingItems,
      settings.aiProvider,
      apiKey,
      settings.aiModel,
    );
  } catch (error) {
    logger.error({ err: error }, "LLM similarity check failed, using fallback");
    return fallbackWordOverlap(suggestion, existingItems);
  }
}

async function llmSimilarityCheck(
  suggestion: string,
  items: ExistingItem[],
  provider: string,
  apiKey: string,
  model: string,
): Promise<SimilarityResult[]> {
  // Limit to 50 items to keep prompt size reasonable
  const subset = items.slice(0, 50);

  const itemList = subset
    .map((item, i) => `${i + 1}. [${item.id}] "${item.title}"${item.description ? ` - ${item.description}` : ""}`)
    .join("\n");

  const systemPrompt =
    "You are a feature request similarity analyzer. Given a new suggestion and a list of existing feature requests, score the semantic similarity of the suggestion to each existing item on a scale of 0.0 to 1.0. Return ONLY a valid JSON array of objects with \"itemId\" and \"score\" fields for items with score > 0.3. No explanation.";

  const userPrompt = `New suggestion: "${suggestion}"\n\nExisting items:\n${itemList}`;

  const response = await llmComplete({
    provider,
    apiKey,
    model,
    system: systemPrompt,
    user: userPrompt,
    maxTokens: 500,
    timeoutMs: 15000,
  });
  const parsed = extractJSON(response);
  const scores: { itemId: string; score: number }[] = Array.isArray(parsed) ? parsed : [];

  return scores
    .filter((s) => typeof s.itemId === "string" && typeof s.score === "number" && s.score > 0.3)
    .map((s) => {
      const item = items.find((i) => i.id === s.itemId);
      return { itemId: s.itemId, title: item?.title ?? "", score: s.score };
    })
    .sort((a, b) => b.score - a.score);
}

function extractJSON(text: string): unknown {
  // Try to extract JSON array from the response (may have markdown fences)
  const match = text.match(/\[[\s\S]*\]/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(text);
}

export interface LlmCompleteOptions {
  provider: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

/**
 * Shared single-completion call across the org's configured provider.
 * Owns its own abort timeout. Throws on provider/network error or timeout.
 */
export async function llmComplete(opts: LlmCompleteOptions): Promise<string> {
  const {
    provider, apiKey, model, system, user,
    maxTokens = 500, temperature = 0.1, timeoutMs = 30000,
  } = opts;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    switch (provider) {
      case "openai":
        return await callOpenAI(apiKey, model, system, user, controller.signal, maxTokens, temperature);
      case "anthropic":
        return await callAnthropic(apiKey, model, system, user, controller.signal, maxTokens, temperature);
      case "google":
        return await callGoogle(apiKey, model, system, user, controller.signal, maxTokens, temperature);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAI(
  apiKey: string, model: string, system: string, user: string, signal: AbortSignal,
  maxTokens: number, temperature: number,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature,
      max_tokens: maxTokens,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callAnthropic(
  apiKey: string, model: string, system: string, user: string, signal: AbortSignal,
  maxTokens: number, temperature: number,
): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: maxTokens,
      temperature,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

async function callGoogle(
  apiKey: string, model: string, system: string, user: string, signal: AbortSignal,
  maxTokens: number, temperature: number,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
      signal,
    },
  );
  if (!res.ok) throw new Error(`Google AI API error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

/**
 * Jaccard word-overlap similarity (fallback when no LLM is configured).
 */
function fallbackWordOverlap(
  suggestion: string,
  items: ExistingItem[],
): SimilarityResult[] {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2); // Skip tiny words

  const suggestionWords = new Set(normalize(suggestion));
  if (suggestionWords.size === 0) return [];

  return items
    .map((item) => {
      const itemWords = new Set(normalize(`${item.title} ${item.description || ""}`));
      const intersection = new Set([...suggestionWords].filter((w) => itemWords.has(w)));
      const union = new Set([...suggestionWords, ...itemWords]);
      const score = union.size > 0 ? intersection.size / union.size : 0;
      return { itemId: item.id, title: item.title, score };
    })
    .filter((r) => r.score > 0.3)
    .sort((a, b) => b.score - a.score);
}

// === "Clean up with AI": holistic rewrite of existing post content ===

export interface RewriteConfig {
  provider: string;
  apiKey: string;
  model: string;
  writingContext?: string | null;
  terms: DerivedTerms;
  /** Corrective note appended on a terminology retry. */
  corrective?: string;
}

/**
 * Ask the model to clean up the whole post. It receives the post as an ordered list
 * of plain-text blocks (with opaque ⟦…⟧ tokens standing in for links, media, formatted
 * phrases and code/table blocks) and returns a freshly structured blocks array. It may
 * rewrite, merge, split, reorder and re-type blocks freely, but every token must survive
 * exactly once. Throws on provider error or an unusable response; token integrity itself
 * is enforced downstream by `reassembleBlocks`.
 */
export async function rewriteDocument(blocks: Block[], cfg: RewriteConfig): Promise<OutBlock[]> {
  const system = buildCleanupSystemPrompt(cfg);

  const response = await llmComplete({
    provider: cfg.provider,
    apiKey: cfg.apiKey,
    model: cfg.model,
    system,
    user: JSON.stringify({ blocks }),
    maxTokens: 8192,
    temperature: 0.3,
    timeoutMs: 90000,
  });

  return parseBlocksResponse(response);
}

function buildCleanupSystemPrompt(cfg: RewriteConfig): string {
  const parts: string[] = [
    "You are an expert product-changelog editor. You receive a JSON object {\"blocks\":[...]} representing one changelog post as an ordered list of content blocks. Clean up the whole post so it reads clearly and professionally: fix grammar, tighten wording, and improve flow. You MAY merge, split, reorder, and re-type blocks (for example, turn a run-on paragraph into a bulleted list) to improve clarity. Keep the SAME LANGUAGE as the input — do not translate.",
    "",
    "Block types you may use in your output:",
    '- {"type":"p","text":"..."} — a paragraph',
    '- {"type":"h","level":2,"text":"..."} — a heading (level 1–3)',
    '- {"type":"quote","text":"..."} — a blockquote',
    '- {"type":"ul","items":["...","..."]} — a bulleted list',
    '- {"type":"ol","items":["...","..."]} — a numbered list',
    '- {"type":"raw","token":"⟦B0⟧"} — an opaque block (code block or table); reproduce it unchanged',
    "",
    "Every `text` and list `item` is PLAIN TEXT — no HTML, no markdown, no angle brackets.",
    "",
    "Tokens like ⟦L0⟧ (a link), ⟦M0⟧ (an image or video), ⟦F0⟧ (a formatted phrase) and ⟦B0⟧ (a code block or table) are placeholders for content you cannot see and must not change. Keep EVERY token from the input somewhere in your output, each EXACTLY ONCE — never delete, add, edit, split, or duplicate a token, and never invent a new one. Place each media/link token where it best fits the surrounding text.",
    "",
    'Return ONLY a JSON object {"blocks":[...]} — no explanation, no code fences.',
  ];

  const { properNouns, domainTerms } = cfg.terms;
  if (domainTerms.length > 0 || properNouns.length > 0) {
    parts.push("", "This organization uses established terminology. Preserve it exactly and never substitute synonyms:");
    if (domainTerms.length > 0) {
      parts.push(`- Domain terms (use the same word, e.g. do not rename "customer" to "client" or "user"): ${domainTerms.join(", ")}`);
    }
    if (properNouns.length > 0) {
      parts.push(`- Product names / proper nouns (keep verbatim, exact casing): ${properNouns.join(", ")}`);
    }
  }

  if (cfg.writingContext && cfg.writingContext.trim()) {
    parts.push("", `Brand & audience context:\n${cfg.writingContext.trim()}`);
  }

  if (cfg.corrective && cfg.corrective.trim()) {
    parts.push("", `IMPORTANT — a previous attempt dropped required terminology. ${cfg.corrective.trim()}`);
  }

  return parts.join("\n");
}

function parseBlocksResponse(text: string): OutBlock[] {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Model response was not JSON");
    obj = JSON.parse(match[0]);
  }
  const blocks = (obj as { blocks?: unknown })?.blocks;
  if (!Array.isArray(blocks)) throw new Error("Model response missing `blocks` array");
  // Shape is validated strictly in reassembleBlocks; here we only ensure it's a list of objects.
  return blocks.filter((b): b is OutBlock => !!b && typeof b === "object") as OutBlock[];
}
