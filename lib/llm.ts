import { decrypt } from "./crypto";
import type { OrgSettings } from "@prisma/client";

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
    console.error("LLM similarity check failed, using fallback:", error);
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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await callLLM(provider, apiKey, model, systemPrompt, userPrompt, controller.signal);
    const parsed = extractJSON(response);
    const scores: { itemId: string; score: number }[] = Array.isArray(parsed) ? parsed : [];

    return scores
      .filter((s) => typeof s.itemId === "string" && typeof s.score === "number" && s.score > 0.3)
      .map((s) => {
        const item = items.find((i) => i.id === s.itemId);
        return { itemId: s.itemId, title: item?.title ?? "", score: s.score };
      })
      .sort((a, b) => b.score - a.score);
  } finally {
    clearTimeout(timeout);
  }
}

function extractJSON(text: string): unknown {
  // Try to extract JSON array from the response (may have markdown fences)
  const match = text.match(/\[[\s\S]*\]/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(text);
}

async function callLLM(
  provider: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  signal: AbortSignal,
): Promise<string> {
  switch (provider) {
    case "openai":
      return callOpenAI(apiKey, model, systemPrompt, userPrompt, signal);
    case "anthropic":
      return callAnthropic(apiKey, model, systemPrompt, userPrompt, signal);
    case "google":
      return callGoogle(apiKey, model, systemPrompt, userPrompt, signal);
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function callOpenAI(
  apiKey: string, model: string, system: string, user: string, signal: AbortSignal,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      temperature: 0.1,
      max_tokens: 500,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "[]";
}

async function callAnthropic(
  apiKey: string, model: string, system: string, user: string, signal: AbortSignal,
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
      max_tokens: 500,
      temperature: 0.1,
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text ?? "[]";
}

async function callGoogle(
  apiKey: string, model: string, system: string, user: string, signal: AbortSignal,
): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: user }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 500 },
      }),
      signal,
    },
  );
  if (!res.ok) throw new Error(`Google AI API error: ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
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
