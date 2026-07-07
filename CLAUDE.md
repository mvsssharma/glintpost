# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Glintpost

Product communication SaaS — changelog, roadmap voting, and feedback widgets that embed into customer sites.

**Domain:** glintpost.com | **App:** app.glintpost.com

## Constitution

Deep context lives in `constitution/` — read these before making architectural or product decisions:
- **[mission.md](constitution/mission.md)** — problem statement, customers, competitors, product decisions
- **[architecture.md](constitution/architecture.md)** — tech stack, directory structure, multi-tenancy, auth, widgets, database models, key patterns
- **[roadmap.md](constitution/roadmap.md)** — live features, planned features (with specs), phased delivery

## Commands

```bash
npm run dev        # Dev server (Turbopack)
npm run build      # prisma generate → prisma migrate deploy → next build
npm run start      # Production server
npm run lint       # ESLint
npx prisma migrate dev --name <name>   # Create a new migration
npx prisma studio                       # Visual DB browser
```

**Always run `npm run build` locally before pushing to main/staging.**

## Critical Rules

- **No infinite request loops from widget preview pages.** The public pages (`/changelog`, `/board`, `/survey`) are loaded inside iframes by both the preview page and production widgets. Any `useEffect`, `postMessage` listener, or API call on these pages must be guarded against re-render loops (e.g. missing dependency arrays, effect ↔ state ping-pong, or parent ↔ iframe message cycles). Always verify that switching widgets in the preview page and opening/closing slideovers does not produce runaway network requests.
- **Always read Next.js docs before coding.** Find and read the relevant doc in `node_modules/next/dist/docs/`. Training data may be outdated — the docs are the source of truth.

## Key Patterns

- **Multi-tenancy:** `getOrgPrisma(orgId)` in `lib/db.ts` returns a Prisma extension that auto-injects `orgId` into all queries. Use it for all tenant-scoped operations instead of manually filtering. New models must be added to `TENANT_SCOPED_MODELS` in `lib/db.ts`.
- **Auth guard chain:** `requireAuth()` → `requireVerified()` → `requireOrg()` in `lib/auth-helpers.ts`. Dashboard pages call `requireOrg()` which returns `{ session, org }`. Public API routes use `validateApiKey()` from `lib/api-key.ts` instead.
- **Adding a new feature/widget:** Register it in `lib/widgets.ts` (both `WIDGETS` and/or `WIDGETS_WITH_FEEDBACK`), create its public page under `app/`, create its widget script in `public/`, add dashboard pages under `app/(dashboard)/`, and add API routes under `app/api/`.
- **Public pages are iframe targets:** `app/changelog/`, `app/board/`, `app/survey/` render inside iframes on customer sites. They communicate with parent via `postMessage` with origin validation (`lib/post-message.ts`).
- **CORS:** Controlled per-org via `allowedDomain` in OrgSettings. All public API routes must implement `OPTIONS` handler using `lib/cors.ts`.
- **Cache:** In-memory org-level cache in `lib/cache.ts` with explicit invalidation (no TTL). Call cache invalidation after any mutation.
- **API error handling:** Wrap route handlers in `try/catch`; `throw` a typed error from `lib/errors.ts` (`ApiError(statusCode, message)` and its subclasses `ValidationError`/`NotFoundError`/`UnauthorizedError`/`ForbiddenError`). In the `catch`, map `error instanceof ApiError` → `{ error: error.message }` with `error.statusCode`, else a generic 500 (preserve CORS headers on public routes). See `app/api/roadmap/items/route.ts` for the reference shape. _(Migration in progress — older routes still return `NextResponse.json` inline; follow the new pattern for new/edited routes.)_
- **Logging:** Use the pino `logger` from `lib/logger.ts` (`logger.error({ err }, "message")`), not `console.*`. Level via `LOG_LEVEL`; pretty output in dev.
- **Client/widget data fetching:** Public widget pages use **SWR** for dedup + caching (e.g. `app/board/useRoadmap.ts`). Prefer a co-located `useSWR` hook with a `[url, apiKey]` key + `fetcher` over `useEffect`+`fetch`. On the iframe pages (`/changelog`, `/board`, `/survey`) still honor the no-request-loop critical rule.

## Environment Variables

```
DATABASE_URL              # PostgreSQL connection string
AUTH_SECRET               # JWT + encryption secret
AUTH_URL                  # NextAuth redirect base URL
RESEND_API_KEY            # Email (optional in dev — logs to console)
S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_ID, RAZORPAY_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL       # Public app URL
LOG_LEVEL                 # pino log level (default "info")
```
