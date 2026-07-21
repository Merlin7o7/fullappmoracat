# MRC-REMEDIATION-2026-07-21 — Census Pre-Launch Fixes

**Companion to:** `MRC-AUDIT-2026-07-21-CENSUS.md`
**Scope shipped this pass:** all four Priority-1 Criticals + the high-ROI funnel/compliance fixes.
**Verification:** API build clean · 27 unit tests pass · **e2e 136 smoke + 33 commerce-off = 169/169 pass** · web typecheck + lint clean.
**Change surface:** 33 files (27 modified, 6 new). No Prisma schema change → no migration, fully backward-compatible.

---

## What was fixed, verified

### 🔴 P1.1 — Protect the census (the number is now hard to poison)
The census's brand claim is «this number is real». The display was already honest; the **input** was undefended. Now three layers stack on `POST /cats` and `POST /auth/register`:

- **Per-route rate limit** — cat creation throttled to 4/min/IP (was the 120/min global). `cats.controller.ts`. Env-tunable (`CENSUS_CREATE_THROTTLE`) so the e2e suite isn't fighting the limiter.
- **Per-account daily cap** — 8 cats/account/day, enforced *before* insert so a script never takes a founding ordinal it won't use. `security/census-integrity.service.ts` → `assertWithinDailyCap`. Env-tunable.
- **Proof-of-humanity (Turnstile)** — new `security/` module: `TurnstileService` + `TurnstileGuard`, wired end-to-end to a web `<TurnstileWidget/>` and the `x-turnstile-token` header. **Env-gated: a transparent no-op until `TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY` are set** — first value is never blocked by missing infra.
- **Integrity audit + alerts** — every registration writes a hashed-IP/UA row (PDPL: never raw IPs) and trips a `WARN` (→ logs/Sentry) when one IP is behind many accounts or one account registers unusually fast.
- **Admin review** — `GET /admin/census/abuse` surfaces suspicious IPs + high-velocity accounts. Read-only: it flags for a human, never deletes a cat, so the count stays a mechanical restatement of the table (R006).

### 🔴 P1.2 — City personalization (no more false claims)
- Homepage `census.foundingBody` (ar + en) no longer hardcodes "Riyadh Class of 2026" — it describes founding status by the real ordinal only. `lib/i18n.ts`. (The backend already computed the correct per-city label — e2e confirms "Founding Member — Jeddah Class of 2026" for a Jeddah cat.)
- The social share card (`opengraph-image.tsx`) dropped its hardcoded "Jeddah & Riyadh" line.

### 🔴 P1.3 — Full analytics (the census is now measurable)
- New consent-gated layer: **GA4, Meta Pixel, TikTok Pixel, Snapchat Pixel, Microsoft Clarity** (`lib/analytics.ts`, `components/analytics/pixels.tsx`). Each provider dark until its id is set **and** the visitor accepts.
- **PDPL-correct opt-in**: nothing fires before consent; a new `ConsentBanner` (accept/decline, no dark pattern) replaces the old "no ad trackers" notice (which would have become false). Consent consolidated to one surface.
- **Typed events wired through the funnel**, no PII ever sent: `hero_name_entered`, `cta_click`, `registration_started`, `sign_up`, `cat_creation_started`, `cat_registered {cat_number, city, source}`, `cat_id_revealed`, `public_opt_in`, `share_click`, `census_view`.

### 🔴 P1.4 — Founding-member system (the promise is now a real feature)
- `packages/core/src/census.ts`: a machine-readable `FoundingBenefit` framework — price-lock, first-tag, founders'-wall, early-access — bilingual, the single source of truth. `isFoundingPriceLocked()` is the commerce hook that will honour the locked rate at launch.
- Public API `GET /census/founding-benefits` serves the same list the product honours (so the marketing page can state it truthfully). Covered by e2e.

### 🟠 High-ROI funnel + compliance fixes
- **Newborn-kitten deadlock** fixed — an explicit 0y/0m age now enables the Issue-ID button (`cats/new/page.tsx`).
- **`/register` authenticated-visitor guard** — a signed-in member is redirected to add another cat instead of hitting the signup wall; header/footer are now session-aware.
- **Price-visibility contradiction** resolved — the ComingSoon preview no longer shows SAR prices, honouring the welcome page's "no prices before ready" promise.
- **PDPL erasure completed** — account deletion now frees every cat photo/cover/gallery object from R2 (was orphaning them).
- **Admin census dashboard** now excludes demo cats, matching the public service.
- **Dynamic OG** — the share card shows the **real live census count** when reachable, omitted gracefully on failure (never a fake number).

---

## Before → After (census-readiness lens)

| Category | Before | After | Why |
|---|---:|---:|---|
| Data & Analytics | 2 | **8** | Full consent-gated 5-provider stack + typed funnel events. (Not 9.8: server-side CAPI + dashboards are ops/config, not code.) |
| Security | 6 | **8** | Bot protection, integrity audit, PDPL media erasure. (Turnstile needs keys to *enforce*; no external pentest yet.) |
| Cat Census Campaign | 6 | **8** | Founding benefit real, integrity defended, copy honest. (Referral queue-jump still unbuilt.) |
| Landing Pages | 7 | **8.5** | No false city claim, session-aware, contradiction gone. |
| UX | 6 | **8** | Newborn fix, register guard, funnel instrumented. |
| Marketing (execution) | 5 | **7** | Measurement now exists; channel/nurture work is still plan-side. |
| Legal / Compliance | 6 | **7.5** | PDPL erasure complete, honest consent. (Policy copy review pending.) |
| **Overall (census-readiness)** | **65** | **~79** | Every Priority-1 Critical closed and verified. |

