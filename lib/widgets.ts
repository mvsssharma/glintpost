export type EmbedMode = "slideover" | "inline" | "hosted" | "advanced";

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
        mode: "advanced",
        title: "Advanced Config",
        description:
          "Pass visitor identity and datalayer variables for targeting. Define this before loading the roadmap.",
      },
    ],
  },
];

export const SLIDEOVER_WIDGETS = WIDGETS.filter((w) =>
  w.integrations.some((i) => i.mode === "slideover")
);

export function getWidget(key: string): WidgetConfig | undefined {
  return WIDGETS.find((w) => w.key === key);
}
