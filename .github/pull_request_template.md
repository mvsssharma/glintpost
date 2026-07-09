<!-- Thanks for contributing! Keep PRs focused — one logical change per PR. -->

## What & why

<!-- What does this change, and what problem does it solve? Link any related issue: "Closes #123". -->

## How was it tested?

<!-- Describe how you verified the change (manual steps, new tests, etc.). -->

## Checklist

- [ ] `npm run lint` passes (zero warnings)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] Touched build/Docker/deps/env/migrations? → verified the Docker path (`docker build` + clean `docker compose up`, health check 200)
- [ ] Added/updated tests where it makes sense
- [ ] No secrets committed; new env vars documented in `.env.example`
- [ ] Docs updated if behavior/config changed (README / CLAUDE.md / constitution)
