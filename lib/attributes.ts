// Shared targeting logic: operator metadata (for the builder + validation) and
// the typed condition evaluator. Single source of truth — the changelog page
// imports it directly, and the widgets bundle it in via scripts/build-widgets.mjs
// (see widgets/), so there are no hand-maintained copies to keep in sync.

import type {
  AttributeType,
  AttributeOp,
  RuleValue,
  ResolvedTargeting,
  ResolvedAudience,
} from "@/types/targeting";

export const ATTRIBUTE_TYPES: AttributeType[] = [
  "string",
  "number",
  "boolean",
  "enum",
  "date",
];

export type ValueKind =
  | "none"
  | "text"
  | "number"
  | "textList"
  | "numberRange"
  | "days"
  | "date";

export interface OpDef {
  value: AttributeOp;
  label: string;
  valueKind: ValueKind;
}

export const OPERATORS_BY_TYPE: Record<AttributeType, OpDef[]> = {
  string: [
    { value: "equals", label: "equals", valueKind: "text" },
    { value: "not_equals", label: "not equals", valueKind: "text" },
    { value: "contains", label: "contains", valueKind: "text" },
    { value: "in", label: "is one of", valueKind: "textList" },
  ],
  enum: [
    { value: "is", label: "is", valueKind: "text" },
    { value: "is_not", label: "is not", valueKind: "text" },
    { value: "in", label: "is one of", valueKind: "textList" },
  ],
  number: [
    { value: "eq", label: "=", valueKind: "number" },
    { value: "ne", label: "≠", valueKind: "number" },
    { value: "gt", label: ">", valueKind: "number" },
    { value: "lt", label: "<", valueKind: "number" },
    { value: "gte", label: "≥", valueKind: "number" },
    { value: "lte", label: "≤", valueKind: "number" },
    { value: "between", label: "between", valueKind: "numberRange" },
  ],
  boolean: [
    { value: "is_true", label: "is true", valueKind: "none" },
    { value: "is_false", label: "is false", valueKind: "none" },
  ],
  date: [
    { value: "before", label: "before", valueKind: "date" },
    { value: "after", label: "after", valueKind: "date" },
    { value: "within_last_days", label: "within last N days", valueKind: "days" },
    { value: "more_than_days_ago", label: "more than N days ago", valueKind: "days" },
  ],
};

export function opsForType(type: AttributeType): OpDef[] {
  return OPERATORS_BY_TYPE[type] ?? [];
}

export function opDef(type: AttributeType, op: AttributeOp): OpDef | undefined {
  return opsForType(type).find((o) => o.value === op);
}

/**
 * Validate a single audience rule against its referenced attribute.
 * Returns an error message, or null if valid. Used server-side (routes)
 * where the attribute registry is available.
 */
export function ruleError(
  attr: { type: AttributeType; values: string[] } | undefined,
  op: AttributeOp,
  value: RuleValue | undefined,
): string | null {
  if (!attr) return "Unknown attribute";
  const def = opDef(attr.type, op);
  if (!def) return `Operator "${op}" is not valid for ${attr.type} attributes`;

  switch (def.valueKind) {
    case "none":
      return null;
    case "text":
      if (typeof value !== "string" || value.length === 0) return "Value is required";
      if (attr.type === "enum" && !attr.values.includes(value)) {
        return "Value is not in the allowed list";
      }
      return null;
    case "textList":
      if (!Array.isArray(value) || value.length === 0) return "Select at least one value";
      if (
        attr.type === "enum" &&
        value.some((v) => typeof v !== "string" || !attr.values.includes(v))
      ) {
        return "One or more values are not in the allowed list";
      }
      return null;
    case "number":
      if (typeof value !== "number" || Number.isNaN(value)) return "A number is required";
      return null;
    case "days":
      if (typeof value !== "number" || value < 0) return "Enter a number of days";
      return null;
    case "numberRange":
      if (
        !Array.isArray(value) ||
        value.length !== 2 ||
        typeof value[0] !== "number" ||
        typeof value[1] !== "number"
      ) {
        return "Enter a valid number range";
      }
      return null;
    case "date":
      if (typeof value !== "string" || Number.isNaN(new Date(value).getTime())) {
        return "A valid date is required";
      }
      return null;
    default:
      return null;
  }
}

const DAY_MS = 86_400_000;

/**
 * Evaluate one typed condition against a raw datalayer value.
 * Missing values fail positive ops and pass negative ops (not_equals / is_not / ne).
 */
