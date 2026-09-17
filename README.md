# Moracat (مُراقط) 🐾

Saudi cat-care **membership platform**: every cat gets a **Cat ID** and a living
health record that partner clinics write into; owners keep it, reminders bring
them back to their clinic, and a monthly essentials box is the recurring engine.
Arabic-first, RTL-native, mobile-first. The design constitution is
`design/DESIGN-AUTHORITY.md` — read it before touching any surface.

## Monorepo layout

```
moracat/
├── apps/
│   ├── web/          Next.js 14 (App Router) — public site, owner portal, vet portal, admin
│   └── api/          NestJS 10 REST API — Prisma, Swagger, throttling, helmet, cron jobs
├── packages/
│   ├── db/           Prisma schema + hand-written additive migrations + seeds
│   ├── core/         Pure rules shared by web + api (feeding engine, pricing, events, claim, dunning…)
│   └── ui/           Design system — tokens, Tailwind preset, primitives
├── design/           Design authority, strategy + product dossiers (MRC-*)
├── docs/archive/     Past audits (historical; superseded by the code and MRC-PROD-001)
├── render.yaml       API service (Render)      apps/web/vercel.json   Web (Vercel)
└── turbo.json · pnpm-workspace.yaml
```

## Tech stack

| Layer | Choice |
|-------|--------|
| Web | Next.js 14, React 18, TypeScript (strict), Tailwind, Framer Motion, TanStack Query |
| API | NestJS 10, REST + Swagger, class-validator, Throttler, Helmet, @nestjs/schedule |
| Data | PostgreSQL (Neon in prod, embedded Postgres locally), Prisma 5 |
| Files | Cloudflare R2 (S3 API); private objects only ever leave through signed links |
| PDF | @react-pdf/renderer + bundled Noto Naskh Arabic (no Chromium in the API image) |

## Getting started

```bash
pnpm install
cp .env.example .env          # Windows: copy .env.example .env
pnpm db:local                 # embedded Postgres on :5432 (leave running)
pnpm db:build && pnpm db:migrate:deploy && pnpm db:seed
pnpm dev                      # web :3000 · api :4000 · swagger :4000/api/docs
```

Prerequisites: Node ≥ 20.11, pnpm ≥ 9 (`corepack enable`). No Docker needed.

## Where the main systems live

| System | API | Web |
|---|---|---|
| Cat ID, owner health record, privacy, lost mode, certificate | `apps/api/src/cats`, `certificates`, `public-cats` | `apps/web/app/portal/cats/[id]/*`, `app/c/[token]`, `app/certificates/verify` |
| Vet portal (patients, visits, clinical entries, attachments, claims, consent) | `apps/api/src/vet/*` | `apps/web/app/vet/*`, `components/vet/*`, `lib/vet-api.ts` |
| Memberships, checkout, opt-in auto-renew, dunning, refunds | `subscriptions`, `payments`, `lifecycle` | `app/portal/checkout`, `app/portal/subscriptions`, `components/checkout/*` |
| Reminders, term-end notices, graceful lapse (hourly cron) | `lifecycle/lifecycle.service.ts` (under `withJobLock`) | — |
| Notifications + email copy | `notifications/notifications.messages.ts`, `mail/mail.templates.ts` | — |
| Product analytics + nightly metrics (CVAC) | `events`, `admin/metrics.service.ts` | `lib/track.ts`, `app/admin` |
| Signed private-file links | `files` | — |
| Community, census, admin | `community`, `census`, `admin` | `app/community`, `app/admin` |

**Permissions model.** Owners: JWT, every cat route resolves the cat through
`ownedCat(userId, catId)` (404 across accounts). Clinics: `VetStaffGuard`
resolves a `VetActor` from the `x-moracat-org` header; each route declares a
`@VetCapability(...)` from `packages/core/src/vet-permissions.ts` (role matrix,
sandbox and counter-mode restrictions). Record reads are governed by owner
consent tiers; every read of a clinical record or attachment is logged.
Admin: `@Permission("x.read|write")` per route. Commerce: `@Commercial()` +
`COMMERCE_ENABLED` fail-closed kill-switch.

