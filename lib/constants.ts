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

export const AI_PROVIDERS = [
  { id: "openai", label: "OpenAI", defaultModel: "gpt-5.4-mini" },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-sonnet-5",
  },
  { id: "google", label: "Google Gemini", defaultModel: "gemini-3.5-flash" },
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

export const FEEDBACK_QUESTION_TYPES = [
  { value: "SELECT", label: "Select (options)" },
  { value: "NPS", label: "NPS Scale (0–10)" },
  { value: "TEXT", label: "Free Text" },
] as const;

export const MAX_FEEDBACK_QUESTIONS = 3;

export const AI_MODELS: Record<string, { id: string; label: string }[]> = {
  openai: [
    { id: "gpt-5.5", label: "GPT-5.5" },
    { id: "gpt-5.4-mini", label: "GPT-5.4 Mini" },
  ],
  anthropic: [
    { id: "claude-opus-4-8", label: "Claude Opus 4.8" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
  ],
  google: [
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
    { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
  ],
};
