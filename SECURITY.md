# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Report privately through GitHub's **[Report a vulnerability](https://github.com/mvsssharma/glintpost/security/advisories/new)** button (Security tab → Report a vulnerability). This opens a private advisory visible only to the maintainers.

When reporting, please include:
- A description of the vulnerability and its impact
- Steps to reproduce (a proof-of-concept if possible)
- The affected version / commit and deployment mode (Vercel cloud or self-hosted Docker)

You can expect an initial acknowledgement within a few days. Once a fix is available we'll coordinate disclosure and credit you (unless you prefer to remain anonymous).

## Supported versions

This project is pre-1.0 and moves fast — security fixes are applied to the latest `main`. Please make sure you're running the most recent version before reporting.

## Scope & hardening notes for self-hosters

Because Glintpost can be self-hosted, a secure deployment is partly your responsibility. At minimum:
- Generate a strong, unique `AUTH_SECRET` (`openssl rand -base64 32`) — never ship the quickstart default.
- Change the default Postgres credentials in `docker-compose.yml`, or use an external managed database.
- Serve over HTTPS and set `APP_URL` / `AUTH_URL` to your real domain (set `AUTH_TRUST_HOST=true` behind a reverse proxy).
- Keep `RESEND_API_KEY`, `S3_*`, and database credentials out of version control (they belong in `.env`, which is git-ignored).

See the **Production checklist** in the [README](README.md#-production-checklist) for the full list.
