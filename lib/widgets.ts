export type EmbedMode = "slideover" | "tab" | "inline" | "hosted" | "advanced" | "headless";

export interface EmbedOption {
  mode: EmbedMode;
  title: string;
  description: string;
  recommended?: boolean;
}

export interface WidgetConfig {
  key: string;
  label: string;
  script: string;
  pagePath: string;
  integrations: EmbedOption[];
}

export const WIDGETS: WidgetConfig[] = [
  {
    key: "changelog",
    label: "Changelog",
    script: "changelog-widget.js",
    pagePath: "/changelog",
    integrations: [
      {
        mode: "slideover",
        title: "Slide-over Widget",
        description:
          "Adds a floating badge to your site. Clicking it opens a slide-over panel with the changelog.",
        recommended: true,
      },
      {
        mode: "tab",
        title: "Side Tab",
        description:
          "Adds a small sticky tab on the right edge of the viewport. Clicking it opens the changelog slide-over. Works well alongside feedback tabs.",
      },
      {
        mode: "inline",
        title: "Inline Embed",
        description:
          "Embed the changelog directly into any page using an iframe. Great for dedicated pages.",
      },
      {
        mode: "hosted",
        title: "Hosted Page",
        description:
          "Link directly to the hosted changelog page. Use this in navbars, buttons, or emails.",
      },
      {
        mode: "headless",
        title: "Headless API",
        description:
          "Fetch changelog data via REST API and render it in your own UI. You generate and persist a visitor ID on your side for like/dislike deduplication. Set your allowed domain in Settings for cross-origin access.",
      },
      {
        mode: "advanced",
        title: "Advanced Config",
        description:
          "Pass visitor identity and datalayer variables for targeting. Define this before the widget script loads.",
      },
    ],
  },
  {
    key: "roadmap",
    label: "Roadmap",
    script: "roadmap-widget.js",
    pagePath: "/board",
    integrations: [
      {
        mode: "inline",
        title: "Inline Embed",
        description:
          "Embed the roadmap board directly into a page. Best for feature voting that needs space.",
        recommended: true,
      },
      {
        mode: "hosted",
        title: "Hosted Page",
        description:
          "Link directly to the hosted roadmap page. Share it with your users or link from your app.",
      },
      {
        mode: "headless",
        title: "Headless API",
        description:
          "Fetch roadmap items and submit votes/suggestions via REST API. Build your own roadmap UI. You generate and persist a visitor ID on your side for vote deduplication. Set your allowed domain in Settings for cross-origin access.",
      },
      {
        mode: "advanced",
        title: "Advanced Config",
        description:
          "Pass visitor identity and datalayer variables for targeting. Define this before loading the roadmap.",
      },
    ],
  },
];

export const WIDGETS_WITH_FEEDBACK: WidgetConfig[] = [
  ...WIDGETS,
  {
    key: "feedback",
    label: "Feedback",
    script: "feedback-widget.js",
    pagePath: "/survey",
    integrations: [
      {
        mode: "slideover",
        title: "Slide-over Widget",
        description:
          "Adds a floating feedback button to your site. Clicking it opens a slide-over panel with the feedback form.",
        recommended: true,
      },
      {
        mode: "tab",
        title: "Side Tab",
        description:
          "Adds a small sticky tab on the right edge of the viewport. Clicking it opens the feedback slide-over. Works well alongside changelog tabs.",
      },
      {
        mode: "inline",
        title: "Inline Embed",
        description:
          "Embed the feedback form directly into any page using an iframe.",
      },
      {
        mode: "hosted",
        title: "Hosted Page",
        description:
          "Link directly to the hosted feedback page. Share it via emails or in-app links.",
      },
      {
        mode: "headless",
        title: "Headless API",
        description:
          "Fetch the feedback form config and submit responses via REST API. Build your own feedback UI. Set your allowed domain in Settings for cross-origin access.",
      },
    ],
  },
];

export const SLIDEOVER_WIDGETS = WIDGETS_WITH_FEEDBACK.filter((w) =>
  w.integrations.some((i) => i.mode === "slideover")
);

export function getWidget(key: string): WidgetConfig | undefined {
  return WIDGETS.find((w) => w.key === key);
}
