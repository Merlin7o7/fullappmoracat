# Moracat — Production Readiness Audit (Community Launch)

**Date:** 2026-07-07 · **Branch:** `fix/deploy-migrate-boot` · **HEAD:** `88e32d5`
**Scope:** Full platform QA/UX/UI/security/functionality. **Payments intentionally excluded** (Community Mode; `COMMERCE_ENABLED=false`) — evaluated only to confirm the kill switch fails closed.
**Method:** Six parallel code-level audits (read actual source, not docs) + live app boot (embedded Postgres + API on :4000 + web on :3000). Smoke suite run (52/54 checks pass; the 2 "fails" are a Windows-only test-harness artifact — see Appendix A). Typecheck + lint clean.

---

## Verdict

| | |
|---|---|
| **Launch Readiness** | **74 / 100** |
| **Recommendation** | **Delay Launch — brief, well-scoped fix sprint (conditional go)** |

The engineering is unusually clean for a pre-launch product: fail-closed config, real CI with a live-Postgres smoke suite, disciplined IDOR/authorization, a schema whose indexes match its query shapes, and a genuinely Apple/Stripe-tier design system. **It is not ready today** because a small cluster of confirmed defects causes silent **data loss**, **schema-drift blindness**, and **discovery/mobile dead-ends** — each individually a small fix, but collectively launch-blocking. Fix the 6 blockers below (est. 2–4 focused days) and this ships with confidence.

---

## Category Scores

| Category | Score | Notes |
|---|---:|---|
| Design | 9/10 | Warm-paper/flat-sticker system is coherent, token-driven; Cat ID card + ceremony are exceptional. |
| Branding | 9/10 | Design-authority-faithful; the cat is the hero on every surface; honest Community-Mode framing. |
| Security | 8/10 | Strong core (kill switch fails closed, IDOR-clean, boot secret validation). One High: 2FA disable needs no re-auth. |
| User Experience | 7/10 | Onboarding is outstanding; dragged down by broken "complete the file", English-only notifications, non-shareable filters. |
| Accessibility | 7/10 | Focus traps, landmarks, labelled forms, keyboard like-button all solid; but admin tickets are keyboard-inaccessible, the cropper modal has no trap, form errors aren't announced, and several tokens fail contrast. |
| Mobile Experience | 7/10 | Portal bottom-nav + container-query card excellent; **marketing header collapses to nothing on phones**. |
| Professionalism | 7.5/10 | Polished, but incomplete features leak (dead "Verify" QR, lying delete/reactivate copy). |
| Performance | 6.5/10 | Clamped pagination + correct indexes; no image optimization, unindexable search, uncached public feed. |
| Reliability | 6/10 | Fail-fast boot + Sentry + CI e2e; **migration drift undetectable**, email/SMS fail silently. |
| Functionality | 6/10 | Identity spine is solid; **"complete the file" loses 5 fields + corrupts allergies**; feed hard-capped at 24. |
| Scalability | 7/10 | Stateless API, DB-backed OTP/lockout; in-memory throttler + racy boot backfill. |
| **Overall Product Quality** | **7/10** | Premium build, blocked by a fixable defect cluster. |

---

## 🔴 CRITICAL — must fix before launch

**CR-1 · "Complete the file" silently discards 5 fields — vaccination status can never be saved.**
`apps/api/src/cats/cats.service.ts:283-308`. `update()`'s Prisma `data` block omits `coatColor`, `isNeutered`, `vaccinationStatus`, `currentMedications`, `emergencyNotes` — all accepted by the DTO and all written by `create()` (lines 140-144), but the create wizard never collects them, so the *only* path to set them is the PATCH that drops them. **Verified hands-on.** Result: the Cat ID card and Google Wallet pass show "Not recorded / غير مسجّلة" for 100% of cats, forever — the card's flagship health signal is dead. *Fix: add the five fields to `update()`'s data object.*

