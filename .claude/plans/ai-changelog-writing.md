# AI Changelog Writing — Implementation Plan

Spec source: `constitution/roadmap.md` → "Planned: AI Changelog Writing". This plan adds the
implementation detail, plus three hard product constraints (added 2026-07-02):

1. **AI never touches media or links.** When AI operates on existing post content, `<img src>`,
   `<a href>`, iframe embeds, and every other attribute pass through byte-identical. Only
   human-readable text changes (anchor *text* may be rewritten/translated; the URL never).
2. **Format carries forward.** A table stays a table, a bullet list stays a bullet list, a heading
   stays a heading. The AI must never be in a position to regenerate document structure.
3. **Nomenclature carries forward.** The org's domain taxonomy is sacred — a *customer* is never
   renamed to "client" or "user", a *partner* stays a partner, a *student* stays a student.
   Terminology is **auto-derived by the system from content the org already wrote** — users are
   never asked to maintain a glossary (zero-config, consistent with the product's datalayer-native
   ethos). Enforced via derived terms injected into every AI prompt **plus** output validation,
   not left to model discretion.

Priority order (per product decision 2026-07-02): **single-language rewrite of content the user
already wrote in the post ships first.** Drafting second. Multi-language/translation is
deliberately last among content phases.

Constraints 1–2 are satisfied *by construction* via the segment pipeline (Phase 1) — not by
prompting the model to "please keep the HTML intact".

---

