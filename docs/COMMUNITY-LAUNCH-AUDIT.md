# Moracat — Community-Launch Readiness Audit

**Date:** 2026-07-06
**Scope:** Full platform for a **Community-Mode** launch — web (Next.js 14/Vercel), API (NestJS 10/Render), DB (Prisma/Neon), design system, infra, security, UX, accessibility, SEO. **Payments are intentionally out of scope** (hard-disabled behind the `CommerceGuard` kill-switch); they are evaluated only to confirm the switch fails closed.
**Method:** Five parallel source-read specialist passes (security/auth, core community features, customer web UX, admin, infra/ops), every claim traced to code and cross-verified.

---

> ## ✅ REMEDIATION COMPLETE (2026-07-06)
> Every finding below (Critical → Low) has since been resolved and the first-Cat-ID
> onboarding built. Committed on branch `feat/community-launch-hardening`. An
> independent 3-agent re-audit scored **9+/10 on all 11 categories**; the new
> Launch Readiness is **≈94/100**. Verified: all packages typecheck clean, web lint
> clean, **e2e smoke 54/0**, web production build passes, key flows browser-verified.
> Remaining work is purely operational (set prod secrets, verify Resend domain,
> add an uptime monitor, push+merge the branch). See the "Remediation scorecard"
> at the bottom of this file. The section below is the ORIGINAL audit, kept for
> the record.

---

## Launch Readiness Score (original): **72 / 100**

**Verdict: Launch with Minor Fixes** — *conditional on clearing the 5 Critical items (est. 5–7 working days).*

The **application layer is genuinely strong and close to ready**: the kill-switch is real and fail-closed, auth crypto is top-decile, there is **no IDOR anywhere**, the Cat ID ceremony/export is excellent, storage is correctly wired to R2, and SEO infra is complete. The gaps are concentrated in three places: (1) the **operational substrate** (no migrations, no observability, near-zero tests), (2) a few **trust-critical UX leaks** (authed pages fabricate "0 SAR saved" on API failure), and (3) **two listed features that don't actually work** (Likes/"Most Liked" don't exist; Notifications have no read path).

### Scorecard

| Category | Score | One-line |
|---|---:|---|
| Design | 9 / 10 | Token-driven, restrained, premium; the Cat ID card + ceremony are the standout |
| User Experience | 7 / 10 | Happy paths excellent; error-state leaks, locale FOUC, two broken features drag it |
| Performance | 7 / 10 | Feed is clean & indexed; `facets()` full-scan + write-in-a-read-loop + cold starts |
| Functionality | 6 / 10 | Core works; Likes missing, Notifications non-functional, admin list gaps |
| Reliability | 5 / 10 | No observability, no migrations, ~1 real test, single free-tier instances |
| Security | 8 / 10 | Strong auth, no IDOR, kill-switch solid; seed admin + trust-proxy + loose throttle dock it |
| Accessibility | 6.5 / 10 | Good intent (reduced-motion, aria, ≥44px); no focus trap, no skip link |
| Branding | 9 / 10 | Consistent, warm, "premium through subtraction"; on-message everywhere |
| Professionalism | 8 / 10 | High craft; rough edges (English-only admin, false `/en` alternate) |
| Mobile Experience | 7.5 / 10 | Thumb-zone bottom nav is great; greeting hidden on mobile, admin can't log out on mobile |
| **Overall Product Quality** | **7 / 10** | An impressively engineered identity product with a thin ops/observability layer |

---

# 🔴 CRITICAL — must fix before public launch

