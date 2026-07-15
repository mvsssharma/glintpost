import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { evaluateCondition } from "@/lib/attributes";
import type { AttributeType, AttributeOp, RuleValue } from "@/types/targeting";

// The widget scripts no longer hand-port the matcher: the built bundles under
// public/ (the *-widget.js embeds plus the standalone glintpost-targeting.js
// helper) are bundled from widgets/ and inline lib/attributes.ts (single source of truth,
// see scripts/build-widgets.mjs). This test extracts evaluateCondition from the
// committed bundles and asserts it still agrees with lib/attributes.ts across a
// fixture matrix — so a stale bundle (matcher changed but `npm run build:widgets`
// not re-run before commit) fails CI instead of shipping mismatched targeting.

const WIDGETS = [
  "announcement-widget.js",
  "changelog-widget.js",
  "glintpost-targeting.js",
] as const;

/** Extract a top-level `function name(...) { ... }` source via brace balancing. */
function extractFunction(source: string, name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start === -1) throw new Error(`function ${name} not found`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = bodyStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced braces extracting ${name}`);
}

type EvalFn = (
  type: AttributeType,
  op: AttributeOp,
  ruleValue: RuleValue | undefined,
  raw: unknown,
) => boolean;

function loadWidgetEvaluator(file: string): EvalFn {
  const source = readFileSync(join(process.cwd(), "public", file), "utf8");
  const fnSource = extractFunction(source, "evaluateCondition");
  // The port depends only on a local DAY_MS constant.
  return new Function(`"use strict";\nvar DAY_MS = 86400000;\n${fnSource}\nreturn evaluateCondition;`)() as EvalFn;
}

// [type, op, ruleValue, raw] — covers every op incl. coercion + missing-value edges.
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
const tenDaysAgo = new Date(Date.now() - 10 * 86400000).toISOString();
const cases: [AttributeType, AttributeOp, RuleValue | undefined, unknown][] = [
  // string / enum
  ["string", "equals", "pro", "pro"],
  ["string", "equals", "pro", "free"],
  ["string", "not_equals", "pro", "free"],
  ["string", "not_equals", "pro", undefined],
  ["string", "contains", "ro", "pro"],
  ["string", "contains", "X", undefined],
  ["string", "in", ["a", "pro"], "pro"],
  ["string", "in", ["a", "b"], "pro"],
  ["enum", "is", "enterprise", "enterprise"],
  ["enum", "is_not", "enterprise", "pro"],
  ["enum", "in", ["pro", "enterprise"], "pro"],
  // number (incl. string coercion + missing)
  ["number", "eq", 10, 10],
  ["number", "eq", 10, "10"],
  ["number", "ne", 10, 10],
  ["number", "ne", 10, undefined],
  ["number", "gt", 10, 12],
  ["number", "gt", 10, "12"],
  ["number", "gt", 10, 10], // boundary: distinguishes gt from gte
  ["number", "gt", 10, undefined],
  ["number", "lt", 10, 5],
  ["number", "lt", 10, 10], // boundary: distinguishes lt from lte
  ["number", "gte", 10, 10],
  ["number", "gte", 10, 9],
  ["number", "lte", 10, 10],
  ["number", "lte", 10, 11],
  ["number", "between", [5, 15], 12],
  ["number", "between", [5, 15], 20],
  ["number", "between", 5 as unknown as RuleValue, 12],
  // boolean (all truthy encodings)
  ["boolean", "is_true", undefined, true],
  ["boolean", "is_true", undefined, "true"],
  ["boolean", "is_true", undefined, 1],
  ["boolean", "is_true", undefined, "1"],
  ["boolean", "is_true", undefined, false],
  ["boolean", "is_false", undefined, false],
  ["boolean", "is_false", undefined, undefined],
  // date (absolute + relative)
  ["date", "before", "2020-01-01", "2019-01-01"],
  ["date", "after", "2020-01-01", "2021-01-01"],
  ["date", "before", "2020-01-01", "not-a-date"],
  ["date", "within_last_days", 7, twoDaysAgo],
  ["date", "within_last_days", 7, tenDaysAgo],
  ["date", "more_than_days_ago", 7, tenDaysAgo],
  ["date", "more_than_days_ago", 7, twoDaysAgo],
  // unknown op falls through to false everywhere
  ["string", "bogus" as AttributeOp, "x", "x"],
];

describe.each(WIDGETS)("%s evaluateCondition matches lib/attributes.ts", (file) => {
  const widgetEval = loadWidgetEvaluator(file);
  it.each(cases)("(%s %s %o vs %o)", (type, op, ruleValue, raw) => {
    expect(widgetEval(type, op, ruleValue, raw)).toBe(
      evaluateCondition(type, op, ruleValue, raw),
    );
  });
});
