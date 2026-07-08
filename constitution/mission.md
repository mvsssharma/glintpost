# Mission

**The ultimate product marketing platform** — changelog, roadmap voting, and feedback widgets that embed into customer sites.

**Domain:** glintpost.com | **App:** app.glintpost.com

## Why Glintpost Exists

Tools like Canny ($275+/mo at scale), Beamer ($49+/mo + paid add-ons for feedback/NPS), AnnounceKit ($79+/mo), and Featurebase ($37+/mo with per-seat add-ons) all build **walled gardens** — their own user tracking, their own segmentation dashboards, their own analytics silos. They force customers to adopt yet another analytics platform just to show a changelog or collect feedback.

Glintpost takes the opposite approach: **a lightweight product communication layer that plugs into teams' existing data stack (GTM, datalayer variables) instead of creating a new silo.**

## Core Differentiators

- **Datalayer-native targeting:** Customers pass their existing GTM/datalayer variables directly — zero config on their side, works with what they already have. Competitors build proprietary segment builders; we reuse what's already there.
- **True GTM compatibility:** Simple `<script>` tags with `data-` attributes drop into GTM Custom HTML trivially. Designed for it, not an afterthought.
- **Unified widget system:** 5 embed modes (slideover, inline, tab, hosted, headless) across ALL three widgets (changelog, roadmap, feedback). No competitor offers this breadth across all product areas.
- **AI-powered content:** Changelog writing assistance + auto-translation (8 Indian languages) with BYO AI keys (encrypted at rest). Competitors offer manual multi-language at best.
- **Flat pricing, no per-seat:** Built for teams <5 seats sharing credentials. No tracked-user billing traps (Canny), no per-seat add-ons (Featurebase), no MAU caps (Beamer).

## Dual-Distribution Strategy

Glintpost is designed with a single codebase that seamlessly powers two distinct environments through 12-factor feature flags:
1. **Multi-Tenant Cloud (SaaS):** Hosted on Vercel, this mode strictly enforces email verification, enables Stripe/Razorpay billing, and uses a centralized email provider (Resend) to securely isolate tenants.
2. **Self-Hosted Open Source (Docker):** A frictionless, "single-player" mode. By simply flipping feature flags (e.g., `REQUIRE_EMAIL_VERIFICATION=false`), email verification is bypassed, billing is disabled, and password resets gracefully fallback to console logs. This allows self-hosters to spin up Glintpost instantly without wrestling with third-party email configurations or paying for external API keys.
## Competitive Positioning

- **Not competing on:** Analytics depth, support inbox, AI chatbots (Featurebase's direction)
- **Competing on:** Embeddability, targeting via existing data, AI-powered content, price simplicity
- **Closest competitor:** AnnounceKit ($79/mo, all three features, good widgets, segmentation) — we beat them on price + datalayer integration + Indian market focus
- **Price floor:** Sleekplan at $15/mo is cheapest but has basic widgets and no targeting — we offer far more value

## Key Product Decisions

- Open-Source First — Built for frictionless self-hosting via Docker, with optional feature-flagged billing for cloud deployments.
- No per-seat pricing — this limits revenue ceiling intentionally for the cloud version; the target market is small teams.
- Razorpay billing (Optional) — Indian market focus for the cloud-hosted version, hidden by default in open-source.
- BYO AI keys — users control their own AI costs, encrypted with AES-256-GCM.
- Consent-first design — lazy visitorId, consent API, anonymous passive tracking (GDPR-conscious).
