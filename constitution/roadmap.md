# Roadmap

## Live Features

### Changelog
- Post CRUD (create, edit, delete, list)
- Rich text editor (Quill) with HTML storage
- Image uploads to Cloudflare R2 (toolbar + clipboard paste — no base64 in DB)
- Like/dislike/view tracking with datalayer targeting
- Widget embed: slideover, side tab, inline, hosted, headless, advanced config
- Draft/publish workflow with status filter (DRAFT / PUBLISHED / ALL) on posts list
- Excel import for migration (Canny/Beamer etc.) — template download, backdated dates, all-or-nothing validation; shown only while the section has fewer than 3 entries

### Roadmap
- Item CRUD with status workflow (Under Review → Planned → In Progress → Completed → Archived)
- Public voting (up/down) with visitor tracking
- AI-powered suggestion similarity detection (BYO key, fallback to Jaccard word overlap)
- Suggestion management: merge, create as item, dismiss
- Widget embed: slideover, inline, hosted, headless, advanced config
- Excel import for migration — stores carried-over upvote/downvote counts in `importedUpvotes` / `importedDownvotes` on the item (separate from visitor votes; displayed as the sum), backdated dates

### Feedback
- Multi-form support (create multiple independent feedback forms)
- Configurable form builder (SELECT / NPS / TEXT, max 3 questions)
- Public submission with visitor + datalayer tracking
- Response viewer in dashboard
- Widget embed: slideover, side tab, inline, hosted, headless

### Announcements
- Push-based notifications: full-screen overlay or top banner (configurable per announcement)
- Announcement CRUD with draft/publish workflow
- Scheduling via start/end dates with priority ordering
- Session-based display: one announcement per session (30-min localStorage timeout)
- Per-browser seen tracking: each announcement shown at most once (localStorage)
- VIEW and CLICK event tracking with analytics (views, clicks, CTR)
- Datalayer-based targeting rules (reuses changelog targeting system)
- Widget script injects DOM directly into host page (not iframe)
- Integration page with embed snippet and advanced config
- Excel import for migration — display type/status/dates/priority/CTA, backdated entries

### Settings & Integration
- Org settings: theme, locales, allowed domain, AI provider/key/model
- Widget embed code generator with per-mode code snippets
- Live widget preview (iframe-based with preloaded iframes)
- Feature-flagged Razorpay billing integration (`NEXT_PUBLIC_ENABLE_BILLING`)
- Storage tracking (used/cap bytes per org)
- Docker support for instant self-hosting (Next.js standalone + Postgres)

### Onboarding
- New orgs are seeded with one sample entry per section (`lib/sample-content.ts`) so dashboards are never blank on registration
- Samples are never publicly visible: post + announcement are DRAFT, roadmap item is ARCHIVED (public board excludes archived)

### Privacy & Compliance
- GDPR-compliant lazy visitor ID generation
- Consent API for visitor tracking
- Anonymous passive tracking (views without persistent IDs)

---

## ~~Planned: Post Edit Page & Draft Workflow~~ ✓ Done

**Status:** Complete — shipped with post CRUD, draft workflow, status filter, and R2 image uploads

---

## Planned: Multi-language Changelog

**Status:** Not started — schema only. The `PostTranslation` model exists, but every code path hardcodes `locale: "en"`: post create/edit only writes the `en` row, the public API only reads `en`, and the public pages/widgets have no locale handling. The locale multi-select in Settings is not consumed anywhere.

