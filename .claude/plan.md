# Plan: Config-driven widget integration options

## Problem
Currently, IntegrationTabs hardcodes 4 option cards (Popup, Inline, Hosted, Advanced) for every widget. But not all embedding modes suit every widget — e.g., sidebar popup works for changelog but not roadmap. No config declares which modes are allowed or which is the default.

## Approach
Create a shared widget registry in `lib/widgets.ts`. Each widget declares its **allowed embedding modes** and which one is the **default/recommended**. The rendering logic loops over the config — only allowed modes are shown. Datalayer support is universal (all widgets), not a per-widget config.

### 1. Create `lib/widgets.ts` — shared widget config

```typescript
type EmbedMode = "popup" | "inline" | "hosted" | "advanced";

interface EmbedOption {
  mode: EmbedMode;
  title: string;
  description: string;
  recommended?: boolean;
}

interface WidgetConfig {
  key: string;
  label: string;
  script: string;
  pagePath: string;
  integrations: EmbedOption[];
}
```

**Changelog** (script: changelog-widget.js, pagePath: /changelog) — all 4 modes:
- popup (recommended) — "Adds a floating badge. Clicking opens a slide-in panel with the changelog."
- inline — "Embed the changelog directly into any page using an iframe."
- hosted — "Link directly to the hosted changelog page. Use in navbars, buttons, or emails."
- advanced — "Pass visitor identity and datalayer variables for targeting. Define before the widget script."

**Roadmap** (script: roadmap-widget.js, pagePath: /board) — no popup (sidebar doesn't suit a voting board):
- inline (recommended) — "Embed the roadmap board directly into a page. Best for feature voting that needs space."
- hosted — "Link directly to the hosted roadmap page."
- advanced — "Pass visitor identity and datalayer variables for targeting. Define before loading the roadmap."

### 2. Update `IntegrationTabs.tsx`
- Import config from `lib/widgets.ts`
- Remove all hardcoded option cards
- Loop over `widget.integrations` to render cards dynamically
- Code snippet generation driven by `option.mode` + widget config:
  - `popup` → `<script src="...widget.script" data-api-key="..." defer>`
  - `inline` → `<iframe src="...widget.pagePath?apiKey=...">`
  - `hosted` → plain URL `appUrl + widget.pagePath + ?apiKey=...`
  - `advanced` → `GlintPostConfig` block with visitorId + datalayer (always included for all widgets)
- Recommended badge shown when `option.recommended === true`

### 3. Update `PreviewContent.tsx`
- Import from `lib/widgets.ts` instead of local WIDGETS map

### Files changed
- **New:** `lib/widgets.ts`
- **Modified:** `app/(dashboard)/integration/IntegrationTabs.tsx`
- **Modified:** `app/(dashboard)/preview/PreviewContent.tsx`
