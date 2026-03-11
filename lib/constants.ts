export const COLOR_PRESETS = [
  { name: "Emerald", value: "#10b981" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Cerulean", value: "#0ea5e9" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Violet", value: "#8b5cf6" },
] as const;

export const DEFAULT_PRIMARY_COLOR = "#10b981";

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "mr", label: "Marathi" },
  { code: "bn", label: "Bengali" },
  { code: "gu", label: "Gujarati" },
] as const;

export type TargetingParamType = "string" | "number" | "date" | "array";

export interface TargetingParamDef {
  name: string;
  label: string;
  type: TargetingParamType;
  operators: readonly string[];
}

export const TARGETING_PARAMS: TargetingParamDef[] = [
  {
    name: "plan",
    label: "Plan",
    type: "string",
    operators: ["eq", "neq", "contains", "in"],
  },
  {
    name: "role",
    label: "Role",
    type: "string",
    operators: ["eq", "neq", "contains", "in"],
  },
  {
    name: "region",
    label: "Region",
    type: "string",
    operators: ["eq", "neq", "contains", "in"],
  },
  {
    name: "platform",
    label: "Platform",
    type: "string",
    operators: ["eq", "neq", "contains", "in"],
  },
  {
    name: "version",
    label: "Version",
    type: "string",
    operators: ["eq", "neq", "gt", "lt", "gte", "lte"],
  },
  {
    name: "company",
    label: "Company",
    type: "string",
    operators: ["eq", "neq", "contains", "in"],
  },
  {
    name: "locale",
    label: "Locale",
    type: "string",
    operators: ["eq", "neq", "in"],
  },
  {
    name: "visitorId",
    label: "Visitor ID",
    type: "string",
    operators: ["eq", "neq", "contains", "in"],
  },
  {
    name: "signupDate",
    label: "Signup Date",
    type: "date",
    operators: ["eq", "gt", "lt", "gte", "lte"],
  },
  {
    name: "tags",
    label: "Tags",
    type: "array",
    operators: ["contains", "containsAny", "containsAll"],
  },
] as const;

export const AI_PROVIDERS = [
  { id: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-4-20250514",
  },
  { id: "google", label: "Google Gemini", defaultModel: "gemini-2.0-flash" },
] as const;

export const ROADMAP_STATUSES = [
  { value: "UNDER_REVIEW", label: "Under Review", color: "#f59e0b" },
  { value: "PLANNED", label: "Planned", color: "#6366f1" },
  { value: "IN_PROGRESS", label: "In Progress", color: "#0ea5e9" },
  { value: "COMPLETED", label: "Completed", color: "#10b981" },
  { value: "ARCHIVED", label: "Archived", color: "#6b7280" },
] as const;

export const SUGGESTION_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "MERGED", label: "Merged" },
  { value: "CREATED", label: "Created as Item" },
  { value: "DISMISSED", label: "Dismissed" },
] as const;

export const SIMILARITY_THRESHOLD_DUPLICATE = 0.8;
export const SIMILARITY_THRESHOLD_RELATED = 0.6;

export const AI_MODELS: Record<string, { id: string; label: string }[]> = {
  openai: [
    { id: "gpt-4o", label: "GPT-4o" },
    { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  ],
  anthropic: [
    { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  ],
  google: [
    { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { id: "gemini-2.5-pro-preview-05-06", label: "Gemini 2.5 Pro" },
  ],
};