### Remaining Work
- **Serving:** `?locale=` param on `GET /api/changelog/posts` with fallback to `en`; per-locale cache keys; `data-locale` attribute on the widget script and locale query param on public pages.
- **Authoring:** per-locale translation status in the post editor (translated / stale / missing — stale = `en` translation updated after the locale's translation).
- **Generation:** AI auto-translation is the primary authoring path — delivered as Phase 3 of AI Changelog Writing (below), **deliberately after single-language rewrite/draft ship**. Manual translation editing is out of scope until AI translation ships.

Full plan: `.claude/plans/ai-changelog-writing.md` (Phase 3 covers both translation generation and serving).

---

## AI Changelog Writing

**Status:** "Refine with AI" shipped (2026-07-06) for both changelog posts and announcements. Translation/multi-language serving still planned. Implementation plan: `.claude/plans/ai-changelog-writing.md`

### Overview
AI-assisted changelog writing and (future) translation. Bridges the gap between internal ticket/PR language and customer-facing announcements.

### The Feature — one action: "Refine with AI"
There is a **single** AI writing action, not separate "rewrite" vs "draft" modes. The user gets their content into the editor however they like — typing it, or **pasting** a rough dump from JIRA/Linear/Notion/Slack (with inline screenshots/video) — and clicks **Refine with AI**. The AI reads the whole post and rewrites it holistically: fixes grammar, tightens wording, improves flow, and may merge/split/reorder/re-type blocks (e.g. turn a run-on paragraph into a bullet list). Single language. A before/after modal lets the user apply or discard.

Media, links, inline formatting, and code/table blocks are **never sent to the AI** and are restored byte-identical — the AI only ever sees plain text with opaque placeholder tokens, and decides where each token best fits the reflowed text (see Content Preservation below). This means: your app screenshots stay exactly as uploaded, and the AI spends zero credits "understanding" images.

### AI Layers
1. **Style from past posts:** Last 5 published posts passed inline to system prompt as tone examples. No embeddings/vector infra needed.
2. **Org writing context:** `aiWritingContext String?` field in `OrgSettings`. User-authored free text describing audience, tone, what to avoid.
3. **Nomenclature (auto-derived, zero config):** the org's taxonomy (e.g. "customer", "partner", "student") is **derived by the system from content the org already wrote** — the source content being processed plus recent published posts. Users are never asked to maintain a glossary. It is persisted in `OrgSettings.nomenclature` and refreshed in the background (LLM-refined, fire-and-forget, 10-min debounce) when posts are created/published (`lib/nomenclature.ts`). The effective term list is injected into every AI operation; the model must never substitute a synonym for a domain term (a customer is never renamed to "client" or "user"), and proper nouns/product names from the source are preserved verbatim.
4. **Auto-translation (deprioritized — last content phase):** "Translate" button on post editor generates `PostTranslation` records for all enabled locales via LLM. Manual/on-demand — not automatic on publish. Derived proper nouns/product names are kept verbatim in translations; domain terms must translate consistently.

### Schema Changes
- `OrgSettings.aiWritingContext String?` — free-text brand/audience context for AI (optional)
- `OrgSettings.nomenclature Json?` — persisted auto-derived terminology (proper nouns + domain terms)

### API Routes (dashboard-only, not public API)
- `POST /api/internal/posts/ai-refine` — takes `{ content }` (unsaved editor HTML), holistically rewrites it in one language, returns `{ content, terminologyWarnings[] }`. Media/links/formatting/code untouched. **Shipped.**
- `POST /api/internal/posts/ai-translate` *(future)* — takes `{ postId, locales[] }`, writes `PostTranslation` records.

### lib/llm.ts Functions
- `llmComplete({ provider, apiKey, model, system, user, ... })` — shared per-provider completion (OpenAI / Anthropic / Google). **Shipped.**
- `rewriteDocument(blocks, cfg)` — holistic block-level rewrite of an existing post, terminology-aware. **Shipped.**
- `translateSegments(...)` *(future)* — reuses the same block pipeline + provider infrastructure for translation.

### Content Format
- Refine works on the **stored HTML** directly via the block pipeline — no markdown round-trip. The AI returns a typed JSON of blocks (plain text + tokens); we render the HTML ourselves and sanitize. The AI never emits HTML or markdown.
- Do NOT migrate editor away from Quill — DB stores HTML.
- Output stays within Quill-supported constructs (headings, lists, blockquotes, paragraphs) plus verbatim-restored code/tables.

### Content Preservation (hard rules — enforced by construction, not prompting)
- **The AI never sees media or links.** `<img>`, `<video>`, `<iframe>`, `<a href>`, code blocks and tables are replaced by opaque tokens (⟦M#⟧/⟦L#⟧/⟦B#⟧) before anything is sent; their href/src never reach the model, so they cost no vision credits and are restored byte-identical.
- **The AI may restructure text but never invent media.** It rewrites the plain text holistically (merge/split/reorder blocks) and repositions each token by surrounding-text context. Every token must survive **exactly once** — no drops, duplicates, or invented tokens — or the whole operation aborts and the content is left unchanged.
- **Inline formatting is preserved:** bold/italic/underline/code phrases (and styled spans) are tokenized (⟦F#⟧) and restored verbatim.
- **Nomenclature carries forward:** domain taxonomy (customer, partner, student, …) is never renamed — terminology auto-derived from the org's own content (zero user config), injected into every prompt, plus output validation that flags terms that vanished from the output (with one corrective retry).
- Implemented via the document-wide token pipeline (`lib/html-segments.ts`): parse stored HTML → `extractBlocks` (plain-text blocks + token map) → LLM returns restructured blocks as JSON → `reassembleBlocks` validates tokens + renders HTML → sanitize.

### Key Decisions
- **One action, not modes:** "rewrite existing content" and "draft from a paste" collapsed into a single **Refine with AI** — the user always works in the editor (typed or pasted), and Refine handles both, media intact. No separate "Draft"/"Rewrite" buttons, no upfront "write vs paste" prompt.
- **Single-language first:** refine in the post's language ships before any translation work — multi-language is explicitly deprioritized
- **Nomenclature consistency is a hard requirement:** domain terms (customer, partner, student, …) must survive every AI operation unchanged — terminology is **auto-derived from the org's own content (never user-maintained)** and enforced via prompt + output validation, not left to model discretion
- No streaming — drafts are short enough for simple fetch + loading state
- No auto-translate on publish — manual to avoid surprise API costs
- Style learned from inline examples, not vector RAG — sufficient at this org size

### Phased Delivery

| Phase | Scope | Depends On |
|-------|-------|------------|
| 0 | Post edit page + draft/publish workflow | — ✓ Done |
| 1 | Foundations (`aiWritingContext`, `OrgSettings.nomenclature`, terminology in `lib/glossary.ts` + `lib/nomenclature.ts`, `llmComplete` refactor) + document-wide token pipeline (`lib/html-segments.ts`) + **`ai-refine` API + "Refine with AI" in changelog post + announcement editors** (single language) | — ✓ Done (2026-07-06) |
| 2 | `ai-translate` API, "Translate" button in post editor with per-locale status, translation **serving** (`?locale=` on public API, widget `data-locale`) | Phase 1 |
