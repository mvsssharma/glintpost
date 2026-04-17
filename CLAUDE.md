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
```

**Always run `npm run build` locally before pushing to main/staging.**

## Critical Rules

- **No infinite request loops from widget preview pages.** The public pages (`/changelog`, `/board`, `/survey`) are loaded inside iframes by both the preview page and production widgets. Any `useEffect`, `postMessage` listener, or API call on these pages must be guarded against re-render loops (e.g. missing dependency arrays, effect ↔ state ping-pong, or parent ↔ iframe message cycles). Always verify that switching widgets in the preview page and opening/closing slideovers does not produce runaway network requests.
- **Always read Next.js docs before coding.** Find and read the relevant doc in `node_modules/next/dist/docs/`. Training data may be outdated — the docs are the source of truth.

## Environment Variables

```
DATABASE_URL              # PostgreSQL connection string
AUTH_SECRET               # JWT + encryption secret
AUTH_URL                  # NextAuth redirect base URL
RESEND_API_KEY            # Email (optional in dev — logs to console)
S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_PUBLIC_URL
RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_PLAN_ID, RAZORPAY_WEBHOOK_SECRET
NEXT_PUBLIC_APP_URL       # Public app URL
```
