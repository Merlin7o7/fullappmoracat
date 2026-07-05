# Moracat — Production-Readiness Audit

**Date:** 2026-07-04
**Scope:** Full platform — web (Next.js 14 / Vercel), API (NestJS 10 / Render), DB (Prisma / Postgres / Neon), design system, payments, infra, business logic, security, UX, legal.
**Method:** Source-read audit across five specialist passes (backend/security, web/UX, infra/ops, business-logic/payments, design). Nothing assumed complete; every claim traced to code.

---

## Launch-Readiness Score: **54 / 100**

> **Verdict: NOT ready to accept real users, real payments, or real orders.**
> The *engineering quality of what exists* is high (top-decile auth, RBAC, validation, design system, CI). But the **money path — the entire point of a commerce platform — is simulated end to end**: payments run in mock mode, subscriptions never bill, membership activates for free, and wallet/gift-card "payments" always approve without moving money. These are not polish gaps; they are "the product does not actually transact" gaps.

### Scorecard by dimension

| Dimension | Score | Notes |
|---|---:|---|
| Architecture & code quality | 85 | Clean monorepo, strong module boundaries, real handlers (no stubs) |
| Authentication | 82 | bcrypt-12, refresh rotation + reuse detection, TOTP 2FA, Google verify — genuinely strong |
| Authorization (RBAC + ownership) | 72 | Global default-deny guards, real RBAC; **one cart IDOR** drags it down |
| Design system & UX polish | 88 | Token-driven, Lyon/Latin type, real Cat ID ceremony — the standout |
| Customer web app | 70 | Nearly all pages wired to real APIs; missing cart/checkout/legal, client-only route guard |
| Admin dashboard | 60 | Real & functional, but list-only (no detail views), English-only, no pagination UI |
| **Payments (real money)** | **10** | **Mock mode hardcoded in prod; wallet/gift-card bypass; no real charge in the live path** |
| **Subscription / recurring billing** | **8** | **No scheduler exists — subscriptions never bill even once** |
| Inventory & fulfillment | 12 | Schema-only; no stock check, no decrement, no shipment creation |
| Checkout integrity | 35 | No idempotency (double-charge), no stock reservation, charge-before-persist window |
| Database ops | 40 | No migrations (manual `db push`), no pooling, no backups/DR |
| Observability | 15 | No Sentry, no alerting, no uptime monitor, ephemeral logs |
| Scalability | 30 | Redis declared-but-unused, in-memory throttle, no object storage, free-tier SPOFs |
| Notifications | 25 | In-app DB rows only; **no transactional email/SMS** (OTP via Twilio is the exception) |
| Testing | 15 | One unit test + a smoke harness for ~86 models |
| SEO | 30 | Good root metadata; no per-page meta, no sitemap/robots |
| Accessibility | 65 | Strong intent (ARIA, reduced-motion), a few real gaps (focus trap, dead buttons) |
| Legal / compliance | 10 | No privacy/terms/refund pages; linked-but-404; no PDPL/ZATCA posture |

*Score is weighted toward launch-blocking capability, not lines of code. A platform that cannot take money scores low regardless of how well the rest is built.*

---

## The Big Picture

Moracat is a **beautifully engineered shell around an enterprise-grade schema, with the commercial engine not yet connected.** Three independent audits converged on the same root story:

1. **~86 Prisma models exist; roughly half have no service/controller behind them.** The schema is aspirational. The implemented half (users, cats, auth, cart, orders, checkout, subscriptions-lifecycle, refunds, content, support, RBAC) is real and well-built.
2. **Every place real money should move, it doesn't.** `PAYMENTS_MODE=mock` is hardcoded in `render.yaml`; there is no recurring-billing scheduler; membership goes ACTIVE with no payment; `WALLET`/`GIFT_CARD` checkout routes to the always-approve mock provider.
3. **The operational substrate for a live product is missing:** no committed migrations, no monitoring, no transactional email, no object storage, no distributed rate limiting, near-zero tests.

