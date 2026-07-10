import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  matchesTargeting,
  ruleError,
  synthesizeDatalayer,
} from "@/lib/attributes";
import type { AttributeType, ResolvedTargeting } from "@/types/targeting";

describe("evaluateCondition", () => {
  it("string ops", () => {
    expect(evaluateCondition("string", "equals", "pro", "pro")).toBe(true);
    expect(evaluateCondition("string", "not_equals", "pro", "free")).toBe(true);
    expect(evaluateCondition("string", "contains", "ro", "pro")).toBe(true);
    expect(evaluateCondition("string", "in", ["a", "pro"], "pro")).toBe(true);
    expect(evaluateCondition("string", "in", ["a", "b"], "pro")).toBe(false);
  });

  it("missing values: positive fail, negative pass", () => {
    expect(evaluateCondition("string", "equals", "pro", undefined)).toBe(false);
    expect(evaluateCondition("string", "not_equals", "pro", undefined)).toBe(true);
    expect(evaluateCondition("string", "contains", "x", undefined)).toBe(false);
  });

  it("number ops incl. string coercion and between", () => {
    expect(evaluateCondition("number", "gt", 10, 12)).toBe(true);
    expect(evaluateCondition("number", "gt", 10, "12")).toBe(true); // datalayer sent string
    expect(evaluateCondition("number", "lte", 10, 10)).toBe(true);
    expect(evaluateCondition("number", "between", [5, 15], 12)).toBe(true);
    expect(evaluateCondition("number", "between", [5, 15], 20)).toBe(false);
    expect(evaluateCondition("number", "ne", 10, undefined)).toBe(true);
    expect(evaluateCondition("number", "gt", 10, undefined)).toBe(false);
  });

  it("boolean ops", () => {
    expect(evaluateCondition("boolean", "is_true", undefined, true)).toBe(true);
    expect(evaluateCondition("boolean", "is_true", undefined, "true")).toBe(true);
    expect(evaluateCondition("boolean", "is_false", undefined, false)).toBe(true);
    expect(evaluateCondition("boolean", "is_false", undefined, undefined)).toBe(true);
  });

  it("enum ops", () => {
    expect(evaluateCondition("enum", "is", "enterprise", "enterprise")).toBe(true);
    expect(evaluateCondition("enum", "is_not", "enterprise", "pro")).toBe(true);
    expect(evaluateCondition("enum", "in", ["pro", "enterprise"], "pro")).toBe(true);
  });

  it("date relative ops", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
    expect(evaluateCondition("date", "within_last_days", 7, twoDaysAgo)).toBe(true);
    expect(evaluateCondition("date", "within_last_days", 7, tenDaysAgo)).toBe(false);
    expect(evaluateCondition("date", "more_than_days_ago", 7, tenDaysAgo)).toBe(true);
  });
});

describe("matchesTargeting", () => {
  const targeting = (match: "AND" | "OR"): ResolvedTargeting => ({
    match,
    audiences: [
      { operator: "AND", rules: [{ attributeKey: "plan", type: "enum", op: "is", value: "enterprise" }] },
      { operator: "AND", rules: [{ attributeKey: "seats", type: "number", op: "gt", value: 10 }] },
    ],
  });

  it("null targeting shows to everyone", () => {
    expect(matchesTargeting(null, null)).toBe(true);
    expect(matchesTargeting({ match: "OR", audiences: [] }, { plan: "x" })).toBe(true);
  });

  it("targeted but no datalayer is hidden", () => {
    expect(matchesTargeting(targeting("OR"), null)).toBe(false);
  });

  it("ANY matches if one audience matches", () => {
    expect(matchesTargeting(targeting("OR"), { plan: "enterprise", seats: 2 })).toBe(true);
    expect(matchesTargeting(targeting("OR"), { plan: "free", seats: 2 })).toBe(false);
  });

  it("ALL requires every audience", () => {
    expect(matchesTargeting(targeting("AND"), { plan: "enterprise", seats: 20 })).toBe(true);
    expect(matchesTargeting(targeting("AND"), { plan: "enterprise", seats: 2 })).toBe(false);
  });
});

describe("synthesizeDatalayer round-trips through the matcher", () => {
  const attrs = new Map<string, { type: AttributeType; values: string[] }>([
    ["plan", { type: "enum", values: ["free", "pro", "enterprise"] }],
    ["seats", { type: "number", values: [] }],
    ["role", { type: "string", values: [] }],
    ["active", { type: "boolean", values: [] }],
    ["signup", { type: "date", values: [] }],
  ]);

  const cases = [
    { operator: "AND" as const, rules: [{ attributeKey: "plan", op: "is" as const, value: "enterprise" }, { attributeKey: "seats", op: "gt" as const, value: 10 }] },
    { operator: "AND" as const, rules: [{ attributeKey: "plan", op: "is_not" as const, value: "free" }, { attributeKey: "seats", op: "between" as const, value: [5, 50] as [number, number] }] },
    { operator: "AND" as const, rules: [{ attributeKey: "role", op: "contains" as const, value: "admin" }, { attributeKey: "active", op: "is_true" as const }] },
    { operator: "OR" as const, rules: [{ attributeKey: "signup", op: "within_last_days" as const, value: 30 }, { attributeKey: "plan", op: "is" as const, value: "pro" }] },
    { operator: "AND" as const, rules: [{ attributeKey: "seats", op: "lte" as const, value: 3 }, { attributeKey: "plan", op: "in" as const, value: ["pro", "enterprise"] }] },
  ];

  it("each synthesized persona matches its own audience", () => {
    for (const rules of cases) {
      const dl = synthesizeDatalayer(rules, attrs);
      const targeting: ResolvedTargeting = {
        match: "OR",
        audiences: [
          {
            operator: rules.operator,
            rules: rules.rules.map((r) => ({
              attributeKey: r.attributeKey,
              type: attrs.get(r.attributeKey)!.type,
              op: r.op,
              value: r.value,
            })),
          },
        ],
      };
      expect(matchesTargeting(targeting, dl)).toBe(true);
    }
  });
});

describe("ruleError", () => {
  it("flags unknown attribute and enum value", () => {
    expect(ruleError(undefined, "equals", "x")).toBe("Unknown attribute");
    expect(ruleError({ type: "enum", values: ["a", "b"] }, "is", "c")).toContain("allowed list");
    expect(ruleError({ type: "enum", values: ["a", "b"] }, "is", "a")).toBeNull();
    expect(ruleError({ type: "number", values: [] }, "gt", "x" as unknown as number)).toContain("number");
    expect(ruleError({ type: "boolean", values: [] }, "is_true", undefined)).toBeNull();
  });
});
