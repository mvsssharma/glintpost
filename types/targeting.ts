export type TargetingOperator = "AND" | "OR";

export type TargetingParam =
  | "plan"
  | "role"
  | "region"
  | "platform"
  | "version"
  | "company"
  | "locale";

export type TargetingRuleOp = "equals" | "not_equals" | "contains" | "in";

export interface TargetingRule {
  param: TargetingParam;
  op: TargetingRuleOp;
  value: string | string[];
}

export interface TargetingRuleSet {
  operator: TargetingOperator;
  rules: TargetingRule[];
}