The good news: because the foundations (auth crypto, guards, validation, design tokens, CI) are genuinely strong, the remaining work is **additive and well-scoped**, not a rewrite.

---

# 1. CRITICAL — Must fix before launch (blockers)

Each of these alone blocks taking real customers/money.

### C1. Payments run in mock mode in production
- `render.yaml:17-18` hardcodes `PAYMENTS_MODE=mock`. Live Render API "charges" through the in-repo sandbox. Any successful checkout is fake.
- **Fix:** Set `PAYMENTS_MODE=live` with real Moyasar (card/mada/Apple Pay/STC) + Tabby + Tamara credentials and webhook secrets, all via dashboard secrets. Verify each adapter against sandbox, then production keys.

### C2. No recurring-billing engine — subscriptions never bill
- No `@nestjs/schedule`, no `@Cron`, no queue, no `setInterval` anywhere in `apps/api/src`. `Subscription.nextBillingAt`/`nextDeliveryAt` are written but never *read* to charge or generate orders. (`subscriptions.service.ts`)
- Subscriptions are also created `status: ACTIVE` with **no charge at all** (`subscriptions.service.ts:66`) — not even the first payment.
- **Fix:** Build a scheduler (BullMQ on Redis, or `@nestjs/schedule` for a single instance) that (a) charges the first cycle at creation, (b) advances `nextBillingAt`, charges the PSP, creates the recurring `Order`, handles `PAST_DUE`/retry/dunning, and respects pause/skip/vacation.

### C3. Membership activates for free (gating bypassed)
- `POST /subscriptions` sets subscription ACTIVE with no payment, then `syncCatsMembership` flips every covered cat's `membershipStatus` to ACTIVE (`subscriptions.service.ts:102,192-201`). `cats.service.restore()` also hard-sets ACTIVE (`:282`). Any user can grant themselves full membership for free.
- Nothing downstream actually consumes `membershipStatus` to gate benefits — it's a display label.
- **Fix:** Gate membership activation on a *captured payment*, not subscription status. Enforce `membershipStatus` at every benefit boundary.

### C4. Wallet & gift-card "payments" always approve without moving money
- `WALLET` and `GIFT_CARD` are accepted checkout providers but route to the mock provider (`payment-provider.factory.ts:54-57`), which always approves. Balances are never checked or debited. Free successful orders.
- **Fix:** Either implement real wallet-debit / gift-card-redeem logic (balance check + atomic decrement + ledger row) or **remove these providers from the checkout allow-list** until implemented.

### C5. Default JWT secrets fall back to `"change-me-*"` with no boot check
- `auth.service.ts:40-41`, `jwt.strategy.ts:19` default to publicly-known secrets. If env is unset, the app boots and **anyone can forge admin JWTs**. No fail-fast.
- **Fix:** Assert at bootstrap that `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` are set, ≥32 bytes, and not the default, in production — crash otherwise.

### C6. Cart IDOR + checkout against arbitrary carts
- `CartController` is entirely `@Public()` and `CartService` never checks ownership. `checkout.service.ts:33` accepts any `cartId` with no ownership check (only `addressId` is verified). An authenticated user can check out someone else's cart. (`cart.controller.ts:16`, `checkout.service.ts:33-37`)
- **Fix:** Bind carts to user/session; verify `cartId` ownership at checkout; scope all cart reads/writes by owner.

### C7. No stock check or inventory decrement — oversell guaranteed
- Nothing in add-to-cart, checkout, or webhook consults `InventoryItem.quantity`/`reserved`. You can order unlimited quantity of an out-of-stock product; inventory is never decremented. (`cart.service.ts:74-96`, `checkout.service.ts`)
- **Fix:** Reserve stock at checkout (atomic conditional decrement), release on failure/expiry, decrement on capture, write `StockMovement` rows.

### C8. No checkout idempotency — double-submit double-charges
- No idempotency key; `orderNumber` generated fresh per call. A double-click / retry charges the PSP twice and creates two orders + two invoices. (`checkout.service.ts:178-182`)
- **Fix:** Require an `Idempotency-Key` header (or derive from cart+user), dedupe atomically before charging.

