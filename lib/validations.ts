import { z } from "zod";

// === Auth ===

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters").max(128),
    confirmPassword: z.string().min(1, "Confirmation is required"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "New password and confirmation do not match",
    path: ["confirmPassword"],
  });

export const requestPasswordResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Invalid reset link"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

// === Organization ===

export const createOrgSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(100),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  locales: z.string().optional(),
});

const AI_PROVIDERS = ["openai", "anthropic", "google"] as const;

const WIDGET_KEYS = ["changelog", "roadmap", "feedback", "announcements"] as const;

export const updateOrgSettingsSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters").max(100),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  widgetTheme: z.enum(["light", "dark"]).optional(),
  locales: z.string().optional(),
  allowedDomain: z.string().max(255).optional(),
  enabledWidgets: z.string().optional(),
  aiProvider: z.enum(AI_PROVIDERS).nullable().optional(),
  aiModel: z.string().max(100).nullable().optional(),
  aiApiKey: z.string().max(500).optional(),
});

// === Posts ===

const TARGETING_PARAMS = ["plan", "role", "region", "platform", "version", "company", "locale"] as const;
const TARGETING_OPS = ["equals", "not_equals", "contains", "in"] as const;

const targetingRuleSchema = z.object({
  param: z.enum(TARGETING_PARAMS),
  op: z.enum(TARGETING_OPS),
  value: z.union([z.string().min(1).max(200), z.array(z.string().min(1).max(200)).min(1).max(50)]),
});

export const targetingRulesSchema = z.object({
  operator: z.enum(["AND", "OR"]),
  rules: z.array(targetingRuleSchema).min(1).max(20),
});

export const createPostSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required").max(100_000),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional().default("DRAFT"),
  targetingRules: targetingRulesSchema.nullable().optional(),
});

export const updatePostSchema = z.object({
  title: z.string().min(1, "Title is required").max(500).optional(),
  content: z.string().min(1, "Content is required").max(100_000).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  targetingRules: targetingRulesSchema.nullable().optional(),
});

// === Engagement ===

export const CHANGELOG_EVENT_TYPES = ["VIEW", "LIKE", "DISLIKE"] as const;

export const changelogEventSchema = z.object({
  type: z.enum(CHANGELOG_EVENT_TYPES, { message: "Invalid event type" }),
  postId: z.string().max(50).nullable().optional(),
  visitorId: z.string().max(200).nullable().optional(),
  datalayer: z
    .object({
      plan: z.string().max(100).optional(),
      role: z.string().max(100).optional(),
      region: z.string().max(100).optional(),
      platform: z.string().max(100).optional(),
      version: z.string().max(100).optional(),
      company: z.string().max(200).optional(),
      locale: z.string().max(20).optional(),
    })
    .nullable()
    .optional(),
});

// === Roadmap ===

const ROADMAP_STATUSES = [
  "UNDER_REVIEW", "PLANNED", "IN_PROGRESS", "COMPLETED", "ARCHIVED",
] as const;

export const createRoadmapItemSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(500),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(ROADMAP_STATUSES).optional().default("UNDER_REVIEW"),
});

export const voteSchema = z.object({
  itemId: z.string().min(1, "Item ID is required"),
  visitorId: z.string().min(1, "Visitor ID is required").max(200),
  voteType: z.enum(["UP", "DOWN"], { message: "Invalid vote type" }),
});

export const suggestSchema = z.object({
  text: z.string().min(5, "Suggestion must be at least 5 characters").max(2000),
  visitorId: z.string().max(200).nullable().optional(),
});

// === Feedback ===

const FEEDBACK_QUESTION_TYPES = ["SELECT", "NPS", "TEXT"] as const;

export const feedbackQuestionSchema = z.object({
  id: z.string().min(1).max(50),
  text: z.string().min(1, "Question text is required").max(500),
  type: z.enum(FEEDBACK_QUESTION_TYPES),
  options: z.array(z.string().min(1).max(200)).max(10).optional(),
  required: z.boolean(),
});

export const feedbackFormSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  enabled: z.boolean().optional(),
  questions: z.array(feedbackQuestionSchema).min(1, "At least one question is required").max(3),
});

export const feedbackSubmitSchema = z.object({
  formId: z.string().min(1, "Form ID is required"),
  visitorId: z.string().min(1, "Visitor ID is required").max(200),
  answers: z.array(
    z.object({
      questionId: z.string().min(1),
      value: z.union([z.string().max(5000), z.number()]),
    })
  ).min(1).max(3),
  datalayer: z
    .object({
      plan: z.string().max(100).optional(),
      role: z.string().max(100).optional(),
      region: z.string().max(100).optional(),
      platform: z.string().max(100).optional(),
      version: z.string().max(100).optional(),
      company: z.string().max(200).optional(),
      locale: z.string().max(20).optional(),
    })
    .nullable()
    .optional(),
});

// === Announcements ===

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required").max(100_000),
  imageUrl: z.string().url().max(2000).nullable().optional(),
  videoUrl: z.string().url().max(2000).nullable().optional(),
  ctaText: z.string().max(100).nullable().optional(),
  ctaUrl: z.string().max(2000).nullable().optional(),
  displayType: z.enum(["OVERLAY", "TOP_BANNER"]).default("OVERLAY"),
  priority: z.number().int().min(0).max(1000).default(0),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  targetingRules: targetingRulesSchema.nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
}).refine((d) => d.endDate > d.startDate, {
  message: "End date must be after start date",
  path: ["endDate"],
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").max(500).optional(),
  content: z.string().min(1, "Content is required").max(100_000).optional(),
  imageUrl: z.string().url().max(2000).nullable().optional(),
  videoUrl: z.string().url().max(2000).nullable().optional(),
  ctaText: z.string().max(100).nullable().optional(),
  ctaUrl: z.string().max(2000).nullable().optional(),
  displayType: z.enum(["OVERLAY", "TOP_BANNER"]).optional(),
  priority: z.number().int().min(0).max(1000).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  targetingRules: targetingRulesSchema.nullable().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const announcementEventSchema = z.object({
  type: z.enum(["VIEW", "CLICK"], { message: "Invalid event type" }),
  announcementId: z.string().min(1).max(50),
  visitorId: z.string().max(200).nullable().optional(),
  datalayer: z
    .object({
      plan: z.string().max(100).optional(),
      role: z.string().max(100).optional(),
      region: z.string().max(100).optional(),
      platform: z.string().max(100).optional(),
      version: z.string().max(100).optional(),
      company: z.string().max(200).optional(),
      locale: z.string().max(20).optional(),
    })
    .nullable()
    .optional(),
});

// === Helpers ===

/**
 * Extract form data fields into a plain object suitable for Zod parsing.
 */
export function formDataToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string") obj[key] = value;
  });
  return obj;
}
