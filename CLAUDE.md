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
npm run build      # prisma generate → next build (migrations run separately: docker-entrypoint.sh, or `prisma migrate deploy`)
npm run start      # Production server
npm run lint       # ESLint
npx prisma migrate dev --name <name>   # Create a new migration
npx prisma studio                       # Visual DB browser
```

**Always run `npm run build` locally before pushing to main/staging.**

### Release sanity checklist (run before every release/push that touches build, Docker, deps, env, or migrations)

Glintpost ships as **two distributions** — Vercel (cloud) and a self-hosted Docker image. A green `next build` only proves the Vercel path. Also verify the Docker path:

1. **`npm run build`** — TypeScript + Next build (the Vercel/cloud path).
2. **Docker image builds:** `docker build -t glintpost:sanity .` — catches Dockerfile / standalone-output / in-container `next build` breakage.
3. **Clean self-host boot:** from a fresh DB volume, confirm migrations apply and the app serves:
   ```bash
   docker compose down -v                 # wipe volumes for a true fresh-install test
   docker compose up -d --build
   docker compose logs web                # expect all migrations "Applying…" then "Ready"
   curl -so /dev/null -w "%{http_code}\n" http://localhost:3000/api/health   # expect 200
   ```
   (If host port 5432 is taken by a local Postgres, remap the db port via a compose override — the app reaches it internally as `db:5432` regardless.)

Both build **and** clean-boot must pass — the Docker path can break while the cloud build is green (e.g. runtime-only env vars, `output: standalone` file tracing, entrypoint migrations).

## Critical Rules

- **No infinite request loops from widget preview pages.** The public pages (`/changelog`, `/board`, `/survey`) are loaded inside iframes by both the preview page and production widgets. Any `useEffect`, `postMessage` listener, or API call on these pages must be guarded against re-render loops (e.g. missing dependency arrays, effect ↔ state ping-pong, or parent ↔ iframe message cycles). Always verify that switching widgets in the preview page and opening/closing slideovers does not produce runaway network requests.
- **Always read Next.js docs before coding.** Find and read the relevant doc in `node_modules/next/dist/docs/`. Training data may be outdated — the docs are the source of truth.

## Key Patterns

- **Multi-tenancy:** `getOrgPrisma(orgId)` in `lib/db.ts` returns a Prisma extension that auto-injects `orgId` into all queries. Use it for all tenant-scoped operations instead of manually filtering. New models must be added to `TENANT_SCOPED_MODELS` in `lib/db.ts`.
- **Auth guard chain:** `requireAuth()` → `requireVerified()` → `requireOrg()` in `lib/auth-helpers.ts`. Dashboard pages call `requireOrg()` which returns `{ session, org }`. Public API routes use `validateApiKey()` from `lib/api-key.ts` instead.
- **Adding a new feature/widget:** Register it in `lib/widgets.ts` (both `WIDGETS` and/or `WIDGETS_WITH_FEEDBACK`), create its public page under `app/`, create its widget script in `public/`, add dashboard pages under `app/(dashboard)/`, and add API routes under `app/api/`. **Allowlist the new public page + public (API-key) routes in `proxy.ts` `publicPaths`** — otherwise the auth middleware (`proxy.ts`, Next 16's renamed `middleware.ts`) redirects cross-origin widget requests to `/login`. Do NOT allowlist dashboard/session routes there (they stay protected and rely on `requireOrgApi`).
- **Public pages are iframe targets:** `app/changelog/`, `app/board/`, `app/survey/` render inside iframes on customer sites. They communicate with parent via `postMessage` with origin validation (`lib/post-message.ts`).
- **CORS:** Controlled per-org via `allowedDomain` in OrgSettings. All public API routes must implement `OPTIONS` handler using `lib/cors.ts`.
- **Cache:** In-memory org-level cache in `lib/cache.ts` with explicit invalidation (no TTL). Call cache invalidation after any mutation.
- **API error handling:** Wrap route handlers in `try/catch`; `throw` a typed error from `lib/errors.ts` (`ApiError(statusCode, message)` and its subclasses `ValidationError`/`NotFoundError`/`UnauthorizedError`/`ForbiddenError`). In the `catch`, map `error instanceof ApiError` → `{ error: error.message }` with `error.statusCode`, else a generic 500 (preserve CORS headers on public routes). See `app/api/roadmap/items/route.ts` for the reference shape. _(Migration in progress — older routes still return `NextResponse.json` inline; follow the new pattern for new/edited routes.)_
- **Logging:** Use the pino `logger` from `lib/logger.ts` (`logger.error({ err }, "message")`), not `console.*`. Level via `LOG_LEVEL`; pretty output in dev.
- **Client/widget data fetching:** Public widget pages use **SWR** for dedup + caching (e.g. `app/board/useRoadmap.ts`). Prefer a co-located `useSWR` hook with a `[url, apiKey]` key + `fetcher` over `useEffect`+`fetch`. On the iframe pages (`/changelog`, `/board`, `/survey`) still honor the no-request-loop critical rule.

## Environment Variables

```
DATABASE_URL              # PostgreSQL connection string
DIRECT_DATABASE_URL       # Direct (non-pooled) connection for migrations; falls back to DATABASE_URL
AUTH_SECRET               # JWT + encryption secret
AUTH_URL                  # NextAuth redirect base URL
RESEND_API_KEY            # Email (optional in dev — logs to console)
STORAGE_DRIVER            # "local" (disk) or "s3"; auto-selects "s3" when S3_ENDPOINT set (see lib/storage.ts)
UPLOAD_DIR                # Local driver upload dir (default ./data/uploads); served by app/uploads/[key]
S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_ID, RAZORPAY_WEBHOOK_SECRET
APP_URL                   # Public app base URL (runtime, server-side; see lib/app-url.ts)
LOG_LEVEL                 # pino log level (default "info")
ENABLE_BILLING            # "false" hides billing (self-host); default enabled
REQUIRE_EMAIL_VERIFICATION # "true" forces email verification before login; default off
```

**Dual-distribution env note:** Config that must differ between the Vercel cloud build and the self-hosted Docker image (`APP_URL`, `ENABLE_BILLING`, `REQUIRE_EMAIL_VERIFICATION`) uses **plain, non-`NEXT_PUBLIC_` names** so it is read at *runtime*. `NEXT_PUBLIC_*` values are inlined at build time and frozen — a prebuilt Docker image can't honor them at runtime. For client components, resolve these server-side (`lib/app-url.ts`) and pass down as props, or derive from `window.location.origin`.