**CR-2 · Allergy/medical data corrupted to "[object Object]" on the complete-file round-trip.**
`apps/web/app/portal/cats/new/page.tsx:298-299`. Prefill does `(cat.allergies ?? []).join(", ")`, but the API serializes allergies as `{id, allergen}[]` and health as `healthConds:{id,name}[]` (`cats.service.ts:70-71`). Prefill renders `[object Object], …`; on save, `update()` `deleteMany`s the real rows and recreates them as literal `"[object Object]"`. Medical conditions also never prefill (form reads `cat.healthConditions`; API returns `healthConds`). A clinic scanning the cat later sees garbage allergens. *Fix: map `allergies.map(a=>a.allergen)` / `healthConds.map(h=>h.name)`, and wrap the delete-then-update in `$transaction` (see CR-3).*

**CR-3 · Migration is a dead-end with no drift detection — schema-stale containers report healthy.**
`apps/api/Dockerfile:54` runs `timeout 60 prisma migrate deploy || echo WARN` (best-effort, swallowed), while `LAUNCH-CHECKLIST.md` tells you to create the prod schema with `prisma db push` through the pooled Neon URL. Consequences: `db push` records no migration history → every future boot `migrate deploy` fails P3005 and is ignored; migrations can't run through pgbouncer anyway; `/health` only does `SELECT 1`. Ship a schema change and every query on the new column throws P2022 at runtime on a "healthy" service. (Accidental partial guard: `CatsService.onModuleInit` queries new `cats` columns at boot, so drift on *that one table* crash-loops the deploy; every other table sails through.) *Fix: baseline the prod DB, run `migrate deploy` against a `DIRECT_DATABASE_URL` as a pre-deploy step, add a boot-time drift check that flips `/health` to degraded.*

> Data-loss non-transactional variant of CR-2: `cats.service.ts:276-310` runs `catAllergy.deleteMany` / `catHealthCondition.deleteMany` **before** the `cat.update`, outside a transaction — a failed update (bad `breedId` FK, DB hiccup) permanently destroys health data while the user sees "Couldn't save."

---

## 🟠 HIGH PRIORITY

**H-1 · Community feed is hard-capped at 24 cats — no pagination UI exists.** `apps/web/components/community-browse.tsx:218` calls `api.community({...})` with no `page` and renders no pager, though the API returns `pagination.hasMore` and the footer prints the true total. The 25th cat ever shared is invisible to every visitor, forever — fatal for a growth-first launch. *Fix: `useInfiniteQuery` + "Show more" on the existing `page`/`hasMore`.*

**H-2 · In-app notifications are English-only in an Arabic-default product.** `community-likes.service.ts:62-73`, `cats.service.ts:178-183,618-624` hardcode English at write time ("… got their first like ❤️"). The hero community surface speaks the wrong language to the default audience (violates R101). *Fix: store structured `kind`+params, localize at render (or store ar+en).*

**H-3 · Portal cats page fabricates an empty household on API error.** `apps/web/lib/cat-context.tsx:70-74` swallows `isError`; a failed `/cats` fetch shows the brand-new-user welcome to a member with 3 cats (and poisons dashboard greeting, switcher, welcome flow). The exact anti-pattern `QueryError` was built to prevent — used on 7 other pages but not here. *Fix: expose `isError`, render `<QueryError/>`.*

**H-4 · No mobile navigation or login in the marketing header.** `components/site-header.tsx:43` nav is `hidden md:flex`; login is `hidden sm:inline-flex`; there is no hamburger fallback. **Verified live at 375px** — a phone visitor sees only theme + language toggles and cannot reach Community/Shop/Blog/Feeding *or Login* from any marketing page. In a mobile-majority market this strands returning members. *Fix: add a mobile disclosure menu with nav items + login.*

**H-5 · Waitlist CSV export only serializes the current 20-row page.** `apps/web/app/admin/waitlist/page.tsx:49-62` exports `data.items` (PAGE_SIZE=20). Launch week: 800 sign-ups → staff exports 20 and doesn't notice. The single most business-critical Community-Mode admin action silently truncates. *Fix: server-side streaming export endpoint (`customers.read`).*

**H-6 · 2FA can be disabled with no re-authentication.** `auth.controller.ts:163-167` → `auth.service.ts:559-562` — any valid access token disables 2FA outright (no password, no TOTP), while `enable` correctly requires a code. Removes the account's strongest control silently. *Fix: require a fresh TOTP/password + email the user on disable.*

