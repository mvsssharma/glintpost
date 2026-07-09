# Contributing to GlintPost

Thanks for your interest in improving GlintPost! 🎉 This guide covers how to get set up and get a change merged.

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

**Prerequisites:** Node.js 20+ and a PostgreSQL database (or Docker).

The fastest path is Docker — it brings up the app + Postgres + local file storage with no external accounts:

```bash
docker compose up -d --build   # http://localhost:3000
```

To run the app directly with Node for development:

```bash
cp .env.example .env           # then fill in DATABASE_URL (+ AUTH_SECRET)
npm install
npx prisma migrate deploy      # create the schema
npm run dev                    # http://localhost:3000
```

See the [README configuration section](README.md#%EF%B8%8F-configuration) for every environment variable, and `constitution/` for architecture and product context.

## Making a change

We use a **fork → pull request** flow. Direct pushes to `main` are blocked.

1. Fork the repo and create a branch: `git checkout -b fix/short-description`
2. Make your change. Keep PRs focused — one logical change per PR is much easier to review.
3. Run the checks locally (see below) before pushing.
4. Open a PR against `main`. The CI `build` check must pass before it can be merged.

## Before you open a PR

Run the same checks CI runs — all must pass:

```bash
npm run lint          # ESLint (zero warnings)
npx tsc --noEmit      # TypeScript
npm test              # Vitest unit tests
npm run build         # prisma generate + next build
```

**If your change touches the build, Dockerfile, dependencies, environment variables, or migrations**, also verify the self-hosted Docker path (Glintpost ships as *two* distributions — Vercel and Docker — and one can break while the other is green):

```bash
docker build -t glintpost:sanity .
docker compose down -v && docker compose up -d --build   # fresh-install test
curl -so /dev/null -w "%{http_code}\n" http://localhost:3000/api/health   # expect 200
```

## Conventions

- **Follow the existing code style** — match the surrounding file (CSS Modules over inline styles, typed errors from `lib/errors.ts`, the pino `logger` over `console.*`, `getOrgPrisma` for tenant-scoped queries). See `CLAUDE.md` and `constitution/architecture.md` for the house patterns.
- **Commit messages:** short imperative summaries, optionally prefixed `feat:` / `fix:` / `chore:` / `docs:` / `ci:`.
- **Tests:** add or update tests for behavior changes where practical (unit tests live in `lib/**/*.test.ts`).
- **Don't commit secrets** — `.env` is git-ignored; use `.env.example` for new variables (documented, with safe placeholder values).

## Reporting bugs & requesting features

Use the issue templates (Bugs / Feature requests). For **security vulnerabilities**, do not open a public issue — follow [SECURITY.md](SECURITY.md).

Questions or larger proposals? Open a discussion or a feature-request issue first so we can align before you invest time.