**Business (3) is unchanged** — the box-pricing inversion / auto-renew / VAT items are commerce-latent and correctly out of scope while commerce is off.

---

## Remaining (honest ledger — not done this pass)

| Item | Priority | Why deferred |
|---|---|---|
| **Turnstile + analytics go-live** | 🔴 ops | Code is done; needs the account keys pasted (Cloudflare + GA4/Meta/TikTok/Snap/Clarity). Until then both are no-ops. |
| **Referral queue-jump** (+10 places, visible position) | 🟠 | The viral loop. `Referral` model exists; the gamified queue is a real feature build (backend + UI), scoped next. |
| **Vet foundation** (make one clinic verify/record flow real) | 🟠 | Needed for the Phase-0 exit gate; a substantial platform effort, not a single pass. |
| **SEO** (hreflang, list-page skeletons) + **email nurture sequence** | 🟡 | Marketing-readiness; plan + build. |
| **Community photo moderation** | 🟡 | Before actively encouraging public cats. |
| **Box reprice + auto-renew + ZATCA** | 🟡 latent | Commerce-only; must land before flipping commerce, not before the census. |
| Password-toggle 44px target, `/verify` rate-limit, migration-timestamp collision | 🟢 | Minor; queued. |

## New opportunities discovered
- The founding-benefits endpoint + `isFoundingPriceLocked()` mean the census can now **show** the exact founding perks on the marketing page from the same source commerce will honour — a truthful FOMO surface with zero risk of over-promising. (Wiring the display is a small follow-up.)
- The integrity audit rows are a ready-made **"% verified registrations"** guardrail metric — pair it with the analytics north-star (`cat_registered`/week) for a two-number launch dashboard.
- The dynamic OG count is a compounding share hook; consider a per-city OG variant once city volumes justify it.

## Updated readiness
- **Census readiness:** a *scaled/public* census is now defensible once the two sets of keys are pasted (Turnstile + analytics). The three audit blockers (inflation, false copy, no measurement) are closed.
- **Launch readiness (commerce):** unchanged — still gated on box repricing + auto-renew + the vet exit gate.
- **Security:** materially improved; the front door is no longer trivially inflatable.
- **UX/UI:** the funnel's known breaks are fixed; the experience is honest end-to-end.
- **Technical:** 169/169 e2e green, no schema/migration risk, all changes backward-compatible.

*The headline: all four Priority-1 Criticals are implemented and verified. Moracat can run a controlled census today and a high-visibility public one the moment the Turnstile and analytics keys are provisioned.*

---

## Wave 2 (same day) — remaining tractable items

**Verification after wave 2:** core **52 unit tests**, **e2e 138 smoke + 33 commerce-off = 171/171**, web + api typecheck + lint clean.

- **Referral recognition loop** (the decision: *recognition + rewards, no line-jumping* — honors R006 and the Design Authority, which the code already defended). New `packages/core/src/referral.ts` (`referralRecognition`, milestones) with 9 unit tests. `account.referral()` now returns an honest **`brought`** count (friends whose cats *actually registered* — fraud-resistant, not raw signups), milestones, and a derived founding-supporter recognition. Portal `ReferralCard` shows recognition + an honest "cats you've helped join" progress bar and fires `referral_invite_sent` / `referral_link_copied`. **No buyable queue position was built** — the waitlist stays honest.
- **Founding-benefits display** — the census section now shows the 4 real perks (from `@moraqat/core`, the same source commerce honours).
- **Password reveal target** raised to ≥44px (R092) on the funnel form.
- **hreflang** — assessed and correctly *not* faked: the app serves both locales at one URL via a cookie, so `/ar` `/en` alternates would 404. Added honest `openGraph.locale`/`alternateLocale` (ar default, en alternate) + canonical instead.
- **`/verify/cat/:token` rate-limited** (60/min, env-tunable) against key-leak enumeration.
- **Migration-timestamp collision** — deliberately **left as-is**: the order is deterministic (alphabetical tie-break) and renaming an already-applied migration would corrupt Prisma's history on deployed DBs. The "fix" is more dangerous than the fragility.

### Still genuinely remaining (honest — needs dedicated effort, not faked)
- **Vet exit-gate flow** — the audit found the vet UI can't render its own API; making one clinic verify + record end-to-end is a real multi-day platform effort, not a bolt-on.
- **ML / pre-publish photo moderation** — reactive moderation (reports → hide) already exists; proactive NSFW screening is a real build + a product decision (hold-before-public vs. review-after), out of scope for a safe single pass.
- **Full email nurture sequence** — the lifecycle cron host exists; the multi-touch drip is a content + scheduling build.
- **Ops:** Turnstile + analytics keys (dashboard action, yours).
- **Commerce-latent:** box reprice, auto-renew, ZATCA (only when commerce flips on).