**H-7 · RBAC is single-tier theatre; no staff-onboarding path exists.** `seed.ts:184-198` grants permissions only to `super_admin`; 9 other roles are empty, and no endpoint or UI writes `isStaff`/`UserRole` — onboarding a support agent requires hand-editing the DB, and they'd get super-admin powers. Granular permission keys are checked but undifferentiated at the data layer. *Fix: seed per-role permission sets; add a super-admin-only staff-management endpoint/page.*

**H-8 · Transactional email silently routes to the server log if `RESEND_API_KEY` is missing in prod.** `mail.service.ts:24-41` falls back to `provider="log"` in production and returns `{ok:true,id:"logged"}`. Registration gates the dashboard on `emailVerified` via this path → a missing/typo'd key makes every new signup uncompletable, invisibly (no Sentry). *Fix: `assertProductionConfig` must require `EMAIL_PROVIDER=resend`+key in prod, or log `error`+Sentry and return `ok:false`.*

**H-9 · Web Docker image omits `public/` — brand logos 404 on the self-hosted path.** `apps/web/Dockerfile:32-33` copies `.next/standalone` and `.next/static` but not `apps/web/public`. `public/brand/moracat-logo.png` is the logo on the Cat ID card (the hero artifact). Vercel path unaffected — which is why it's unnoticed. *Fix: one line — `COPY --from=build … /repo/apps/web/public ./apps/web/public`.*

**H-10 · Welcome-page story share breaks on cross-origin photos.** `portal/welcome/page.tsx:315` passes raw `cat.photoUrl` into `CatIdStory` (the cats page correctly wraps with `exportSafeSrc`). For an R2 photo without CORS headers, `html-to-image` drops it → the first "Share now" moment (the growth loop) produces a photo-less or failed story. *Fix: route through `exportSafeSrc`.*

**H-11 · Admin support tickets can't be opened by keyboard.** `packages/ui/src/components/data-table.tsx:91-95` — rows with `onRowClick` get no `tabIndex`/`role`/keydown handler, and admin support's *only* way to open a thread is a row click (`admin/support/page.tsx:88`). A keyboard-only staff member cannot answer tickets at all. (The correct pattern already exists at `admin/customers/page.tsx:87-93`.) *Fix: add `tabIndex=0`/`role="link"`/Enter handler in `DataTable` when `onRowClick` is set.*

**H-12 · Image-cropper modal has no focus trap, Escape, or scroll lock.** `components/photo-uploader.tsx:359-365` declares `aria-modal="true"` but never moves focus in, Tab escapes to the (SR-hidden) page behind, Escape does nothing, and the page scrolls. It sits on the core cat-photo onboarding path. *Fix: reuse `useFocusTrap` + Escape + body-scroll-lock exactly like the ceremony.*

**H-13 · Page-level form errors are never announced to screen readers.** Field-level errors are exemplary (`field.tsx:65` `role="alert"`), but every *page-level* error is a plain `<p>` (login, register, verify-email — which even clears the input, settings ×3, cat-manage-drawer). A blind user submitting a wrong password hears nothing. *Fix: `role="alert"`/live region on ~9 paragraphs — a 15-minute change with large payoff.*

**H-14 · Product decision needed: Arabic dates render as Hijri (Umm al-Qura).** The uniform `isAr ? "ar-SA" : "en-GB"` policy means every Arabic date defaults to `islamic-umalqura` ("١٥ محرم ١٤٤٧"), while English shows Gregorian for the *same* record — including "Member since" on the Cat ID card. This is an implicit consequence, not a decision. *Fix: decide; if Gregorian is intended, `"ar-SA-u-ca-gregory"` (keeps Arabic-Indic digits) in one shared formatter. Lock this before users anchor on it.*

---

## 🟡 MEDIUM PRIORITY

