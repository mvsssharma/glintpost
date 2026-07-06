import { describe, it, expect, vi } from "vitest";

// The LLM refine path calls llmComplete; mock it to return a curated glossary that
// deliberately DROPS the org's existing terms, to prove they're preserved anyway.
vi.mock("./llm", () => ({
  llmComplete: vi.fn(async () => JSON.stringify({ properNouns: ["Beam"], domainTerms: ["partner"] })),
}));

import { deriveTerms, checkTerms, getEffectiveTerms, mergeTerms, refineNomenclature } from "./glossary";

describe("deriveTerms", () => {
  it("finds proper nouns (recurring/CamelCase) and domain terms (shared across posts)", () => {
    const sourceText =
      "Acme now lets every customer invite a partner. Acme customers love the partner flow. GlintPost integrates too.";
    const recentPosts = [
      "We shipped a customer dashboard and partner portal in Acme.",
      "The customer can now export data; partner access improved.",
      "Unrelated note about performance.",
    ];
    const { properNouns, domainTerms } = deriveTerms({ sourceText, recentPosts });

    expect(properNouns).toContain("Acme");
    expect(properNouns).toContain("GlintPost"); // CamelCase always kept
    expect(domainTerms).toContain("customer");
    expect(domainTerms).toContain("partner");
    // generic stopword-ish verbs never become terms
    expect(domainTerms).not.toContain("shipped");
  });

  it("returns empty lists for empty input", () => {
    expect(deriveTerms({ sourceText: "", recentPosts: [] })).toEqual({
      properNouns: [],
      domainTerms: [],
    });
  });
});

describe("checkTerms", () => {
  const terms = { properNouns: ["Acme"], domainTerms: ["customer"] };

  it("warns when a repeated domain term vanishes from the output", () => {
    const source = "The customer saw it. Every customer benefits.";
    const output = "The client saw it. Every client benefits.";
    const warnings = checkTerms(source, output, terms);
    expect(warnings.some((w) => w.includes("customer"))).toBe(true);
  });

  it("no warning when the term survives", () => {
    const source = "The customer saw it. Every customer benefits.";
    const output = "The customer noticed it. Each customer benefits.";
    expect(checkTerms(source, output, terms)).toHaveLength(0);
  });

  it("warns when a proper noun is dropped", () => {
    const warnings = checkTerms("Acme shipped it.", "The product shipped it.", terms);
    expect(warnings.some((w) => w.includes("Acme"))).toBe(true);
  });
});

describe("mergeTerms / getEffectiveTerms", () => {
  it("unions persisted glossary with fresh derivation, dedup case-insensitively", () => {
    const persisted = { properNouns: ["Acme"], domainTerms: ["customer"] };
    const merged = mergeTerms(persisted, { properNouns: ["Acme", "Beam"], domainTerms: ["Customer", "partner"] });
    expect(merged.properNouns).toEqual(["Acme", "Beam"]);
    expect(merged.domainTerms).toEqual(["customer", "partner"]);
  });

  it("getEffectiveTerms falls back to derivation when nothing persisted", () => {
    const eff = getEffectiveTerms(null, "Acme helps the customer.", [
      "The customer uses Acme.",
      "Another customer joined Acme.",
    ]);
    expect(eff.properNouns).toContain("Acme");
  });
});

describe("refineNomenclature", () => {
  it("keeps existing persisted terms even when the LLM drops them", async () => {
    const res = await refineNomenclature({
      existing: { properNouns: ["Acme"], domainTerms: ["customer"] },
      // New content/examples that do NOT reintroduce Acme/customer, so the only way
      // they can survive is the existing-terms preservation.
      newText: "Beam adds partner tools.",
      recentPosts: ["Beam partner update.", "More partner things in Beam."],
      settings: { aiProvider: "openai", aiApiKey: "enc", aiModel: "gpt" },
      decryptKey: async () => "key",
    });
    expect(res.properNouns).toContain("Acme"); // preserved from existing
    expect(res.domainTerms).toContain("customer"); // preserved from existing
    expect(res.properNouns).toContain("Beam"); // from the LLM / derivation
    expect(res.domainTerms).toContain("partner");
  });
});
