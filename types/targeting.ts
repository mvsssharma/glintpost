export type TargetingOperator = "AND" | "OR";

export type TargetingRuleOp =
  | "eq"
  | "neq"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "contains"
  | "in"
  | "containsAny"
  | "containsAll";

export interface TargetingRule {
  param: string;
  op: TargetingRuleOp;
  value: string | string[];
}

export interface TargetingRuleSet {
  operator: TargetingOperator;
  rules: TargetingRule[];
}
