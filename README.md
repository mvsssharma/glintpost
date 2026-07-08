# GlintPost 🌟

GlintPost is an open-source, multi-tenant product communication platform. It provides unified widgets for **Changelogs, Roadmaps, and User Feedback** that you can embed directly into your customer-facing websites. 

Whether you are a solo founder or an agency managing multiple products, GlintPost helps you keep your users in the loop and gather valuable insights.

---

## 🚀 Features

- **Multi-Tenant Architecture:** Manage multiple products or organizations from a single dashboard.
- **Changelog Widget:** Keep users updated with rich-text product announcements and updates.
- **Interactive Roadmaps:** Let your users suggest and vote on upcoming features.
- **Feedback Collection:** Gather context-rich feedback directly from your app.
- **Next.js & Prisma:** Built on a modern, blazing-fast tech stack.
- **Frictionless Self-Hosting:** Deploy anywhere in minutes with Docker.

---

## 🐳 Quick Start (Self-Hosting via Docker)

The easiest way to run GlintPost locally or on your own server is using Docker.

1. Clone the repository:
   ```bash
   git clone https://github.com/mvsssharma/glintpost.git
   cd glintpost
   ```
2. Create your environment variables:
   ```bash
   cp .env.example .env
   # For self-hosting, keep ENABLE_BILLING=false in .env and set APP_URL to your public URL
   ```
3. Start the stack (Next.js app + PostgreSQL database):
   ```bash
   docker compose up -d --build
   ```
4. Access the dashboard at `http://localhost:3000`. 
   
*(Note: Database migrations run automatically on startup!)*

The bundled `docker-compose.yml` runs **everything you need** — the app, a PostgreSQL database, and local file storage for image uploads — with **no external accounts required**. Everything below is optional and only needed if you want to plug in your own managed services.

---

## ⚙️ Configuration

