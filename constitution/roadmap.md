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
- Razorpay billing integration
- Storage tracking (used/cap bytes per org)

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

## Planned: AI Changelog Writing

**Status:** Not started — prerequisite (post edit + draft workflow) is now complete. Implementation plan: `.claude/plans/ai-changelog-writing.md`

### Overview
AI-assisted changelog drafting and translation. Bridges the gap between internal ticket/PR language and customer-facing announcements.

### Input Modes
- **Rewrite (priority — ships first):** User writes rough content directly in the post editor; AI polishes it in place — grammar, clarity, tone. Single language. Media, links, and document structure pass through untouched (segment pipeline).
- **Mode A — Structured bullets:** User types key changes as bullets; AI expands into polished announcement.
- **Mode B — Raw paste:** User pastes content from JIRA/Linear/Notion/Slack; AI extracts customer-relevant info and discards internal noise.
- **Mode C — PM tool integration (last phase):** OAuth to Linear → issue picker UI. Pluggable "import source" interface. Linear first, JIRA follows same pattern.

### AI Layers
1. **Style from past posts:** Last 5 published posts passed inline to system prompt as tone examples. No embeddings/vector infra needed.
2. **Org writing context:** `aiWritingContext String?` field in `OrgSettings`. User-authored free text describing audience, tone, what to avoid.
3. **Nomenclature (auto-derived, zero config):** the org's taxonomy (e.g. "customer", "partner", "student") is **derived by the system from content the org already wrote** — the source content being processed plus recent published posts. Users are never asked to maintain a glossary. The derived term list is injected into every AI operation; the model must never substitute a synonym for a domain term (a customer is never renamed to "client" or "user"), and proper nouns/product names from the source are preserved verbatim.
4. **Auto-translation (deprioritized — last content phase):** "Translate" button on post editor generates `PostTranslation` records for all enabled locales via LLM. Manual/on-demand — not automatic on publish. Derived proper nouns/product names are kept verbatim in translations; domain terms must translate consistently.

### Schema Changes
- `OrgSettings.aiWritingContext String?` — free-text brand/audience context for AI drafting (optional)

### New API Routes (dashboard-only, not public API)
- `POST /api/internal/posts/ai-rewrite` — takes `{ postId }` or `{ content }`, rewrites text segments of existing post content, returns polished HTML. Structure/media/links untouched.
- `POST /api/internal/posts/ai-draft` — takes `{ mode, rawInput }`, returns `{ title, content }`. Fetches AI config + last 5 posts + writing context server-side.
- `POST /api/internal/posts/ai-translate` — takes `{ postId, locales[] }`, writes `PostTranslation` records.

### New lib/llm.ts Functions
- `rewriteSegments(segments, derivedTerms, orgContext, ...)` — polish text segments in place (single language)
- `draftChangelog(input, mode, pastPosts, orgContext, derivedTerms, ...)` — main generation function
- `translateSegments(segments, targetLocale, derivedTerms, ...)` — reuses existing provider infrastructure

### Content Format
- AI generates **markdown** (natural LLM output) → `marked` library converts to HTML → loads into Quill editor
- Do NOT prompt AI to output HTML — markdown is more reliable and token-efficient
- Do NOT migrate editor away from Quill — DB stores HTML, format change would require data migration
- **Drafts must stay within Quill-supported formats** (headings, bold/italic, lists, links, blockquotes, code blocks) — Quill strips unsupported HTML (e.g. tables) on load

### Content Preservation (hard rules for any AI operation on existing content)
- **Media and links are never touched:** `<img src>`, `<a href>`, iframe embeds, and all other attributes pass through byte-identical. Only human-readable text is rewritten/translated (anchor text yes, the URL never).
- **Structure carries forward:** a table stays a table, a bullet list stays a bullet list, headings stay headings. Achieved by construction — rewrite and translation both operate on extracted text segments and reinsert them into the original DOM; the AI never regenerates HTML.
- **Nomenclature carries forward:** domain taxonomy (customer, partner, student, …) is never renamed — terminology auto-derived from the org's own content (zero user config) and injected into every prompt, plus output validation that flags terms that vanished from the output.
- Implemented via a shared segment pipeline (`lib/html-segments.ts`): parse stored HTML → extract text nodes → LLM transforms segments as JSON → validate → reinsert → sanitize. See plan for details.

### Key Decisions
- **Single-language first:** rewrite/draft in the post's language ships before any translation work — multi-language is explicitly deprioritized
- **Nomenclature consistency is a hard requirement:** domain terms (customer, partner, student, …) must survive every AI operation unchanged — terminology is **auto-derived from the org's own content (never user-maintained)** and enforced via prompt + output validation, not left to model discretion
- No streaming — drafts are short enough for simple fetch + loading state
- No auto-translate on publish — manual to avoid surprise API costs
- Style learned from inline examples, not vector RAG — sufficient at this org size

### Phased Delivery

| Phase | Scope | Depends On |
|-------|-------|------------|
| 0 | Post edit page + draft/publish workflow | — ✓ Done |
| 1 | Foundations (`aiWritingContext`, terminology derivation in `lib/glossary.ts`, `llmComplete` refactor) + segment pipeline (`lib/html-segments.ts`) + **`ai-rewrite` API + "Rewrite with AI" in post editor** (single language) | Phase 0 |
| 2 | `ai-draft` API, "Draft with AI" toggle in create post (modes A + B) | Phase 1 |
| 3 | `ai-translate` API, "Translate" button in post editor with per-locale status, translation **serving** (`?locale=` on public API, widget `data-locale`) | Phase 1 |
| 4 | Linear OAuth import source (pluggable pattern) | Phase 2 |
