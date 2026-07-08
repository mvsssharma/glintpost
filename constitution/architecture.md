# Architecture

## Tech Stack

- **Framework:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 5
- **Database:** PostgreSQL via Prisma 7 (PrismaPg adapter, max 2 connections)
- **Deployment:** Docker (standalone Next.js + Postgres) for self-hosting; Vercel for cloud.
- **Auth:** NextAuth v5 (credentials provider, JWT sessions, bcrypt)
- **Email:** Resend
- **Storage:** Pluggable via `STORAGE_DRIVER` (`lib/storage.ts`) — `local` filesystem (default self-host; served by `app/uploads/[key]`) or `s3` (Cloudflare R2 / AWS S3 / any S3-compatible store). Auto-selects `s3` when `S3_ENDPOINT` is set.
- **Billing:** Optional Razorpay subscriptions (hidden via the runtime `ENABLE_BILLING` feature flag; set `ENABLE_BILLING=false` to hide).
- **Validation:** Zod 4
- **AI:** BYO keys with pluggable providers (OpenAI, Anthropic, Google) via direct API calls
- **Rich Text:** Quill editor (react-quill-new) — stores HTML in database
- **Client data fetching:** SWR (public/widget pages) — dedup + caching
- **Logging:** pino (structured; pino-pretty in dev)

## Directory Structure

```
app/
  (auth)/            # Login, signup, password reset, email verification
  (dashboard)/       # Protected pages (sidebar layout)
    announcements/   # Announcement CRUD + analytics
    posts/           # Changelog CRUD
    roadmap/         # Roadmap items, suggestions (AI similarity)
    feedback/        # Form builder + responses
    settings/        # Org settings, billing
    integration/     # Widget embed code generator
    preview/         # Live widget preview
  api/               # Public REST API (API key auth)
    announcements/   # CRUD, active (public), track (public)
    changelog/       # posts, track
    roadmap/         # items, vote, suggest, track
    feedback/        # form, submit
    config/          # Widget theme/config
    internal/        # Session-auth dashboard-only routes (import; AI routes planned)
  board/             # Public roadmap page (iframe target)
  changelog/         # Public changelog page (iframe target)
  survey/            # Public feedback page (iframe target)
lib/
  auth.ts            # NextAuth config
  auth-helpers.ts    # requireAuth → requireVerified → requireOrg guards
  db.ts              # Prisma client + getOrgPrisma() tenant scoping
  api-key.ts         # validateApiKey() for public API routes
  cors.ts            # CORS headers from org allowedDomain
  cache.ts           # In-memory org-level cache (no TTL, explicit invalidation)
  widgets.ts         # Widget definitions (WIDGETS, WIDGETS_WITH_FEEDBACK)
  post-message.ts    # postMessage origin validation (getAllowedOrigins, isAllowedOrigin)
  llm.ts             # AI provider factory (encrypted API keys via AES-256-GCM)
  import-excel.ts    # Excel migration import: templates, parsing, validation (exceljs)
  validations.ts     # Zod schemas
  constants.ts       # Enums, config values
  visitor.ts         # Visitor ID generation
  crypto.ts          # AES-256-GCM encrypt/decrypt (key from AUTH_SECRET)
public/
  changelog-widget.js      # Slideover/embed widget script
  roadmap-widget.js        # Inline embed widget script
  feedback-widget.js       # Slideover/embed widget script
  announcement-widget.js   # Direct DOM injection widget script
prisma/
  schema.prisma         # Database schema
types/                  # TypeScript type definitions
constitution/           # Product docs (mission, architecture, roadmap)
```

## Multi-tenancy

`getOrgPrisma(orgId)` in `lib/db.ts` returns a Prisma extension that auto-injects `orgId` into all read/write operations. Scoped operations: findMany, findFirst, findUnique, count, groupBy, aggregate, deleteMany, updateMany, update, delete, upsert. The Organization model is scoped by `id` instead of `orgId`.

## Auth Flow

Credentials provider → bcrypt → JWT. Guards chain: `requireAuth()` → `requireVerified()` → `requireOrg()`, each redirecting to the appropriate page.

## Public API

Routes under `app/api/` use API key validation (`x-api-key` header or `apiKey` query param). CORS controlled by `allowedDomain` in org settings. All routes implement `OPTIONS` for preflight.

## Widget System

Four widgets (changelog, roadmap, feedback, announcements) support multiple embed modes:
- **Slideover:** Floating badge → slide-over panel (changelog, feedback)
- **Inline:** iframe embed
- **Hosted:** Direct page link
- **Headless:** REST API for custom UI
- **Advanced:** Custom visitorId + datalayer targeting

Widgets communicate via `postMessage` with origin validation. Allowed origins: org's `allowedDomain`, `app.glintpost.com`, `localhost`. Announcements widget injects DOM directly (no iframe) and uses localStorage for session/seen tracking.

## Database (key models)

- **User/Organization:** 1:1 relationship (User.orgId is unique)
- **OrgSettings:** Theme, locales, allowedDomain, AI config, storage limits
- **Post + PostTranslation:** Changelog with multi-language support. Content stored as HTML (Quill output).
- **ChangelogEvent:** Like/dislike/view tracking with targeting data
- **RoadmapItem/Vote/Suggestion/View:** Feature voting + AI similarity matching. `RoadmapItem.importedUpvotes` / `importedDownvotes` hold migration carry-over counts; displayed totals = visitor votes + imported.
- **FeedbackForm/Response:** Configurable survey (SELECT/NPS/TEXT, max 3 questions)
- **Announcement/AnnouncementEvent:** Push notifications with overlay/banner display, scheduling, priority, and VIEW/CLICK tracking

## Key Patterns

- **Widget definitions:** `WIDGETS` (changelog + roadmap) vs `WIDGETS_WITH_FEEDBACK` (all three) in `lib/widgets.ts`. Dashboard preview uses `WIDGETS_WITH_FEEDBACK`.
- **Cache invalidation:** Explicit — call cache invalidation after mutations, no TTL.
- **API errors:** Typed error classes in `lib/errors.ts` (`ApiError` + `Validation`/`NotFound`/`Unauthorized`/`Forbidden`). Routes `throw` them inside a `try/catch`; the catch maps `instanceof ApiError` → `{ error, statusCode }`, else 500. Migration is partial — apply to new/edited routes.
- **Logging:** pino `logger` in `lib/logger.ts` (`logger.error({ err }, "…")`) instead of `console.*`; level via `LOG_LEVEL`.
- **Public data fetching:** SWR hooks (e.g. `app/board/useRoadmap.ts`) with `[url, apiKey]` keys for dedup/caching on widget pages, subject to the no-request-loop rule.
- **AI keys:** Encrypted at rest with AES-256-GCM, key derived from `AUTH_SECRET`. Never serialized to the client — the settings page redacts `aiApiKey` to a sentinel (only "is a key saved?" reaches the browser).
- **Locales:** en, hi, ta, te, kn, mr, bn, gu.
- **Billing states:** trialing → active → past_due → canceled → inactive.