> ## ⚠️ Update — 2026-07-06 (design consolidated; supersedes the Phase-1/Phase-2 split below)
>
> The original plan split AI writing into **Rewrite** (Phase 1, polish existing content) and
> **Draft** (Phase 2, modes A/B from bullets/paste). During implementation we collapsed these into
> **one action: "Refine with AI"**, because:
> - There are no PM-tool connectors, so users will realistically **paste** their content into the
>   editor and refine it — the same editor flow as "rewrite". Asking "write vs paste?" upfront is
>   needless friction; both just land in the editor.
> - Pasted content can contain **inline screenshots/video**, so the "draft" path also needs media
>   preservation — the original markdown-regeneration Phase-2 design would have destroyed media.
> - "Refine" is clearer to users than "Rewrite"/"Draft"/"Cleanup" when there's only one mode.
>
> **What actually shipped (2026-07-06):**
> - **One feature, "Refine with AI"**, wired into **both** the changelog post editor
>   (`CreatePostForm.tsx`) and the announcement editor (`CreateAnnouncementForm.tsx`) via the shared
>   `app/components/AIRefine.tsx`. Route: `POST /api/internal/posts/ai-refine`.
> - The segment pipeline became a **document-wide token pipeline** (`lib/html-segments.ts`,
>   `extractBlocks`/`reassembleBlocks`): the whole post is flattened to plain-text **blocks**; links,
>   media, inline-formatted phrases and code/table blocks become opaque tokens (⟦L#⟧/⟦M#⟧/⟦F#⟧/⟦B#⟧).
>   The model rewrites holistically (merge/split/reorder/re-type blocks) and repositions tokens by
>   context; every token must survive **exactly once** or the op aborts. Media is never sent to the
>   model (no vision cost) and restored byte-identical. `lib/llm.ts` → `rewriteDocument(blocks, cfg)`.
> - Terminology is **persisted** in `OrgSettings.nomenclature` and background-refreshed
>   (`lib/nomenclature.ts`), on top of the derive/check functions in `lib/glossary.ts`.
> - **Phase 2 (standalone Drafting) is dropped** — folded into Refine. Translation (was Phase 3) is
>   now the single remaining future phase.
>
> The Phase 1 / Phase 2 / Phase 3 sections below are kept for historical context; read them through
> the lens of this consolidation.

---

## Current State (verified 2026-07-02)

- `OrgSettings` has `aiProvider` / `aiApiKey` (AES-256-GCM encrypted) / `aiModel`; settings UI exists.
- `lib/llm.ts` has only `findSimilarItems` (roadmap suggestions) with per-provider direct API calls.
- Post CRUD lives at `app/api/posts/` (session-auth, `getOrgPrisma`) — create/edit hardcode `locale: "en"`.
- Public read is `GET /api/changelog/posts` (API-key auth) — hardcodes `translations: { where: { locale: "en" } }`.
- Editor: Quill via `react-quill-new`, HTML stored in `PostTranslation.content`.
- `isomorphic-dompurify` is already a dependency; **`marked` is not installed**; no HTML parser installed.
- `SUPPORTED_LOCALES` in `lib/constants.ts` (en, hi, ta, te, kn, mr, bn, gu); Settings locale
  multi-select exists but nothing consumes it.
- No `app/api/internal/` directory yet.

---

## Nomenclature Design — auto-derived, zero user config (used by every phase)

**Product decision (2026-07-02): users are never asked to provide or maintain a glossary.** The
system derives the org's terminology from content the org has already written. No schema field,
no settings UI for this.

### Derivation — `lib/glossary.ts`
- `deriveTerms({ sourceText, recentPosts }) → { properNouns: string[], domainTerms: string[] }`
  - **Deterministic extraction, no extra LLM call** (no added cost/latency per operation):
    - *Proper nouns / product names:* capitalized or CamelCase terms recurring in the source
      and/or recent published posts (excluding sentence-initial words and a stopword list).
    - *Domain terms:* frequent lowercase nouns appearing in the source **and** in ≥2 of the last
      5 published posts (e.g. "customer", "partner", "student") — the org's established vocabulary.
  - Keep the list small (top ~15 by frequency) to avoid prompt bloat.
- Inputs are already fetched for other reasons: the source segments (rewrite/translate) and the
  last 5 published posts (drafting style examples) — derivation is a pure function over them.
- *Future enhancement (optional, still zero-config):* cache an LLM-refined glossary per org,
  regenerated when posts change; user review possible but never required.

### Prompt enforcement (all AI operations)
Every system prompt gets a terminology block built from the derived terms:
> "This organization's existing content uses established terminology. Preserve these terms
> exactly as written and never substitute synonyms for them: … If the source text uses one of
> these terms, your output must use the same term. Preserve capitalized product names and proper
> nouns from the source verbatim."

### Output validation (`lib/glossary.ts`)
- `checkTerms(sourceText, outputText, derivedTerms) → violations[]`
  - A derived term that appears N times in the source but vanishes (or drops sharply) in the
    output → violation (we can't know which synonym replaced it, but we can detect that
    "customer" appeared 4× in the source and 0× in the output).
  - Proper nouns are checked case-sensitively.
- On violation: **one automatic retry** with a corrective instruction listing the exact terms
  that were lost. If it still fails, return the result with a visible warning in the UI
  ("Terminology check: 'customer' from your original text no longer appears") — the user decides
  in the before/after confirm. Never silently accept a violating rewrite, never hard-fail the
  whole operation over wording.

---

## Phase 1 — Foundations + Rewrite Existing Content (priority)

The first shippable: user writes rough content in the post editor, clicks **"Rewrite with AI"**,
gets a polished single-language version. Media, links, structure, and terminology all preserved.

### 1.1 Schema + Settings
- Migration adds `OrgSettings.aiWritingContext String?` only
  (`npx prisma migrate dev --name add_ai_writing_context`). No glossary field — terminology is
  derived, not stored.
- Settings UI: optional "AI writing context" textarea (audience, tone, what to avoid) in
  `app/(dashboard)/settings/SettingsForm.tsx`; extend Zod schema in `lib/validations.ts`.

### 1.2 `lib/llm.ts` refactor
- Extract the per-provider call in `llmSimilarityCheck` into a shared
  `llmComplete({ provider, apiKey, model, system, user, maxTokens })` — one function, three
  provider branches (OpenAI / Anthropic / Google), same error semantics as today.
  `findSimilarItems` keeps its behavior (including Jaccard fallback).

### 1.3 Segment pipeline — `lib/html-segments.ts` (the core of constraints 1–2)

New dependency: **cheerio** (server-side HTML parsing; wraps htmlparser2, no jsdom weight).

- `extractSegments(html) → { segments: [{ id, text }], skeleton }`
  - Parse stored HTML. Walk the DOM; collect **text nodes only**, each with a stable positional id.
  - Skip text inside `<pre>`/`<code>` (code is never rewritten/translated) and whitespace-only nodes.
  - Also collect `alt` and `title` attribute values as segments (user-facing text).
    `href`, `src`, and every other attribute are **never** extracted — they cannot be modified
    because they never reach the model.
- `reassemble(skeleton, transformedSegments) → html`
  - Strict validation before reinsertion: same segment count, same ids, every value a non-empty
    string, reject any value containing `<` or `>` (model must return plain text).
    **Any validation failure aborts the whole operation — no partial writes.**
  - Reinsert text into the original DOM, serialize, run through DOMPurify.
- Because the model only ever sees and returns flat text segments, tables, lists, headings,
  blockquotes, image tags, links, and embeds are structurally untouched — the skeleton IS the
  original document.
- **Unit-test this module against fixture HTML** containing a table, nested lists, an image, an
  external link, a code block, and inline formatting spans. Assert: transformed output diffs from
  source in text nodes only.

### 1.4 `rewriteSegments` in `lib/llm.ts`
- Input: segments JSON array + org context + derived terms (`deriveTerms` over source + recent posts).
- Instruction: improve grammar, clarity, and tone per org context; same language as input; return
  the same JSON array — same ids, same order, no additions/removals, plain text only, no HTML/markdown.
- Chunk if >100 segments per call.
- Run `checkTerms` on the joined output (retry-once semantics above).

### 1.5 API route: `POST /api/internal/posts/ai-rewrite`
- New directory `app/api/internal/` — **session auth** (same guard pattern as `app/api/posts/`),
  never API-key auth; no CORS/OPTIONS handler (dashboard-only).
- Zod body: `{ content: string }` (the editor's current HTML — rewrite operates on unsaved editor
  state, not the persisted row, so the user can rewrite before ever saving).
- Pipeline: sanitize input → extractSegments → deriveTerms → rewriteSegments → reassemble →
  sanitize → return `{ content, terminologyWarnings: string[] }`.
- Error cases: AI not configured (409, actionable message linking to Settings), provider
  error/timeout (502), empty/too-large content (400), segment validation failure (502 "AI response
  could not be applied safely — your content was not changed").

### 1.6 Editor UI (`app/(dashboard)/posts/[id]/edit` + create page)
- "Rewrite with AI" button in the editor toolbar area. Loading state; on success show a
  **before/after confirm** (replace editor content only on user accept — never silently overwrite).
- Surface `terminologyWarnings` in the confirm dialog if present.
- Disabled state with tooltip when org has no AI provider configured.

**Phase 1 exit criteria:** rewrite a rough post containing an image, a link, a bullet list, and a
table → diff of source vs rewritten HTML shows only text-node changes; a source using "customer"
never comes back saying "client"; `npm run build` passes; widget preview shows no request loops.

---

## Phase 2 — AI Drafting (modes A + B)

New content from bullets or raw paste — no existing media/links, so the segment pipeline is not
involved; derived terminology + writing context still are.

### 2.1 `draftChangelog` in `lib/llm.ts`
- System prompt = role + `aiWritingContext` + derived-terms block (`deriveTerms` over the mode-B
  source text + last 5 posts — for mode A, over the bullets + last 5 posts) + last 5 published
  posts (title + plain-texted content, truncated) as tone examples.
- Mode A (bullets): expand key changes into a customer-facing announcement.
- Mode B (raw paste): extract customer-relevant changes; discard ticket IDs, internal names, noise.
- Output contract: **markdown**, restricted to Quill-supported constructs — headings, bold/italic,
  bullet/ordered lists, links, blockquotes, code blocks. Explicitly: *no tables, no images, no raw
  HTML* (Quill strips unsupported formats on load — allowing them would silently corrupt drafts).
- Returns `{ title, contentMarkdown }`; run `checkTerms` against the mode-B source text (for
  mode A, against the user's bullets).

### 2.2 API route: `POST /api/internal/posts/ai-draft`
- Session auth. Zod body: `{ mode: "bullets" | "raw", input: string (1–10k chars) }`.
- Fetches settings + last 5 posts via `getOrgPrisma`, calls `draftChangelog`, converts markdown →
  HTML with `marked` (new dep), sanitizes with DOMPurify, returns `{ title, content }`.

### 2.3 Create-page UI
- "Draft with AI" toggle panel in `app/(dashboard)/posts/create/page.tsx`: mode switch, textarea,
  Generate button. If the editor already has content, explicit "Replace current content?" confirm.

**Phase 2 exit criteria:** bullets and a pasted JIRA blob both produce clean Quill-editable posts
using org terminology; unconfigured orgs see a graceful disabled state.

---

## Phase 3 — Translation + Multi-language Serving (deliberately after 1–2)

Reuses the Phase 1 segment pipeline unchanged. Also closes the "PostTranslation is schema-only"
gap — generating translations without serving them would be dead data.

### 3.1 `translateSegments` in `lib/llm.ts`
- Same JSON-segments contract as rewrite, instruction is "translate to {locale}".
- Terminology integration: derived proper nouns/product names are listed as "keep verbatim —
  do not translate"; derived domain terms get "translate consistently — use the same target-language
  word for this term every time it appears".

### 3.2 API route: `POST /api/internal/posts/ai-translate`
- Session auth, Zod body: `{ postId, locales: string[] }` (each ∈ `SUPPORTED_LOCALES`, ≠ "en").
- Loads the `en` translation, runs the pipeline per locale, upserts `PostTranslation` rows via
  `getOrgPrisma` (**`upsert.create` needs manual `orgId`** — established project pattern).
- Per-locale result: `{ locale, status: "ok" | "failed", error? }` — one locale failing must not
  roll back the others. `cacheInvalidate(orgId, "changelog-posts")` after any successful write.

### 3.3 Editor UI — Translations panel
- Lists the org's enabled locales (finally consuming the Settings multi-select) with status chips:
  **translated** (row `updatedAt` ≥ en `updatedAt`), **stale** (en edited after), **missing**.
- "Translate all missing/stale" + per-locale retry. Manual trigger only — never auto on publish.

### 3.4 Serving (public side)
- `GET /api/changelog/posts?locale=xx`: validate against `SUPPORTED_LOCALES`, query
  `translations: { where: { locale: { in: [locale, "en"] } } }`, prefer requested locale per post,
  fall back to `en`. Cache key per locale (`changelog-posts:{locale}`); invalidation clears all
  locale variants for the org.
- Widget: `data-locale` attribute → forwarded to iframe/API (`public/changelog-widget.js` +
  unified `public/widget.js` loader). Public page `app/changelog` reads `locale` from searchParams.
- **Critical rule check:** locale read once from the URL — no postMessage/effect loops on iframe
  pages (verify in preview: switching widgets produces no runaway requests).

**Phase 3 exit criteria:** translate a post with image/link/list/table → only text nodes differ;
`?locale=hi` returns Hindi with en fallback; derived proper nouns/product names survive verbatim;
stale detection flips when en is re-edited.

---

## Cross-cutting

- **Tenancy:** every DB touch via `getOrgPrisma`; `PostTranslation` is already in `TENANT_SCOPED_MODELS`.
- **New deps:** `cheerio` (Phase 1), `marked` (Phase 2). Both server-side only.
- **Docs:** update `constitution/roadmap.md` (move features to Live as phases ship) and the
  Glintpost website feature list after Phase 3.
- **Verification per phase:** `npm run build` locally before push (project rule); manual widget
  preview check for request loops after Phase 3 serving changes.

## Suggested Order & Sizing

| Step | Size | Notes |
|------|------|-------|
| 1.1 schema + settings UI (writing context) | S | migration + one optional textarea |
| 1.2 llmComplete refactor | S | low-risk, similarity keeps behavior |
| 1.3 segment pipeline + fixture tests | M | the correctness-critical piece |
| 1.3b deriveTerms + checkTerms (`lib/glossary.ts`) | S | pure functions, unit-testable |
| 1.4–1.5 rewriteSegments + ai-rewrite route | M | includes terminology check + retry |
| 1.6 rewrite UI with before/after confirm | M | |
| 2.x drafting (fn + route + create-page panel) | M | |
| 3.x translation + serving | L | touches cache keys + widget script + public pages |