All configuration is done through environment variables (see [`.env.example`](.env.example)). GlintPost is designed so a single build can be pointed at any environment — **all deployment-specific values are read at runtime**, so you never need to rebuild the image to change a URL, flag, or credential.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. |
| `DIRECT_DATABASE_URL` | ⚠️ | Direct (non-pooled) connection, used only for migrations. Required if `DATABASE_URL` points at a connection pooler (e.g. Supabase pgBouncer, Neon pooled). Falls back to `DATABASE_URL` if unset. |
| `AUTH_SECRET` | ✅ | Secret for signing sessions & encrypting tokens. Generate with `openssl rand -base64 32`. |
| `AUTH_URL` | ✅ | Public base URL used by the auth layer, e.g. `https://updates.yourcompany.com`. |
| `APP_URL` | ✅ | Public base URL of the app. Used for email links and embed snippets. Usually the same as `AUTH_URL`. |
| `STORAGE_DRIVER` | – | `local` (default when no S3 is set) stores uploads on disk; `s3` uses an object store. |
| `UPLOAD_DIR` | – | Directory for the local storage driver. Defaults to `./data/uploads` (a mounted volume in Docker). |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_URL` | – | Object storage config — only when `STORAGE_DRIVER=s3`. Works with Cloudflare R2, AWS S3, MinIO, Backblaze B2, etc. |
| `RESEND_API_KEY` | – | Email provider ([Resend](https://resend.com)). If omitted, verification/reset links are printed to the server console. |
| `ENABLE_BILLING` | – | `false` hides billing (recommended for self-hosting). Defaults to enabled. |
| `REQUIRE_EMAIL_VERIFICATION` | – | `true` forces email verification before login. Defaults to `false` (frictionless self-host). |
| `LOG_LEVEL` | – | Pino log level. Defaults to `info`. |
| `AUTH_TRUST_HOST` | – | Set to `true` when running behind a reverse proxy (nginx, Caddy, Traefik) so the auth layer trusts the forwarded host. |

### 📧 Email

By default the Docker setup uses `REQUIRE_EMAIL_VERIFICATION=false` — a frictionless, instant setup where email verification is bypassed entirely. No email provider needed to get started.

If you forget your password and haven't configured a `RESEND_API_KEY`, just trigger a password reset and check the server console (`docker compose logs web`) to grab your secure reset link.

To send real emails, sign up for [Resend](https://resend.com), verify your sending domain, and set `RESEND_API_KEY`.

### 🗄️ Use your own database (managed Postgres)

The bundled `docker-compose.yml` starts a Postgres container for you. To use an external managed database instead (Supabase, Neon, RDS, Railway, your own server, etc.):

1. Point the app at your database in `.env` (or the compose `environment:` block):
   ```bash
   DATABASE_URL=postgresql://user:password@your-db-host:5432/glintpost
   # If your provider uses a connection pooler, also set the DIRECT (non-pooled) URL —
   # migrations cannot run over a pooler:
   DIRECT_DATABASE_URL=postgresql://user:password@your-db-host:5432/glintpost
   ```
2. Remove the bundled database so it doesn't also start. In `docker-compose.yml`, delete (or comment out) the `db:` service, the `depends_on:` block under `web`, and the `postgres_data` volume.
3. Start just the app:
   ```bash
   docker compose up -d --build web
   ```

Migrations run automatically on startup (`prisma migrate deploy` via the entrypoint), so a fresh database is initialized for you — no manual step required.

### 🖼️ Use your own object storage (S3 / Cloudflare R2)

By default, image uploads are stored on a local Docker volume (`uploads_data`) and served by the app — **no cloud account needed**. This is great for most self-hosters.

If you'd rather offload images to an external, CDN-backed object store (recommended once you have many images or multiple app instances), switch to the `s3` driver. It works with any S3-compatible provider — **Cloudflare R2**, AWS S3, MinIO, Backblaze B2, DigitalOcean Spaces.

**Cloudflare R2 example:**

1. Create an R2 bucket in the Cloudflare dashboard (e.g. `glintpost-uploads`).
2. Enable public access — turn on the bucket's public `r2.dev` URL, or attach a custom domain (e.g. `cdn.yourcompany.com`). That URL becomes `S3_PUBLIC_URL`.
3. Create an R2 API token with **Object Read & Write** and copy the Access Key ID + Secret.
4. Set these in `.env` (or the compose `environment:` block) and remove `STORAGE_DRIVER=local`:
   ```bash
   STORAGE_DRIVER=s3
   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   S3_BUCKET=glintpost-uploads
   S3_ACCESS_KEY_ID=<your-access-key-id>
   S3_SECRET_ACCESS_KEY=<your-secret-access-key>
   S3_PUBLIC_URL=https://cdn.yourcompany.com   # or the pub-xxxx.r2.dev URL
   ```
5. (Optional) Drop the `uploads_data` volume from `docker-compose.yml` since it's no longer used.

> **AWS S3 note:** `S3_ENDPOINT` is `https://s3.<region>.amazonaws.com`, and the bucket needs a policy allowing public `s3:GetObject` (R2 handles public access at the bucket level instead). No bucket CORS config is required — uploads happen server-side and images load via plain `<img>` tags.

### 🔒 Production checklist

- **Generate a real `AUTH_SECRET`** (`openssl rand -base64 32`) — never ship the quickstart default.
- Set `APP_URL` and `AUTH_URL` to your real `https://` domain.
- Behind a reverse proxy? Set `AUTH_TRUST_HOST=true` and forward `X-Forwarded-*` headers.
- Change the default Postgres credentials in `docker-compose.yml` (or use an external database).
- Set `ENABLE_BILLING=false` unless you've configured Razorpay.

---

## 💻 Local Development

If you want to contribute or run the app manually using Node.js:

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Setup your environment:**
   Create a `.env` file from `.env.example` and ensure `DATABASE_URL` points to a valid PostgreSQL instance.
3. **Apply database migrations:**
   ```bash
   npx prisma migrate deploy   # Creates the schema (use `migrate dev` if you're changing it)
   ```
4. **Start the dev server:**
   ```bash
   npm run dev        # Starts server at http://localhost:3000
   ```

---

## 📚 Documentation

For deep dives into our product decisions, architecture, and roadmap, check out the `constitution/` directory:
- **[mission.md](constitution/mission.md)** — Problem statement, target audience, and product strategy.
- **[architecture.md](constitution/architecture.md)** — Tech stack, directory structure, and database models.
- **[roadmap.md](constitution/roadmap.md)** — Live features, planned features, and delivery phases.

---

## 🤝 Contributing

We welcome contributions! Please check out the issues tab or submit a pull request. 

## 📄 License
This project is open-source and available under the [MIT License](LICENSE).