- **M-1 · Milestone notifications spam on like→unlike→like toggling** (`community-likes.service.ts:61-74`) — no dedup; re-crossing a milestone re-notifies up to the throttle. *Record emitted milestones or notify only on new all-time-high.*
- **M-2 · Offset pagination + re-share bump** (`community.service.ts:57-66`, `cats.service.ts:604`) — un-share/re-share resets `sharedAt=now`, a free "bump to top of Newest" lever; no `id` tiebreaker → non-deterministic order across pages. *Cursor pagination; preserve original `sharedAt`.*
- **M-3 · Filter/search/section state not in URL** (`community-browse.tsx:201-207`) — not shareable, lost on back-nav.
- **M-4 · View count is inflatable and under-counts** — increments per API detail call with no dedup, but ISR `revalidate:60` skips increments within the window. "Trending" ranks on a meaningless number.
- **M-5 · Generic "be the first to share" empty state shown for zero *search/filter* results** (`community-browse.tsx:330-339`) — wrong and confusing when a query simply missed.
- **M-6 · City facet lists all active cities, not cities with public cats; no facet counts** (`community.service.ts:139-143`) — dead-end filters at low volume.
- **M-7 · Reactivate dialog lies** — copy promises cats become visible again; the service deliberately keeps them hidden (`admin/customers.service.ts:92-127`). *Fix copy.*
- **M-8 · Delete-cat confirm lies** — "can be undone later" but `remove()` destroys R2 objects + purges rows and `restore()` refuses soft-deleted cats (`cat-manage-drawer.tsx:159`). *Fix copy (ar+en).*
- **M-9 · Archive→Restore grants free "Member" status** (`cats.service.ts:355-371`) — `restore()` sets `membershipStatus=ACTIVE` unconditionally; in Community Mode membership should be unattainable. *Restore to pre-archive status.*
- **M-10 · Suspended/deleted owner's cats stay public** — `community.service.ts:21` (`baseWhere`) and `verify.service.ts:36` filter cat fields only, no `user.status`/`deletedAt` check. (Admin *suspend* hides them transactionally; but a `DEACTIVATED`/soft-deleted owner slips through.) *Add `user:{status:"ACTIVE",deletedAt:null}` to `baseWhere()`.*
- **M-11 · GET /cats/:id can't round-trip the full profile** (`cats.service.ts:678-710`) — `serialize()` omits `coatColor`, `isNeutered`, `currentMedications`, `emergencyNotes`, `coverUrl`; even after CR-1, prefill reads them as blank. *Add to serializer.*
- **M-12 · Empty/whitespace cat names accepted at the API** (`dto/cat.dto.ts:27-30`, no `@IsNotEmpty`/trim) — manage-drawer lets `" "` through → nameless card, empty `nameNormalized`, slug "cat".
- **M-13 · In-memory rate limiter** (`app.module.ts:73`) — resets on deploy, multiplies per instance. Sensitive flows (login lockout, OTP caps) are DB-backed and safe; IP throttle degrades on scale-out. *Redis-back when it returns.*
- **M-14 · No CSP + tokens in localStorage** (`next.config.mjs:23-35`, `middleware.ts:8-11`) — no known XSS sink today, but CSP is the compensating control for the localStorage design. Also no HSTS. *Add CSP (report-only first).*
- **M-15 · `nameNormalized` search uses `contains`** (`community.service.ts:36`) — the btree index can't serve `%term%`; full seq-scan per keystroke. *pg_trgm GIN index when >10k cats.*
- **M-16 · No `next/image` anywhere** — image-heavy product ships full-size R2 originals, no srcset/AVIF. *Adopt for community/gallery, or Cloudflare image resizing.*
- **M-17 · Public feed uncached, two DB queries + a viewCount write per request** — free-tier Neon/Render feels this first. *`Cache-Control: s-maxage=30, SWR`.*
- **M-18 · Admin support ticket list unpaginated, loads every message of every ticket** (`support.service.ts:104-121`) — multi-MB payload that grows unbounded.
- **M-19 · Order status changes: no `onError`, no success toast, no transition validation** (`admin/orders/page.tsx:40-44`, `admin-orders.service.ts:44-64`) — a mis-click cancels a delivered order silently.
- **M-20 · Moderation notifications to members are English-only** (`admin-community.service.ts:65-100`) — ignores `user.locale`.
- **M-21 · CSV has no UTF-8 BOM** (`waitlist/page.tsx:56`) — Arabic cat names mojibake in Excel.
- **M-22 · Home page has no page-specific metadata** — `app/page.tsx` is `"use client"` and relies on the root default title. (Correction to a stricter reading: `products/` and `tools/feeding/` **do** ship metadata layouts, so this is Medium, not Critical.) *Add a marketing-segment metadata layout.*
- **M-23 · No `noindex` meta on portal/admin** — `robots.ts` disallows them (good), but a leaked/linked URL is still indexable since the root sets `robots:{index:true}`. *Segment-level `robots:{index:false}`.*
- **M-24 · Public cat OG image is a raw photo URL, no 1200×630 card** (`community/[slug]/page.tsx:31-37`) — WhatsApp/Twitter cards for the most shareable surface render wrong ratio; title hardcoded LTR regardless of locale.
- **M-25 · Icon-only buttons carry English-only aria-labels** (`toggles.tsx:18,32`; `drawer.tsx:47`; `toast.tsx:84`; several portal/admin) — Arabic screen-reader users hear English.
- **M-26 · A few sub-4.5:1 text tints** — footer secondary text at `text-primary-foreground/60` on green ≈ 3.9:1; audit all `/60` text-on-green.
- **M-27 · Marketing scroll-reveals ignore reduced-motion** (`app/page.tsx:21-28`) — framer `whileInView` fade-ups aren't gated (TiltCard + ceremony correctly are). *One-line fix: wrap Providers in `<MotionConfig reducedMotion="user">`.*
- **M-27b · Computed contrast failures on brand-green + tokens** — portal sidebar inactive nav `text-primary-foreground/65` ≈ 4.10:1 (FAIL, the app's most-used nav); footer legal links/copyright `/50` ≈ 3.06:1 (FAIL, functional links); `warning`/`info` ticket badges ≈ 3.76/3.92:1; input placeholders `/70` ≈ 3.44:1. *Fix: floor primary-foreground text at `/75`, deepen warning/info badge text, raise placeholder to `/80`.*
- **M-27c · `<Link><Button>` nesting is pervasive** (`app/page.tsx:101`, `site-header.tsx:64`, ~15 sites) — invalid HTML (button in anchor), two tab stops per CTA, AT announces a link-containing-button. *Fix: a shared `ButtonLink`/`asChild` API before more pages ship.*
- **M-27d · Selected chips/tabs/switchers lack `aria-pressed` + keyboard semantics** — filter chips, method tabs, cat-switcher `listbox`, settings `radiogroup` announce state by color only and don't implement the ARIA keyboard contract they claim (`community-browse.tsx:256`, `cat-switcher.tsx:68`, `settings/page.tsx:141`). *Fix: `aria-pressed` sweep (LikeButton already does it right), or downgrade fake widgets to honest buttons.*
- **M-27e · Wizard owner-phone input is bidi-unsafe + a few unmirrored arrows** — `cats/new/page.tsx:179` uses the generic `Field` for a phone (so `+9665…` renders reversed in RTL) instead of `PhoneField`; forward arrows at `portal/page.tsx:198,221,275` and admin-support back/send icons lack `rtl:rotate-180`. *Fix: use `PhoneField`; add `rtl:rotate-180`.*
- **M-27f · Meaningful cat photos with empty `alt` + sub-44px targets** — community/manage gallery images are `alt=""` (SR users get nothing; delete buttons become "delete which photo?"); drawer/toast close, make-primary star, gallery delete, filter chips are all 20–32px (R092). Gallery delete also has no confirm. *Fix: descriptive alt; 44px targets; confirm on destructive.*
- **M-27g · Portal mobile bottom-nav overflows + no safe-area inset** — 9 × 44px items exceed the pill width at 360px (last items silently off-screen, scrollbar hidden), and `bottom-3` with no `env(safe-area-inset-bottom)` puts it under the iPhone home indicator. *Fix: ~5 primary items + "More" sheet; `bottom-[max(0.75rem,env(safe-area-inset-bottom))]`.*
- **M-27h · Several marketing pages use `<section id="main">` not `<main>`; blog article has no skip target** — skip link lands on a non-landmark (or nothing on `blog/[slug]`). *Fix: `<main id="main">`.*
- **M-28 · `onboardedAt` read-then-write race** (`cats.service.ts:158-172`) — concurrent first-cat creates both fire the welcome flow. *`updateMany({where:{id,onboardedAt:null}})`, gate on count.*
- **M-29 · Gallery limit/sortOrder races** (`cats.service.ts:541-551`) — count-then-create can exceed the 12-photo cap and duplicate `sortOrder`.
- **M-30 · Orphaned pre-create uploads** — wizard uploads before the cat exists; abandoned wizards orphan R2 objects forever (no GC).
- **M-31 · Owner-contact save failure is swallowed and the UI lies** (`cats/new/page.tsx:80-89`) — `PATCH /account/profile` is `.catch(()=>{})` then optimistically writes the phone locally even on server reject; the "bring my cat home" number may never persist.
- **M-32 · Audit log is write-only; product/CMS mutations write none** — a price change 52→5.2 SAR is untraceable, and there's no admin viewer.
- **M-33 · SMS OTP silently dropped in prod without Twilio** (`auth.service.ts:565-598`) — returns `{sent:true}`, logs nothing. *Log error in prod; hide phone-login behind a flag.*
- **M-34 · Login user-enumeration via timing** (`auth.service.ts:150-161`) — `bcrypt.compare` skipped for absent users; registration also leaks existence (email + phone oracle). *Compare against a dummy hash.*

---

## 🟢 LOW PRIORITY (selected; full list in agent transcripts)

- Concurrent double-unlike → unhandled 500 (`community-likes.service.ts:79-102`); count stays correct.
- Cat ID / QR-token generation is check-then-insert; the DB `@unique` backstops correctness but a race surfaces as a 500 (prob ~3×10⁻⁸).
- `likeCount` not zeroed on soft-delete (landmine only if undelete is ever added).
- `unhide()` on unknown id → raw P2025 500 instead of 404 (`admin-community.service.ts:77`).
- "Public cats" KPI + filter count hidden cats (`isPublic:true` without `hiddenAt:null`).
- Feature/unhide/star actions have no success feedback and aren't disabled while pending (double-fire).
- `featuredAt` is set but nothing expires/caps featured cats.
- Search >60 chars → hard-error card (no `maxLength` on input); `role="tablist"` without arrow-key nav.
- Notifications aren't actionable (carry `slug`/`catId` but render as mark-read only, despite "tap to view" copy).
- Wallet default `siteUrl` is `moracat.sa` while the product is `moracat.co`; `PARTNER_VERIFY_KEY` absent from `render.yaml` → `/verify` 503 in prod, so the card's "Verify" QR does nothing at launch (fail-closed, but the "read by partners" copy is aspirational).
- `photoUrl` is an unvalidated free string on create/update DTO (`@IsUrl` would be cheap); no "remove photo" control (falsy can't clear).
- Docker HEALTHCHECK hardcodes port 4000 while `main.ts` honours `PORT`; no `Asia/Riyadh` TZ handling (UTC day-buckets shift admin "today" by 3h); `pnpm audit` is `continue-on-error`; no web e2e in CI.
- Safe-area inset missing on portal bottom-nav (sits under the iPhone home indicator); cookie banner uses `role="dialog"` for a passive banner; error toasts announce `polite` not `assertive`.
- DEPLOY.md is materially stale (mentions removed Redis; says SMS codes are logged; omits S3/Resend/Sentry/CORS envs; `db push` guidance conflicts with the migration story).

---

## What's genuinely solid (credit where due)

- **Commerce kill switch fails closed, verified end-to-end** — `commerceEnabled()` defaults off; global `CommerceGuard` runs before auth and 403s every money route including the entire webhooks controller; boot refuses `COMMERCE_ENABLED=true` without `PAYMENTS_MODE=live`.
- **Authorization/IDOR discipline** — every user-owned resource scopes by ownership; global `ValidationPipe` `whitelist`+`forbidNonWhitelisted` blocks mass-assignment (no `isStaff`/`likeCount`/`ownerId` in any DTO); all 27 admin routes carry `@RequirePermissions` with per-request DB permission checks; non-staff get 403, not data (e2e-tested).
- **Auth hardening** — bcrypt cost 12, DTO length caps; refresh rotation with reuse-detection → session revoke; reset tokens 32-byte, hashed, single-use, 1h expiry, constant-time; OTPs hashed + attempt/rate-capped; suspended/deactivated blocked at every entry incl. per-request; suspension is transactional (revokes sessions + hides cats) and effectively instant.
- **Upload security is real** — magic-byte sniffing (JPEG/PNG/WebP), 8 MB caps at both layers, `randomBytes` keys with no user filename (no path traversal), delete namespaced to `cats/`/`users/`.
- **Community privacy** — opt-in, field-gated `select`+`toCard()`; no email/phone/address/userId/qrToken ever exposed (verified field-by-field); like idempotency + atomicity are transactional and can't go negative; Most-Loved uses a real composite index.
- **Arabic normalization** is correct and unit-tested (combining marks/tashkeel/alef/hamza/yaa/taa-marbuta), applied on create/update/backfill, parameterized (no SQL-injection surface).
- **Identity spine** — Cat ID is unique + immutable, QR encodes an opaque token (never a URL), partner verify is key-gated + constant-time + fail-closed + first-name-only; **PDF export genuinely exists** (jsPDF, exact ID-1 mm) alongside PNG/print/story; soft-delete hygiene is atomic and complete.
- **Observability & ops** — Sentry wired (api+web, DSN-gated, zero bundle when off), pino request-id logs with auth redaction, graceful shutdown, multi-stage non-root Docker, CI runs `migrate deploy`+seed+smoke against live Postgres, money is uniformly `Decimal(10,2)`, pagination clamped (`?limit=100000` can't work).
- **Design & a11y** — skip link (RTL-correct), `<main>` landmark everywhere, exemplary focus traps + ceremony a11y, `:focus-visible` never removed, logical properties pervasive, LTR islands for numbers, honest empty/error states (never fabricates zero), 5 real bilingual legal docs, robots/sitemap/manifest/404/500 all present.

---

## Prioritized Action Plan (pre-launch, excluding payments)

**Blocker sprint (do first — ~2–4 days):**
1. **CR-1 + CR-2 + M-11:** add the 5 missing fields to `cats.update()`, fix allergy/health mapping both directions, wrap delete-then-update in `$transaction`, extend the serializer. *(One PR — the "complete the file" loop.)*
2. **CR-3:** baseline the prod DB, move `migrate deploy` to a pre-deploy step on a `DIRECT_DATABASE_URL`, add a boot drift check that degrades `/health`.
3. **H-9:** one-line `public/` copy in the web Dockerfile.
4. **H-8 + M-33:** fail boot (or Sentry-error) when email/SMS provider is missing in prod.
5. **H-1:** community feed pagination ("Show more").
6. **H-3:** `QueryError` on the portal cats page.
7. **H-4:** mobile marketing nav + login.
8. **H-6:** require re-auth to disable 2FA.

**High, before public launch (next):** H-2 (localize in-app notifications), H-5 (full waitlist export), H-7 (staff onboarding + seeded role permissions), H-10 (welcome story `exportSafeSrc`), H-11 (keyboard-open admin tickets), H-12 (cropper focus trap), H-13 (`role="alert"` on page-level errors — 15 min), H-14 (**decide Hijri vs Gregorian for Arabic dates** — a one-line product call to make before it hardens), M-7/M-8 (honest reactivate/delete copy), M-9 (archive→restore membership), M-10 (hide deactivated owners' cats), M-27b (token contrast fixes — 3 edits).

**Medium, launch-week or fast-follow:** M-1 (milestone dedup), M-2 (cursor pagination + preserve `sharedAt`), M-3 (URL filter state), M-5/M-6 (search empty state + real city facets), M-12 (name validation), M-21 (CSV BOM), M-22/M-23/M-24 (metadata + noindex + OG image), M-25/M-26/M-27 (aria-labels, contrast, reduced-motion), M-30 (orphaned uploads GC).

**Low / post-launch:** the 🟢 list above.

---

## Day-One Launch Checklist (verify immediately before going public)

**Data & schema**
- [ ] Prod DB baselined; `migrate deploy` succeeds against the **direct** URL; `_prisma_migrations` shows the init migration applied.
- [ ] Boot drift check green; `/health` reflects DB **and** schema state.
- [ ] CR-1/CR-2 fix deployed — create a cat, complete the file with vaccination + allergies, reopen: values persist and render on the card (no "[object Object]", no blank vaccination).

**Config & secrets (prod)**
- [ ] `DATABASE_URL` (pooled) + `DIRECT_DATABASE_URL` set; `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` ≥32 chars, non-default (boot asserts).
- [ ] `EMAIL_PROVIDER=resend` + valid `RESEND_API_KEY` + **verified** sending domain; send yourself a real verify email end-to-end.
- [ ] `S3_*` (R2) set; upload a photo in prod and confirm it serves from the public URL.
- [ ] `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_API_BASE_URL` / `CORS_ORIGINS` correct (apex+www); confirm no CORS errors from the real domain.
- [ ] `COMMERCE_ENABLED=false` confirmed; hit a money route → 403 `MEMBERSHIPS_COMING_SOON`.
- [ ] Twilio set **or** phone-login hidden; SMS drop logs an error in prod.
- [ ] `PARTNER_VERIFY_KEY` set if the "Verify" QR is meant to work day-one (else accept it's aspirational).

**Functionality smoke (as a real user, in prod)**
- [ ] Register → email OTP → dashboard; logout; login; password reset email arrives and works.
- [ ] Create a cat → ceremony → Cat ID issued; download PDF + PNG; share story renders **with** the photo (H-10).
- [ ] Make cat public → appears in `/community`; like from a second account → count + notification (in the owner's language, H-2); unlike; feed shows >24 if you seed 25+ (H-1).
- [ ] Search an Arabic name; apply a filter; empty-result copy is correct (M-5).
- [ ] Admin: log in as staff, view users/cats/waitlist; **export waitlist and confirm the row count matches the total** (H-5); suspend a test user → their cat disappears from community; non-staff user gets 403.

**Web/mobile/SEO**
- [ ] On a real phone: marketing header exposes nav + login (H-4); portal bottom-nav clears the home indicator.
- [ ] Web image built **with** `public/` (logo shows on the Cat ID card, H-9).
- [ ] `robots.txt` disallows `/portal`+`/admin`; `sitemap.xml` loads; a public cat link previews correctly on WhatsApp/Twitter (M-24).
- [ ] Legal pages (privacy/terms/cookies/guidelines/content) load in both languages.

**Ops**
- [ ] Sentry receiving events from api + web (throw a test error).
- [ ] Uptime monitor on `/health`; alert wired.
- [ ] DB backups/PITR enabled on Neon; know your restore procedure.
- [ ] Rate limiting acceptable for a single instance (or Redis-backed if scaling out).

---

## Appendix A — On the e2e smoke suite

Local run: **52/54 pass**. The 2 "failures" are both the wallet-pass assertions, and they are a **Windows-only test-harness artifact, not a product defect**: `apps/api/e2e/run.mjs` passes the RSA private key (multi-line PEM) to the API via `child_process.spawn`'s `env`, and Windows `CreateProcess` mangles multi-line environment values, so the child sees an empty `WALLET_GOOGLE_SA_KEY` and reports Google Wallet unavailable. **Verified the feature works** by booting the API with the key exported in-shell and calling `/api/wallet/availability` with a token → `{"google":true,"apple":false}`. On Linux CI the multi-line env passes intact, which is why CI is green. *Optional fix: base64-encode the key in `run.mjs` and decode in-process for the test path.*

## Appendix B — Method & evidence

Six parallel read-only code audits (security/auth, cat-ID lifecycle, community, web UX/i18n/a11y/SEO, admin, ops/perf/data) reading actual source with file:line evidence; every Critical and several High findings independently re-verified by hand (CR-1/CR-2 in the service + form code; H-4 live at 375px; H-9 in the Dockerfile; CR-3 in the boot CMD; wallet in a live API). Live boot: embedded Postgres + built API (:4000) + web dev server (:3000); key pages returned 200 (home, register, login, community, legal); community API returned real UTF-8 Arabic data. `pnpm typecheck` + `pnpm lint` clean.
