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
   git clone https://github.com/yourusername/glintpost.git
   cd glintpost
   ```
2. Create your environment variables:
   ```bash
   cp .env.example .env
   # Make sure NEXT_PUBLIC_ENABLE_BILLING is set to false in .env
   ```
3. Start the stack (Next.js app + PostgreSQL database):
   ```bash
   docker-compose up -d --build
   ```
4. Access the dashboard at `http://localhost:3000`. 
   
*(Note: Database migrations run automatically on startup!)*

### 📧 Email Configuration (Self-Hosting)
By default, the Docker setup uses `NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION=false`. This gives you a frictionless, instant setup where email verification is completely bypassed. 

If you forget your password and haven't configured a `RESEND_API_KEY` in your `.env`, simply trigger a password reset and check the Docker console (`docker compose logs web`) to grab your secure reset link!

---

## 💻 Local Development

If you want to contribute or run the app manually using Node.js:

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Setup your environment:**
   Create a `.env` file from `.env.example` and ensure `DATABASE_URL` points to a valid PostgreSQL instance.
3. **Run migrations and start the dev server:**
   ```bash
   npm run build      # Generates Prisma client and runs migrations
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