### C9. No transactional email — password resets and confirmations never reach users
- `NotificationsService.notify` writes only in-app DB rows. Password-reset "email," order confirmation, and support replies are never emailed/SMS'd. In prod, the reset token lands in a portal notification the user can't reach out-of-band. (SMS OTP via Twilio is the one real channel.)
- **Fix:** Wire an email provider (Resend/SES/Postmark) + templates for reset, verification, order confirmation, invoice, subscription receipts, dunning.

### C10. No committed migrations — prod schema via manual `prisma db push`
- No `packages/db/prisma/migrations/`. DEPLOY.md instructs a human to run `db push` from the Render shell. No history, no rollback, data-loss risk on drift; Dockerfile runs no migration step.
- **Fix:** Commit an initial migration, switch deploy to `prisma migrate deploy` in a release/entrypoint step, remove `db push` from the prod path.

### C11. Legal pages missing but linked (compliance blocker)
- No `/terms`, `/privacy`, `/refund`, `/shipping`, `/about` routes. Register consent checkbox links to `/terms` and `/privacy` → **404 on every signup**. (`register/page.tsx:159,161`)
- **Fix:** Author and publish Privacy Policy (PDPL-compliant), Terms, Refund/Return policy, Shipping policy, and About. Saudi commerce also needs visible CR number, VAT number, and contact details.

### C12. No observability — you'll be blind in production
- Sentry not wired (env var only, zero code refs). No alerting, no uptime monitor. On a spin-down free tier, outages are invisible; logs are ephemeral plain-text.
- **Fix:** Wire Sentry (API + web), structured JSON logging with request IDs, an uptime monitor pinging `/health` (doubles as keep-warm), and alerts.

---

# 2. HIGH PRIORITY

### Backend / correctness
- **H1. Charge-before-persist window** — PSP is charged before the DB `$transaction`; a DB failure captures money with no order/payment row and no auto-void. Add a compensating void, or persist a PENDING intent first. (`checkout.service.ts:55`)
- **H2. Order vs Invoice subtotal disagree** — `Order.subtotal` is gross (VAT-inclusive), `Invoice.subtotal` is net; `Order.subtotal + taxTotal ≠ grandTotal`. Finance exports off `orders` will mis-state VAT. Normalize order totals to net + VAT + shipping = grand. (`checkout.service.ts:95-96,124`)
- **H3. Stale-price / deleted-product checkout** — checkout trusts the cart's `unitPrice` snapshot and never re-validates live price or `isActive`/`deletedAt`. Re-price and re-validate items at checkout. (`checkout.service.ts`, `cart.service.ts:92`)
- **H4. Coupon `perUserLimit` unenforced + racy `redeemedCount`** — per-user cap never checked; the global-cap increment is check-then-write (not atomic) → over-redemption under concurrency. Enforce per-user usage and use an atomic conditional update. (`cart.service.ts:114-128`, `checkout.service.ts:134-138`)
- **H5. Abandoned redirect orders stuck PENDING forever + cart already cleared** — no reaper to void stale PENDING; shopper loses cart on abandonment. Add a timeout job and defer cart clearing until capture.
- **H6. No graceful shutdown** — `enableShutdownHooks()` not called; SIGTERM drops in-flight requests and skips Prisma cleanup. (`main.ts`)
- **H7. Mock webhook secret defaults to a public constant** (`webhooks.service.ts:86`) — if a deploy stays in mock mode, an attacker can mark orders CAPTURED. Guaranteed moot once `PAYMENTS_MODE=live` (C1).

