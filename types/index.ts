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
  FeedbackForm,
  FeedbackResponse,
  Announcement,
  AnnouncementEvent,
  AnnouncementDisplayType,
  AnnouncementEventType,
} from "@prisma/client";

export type {
  Attribute,
  AttributeType,
  AttributeOp,
  AudienceRule,
  AudienceRuleSet,
  ResolvedTargeting,
} from "./targeting";
export type { GlintPostConfig, WidgetMessage, WidgetMessageType } from "./widget";
export type { PublicRoadmapItem, SuggestionResponse } from "./roadmap";
export type { FeedbackQuestion } from "./feedback";

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
    enabledWidgets: string[];
    aiProvider: string | null;
    aiModel: string | null;
  } | null;
}
