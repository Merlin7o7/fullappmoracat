# Moraqat (مرقط) 🐾

Saudi cat-essentials **subscription platform** — intelligently-sized cat food, litter and treats delivered monthly across **Jeddah** and **Riyadh**.

> Production-grade SaaS, built as real vertical slices. This repository currently contains the **Foundation + Design System** milestone.

---

## Monorepo layout

```
moraqat/
├── apps/
│   ├── web/          Next.js 14 (App Router) — guest site + portals. RTL/LTR, dark mode.
│   └── api/          NestJS 10 REST API — Swagger, rate-limiting, helmet, Prisma.
├── packages/
│   ├── db/           Prisma schema (60+ models), migrations, seed (from financial model).
│   └── ui/           Design system — tokens, Tailwind preset, glassmorphism components.
├── docker-compose.yml    PostgreSQL 16 + Redis 7
├── turbo.json            Turborepo pipeline
└── pnpm-workspace.yaml
```

## Tech stack

| Layer | Choice |
|-------|--------|
| Web | Next.js 14, React 18, TypeScript (strict), Tailwind, Framer Motion, React Query |
| API | NestJS 10, REST + Swagger/OpenAPI, class-validator, Throttler, Helmet |
| Data | PostgreSQL 16, Prisma 5, Redis 7 |
| Design | Custom token system (HSL vars), dark/light, Arabic RTL, `class-variance-authority` |

## Prerequisites

- Node.js ≥ 20.11
- pnpm ≥ 9 (`corepack enable`)
- **No Docker required** — an embedded PostgreSQL binary is used for local dev.
  (Docker is still supported via `pnpm docker:up` if you prefer.)

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Environment
cp .env.example .env        # (Windows: copy .env.example .env)

# 3. Start local Postgres — no Docker needed. Leave this terminal running.
pnpm db:local               # embedded Postgres on :5432, data in packages/db/.pgdata

# 4. In a second terminal — create the schema + seed (from the financial model)
pnpm db:build               # generate Prisma client + compile @moraqat/db
pnpm db:push
pnpm db:seed

# 5. Run everything (web :3000, api :4000)
pnpm dev
```

> First run of `pnpm db:local` downloads a ~30 MB Postgres binary and initialises
> the cluster in **UTF-8** (required for Arabic). Subsequent runs are instant and
> reuse the seeded data.

- Web: http://localhost:3000
- API: http://localhost:4000/api  · Swagger: http://localhost:4000/api/docs
- Health: http://localhost:4000/health
- Prisma Studio: `pnpm db:studio`

## What's in this milestone

- ✅ Monorepo + Docker + Turborepo pipeline
- ✅ **Enterprise database schema** — 60+ normalised models across identity/RBAC, cats,
  catalog, subscriptions, commerce, wallet/loyalty, delivery, support, inventory, CMS, system
- ✅ **Design system** — tokens, glassmorphism, soft shadows, dark/light, Arabic RTL, core components
- ✅ **Marketing homepage** — floating glass nav, hero, plans (wired to the financial model), features
- ✅ **API shell** — health probe + live `/api/plans` reading from the DB, Swagger docs, rate-limiting, helmet
- ✅ **Seed** — plans, prices, COGS and box contents straight from `Moraqat_Financial_Model.xlsx`

## Business model reference

Pricing Model v2 (value-first, market-benchmarked; all SAR, per month per household —
the base price covers the first cat, each additional cat adds the tier's module, up to 6 cats):

| Plan | Tier enum | Price/mo | + per extra cat |
|------|-----------|---------|-----------------|
| Kitten · قطتي الصغيرة | `KITTEN` | 199 | 180 |
| Essentials · الأساسيات | `STARTER` | 219 | 180 |
| Complete · العناية الكاملة | `STANDARD` | 329 | 280 |
| Signature · التوقيع | `PREMIUM` | 479 | 400 |

Prepaid terms: 1/3 months at base, 6 months −5%, 12 months −8%. Full economics,
invariants and the household-box model: `design/MRC-FIN-002-PRICING-MODEL-V2.md`.

## Testing & CI

```bash
pnpm test        # unit tests (feeding engine — vitest)
pnpm e2e         # cross-domain API smoke suite (needs DB pushed+seeded and API built)
```

The E2E harness (`apps/api/e2e/run.mjs`) boots the built API against `DATABASE_URL`,
waits for `/health`, runs `smoke.mjs` (auth, feeding, checkout, webhooks, refunds,
RBAC, CMS, support — 24 assertions), and tears down.

GitHub Actions (`.github/workflows/ci.yml`) runs three jobs:
1. **quality** — typecheck ×4, unit tests, API + Web (standalone) builds
2. **e2e** — the smoke harness against a real Postgres 16 service container
3. **docker** — builds both production images (main branch only)

## Deployment (Docker)

Multi-stage production images live at `apps/api/Dockerfile` and `apps/web/Dockerfile`
(Next standalone output, non-root users, healthchecks). A full production-shaped
stack — Postgres, Redis, API, Web:

```bash
POSTGRES_PASSWORD=… JWT_ACCESS_SECRET=… JWT_REFRESH_SECRET=… \
  docker compose -f docker-compose.prod.yml up --build
```

On first deploy, apply the schema + seed from any machine with repo access:
`pnpm db:push && pnpm db:seed` (pointing `DATABASE_URL` at the stack's Postgres).

## Roadmap (next milestones)

1. **Auth & customer core** — JWT/2FA, cats CRUD, smart feeding engine
2. **Storefront** — products, cart, checkout, subscription builder
3. **Customer portal** — dashboard, orders, wallet, loyalty
4. **Admin panel** — analytics, catalog, inventory, CMS, RBAC
5. **Payments** — Mada/Tabby/Tamara/STC adapters (mock → live)

_Payment & notification providers currently run in **mock mode** (`PAYMENTS_MODE=mock`); swap in live keys to go production._