export function evaluateCondition(
  type: AttributeType,
  op: AttributeOp,
  ruleValue: RuleValue | undefined,
  raw: unknown,
): boolean {
  const missing = raw === undefined || raw === null || raw === "";

  switch (type) {
    case "string":
    case "enum": {
      const actual = missing ? "" : String(raw);
      switch (op) {
        case "equals":
        case "is":
          return actual === String(ruleValue);
        case "not_equals":
        case "is_not":
          return actual !== String(ruleValue);
        case "contains":
          return (
            !missing &&
            actual.toLowerCase().includes(String(ruleValue).toLowerCase())
          );
        case "in":
          return (
            Array.isArray(ruleValue) && ruleValue.map(String).includes(actual)
          );
        default:
          return false;
      }
    }

    case "number": {
      const actual = missing ? NaN : Number(raw);
      if (op === "ne") {
        return Number.isNaN(actual) ? true : actual !== Number(ruleValue);
      }
      if (Number.isNaN(actual)) return false;
      if (op === "between") {
        if (!Array.isArray(ruleValue)) return false;
        const [min, max] = ruleValue.map(Number);
        return actual >= min && actual <= max;
      }
      const target = Number(ruleValue);
      switch (op) {
        case "eq":
          return actual === target;
        case "gt":
          return actual > target;
        case "lt":
          return actual < target;
        case "gte":
          return actual >= target;
        case "lte":
          return actual <= target;
        default:
          return false;
      }
    }

    case "boolean": {
      const actual = raw === true || raw === "true" || raw === 1 || raw === "1";
      if (op === "is_true") return actual;
      if (op === "is_false") return !actual;
      return false;
    }

    case "date": {
      const actualMs = missing
        ? NaN
        : new Date(raw as string | number).getTime();
      if (Number.isNaN(actualMs)) return false;
      const now = Date.now();
      switch (op) {
        case "before":
          return actualMs < new Date(ruleValue as string).getTime();
        case "after":
          return actualMs > new Date(ruleValue as string).getTime();
        case "within_last_days":
          return actualMs >= now - Number(ruleValue) * DAY_MS && actualMs <= now;
        case "more_than_days_ago":
          return actualMs < now - Number(ruleValue) * DAY_MS;
        default:
          return false;
      }
    }

    default:
      return false;
  }
}

function evaluateAudience(
  audience: ResolvedAudience,
  datalayer: Record<string, unknown>,
): boolean {
  if (audience.rules.length === 0) return true;
  const results = audience.rules.map((r) =>
    evaluateCondition(r.type, r.op, r.value, datalayer[r.attributeKey]),
  );
  return audience.operator === "AND"
    ? results.every(Boolean)
    : results.some(Boolean);
}

/**
 * Decide whether an item with the given resolved targeting is visible to a
 * visitor described by `datalayer`. `null` targeting = shown to everyone;
 * targeted-but-no-datalayer = hidden (matches prior behavior).
 */
export function matchesTargeting(
  targeting: ResolvedTargeting | null,
  datalayer: Record<string, unknown> | null,
): boolean {
  if (!targeting || targeting.audiences.length === 0) return true;
  if (!datalayer) return false;
  return targeting.match === "AND"
    ? targeting.audiences.every((a) => evaluateAudience(a, datalayer))
    : targeting.audiences.some((a) => evaluateAudience(a, datalayer));
}

type AttrLite = { type: AttributeType; values: string[] };

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function synthValue(
  attr: AttrLite,
  op: AttributeOp,
  value: RuleValue | undefined,
): string | number | boolean | undefined {
  switch (op) {
    case "equals":
    case "is":
    case "contains":
      return value as string; // for contains, actual === value satisfies "includes"
    case "in":
      return Array.isArray(value) ? (value[0] as string) : (value as string);
    case "not_equals":
    case "is_not":
      if (attr.type === "enum") {
        return attr.values.find((v) => v !== value) ?? `${String(value)}_x`;
      }
      return `${String(value)}_x`;
    case "eq":
    case "gte":
    case "lte":
      return Number(value);
    case "ne":
    case "gt":
      return Number(value) + 1;
    case "lt":
      return Number(value) - 1;
    case "between":
      return Array.isArray(value) ? Number(value[0]) : 0;
    case "is_true":
      return true;
    case "is_false":
      return false;
    case "before":
      return new Date(new Date(value as string).getTime() - DAY_MS).toISOString();
    case "after":
      return new Date(new Date(value as string).getTime() + DAY_MS).toISOString();
    case "within_last_days":
      return isoDaysAgo(Number(value) >= 1 ? 1 : 0);
    case "more_than_days_ago":
      return isoDaysAgo(Number(value) + 1);
    default:
      return value as string;
  }
}

/**
 * Build a representative datalayer that satisfies an audience's rules, for the
 * dashboard "Preview as audience" tool. Best-effort: OR sets only the first
 * rule; AND sets all (later rules on the same key win). Contradictory rules
 * can't always be satisfied — the caller shows a soft note.
 */
export function synthesizeDatalayer(
  ruleSet: { operator: "AND" | "OR"; rules: { attributeKey: string; op: AttributeOp; value?: RuleValue }[] },
  attributesByKey: Map<string, AttrLite>,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  const rules = ruleSet.operator === "OR" ? ruleSet.rules.slice(0, 1) : ruleSet.rules;
  for (const r of rules) {
    const attr = attributesByKey.get(r.attributeKey);
    if (!attr) continue;
    const v = synthValue(attr, r.op, r.value);
    if (v !== undefined) out[r.attributeKey] = v;
  }
  return out;
}