## Business model reference

Pricing Model v2 (all SAR / month / household; the base covers the first cat,
each additional cat adds the tier's module, up to 6): Kitten 199 (+180),
Essentials 219 (+180), Complete 329 (+280), Signature 479 (+400). Terms 1/3
months at base, 6 months −5 %, 12 months −8 %. Auto-renew is **opt-in** on a
stored card (never on Tamara). Full economics: `design/MRC-FIN-002-PRICING-MODEL-V2.md`.
Strategy: `design/MRC-STRAT-001-five-year-strategy.html`; product roadmap and
ticket map: `design/MRC-PROD-001-strategy-to-product-gap.html`.

## Testing & CI

```bash
pnpm -w typecheck                          # every package
pnpm --filter @moraqat/web lint
pnpm --filter @moraqat/core test && pnpm --filter @moraqat/api test && pnpm --filter @moraqat/web test
pnpm --filter @moraqat/api build && pnpm e2e   # two-pass API smoke: commerce ON, then commerce OFF
```

`pnpm e2e` (`apps/api/e2e/run.mjs`) boots the **built** API (`dist/main.js`)
against `DATABASE_URL`, waits for `/health`, runs `smoke.mjs` then
`commerce-off.mjs`, and tears down. Run it against a fresh database (locally:
create `moraqat_e2e`, migrate, point `DATABASE_URL` at it) — stale catalog data
makes one box-options assertion flaky. GitHub Actions (`.github/workflows/ci.yml`)
runs **quality** (typecheck, web lint, unit tests, builds), **e2e** (Postgres
service container) and **docker** (main only).

## Deployment

Production is **Vercel (web) + Render (API, Docker) + Neon (Postgres) + R2 (files)**;
push to `main` deploys both. Every step, DNS included, is in [`DEPLOY.md`](DEPLOY.md).
Migrations are additive and hand-written (`packages/db/prisma/migrations`);
run `prisma migrate deploy` against the direct (non-pooled) URL.

## Schema-only models — technical debt

The Prisma schema was written ahead of the product (127 models). **39 of them are
referenced by no code** — no service, seed, e2e or web type touches them. They
stay because dropping tables is irreversible and some (wallet, loyalty, shipments,
inventory) are on the roadmap; but nothing enforces their shape, so treat them as
untested. Recomputed 2026-09-17 by grepping `prisma.<model>` / `tx.<model>` use:

`ProductVariant`, `ProductImage`, `ProductVideo`, `Ingredient`, `ProductIngredient`, `NutritionFact`, `Tag`, `ProductTag`, `RelatedProduct`, `ProductReview`, `ProductQuestion`, `WishlistItem`, `RecentlyViewed`, `SubscriptionItem`, `GiftCard`, `WalletTransaction`, `LoyaltyTransaction`, `Badge`, `UserBadge`, `Referral`, `DeliveryZone`, `Driver`, `Shipment`, `ShipmentEvent`, `ReturnRequest`, `StockMovement`, `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `Page`, `Banner`, `Influencer`, `JobPosting`, `SeoMeta`, `Setting`, `Integration`, `ApiKey`, `Webhook`, `OfflinePassKey`

Before building on one, expect to revise it. Before dropping one, confirm the
production table is empty.

## Known gaps

- `apps/api` has a `lint` script but no ESLint config/deps — it fails; the web
  app is linted, the API is type-checked only.
- SMS goes through Twilio only when keys are set; claim/found SMS additionally
  sit behind `CLAIM_SMS_ENABLED` / `FOUND_SMS_ENABLED` pending counsel.
- Apple Wallet passes need the Apple Developer certificate chain.