### Infra / scalability
- **H8. No Prisma connection pooling for Neon** — plain `DATABASE_URL`; under load, connection exhaustion. Use the Neon pooled (`-pooler`, `pgbouncer=true`) URL.
- **H9. No object storage** — `S3_*` are placeholders, referenced nowhere. Cat photos / generated assets have no durable home on Render's ephemeral disk. Wire S3/R2 with signed uploads.
- **H10. Redis declared but unused** — in-memory throttler resets on cold start and is per-instance; no cache, no queue. Back the throttler (and the C2 scheduler) with Redis.
- **H11. No DB backups / DR plan** — Neon free retention is short; no export/restore procedure. Configure PITR/backups and document restore.

### Security / access
- **H12. Client-side-only route protection** — no `middleware.ts`; `/portal` and `/admin` (incl. `isStaff`) guard via post-hydration `useEffect` redirects; protected code ships to unauthenticated clients. Add server middleware; the API is the real gate but the web should not ship admin bundles to anon users. (`portal/layout.tsx`, `admin/layout.tsx`)
- **H13. Refresh + access tokens in `localStorage`** — XSS-exfiltratable. Move at least the refresh token to an httpOnly, Secure, SameSite cookie. (`auth.tsx:97`)
- **H14. Seeded default admin `admin@moraqat.sa / Admin!2026`** — known-credentials backdoor if the seed touches prod. Gate seed to non-prod; rotate/force-reset on first prod login. (`seed.ts:222`)

