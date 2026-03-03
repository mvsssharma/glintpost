export type {
  Organization,
  OrgSettings,
  Post,
  PostTranslation,
  EngagementEvent,
  User,
  PostStatus,
  EngagementType,
  BillingStatus,
} from "@prisma/client";

export type { TargetingRule, TargetingRuleSet, TargetingOperator, TargetingRuleOp } from "./targeting";
export type { GlintpostConfig, WidgetMessage, WidgetMessageType } from "./widget";

/** Organization with settings included */
export interface OrgContext {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  apiKey: string;
  billingStatus: string;
  onboardingComplete: boolean;
  settings: {
    primaryColor: string;
    supportedLocales: string[];
    defaultLocale: string;
    storageUsedBytes: bigint;
    storageCapBytes: bigint;
    aiProvider: string | null;
    aiModel: string | null;
  } | null;
}
