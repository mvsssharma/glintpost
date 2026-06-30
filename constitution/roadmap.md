# Roadmap

## Live Features

### Changelog
- Post CRUD (create, edit, delete, list)
- Rich text editor (Quill) with HTML storage
- Image uploads to Cloudflare R2 (toolbar + clipboard paste — no base64 in DB)
- Multi-language support via PostTranslation model
- Like/dislike/view tracking with datalayer targeting
- Widget embed: slideover, side tab, inline, hosted, headless, advanced config
- Draft/publish workflow with status filter (DRAFT / PUBLISHED / ALL) on posts list

### Roadmap
- Item CRUD with status workflow (Under Review → Planned → In Progress → Completed → Archived)
- Public voting (up/down) with visitor tracking
- AI-powered suggestion similarity detection (BYO key, fallback to Jaccard word overlap)
- Suggestion management: merge, create as item, dismiss
- Widget embed: slideover, inline, hosted, headless, advanced config

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

### Settings & Integration
- Org settings: theme, locales, allowed domain, AI provider/key/model
- Widget embed code generator with per-mode code snippets
- Live widget preview (iframe-based with preloaded iframes)
- Razorpay billing integration
- Storage tracking (used/cap bytes per org)

### Privacy & Compliance
- GDPR-compliant lazy visitor ID generation
- Consent API for visitor tracking
- Anonymous passive tracking (views without persistent IDs)

---

## ~~Planned: Post Edit Page & Draft Workflow~~ ✓ Done

**Status:** Complete — shipped with post CRUD, draft workflow, status filter, and R2 image uploads

---

## Planned: AI Changelog Writing

**Status:** Not started — prerequisite (post edit + draft workflow) is now complete

### Overview
AI-assisted changelog drafting and translation. Bridges the gap between internal ticket/PR language and customer-facing announcements.

### Input Modes
- **Mode A — Structured bullets:** User types key changes as bullets; AI expands into polished announcement.
- **Mode B — Raw paste:** User pastes content from JIRA/Linear/Notion/Slack; AI extracts customer-relevant info and discards internal noise.
- **Mode C — PM tool integration (Phase 3):** OAuth to Linear → issue picker UI. Pluggable "import source" interface. Linear first, JIRA follows same pattern.

### AI Layers
1. **Style from past posts:** Last 5 published posts passed inline to system prompt as tone examples. No embeddings/vector infra needed.
2. **Org writing context:** `aiWritingContext String?` field in `OrgSettings`. User-authored free text describing audience, tone, terminology preferences, what to avoid.
3. **Auto-translation:** "Translate" button on post editor generates `PostTranslation` records for all enabled locales via LLM. Manual/on-demand — not automatic on publish.

### Schema Changes
- `OrgSettings.aiWritingContext String?` — free-text brand/audience context for AI drafting

### New API Routes (dashboard-only, not public API)
- `POST /api/internal/posts/ai-draft` — takes `{ mode, rawInput }`, returns `{ title, content }`. Fetches AI config + last 5 posts + writing context server-side.
- `POST /api/internal/posts/ai-translate` — takes `{ postId, locales[] }`, writes `PostTranslation` records.

### New lib/llm.ts Functions
- `draftChangelog(input, mode, pastPosts, orgContext, ...)` — main generation function
- `translatePost(title, content, targetLocale, ...)` — reuses existing provider infrastructure

### Content Format
- AI generates **markdown** (natural LLM output) → `marked` library converts to HTML → loads into Quill editor
- Do NOT prompt AI to output HTML — markdown is more reliable and token-efficient
- Do NOT migrate editor away from Quill — DB stores HTML, format change would require data migration

### Key Decisions
- No streaming — drafts are short enough for simple fetch + loading state
- No auto-translate on publish — manual to avoid surprise API costs
- Style learned from inline examples, not vector RAG — sufficient at this org size

### Phased Delivery

| Phase | Scope | Depends On |
|-------|-------|------------|
| 0 | Post edit page + draft/publish workflow | — |
| 1 | `aiWritingContext` in settings, `ai-draft` API, "Draft with AI" toggle in create post (modes A + B) | Phase 0 |
| 2 | `ai-translate` API, "Translate" button in post editor with per-locale status | Phase 1 |
| 3 | Linear OAuth import source (pluggable pattern) | Phase 1 |
