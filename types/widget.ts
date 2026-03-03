export interface GlintpostConfig {
  visitorId?: string;
  plan?: string;
  role?: string;
  region?: string;
  platform?: string;
  version?: string;
  company?: string;
  locale?: string;
  signupDate?: string;
  tags?: string[];
}

export type WidgetMessageType =
  | "GLINTPOST_READY"
  | "GLINTPOST_CLOSE"
  | "GLINTPOST_RESIZE"
  | "GLINTPOST_NAVIGATE";

export interface WidgetMessage {
  type: WidgetMessageType;
  payload?: Record<string, unknown>;
}