### Product completeness (customer-facing)
- **H15. No cart or checkout UI** — the products page renders a dead "Add to cart" button; there is no `/cart` or `/checkout` route. The storefront cannot actually sell one-off products.
- **H16. Order invoice download is a dead button** (`orders/page.tsx:57`) — no receipts (violates the design authority's "receipts instantly").
- **H17. Portal/admin pages have no error state** — API failures render endless skeletons or silent zeros, never a retry. Add error UI to authed react-query calls.

---

# 3. MEDIUM PRIORITY

- **M1. Email verification flow absent** — `emailVerified` only set via Google; no verification email for email/password signups. Add verify-email endpoint + email.
- **M2. No account lockout / brute-force protection** on login beyond the global 120/min/IP; add per-account attempt counting and tighter limits on login/reset/OTP.
- **M3. Address management incomplete** — no edit, no set-default, no error UI; raw un-clienced `fetch` for cities. (`portal/addresses/page.tsx`)
- **M4. Checkout allows no delivery address & unserviceable cities** — `addressId` optional; city `isActive`/delivery-zone never validated. Require a serviceable address for physical orders.
- **M5. Refunds never credit wallet; `ReturnRequest` RMA flow is schema-only; webhook REFUNDED under-records** (no `Refund` row, no order/invoice reconciliation). Build the customer return→refund pipeline.
- **M6. Float money math throughout** despite `Decimal(10,2)` columns — values are `Number()`-ed, computed in JS, re-wrapped. Low drift risk but not exact; move arithmetic to Decimal.
- **M7. Admin is English-only, LTR** — violates "bilingual ar/en everywhere" (R101). Decide consciously or bring to parity.
- **M8. i18n via inline `isAr ? … : …` ternaries** across portal/tools — unmaintainable; only marketing uses the dictionary. Consolidate to the dict; consider URL-based locale (`/en`), which is currently referenced in metadata but 404s.
- **M9. SSR `<html lang="ar">` is fixed**, corrected only client-side — EN users get Arabic-declared HTML; hurts SEO/screen readers.
- **M10. No per-page metadata, no `sitemap.ts`, no `robots.ts`, no `manifest`** — every route inherits the root title; blog/products unindexable. Add `generateMetadata` + sitemap/robots.
- **M11. Next image `remotePatterns` wildcard host (`"**"`)** — optimizer SSRF/bandwidth-abuse vector. Restrict to known hosts.
- **M12. Admin lacks detail views & pagination UI** — list-only for customers/orders/products despite paginated APIs.
- **M13. No admin CRUD for coupons, categories, brands, tags, banners, inventory, shipments** — many "management systems" from the brief are schema-only.
- **M14. Ceremony dialog lacks a focus trap** (`cat-id-ceremony.tsx`) — focus escapes behind the modal.
- **M15. Home-page plans hardcoded** (`lib/plans.ts`) while subscribe fetches live `/plans` — two pricing sources that can diverge.
- **M16. Swagger `/api/docs` exposed in production** — gate behind auth or disable in prod.
- **M17. No lint gate in CI; CI validates `db push` not migrations; no `pnpm audit`/Dependabot/secret scanning.**
- **M18. VAT/ZATCA e-invoicing posture undefined** — invoices store a `vatNumber` field but there is no ZATCA-compliant e-invoice (Fatoora) generation/QR. Required for KSA B2C at scale.

---

# 4. NICE TO HAVE / POLISH

- **N1.** Tokenize the one color escape — `StatusPill` raw `emerald-*` → `--success`. (`cat-id-card.tsx:146,149`)
- **N2.** Add `--accent-on-dark` token (orange hand-inlined 4× on the Cat ID card).
- **N3.** Extend the type scale (`2xs`/`3xs`) so the card stops reaching for `text-[10px]/[9px]/[8px]`.
- **N4.** Warm up secondary empty states (orders/subscriptions/notifications) to match the illustrated portal-home welcome (R111).
- **N5.** Unify loading idioms — skeletons for content, spinners only for button-busy/route gates.
- **N6.** Product reviews/questions, wishlist, recently-viewed, loyalty earn/redeem, referrals/badges — all schema-only; implement as growth features post-launch.
- **N7.** Skip-link to main content; tie feeding-tool slider labels via `htmlFor`/`id`; fix meaningful `alt=""` on the Cat ID photo.
- **N8.** Subscription plan-change + proration; vacation mode wiring.

---

# 5. Deliverable indexes (as requested)

### Bugs found
1. Order vs Invoice subtotal mismatch; `subtotal + tax ≠ grand` on orders (H2).
2. Double-submit double-charges (no idempotency) (C8).
3. Cart IDOR + checkout against arbitrary cart (C6).
4. Wallet/gift-card checkout always approves for free (C4).
5. Membership activates without payment; `restore()` force-activates (C3).
6. Coupon `perUserLimit` unenforced; racy `redeemedCount` (H4).
7. Stale-price / deleted-product checkout (H3).
8. Charge-before-persist can capture money with no record (H1).
9. Dead buttons: products "Add to cart", order invoice download (H15, H16).
10. Register links to 404 `/terms` & `/privacy` (C11).
11. Metadata `alternates` points at non-existent `/en` (M8).
12. Ceremony modal focus escapes (M14).
13. Abandoned redirect order stuck PENDING; cart lost (H5).
14. In-memory throttler resets on cold start / per-instance (H10).

### Missing features
Recurring billing engine (C2), real payments (C1), cart/checkout UI (H15), transactional email (C9), inventory management + stock decrement (C7), object storage (H9), wallet/gift-card/loyalty/referral logic (C4/N6), returns/RMA (M5), product reviews/Q&A (N6), ZATCA e-invoicing (M18), admin CRUD for coupons/catalog/inventory/shipments (M13), shipment/fulfillment creation, email verification (M1), legal pages (C11), sitemap/robots/per-page SEO (M10).

### Security improvements
Fail-fast JWT secrets (C5), fix cart IDOR (C6), httpOnly refresh cookie (H13), server route middleware (H12), gate/rotate seed admin (H14), account lockout (M2), `PAYMENTS_MODE=live` + real webhook secrets (C1/H7), restrict image host allow-list (M11), gate Swagger in prod (M16), dependency/secret scanning in CI (M17).

### Scalability improvements
Redis-backed throttle + cache + queue (H10), Neon connection pooling (H8), object storage/CDN (H9), background job runner (C2), upgrade off Render free (cold starts, H-tier), DB backups/DR (H11).

### Legal / compliance requirements
Privacy Policy (PDPL), Terms, Refund/Return policy, Shipping policy, About/contact, visible CR + VAT numbers, cookie consent, ZATCA Fatoora e-invoicing (M18), data-subject rights (export/delete) flow, retention policy for OTP/login history/audit logs.

### Performance optimizations
Per-page metadata + static generation for blog/products, image host restriction + proper `next/image` sizing, Redis cache for hot reads (plans, products, content), keep-warm ping to kill cold starts, avoid N+1 in subscription item creation (`subscriptions.service.ts:82-99`), tabular-nums already good.

---

# 6. Definition of Done — 100% Production Readiness

**Payments & money**
- [ ] `PAYMENTS_MODE=live`; Moyasar + Tabby + Tamara live creds & webhook secrets set and verified end-to-end.
- [ ] Recurring-billing scheduler charges first cycle + advances/charges/creates orders on `nextBillingAt`; handles retry/dunning/PAST_DUE.
- [ ] Membership activation gated on captured payment; enforced at every benefit boundary.
- [ ] Wallet debit / gift-card redeem implemented atomically (or providers removed from checkout).
- [ ] Checkout idempotency (no double-charge); stock reserved→decremented with `StockMovement`.
- [ ] Order totals net-consistent; charge/persist made atomic with compensating void.
- [ ] Refunds credit correct destination; customer returns→refund pipeline live; ZATCA e-invoices issued.

**Security**
- [ ] Fail-fast on missing/weak JWT & webhook secrets in prod.
- [ ] Cart bound to owner; checkout verifies cart ownership.
- [ ] Refresh token in httpOnly cookie; server route middleware for /portal & /admin.
- [ ] Seed admin gated to non-prod / force-rotated; account lockout live.
- [ ] Image host allow-list restricted; Swagger gated; dependency + secret scanning in CI.

**Data & ops**
- [ ] Committed Prisma migrations; `migrate deploy` in the deploy path (no `db push` in prod).
- [ ] Neon pooled connection string; backups/PITR configured; documented restore.
- [ ] Object storage (S3/R2) for uploads; Redis for throttle/cache/queue.
- [ ] Sentry (API + web), structured logging, uptime monitor + alerts, graceful shutdown.
- [ ] Off Render free tier (or accept keep-warm) so PSP webhooks don't time out.

**Product / UX**
- [ ] Cart + checkout UI; invoice download; transactional email for all lifecycle events.
- [ ] Error states on all authed pages; email verification flow.
- [ ] Address edit/set-default + serviceable-city validation.
- [ ] Admin: detail views, pagination, bilingual, coupon/catalog/inventory CRUD.
- [ ] i18n consolidated to dictionary; SSR `lang/dir` correct; sitemap/robots/per-page metadata.

**Legal**
- [ ] Privacy/Terms/Refund/Shipping/About published & linked (no 404s); CR + VAT visible; PDPL data-rights flow; cookie consent.

**Quality gates**
- [ ] Integration tests for checkout/payments/subscriptions/auth; e2e in CI; lint gate on.
- [ ] Load test the checkout + billing path; verify no oversell/double-charge under concurrency.

---

## What's genuinely excellent (keep as-is)
- Auth cryptography: bcrypt-12, SHA-256 refresh storage, rotation + reuse detection, TOTP 2FA, server-side Google verify.
- Global default-deny guards (Throttler → JWT → Permissions), real RBAC, consistent ownership checks (except cart).
- Strict global `ValidationPipe` (whitelist + forbidNonWhitelisted).
- Design system: token-driven `packages/ui`, unicode-range-scoped Lyon Arabic / Latin numerals, the two-act Cat ID ceremony, disciplined reduced-motion.
- CI: typecheck + unit + Postgres-backed e2e smoke + Docker image builds.
- Feeding engine: correct WSAVA RER/MER math, unit-safe, clamped, unit-tested.
- Refund path (admin): PSP-first, amount-validated, audit-logged, transactional.

**Bottom line:** the craftsmanship is real and high. The gap to launch is not quality — it's that the commercial engine (payments, recurring billing, inventory, membership gating) is wired to mocks, plus the operational essentials (migrations, monitoring, email, legal). Close Section 1 and the High-priority infra/security items and Moracat moves from "impressive prototype" to "can safely take money."
