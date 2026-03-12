export type {
  Organization,
  OrgSettings,
  Post,
  PostTranslation,
  ChangelogEvent,
  User,
  PostStatus,
  ChangelogEventType,
  BillingStatus,
  RoadmapItem,
  RoadmapSuggestion,
  RoadmapVote,
  RoadmapView,
  RoadmapItemStatus,
  SuggestionStatus,
  VoteType,
} from "@prisma/client";

export type { TargetingRule, TargetingRuleSet, TargetingOperator, TargetingRuleOp } from "./targeting";
export type { GlintPostConfig, WidgetMessage, WidgetMessageType } from "./widget";
export type { PublicRoadmapItem, SuggestionResponse } from "./roadmap";

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