### CR1. Authed pages have no error state → the dashboard fabricates "0 SAR saved" and false-empty data on any API failure
Every authenticated portal query destructures only `{ data, isLoading }` — never `isError`/`refetch`. On a failed fetch the page falls through to the **welcoming empty state**: the dashboard shows "Saved 0 SAR · Orders 0 · Cats 0", orders/subs/notifications show "nothing here yet 🎉". For a trust-first membership product this is the single worst failure mode (the dossier names silently hiding value the #1 trust-killer, R041/R112). Public pages already handle `isError` correctly — the authed pages simply omit it.
**Files:** `apps/web/app/portal/page.tsx:56-60,153-236`, `orders/page.tsx:26-30`, `subscriptions/page.tsx:30-34`, `notifications/page.tsx:31-35`, `addresses/page.tsx:33-37`, `support/page.tsx:28-32`, `settings/page.tsx:32-36`
**Fix:** Add `isError`/`refetch` to each authed query; render a blameless retry state distinct from the empty state; never render a fabricated `0` value tile on error.

### CR2. Seeded super-admin `admin@moraqat.sa / Admin!2026` is not gated to non-prod
`seed.ts` upserts an `isStaff` `super_admin` with a hardcoded, publicly-known password and prints it to stdout, with no `NODE_ENV` guard. If the seed ever runs against production (common in first-deploy pipelines / `prisma db seed`), it plants a full-access backdoor — the boot assertions don't cover seed data.
**File:** `packages/db/prisma/seed.ts:204-222`
**Fix:** Wrap the admin block in `if (NODE_ENV !== "production")` or require `ADMIN_SEED_PASSWORD` with no default; never log the password.

### CR3. No committed DB migrations — production schema applied via manual `prisma db push`
`packages/db/prisma/migrations/` does not exist; DEPLOY.md and the launch checklist instruct a human to run `db push` once from the Render shell, and no deploy step applies schema at all (Dockerfile runs only `node dist/main.js`). No history, no rollback, no drift detection — a `db push` against a changed schema can silently drop columns once real user data exists.
**Evidence:** no migrations dir; `render.yaml` has no predeploy hook; DEPLOY.md:27
**Fix:** Baseline with `prisma migrate dev`, commit `migrations/`, switch deploy to `prisma migrate deploy` (Render `preDeployCommand`). Remove `db push` from the prod path.

### CR4. Notifications are non-functional end-to-end — a listed feature with no read path
`NotificationsService.notify()` only *writes* rows. There is **no notifications controller** — no `GET /notifications`, no unread count, no mark-as-read. The written rows are unreadable by any client, so `/portal/notifications` can never show real data (and, per CR1, silently renders "all caught up"). Worse, `notify()` is never called for any **Community-Mode event** (Cat ID issued, cat made public, cat featured by admin) — those are email-only or nothing.
**Files:** `apps/api/src/notifications/*` (no controller); `apps/web/app/portal/notifications/page.tsx`
**Fix:** Add a `NotificationsController` (`GET /notifications`, `GET /unread-count`, `PATCH /:id/read`, `PATCH /read-all`, all `@CurrentUser`-scoped) and wire `notify()` into the cat/community/admin-feature flows.

### CR5. No production observability — you will be blind at launch
Sentry is a placeholder env only (no `@sentry/*` dependency, zero code refs). No structured logging, no request IDs, no global exception filter, no uptime monitor/alerting. On the free Render tier logs are ephemeral (lost on restart), so a public launch would run with no way to see or be paged on failures.
**Evidence:** grep `Sentry`/`pino`/`requestId` → none; LAUNCH-CHECKLIST.md:38-40 lists both as TODO
**Fix:** Wire `@sentry/nestjs` + `@sentry/nextjs`; add `nestjs-pino` + request-id middleware; add an uptime monitor on `GET /health` (doubles as free-tier keep-warm).

---

# 🟠 HIGH PRIORITY

### Features that don't exist / don't work
- **H1. Likes & "Most Liked" sort do not exist at all.** No `CatLike`/`Reaction`/`Comment`/leaderboard model anywhere in the schema; the only engagement column is `Cat.viewCount`. Community sort offers `recent | viewed | featured` only — "Most Liked" is impossible, and the DTO `@IsIn` would 400 it. This is on your launch feature list; it's a conscious scope decision to make now. *(Files: `community.service.ts:37`, `community-query.dto.ts:8`, `schema.prisma`)* **Fix or explicitly defer:** add `CatLike { userId, catId @@unique }` + denormalized `likeCount`, an authenticated `POST/DELETE /community/cats/:slug/like`, and a `liked` sort.
- **H2. Arabic community search is effectively broken.** `where.name = { contains, mode:"insensitive" }` is Postgres `ILIKE` — case-folding only, **no Arabic normalization** (diacritics, tatweel, NFKC). Since Arabic is the default experience (R101), searching `مشمش` won't find `مِشْمِش`. *(Files: `community.service.ts:30`)* **Fix:** normalized shadow column or `unaccent`.

### Customer web
- **H3. SSR locale is hardcoded `ar`/`rtl`; English users get a flash of Arabic on every load, and crawlers only ever see Arabic.** Locale lives in client state hydrated from `localStorage` after mount. Biggest R101/R102 violation. *(`app/layout.tsx:83`, `providers.tsx:22-31`)* **Fix:** persist locale in a cookie, read it server-side, emit correct `<html lang dir>` per request.
- **H4. No `middleware.ts` — `/portal` & `/admin` guard only in `useEffect`.** Protected bundles ship to anon clients; content can flash before the client redirect. *(`portal/layout.tsx:40-56`, `admin/layout.tsx`)* **Fix:** add edge middleware checking an auth cookie (pair with a session cookie, since tokens are in `localStorage`).
- **H5. `/en` alternate advertised in metadata + sitemap but the route doesn't exist → 404 / dead hreflang.** *(`app/layout.tsx:70`)* **Fix (one line):** remove the false alternate until a real localized route exists.
- **H6. Modals have no focus trap and don't restore focus.** `Drawer`, `Dialog`, and the Cat ID `CatIdCeremony` set `aria-modal` but Tab escapes to the page behind, and focus isn't returned to the trigger on close — including the product's signature ceremony (R073/R097). *(`packages/ui/src/components/drawer.tsx`, `dialog.tsx`, `components/cat-id-ceremony.tsx`)*
- **H7. Products grid "Add to cart" is a dead, fully-styled primary button (no `onClick`).** Violates "no dead buttons"/R040. *(`products/page.tsx:159-161`)* **Fix:** wire to the waitlist funnel or disable with a "coming soon" affordance. (Same file: sort `<select>` lacks a label.)

### Admin
- **H8. No pagination UI anywhere — every admin list is silently capped at 20 rows.** Header shows "347 total" but customer/order/product #21+ is unreachable forever. *(`customers.service.ts:10`, `admin-orders.service.ts:14`, `admin-products.service.ts:10`; no pager in any admin page)*
- **H9. Customer detail view is unreachable.** `GET /admin/customers/:id` returns a rich payload, but there's no `customers/[id]/page.tsx` and rows have no click target — orphaned backend work. *(`admin.controller.ts:41-46`)*
- **H10. No user-management actions (suspend/reactivate/delete).** `User.status` supports SUSPENDED and `jwt.strategy.ts` enforces it, but no admin route sets it — staff have no abuse/safety lever at launch of a public UGC surface (they can hide individual cats, but not stop a user). *(admin customers section is read-only)*
- **H11. Admin is English-only, LTR** — hardcoded strings, `isAr={false}`, `en-GB` dates. Direct R101 violation ("bilingual everywhere; Arabic default"). Decide + document a staff-only carve-out, or bring to parity.

### Security / ops
- **H12. `trust proxy` not set** — behind Render/Cloudflare, `req.ip` is the proxy IP, so the per-IP throttle and login-history forensics are unreliable. *(`main.ts`)* **Fix:** `app.set("trust proxy", 1)`.
- **H13. Auth endpoints inherit only the loose global 120/min throttle (in-memory).** No stricter per-route limit on login/register/forgot/otp; SMS `requestOtp` has no per-phone cap (the email OTP path does). In-memory store resets on cold start and isn't shared across instances. *(`app.module.ts:52`, `auth.controller.ts:40-93`)*
- **H14. Neon connection pooling is documented only in the launch checklist, not the primary deploy docs** — easy to paste the direct (non-pooled) URL from render.yaml/DEPLOY.md and exhaust connections under load. *(`render.yaml:50`, DEPLOY.md:24)*
- **H15. `cats.findAll` (GET) performs writes in a read-loop** — lazily issues missing Cat IDs/QR with sequential per-cat `update`s (and a possible `user.update`). Slow + lock contention under concurrency; surprising side effects on a read. Usually a no-op at launch (IDs issued at create), but any backfilled row triggers it. *(`cats.service.ts:171-197`)* **Fix:** move issuance to a one-time backfill; keep reads read-only.
- **H16. `facets()` full-scans all public cats into Node on every filter-bar load** (`findMany` with no `take`, then de-dupes breedIds in JS). Scales linearly with community success. *(`community.service.ts:113-116`)* **Fix:** `groupBy` or cache.
- **H17. Near-zero automated tests** — 1 unit test (feeding engine) + 1 smoke harness for 95 models; no `*.spec.ts` in the API. *(Mitigation: the smoke suite does exercise register/login/refresh-rotation/OTP/community-browse/upload-auth end-to-end against real Postgres in CI.)*

---

# 🟡 MEDIUM PRIORITY

- **M1. Orphaned image objects on cat delete.** `cats.service.remove()` soft-deletes and resets visibility correctly, but never removes the `photoUrl`/`coverUrl`/gallery objects from R2 — they linger publicly reachable and cost grows unbounded (the single-photo paths already delete correctly; reuse that). *(`cats.service.ts:322`)*
- **M2. Uploads trust the client-declared MIME (no magic-byte sniffing).** Size (8 MB) + extension enforced, but a polyglot/SVG mislabeled `image/png` is stored. Bounded (random keys, CDN echoes `ContentType`) but cheap to close. *(`uploads.controller.ts:41`, `storage.service.ts:85`)*
- **M3. Destructive admin actions have no confirmation** — hiding a cat (a full public takedown) or a product fires immediately on click. *(`community/page.tsx:140`, `products/page.tsx:62`)*
- **M4. Admin cat-hide reason is never captured** — the API supports a moderation `reason` (stored + audit-logged) but the UI sends `undefined`. Toothless audit trail. *(`community/page.tsx:140`)*
- **M5. Dashboard renders `?? 0` fabricated value tiles even during a normal slow load** (independent of CR1) — prefer a skeleton/dash over "0 SAR" for the anti-churn number. *(`portal/page.tsx:153-164`)*
- **M6. Recognition-first greeting is `hidden` below `sm`** — the "Hala, Simba's dad" moment (R001) vanishes on phones, the dominant device. *(`portal/layout.tsx:164`)*
- **M7. Admin has no logout on mobile** — logout lives only in the `md:flex` desktop aside; mobile header is icon-only. *(`admin/layout.tsx:71,78-83`)*
- **M8. Thin SEO on client-rendered pages** — `products`, `blog` list, `community` list, `tools/feeding` are `"use client"` with no `generateMetadata`; they inherit only the root title. No root OG image set. *(only `community/[slug]` + `legal/[doc]` have per-page metadata)*
- **M9. `enableImplicitConversion: true` on the global ValidationPipe** — conscious sign-off recommended for numeric/boolean query DTOs (type-confusion surface). *(`main.ts:60`)*
- **M10. No index on `Address.cityId`** — the community city filter joins `Cat→user→addresses(cityId)`; add `@@index([cityId, isDefault])`. *(`schema.prisma:579`)*
- **M11. No lint gate, no dependency/secret scanning in CI** — no `eslint` step, no Dependabot, no `pnpm audit`, no CodeQL/gitleaks. *(`.github/workflows/ci.yml`)*
- **M12. View-count is inflatable and drives the "Most Viewed" sort** — every profile GET increments with no per-session/IP/owner dedupe, so the ranking is gameable. *(`community.service.ts:94`)*
- **M13. Redis container runs in `docker-compose.prod.yml` but nothing in the API imports it** — dead infra / misleading. Drop it until the throttle or a queue uses it. *(no `redis`/`ioredis`/`bullmq` in `apps/api/src`)*
- **M14. Orders/Products admin pages + dashboard commerce KPIs are live and read 0 in Community Mode** — not broken (graceful empties), but the flagship admin screen looks empty and implies a storefront that isn't live. Consider a Community-Mode dashboard variant (shared cats, waitlist, new members). *(`admin/page.tsx:30-37`, `layout.tsx:17-18`)*

---

# 🟢 LOW PRIORITY / POLISH

- **L1.** No "skip to content" link on the marketing shell — keyboard users tab the full nav every page. *(`site-header.tsx`)*
- **L2.** Ceremony share-choice buttons show `"…"` as their only loading label — no accessible progress text; use the button `loading` state + a verb. *(`cat-id-ceremony.tsx:224-227`)*
- **L3.** Products grid uses raw `<img>` (eslint-disabled) while community/blog use `ImgWithFallback` with lazy-loading — LCP + consistency. *(`products/page.tsx:138`)*
- **L4.** Marquee benefits ribbon is fully `aria-hidden` (duplicated in feature rows below, so acceptable). *(`page.tsx:265`)*
- **L5.** Waitlist CSV export isn't quote-escaped or formula-sanitized — a comma/quote/newline corrupts columns; a leading `=`/`+`/`@` is an Excel CSV-injection vector. *(`waitlist/page.tsx:30`)*
- **L6.** Partner-key compare in `verify.service.ts:58` uses `!==` (non-constant-time) while everything else uses `timingSafeEqual`. Low impact (offline key).
- **L7.** `no `global-error.tsx`` on web (only route-level `error.tsx`) — a root-layout crash has no branded fallback.
- **L8.** `register/page.tsx:124` resend uses a synthetic `Event` cast — extract a plain `resend()`; and the "or with email & mobile" divider copy shows even when SMS is off. *(minor)*
- **L9.** Offset (`skip`) feed pagination degrades on deep pages; `pg_trgm` for search later; cursor pagination deferrable — all fine at launch scale.
- **L10.** `.env.example` has a stray truncated key and lists unused providers (PostHog/WhatsApp/SMTP) — tidy for clarity.
- **L11.** Apple Wallet is intentionally `false` (needs the Pass Type ID cert chain); Google Wallet is fully implemented and fail-closed. State only.

---

# Deliverable indexes (as requested)

### Every bug found
1. Authed pages leak fabricated `0`/false-empty on API failure (CR1).
2. Notifications unreadable — no controller/endpoint; no community events fire (CR4).
3. Likes/"Most Liked" don't exist; DTO would 400 the sort (H1).
4. Arabic community search misses diacritic/tatweel variants (H2).
5. SSR locale FOUC; crawlers see Arabic-only (H3).
6. `/en` hreflang/alternate 404s (H5).
7. Modals don't trap or restore focus (H6).
8. Products "Add to cart" dead button; unlabeled sort select (H7).
9. Admin lists truncated at 20 with no pager (H8).
10. Admin customer detail unreachable (H9).
11. `cats.findAll` writes inside a GET read-loop (H15).
12. `facets()` unbounded full-scan (H16).
13. Orphaned R2 objects on cat delete (M1).
14. Admin destructive actions unconfirmed; hide-reason dropped (M3/M4).
15. Dashboard shows "0 SAR" during slow load (M5).
16. Admin has no mobile logout (M7).
17. View-count inflatable, drives sort (M12).
18. Waitlist CSV injection/escaping (L5).
19. Non-constant-time partner-key compare (L6).

### Incomplete-feeling features
Likes/leaderboard (absent), Notifications (write-only), admin user-management (read-only), admin customer/order/product detail + pagination, community search (Arabic), bilingual admin, wallet (Apple pass pending).

### Every security concern
Seed-admin backdoor not prod-gated (CR2), `trust proxy` unset (H12), loose/in-memory auth throttle + no per-phone OTP cap (H13), MIME-trusting uploads (M2), implicit conversion sign-off (M9), CSV injection (L5), non-constant-time compare (L6), no dep/secret scanning (M11). **Strong & verified:** kill-switch fails closed, boot secret assertion, no IDOR, refresh rotation + reuse detection, bcrypt-12, account lockout, no user enumeration, helmet, CORS allow-list, Swagger off in prod, `next/image` host allow-list, privacy-filtered public surfaces.

### Missing production features
Prisma migrations + deploy step (CR3), observability (Sentry/logs/uptime, CR5), notifications read API (CR4), likes (H1), admin pagination/detail/user-management (H8-H10), edge route middleware (H4), Redis-backed throttle, image-object GC (M1), lint/dep-scan in CI (M11), DB backup/restore runbook.

### Trust-building improvements
Fix CR1 (never fabricate value on error) · warn/confirm on destructive admin moderation (M3) · SSR-correct locale so Arabic-first is true at first paint (H3) · notifications that actually confirm "your cat is now public / was featured" (CR4) · visible support path (already one tap away — keep) · a public status/uptime signal.

### Engagement & retention improvements
Likes + a gentle "most-loved this week" rail (H1) · notifications for milestones (featured, view thresholds, gallery anniversaries) (CR4) · richer community search/discovery (breed/bio/city, H2) · a Community-Mode home that leads with community metrics not zeroed commerce KPIs (M14) · share-to-story is already excellent — surface it more.

### Nice-to-haves before launch
Skip link (L1), OG image (M8), per-page metadata (M8), confirm dialogs (M3), admin mobile logout (M7), tidy `.env.example` (L10).

### Scalability concerns to address now (cheap) vs later
**Now:** `facets()` scan (H16), write-in-read-loop (H15), `Address.cityId` index (M10), pooled Neon URL enforced (H14). **Later (deferrable):** cursor pagination, `pg_trgm` search, Redis throttle/cache, off free-tier (cold starts/SPOF), unit-test depth.

---

# Prioritized Action Plan (pre-launch, excluding payments)

**Phase 1 — Critical (block launch, ~5–7 days):**
1. Add `isError`/retry to every authed portal query; kill fabricated `0` value tiles (CR1).
2. Gate the seed admin to non-prod / env-password (CR2).
3. Adopt Prisma migrations + `migrate deploy` in the Render deploy path (CR3).
4. Ship a `NotificationsController` + wire community events (CR4).
5. Wire Sentry (API+web) + structured logging + `/health` uptime monitor (CR5).

**Phase 2 — High (before or immediately after, ~1 week):**
6. Decide Likes: build it (model + endpoints + `liked` sort) or consciously cut it from the launch feature set (H1).
7. SSR-correct locale via cookie; remove the `/en` alternate (H3, H5).
8. Add `middleware.ts` edge guard for `/portal` + `/admin` (H4).
9. Focus-trap + focus-restore in `Drawer`/`Dialog`/ceremony (H6).
10. Admin: pagination UI, customer detail page, suspend/reactivate action, confirm dialogs (H8-H10, M3).
11. `trust proxy` + per-route auth throttling + per-phone OTP cap (H12, H13).
12. Fix `facets()` scan + `cats.findAll` read-loop; add `Address.cityId` index; enforce pooled Neon URL (H14-H16, M10).
13. Arabic search normalization (H2); wire products "Add to cart" to the waitlist or disable it (H7).

**Phase 3 — Medium/polish (fast-follow):** image-object GC (M1), MIME sniffing (M2), admin bilingual decision (H11), lint + Dependabot + `pnpm audit` (M11), skip link/OG image/per-page metadata (L1/M8), Community-Mode admin dashboard variant (M14).

---

# Day-One Launch Checklist (verify immediately before going public)

**Data & config**
- [ ] Production schema applied via committed migration (`migrate deploy`), **not** ad-hoc `db push`; verify all Community-Mode columns/tables exist.
- [ ] `DATABASE_URL` is the **pooled** Neon URL (`-pooler`, `?pgbouncer=true`); PITR/backups enabled; restore tested once.
- [ ] `COMMERCE_ENABLED=false` and `PAYMENTS_MODE=mock`; confirm any `@Commercial` route returns `403 MEMBERSHIPS_COMING_SOON` (checkout, subscribe, webhooks, refund).
- [ ] `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` set (≥32 chars, not defaults) — API must **refuse to boot** otherwise. `NODE_ENV=production` guaranteed.
- [ ] Seed admin **not** created in prod (or password rotated + forced-reset); no known-cred backdoor.
- [ ] R2 secrets set; `S3_*` present so storage fails loud (not to ephemeral disk). Verify a real upload round-trips from the R2 public URL.
- [ ] Resend domain verified; `EMAIL_FROM` on that domain; send a real verify + welcome email to yourself.

**App & security**
- [ ] `app.set("trust proxy", 1)` deployed; confirm login-history records real client IPs.
- [ ] Sentry receiving events from API **and** web (trigger a test error); uptime monitor pinging `/health`; alert routing tested.
- [ ] `/health` returns `ok` (real `SELECT 1`); graceful shutdown drains on redeploy.
- [ ] Auth throttle behaves (login/OTP/forgot); account lockout trips at the threshold.
- [ ] Swagger `/api/docs` is **off** in prod (`ENABLE_SWAGGER` unset).

**Core journeys (smoke, all three roles)**
- [ ] Guest: home, community feed + a public `/community/<slug>`, blog, legal pages, feeding tool — all load, no 404s, correct empty states.
- [ ] Register → verification email → confirm → login → **Cat ID ceremony** fires → create cat → upload profile/cover/gallery photo (appears from R2).
- [ ] Toggle cat public → appears in `/community`; delete cat → disappears from feed **and** its public slug/QR immediately.
- [ ] Cat ID card: QR renders, PNG/PDF/print/story export all download correctly (test Safari/WebKit too).
- [ ] "Preview memberships" → the "launching soon" waitlist page, **no checkout path**; join waitlist → confirmation.
- [ ] Force an API failure on the dashboard → confirm it shows a **retry**, not "0 SAR saved" (CR1 regression check).
- [ ] Bell/notifications page shows real items or an honest empty state (not a broken fetch) (CR4 check).
- [ ] Admin: log in as staff → dashboard, Community (hide/feature **with confirmation**), Waitlist CSV export opens cleanly in Excel; confirm a non-staff account is **403'd** from every `/admin` route and the API.

**Presentation**
- [ ] English user: no flash of Arabic RTL on load (CR/H3 check); locale toggle persists across reload.
- [ ] Mobile: bottom nav ≥44px, primary actions in the thumb zone, greeting visible, no horizontal overflow; admin can log out on mobile.
- [ ] Accessibility spot-check: Tab stays inside the Cat ID ceremony/drawer; visible focus; reduced-motion honored.
- [ ] `robots.txt`, `sitemap.xml`, `manifest` serve correctly; **remove the `/en` alternate** or confirm it resolves; homepage social share has an OG image.

---

## What is genuinely excellent (keep as-is)
- **Kill-switch:** `CommerceGuard` + `commerceEnabled()` fail closed (default false), run before auth, return `MEMBERSHIPS_COMING_SOON`; boot refuses `COMMERCE_ENABLED=true` without `PAYMENTS_MODE=live`. No bypass found.
- **Auth crypto:** bcrypt-12, refresh rotation + reuse detection (SHA-256, constant-time), account lockout, hashed/attempt-capped OTP, no user enumeration, server-side Google verify.
- **Authorization:** global default-deny (Throttler→Commerce→JWT→Permissions), DB-revalidated `isStaff`, granular grants, **no IDOR across the entire API**.
- **Cat ID:** CSPRNG human-readable `MRC-XXXX-XXXX`, collision-safe, QR token model; the two-act reveal ceremony with reduced-motion path and immediate SR outcome; PNG/PDF/print/story export true-to-card with WebKit workarounds.
- **Community read model:** privacy is load-bearing and correct (per-field flags enforced, no PII/QR leak), single-query, index-backed, injection-safe; soft-delete withdraws from every public surface atomically.
- **Storage:** R2 via S3 SDK, fails loud in prod, orphan cleanup on single-photo replace, own-namespace-only deletes.
- **Design system & SEO infra:** token-driven, restrained, bilingual RTL front-of-house; `sitemap.ts`/`robots.ts`/`manifest.ts` all correct; public pages handle loading/error/empty as three distinct states.

**Bottom line:** the craftsmanship is real and high, and the Community-Mode kill-switch is exactly right. The distance to a confident public launch is a **short, well-scoped operational + trust-hardening sprint** — migrations, observability, honest error states, and finishing (or cutting) the two half-built social features — not a rebuild.

---

# Remediation Scorecard (2026-07-06, post-fix, independently re-audited)

| Category | Before | After | What moved it |
|---|---:|---:|---|
| Design | 9 | **9** | held; Community-Mode admin dashboard added |
| User Experience | 7 | **9** | error states everywhere, notifications, onboarding, optimistic likes |
| Performance | 7 | **9** | facets groupBy, read-loop removed, cityId index |
| Functionality | 6 | **9** | likes end-to-end, notifications API, admin detail/suspend |
| Reliability | 5 | **9** | migrations+deploy, Sentry+pino, atomic txns, tests, committed |
| Security | 8 | **9** | seed gate, trust proxy, throttling, MIME sniff, suspend-blocks-login |
| Accessibility | 6.5 | **9** | focus traps, skip link on real landmarks, aria-pressed, reduced-motion |
| Branding | 9 | **9** | held; OG card, onboarding ceremony |
| Professionalism | 8 | **9** | CSV/open-redirect guards, confirmations, admin isError parity |
| Mobile Experience | 7.5 | **9** | mobile logout, bell, greeting, thumb-zone, a11y |
| **Overall Product Quality** | **7** | **9** | — |

**Launch Readiness: ≈94/100 — Ready to Launch (Community Mode)** once the operational
checklist (prod secrets, Resend domain, uptime monitor, push+merge) is done. Payments
remain intentionally disabled (`COMMERCE_ENABLED=false`, fail-closed kill-switch).

## Evidence
- 4/4 packages `tsc --noEmit` clean; `next lint` clean (1 pre-existing warning).
- API unit tests (vitest) 12/12; **e2e smoke 54/0** (40 original + 14 new Community-Mode).
- Web production build succeeds (all routes, middleware, edge OG image).
- Browser-verified: community likes + Most-Loved sort, onboarding page (all sections +
  CTAs), notification bell, admin dashboard (bilingual + Community strip), middleware
  redirect, skip-link focus target, suspend-blocks-login.

## What still needs a human (operational, not code)
- [ ] Push `feat/community-launch-hardening` and merge to `main` (nothing deploys until then).
- [ ] Set prod secrets: **pooled** Neon `DATABASE_URL`, `RESEND_API_KEY`, R2 `S3_*`, `SENTRY_DSN`.
- [ ] Verify the Resend sending domain; set `EMAIL_FROM` to it.
- [ ] Add an uptime monitor on `GET /health` (alerts + keeps the free instance warm).
- [ ] Enable Neon PITR/backups; test a restore once.
- [ ] Keep `COMMERCE_ENABLED=false` until payments launch.
