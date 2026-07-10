// Targeting types shared by the dashboard builder, API validation, the
// serve-time resolver, and the client-side widget matchers.

export type AttributeType = "string" | "number" | "boolean" | "enum" | "date";

export type AttributeOp =
  // string
  | "equals"
  | "not_equals"
  | "contains"
  | "in"
  // enum
  | "is"
  | "is_not"
  // number
  | "eq"
  | "ne"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "between"
  // boolean
  | "is_true"
  | "is_false"
  // date
  | "before"
  | "after"
  | "within_last_days"
  | "more_than_days_ago";

/** Value shape depends on the attribute type + operator. */
export type RuleValue = string | string[] | number | [number, number];

/** A user-defined targeting variable (org-level datalayer schema). */
export interface Attribute {
  id: string;
  key: string;
  label: string;
  type: AttributeType;
  values: string[];
}

/**
 * A condition stored inside an audience. `attributeKey` references
 * Attribute.key; the type is resolved (never stored on the rule).
 */
export interface AudienceRule {
  attributeKey: string;
  op: AttributeOp;
  value?: RuleValue; // omitted for value-less ops (is_true / is_false)
}

/** Stored audience definition (Audience.rules). Flat AND/OR in v1. */
export interface AudienceRuleSet {
  operator: "AND" | "OR";
  rules: AudienceRule[];
}

/**
 * Resolved rule sent to the widget: the attribute `type` is denormalized in
 * so the client matcher needs no attribute registry.
 */
export interface ResolvedRule {
  attributeKey: string;
  type: AttributeType;
  op: AttributeOp;
  value?: RuleValue;
}

export interface ResolvedAudience {
  operator: "AND" | "OR";
  rules: ResolvedRule[];
}

/** Serve-time targeting payload attached to a post/announcement. */
export interface ResolvedTargeting {
  match: "AND" | "OR"; // "OR" = ANY audience, "AND" = ALL audiences
  audiences: ResolvedAudience[];
}
