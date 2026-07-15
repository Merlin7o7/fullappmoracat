# MORACAT — Senior UI/UX & Product Design Audit

**Reference:** MRC-UX-AUDIT-002 · **Date:** 2026-07-12 · **Method:** full read-only code audit of `apps/web`, `apps/api`, `packages/ui`, `packages/db` by seven parallel specialist reviews (marketing, auth/account, Add-Cat/Cat ID, subscription funnel/payments, community/benefits, design system/a11y/RTL/mobile, copy/i18n/edge states), each judged against `design/DESIGN-AUTHORITY.md` (R001–R120). Every finding cites file:line evidence.

---

## 0. Implementation log & corrections (2026-07-12, post-audit)

Ownership sprint 1 — "stop lying, open the doors." Every finding below was re-verified against live code before acting; one audit claim did not survive verification.

**Correction — the "shop 404 typo" was a false positive.** The audit reported `apps/web/lib/api.ts:131` as `` `\products` `` (a backslash escaping to `p`, supposedly 404-ing the shop). The actual line reads `` `/products` `` with a correct forward slash. The shop route is fine. This finding is **struck** from the launch blockers, quick wins, and conversion lists — a subagent hallucinated the character. (Lesson applied: file:line evidence still requires a direct read before an edit.)

**Shipped this sprint (typecheck-clean, web + api):**
1. **COGS leak closed** — removed `cogs` from the public `/plans` serializer (`plans.service.ts`). Zero web consumers; margins no longer exposed.
2. **Membership in the header nav** — added `/#plans` as the second nav item (`site-header.tsx`); the revenue product is now reachable from the persistent chrome.
3. **Funnel wiring** — the dashboard's "no active subscription" CTA now routes to `/portal/subscribe` (the computed plan builder), not the marketing tier table (`portal/page.tsx`).
4. **Fabricated testimonials killed** — two seeded quotes claimed box deliveries and multi-cat savings no one could have experienced pre-launch. The `MemberVoices` section is now gated off until commerce is live (prod-effective on deploy), and the seed is emptied with a comment forbidding invented voices. Honest social proof from the live community is the follow-up build.
5. **Honesty copy repairs** — the false "ready at any clinic with a single scan" claim rewritten to "in your pocket at every vet visit" (ar+en); the rotting "memberships launch in the coming weeks" de-dated (ar+en); bargain-register "ببلاش" → premium "مجاناً" in the marquee and closing copy.

Everything else in this document stands. The structural blockers (recurring billing, PSP return ceremony, benefits/redemption) remain and are sequenced in §8; several gate on business facts listed in §9.

---

## 1. Executive Summary

**Moracat is two products stitched at a seam, and the seam is where the money is.**

Everything *before* money is unusually good — often genuinely at the Apple/Stripe bar the repo demands. The RTL/Arabic engineering is near-flawless (219 logical-direction utilities vs 0 harmful physical ones; SSR-correct locale; unicode-range-scoped Lyon Arabic). The palette contrast is engineered with receipts — every shipped text pair computes ≥4.5:1 in both themes. The Cat ID ceremony is architected, not decorated: glyph-lock stamping rhythm, reduced-motion fallbacks, focus traps, honest failure states. The community consent/moderation loop is real PDPL work, not theater. The R021 checkout commitment line (full price + cycle + next-charge date above the pay button) is textbook.

Everything *at and after* money is unfinished in ways the polish conceals:

- **There is no month 2.** `nextBillingAt` is stored but nothing ever charges it — no cron, no scheduler, and Moyasar hosted invoices don't tokenize cards, so renewals *cannot* be charged. The "revenue engine" collects exactly one payment per member.
- **The success ceremony is unreachable in production.** All five real payment rails (mada, Apple Pay, STC Pay, Visa, MC) are hosted-page redirects that return the member to a raw list page showing an untranslated **"DRAFT"** badge. The beautiful activation screen only renders for the mock provider.
- **A misconfigured live environment silently fakes payments.** `PAYMENTS_MODE=live` with a missing key falls back to the mock adapter, which *approves* charges — membership activates, zero money moves.
- **The plan builder — the funnel's crown jewel — is orphaned.** No nav entry; the dashboard and subscriptions empty states route authenticated members *out of the portal* to the static marketing tier table, violating the authority's own "never chosen from a tier table" amendment.
- **Benefits are promised in five places and demonstrated in zero.** No partner page exists anywhere; one landing claim ("ready at any clinic with a single scan") is currently false; the redemption moment — one of "the two moments that decide everything" — has no member or partner UX at all.
- **The honesty constitution is breached on the homepage:** seeded testimonials describe box deliveries and multi-cat savings no member can have experienced, under the heading "From members who mean it."
- Plus a one-character typo that 404s the entire shop page, COGS (margins) leaking on the public `/plans` API, and ~15 places where raw English server errors surface inside the Arabic-default UI.

**The verdict:** the team demonstrably knows how to hold the bar — the ceremony, the consent architecture, and the charge-first payment discipline prove it. The gap isn't skill; it's that the designed experience currently *ends at the exact moment real money starts*. Community-mode is shippable today. Commerce launch is gated on the ten blockers in §5.

---

## 2. Scores

| Category | Score | Rationale |
|---|---|---|
| **Overall Product** | **64 / 100** | World-class pre-money surfaces; broken money seam. Not commerce-ready. |
| Product Strategy | **6.5 / 10** | The "ID is the hook, computed plan is the product" reframe is genuinely executed on the landing page and plan builder — then the funnel's own links betray it (tier-table routing, no nav entry, benefits without destination, stale "Jeddah & Riyadh" metadata vs kingdom-wide promise). |
| UX | **6.5 / 10** | Excellent flows (register drafts, name-first Add Cat, honest waitlist) undermined by dead-ends: OTP gate before first value, DRAFT purchase traps, duplicate-account recovery path, no email change, one-tap address deletion. |
| UI | **8 / 10** | Real design system, elevation ladder, cqw-locked ID-1 card, restraint mostly held. Docked for sub-44px utility targets, 6–7px card micro-type, gold/emoji drift, coupon-red offer badges. |
| Conversion | **4 / 10** | Orphaned plan builder, unreachable success ceremony, no recurring revenue, broken shop, discarded "Notify me" intent, calculator that computes the product's promise then goes nowhere, membership absent from the header. |
| Accessibility | **7 / 10** | Strongest palette math audited at this stage; universal focus-visible; skip links; three-layer reduced-motion. Docked for English SR strings in the design system, ARIA written more ambitiously than implemented (fake listbox/tabs/radios), sub-24px dismiss targets, missing `<main>` on 4 marketing pages. |
| Mobile | **7 / 10** | Thumb-zone bottom nav, safe-area system, superb photo pipeline. Docked for iOS auto-zoom on every 14px input (including checkout), the live card preview below the fold in both hero and Add-Cat, sticky-dock occlusion, 300px crop frame overflowing 360px viewports. |
| Design System | **8 / 10** | Full HSL-var tokens, documented contrast rationale, motion tokens; missing Switch/Checkbox/Textarea/IconButton primitives force app-side re-implementation (already copy-pasted 4×). |
| Emotional Design | **7 / 10** | The ceremony is a genuine Spotify-Wrapped moment and the greeting engine ("حياك الله يبو مشمش") is best-in-class R001. Docked because the *post*-ceremony story collapses: Verified/Inactive contradictions, a peak moment spent on a consent form instead of pride, ghost-town view counts, and a post-purchase moment scoring 3/10. |

Sub-scores from the specialist reviews: RTL/Arabic engineering **9/10** · Community safety & consent **8/10** · Motion governance **8.5/10** · Post-purchase moment **3/10** · Benefits communication **3/10** · Value visibility in commerce mode **4/10**.

---

## 3. Top 50 UX Issues (ranked by severity)

Format: `#. [Severity] Issue — evidence — impact → fix`

### Blockers

1. **[Blocker] Recurring billing doesn't exist — there is no month 2.** `apps/api/src/subscriptions/subscriptions.service.ts` stores `nextBillingAt`; zero `@Cron`/`ScheduleModule` anywhere in `apps/api`. Moyasar hosted invoices don't tokenize cards, so renewals can't be charged even with a job. → Renewal job + tokenized payments (Moyasar payments API with `save_card`) + next-order generation, shipped as one unit with renewal reminders (R025).
2. **[Blocker] Live payment mode silently falls back to the approving mock provider.** `payments/payment-provider.factory.ts:34-58`; mock approves at `mock-payment.provider.ts:45`. Misconfigured prod = memberships activate with zero money moved. → Unconfigured live adapter must throw 503 with dignified-retry copy. (R006, R118)
3. **[Blocker] The success ceremony is unreachable on every real payment rail.** All card rails return `PENDING`+`redirectUrl` (`moyasar.adapter.ts:62-68`); `returnUrl` dumps members on `/portal/subscriptions` (`subscriptions.service.ts:239`), which reads no params and renders an untranslated **DRAFT** badge (`subscriptions/page.tsx:149-157`). → `/portal/checkout/return` route: poll order status → "confirming your payment…" → full activation ceremony with the member's real `CatIdCard` flipping to Active. (R024, R031, R073, Stage 4)
4. **[Blocker] The plan builder is orphaned; the funnel routes to a marketing tier table.** No `/portal/subscribe` in `portal/nav.ts:25-36`; dashboard CTA → `/#plans` (`portal/page.tsx:334`); subscriptions empty state → `/#plans` (`subscriptions/page.tsx:115`). Violates the 2026-07-10 amendment ("never chosen from a tier table"). → Commercial-gated "Membership" nav item; every subscribe CTA → `/portal/subscribe?cat=…`.
5. **[Blocker] The shop never loads — a one-character path typo 404s every products request.** `apps/web/lib/api.ts:131`: `` `\products` `` → the `\p` escape drops the leading slash → `…/apiproducts`. The whole `/products` page (linked from header AND footer) permanently shows the error state. → `/products`; add an e2e smoke test.
6. **[Blocker] Fabricated testimonials under "From members who mean it."** `packages/db/prisma/seed.ts:385-387` → `app/page.tsx:427-465`: invented delivery/savings claims ("litter arrives before we run out", "multi-cat plan paid for itself") with 5-star ratings — no box has ever shipped. Manufactured social proof; legally risky under Saudi advertising rules. → Real Community-Beta voices or remove the section. (R006)
7. **[Blocker] Public `/plans` API leaks COGS.** `plans/plans.service.ts:24` serializes `cogs` — anyone can compute margin per box in DevTools. → Strip from public serializer.

### High

8. **[High] Benefits have no destination.** Promised at `i18n.ts:102`, `subscribe/page.tsx:375-405`, `moracat-story.tsx:69-93`, `about/page.tsx:16` — but no `/partners`, `/benefits`, or partner surface exists anywhere (all 40 routes globbed). → Honest partner directory, even small ("3 clinics in Riyadh, more monthly"), with coverage gaps admitted. (R006, R041–R049)
9. **[High] False claim: "ready at any clinic with a single scan."** `i18n.ts:87` — the QR is an opaque `MRCV1:` token only `PARTNER_VERIFY_KEY` holders can resolve (`verify.service.ts:32-62`), returning identity only — no vaccinations/weight/notes, and no clinic network exists. First vet who scans gets gibberish. → Rewrite to what's true. (R040)
10. **[High] Stage 6 (Redemption in the Wild) doesn't exist.** Only artifact is a JSON API (`verify.controller.ts:11-17`). No member "show at partner" moment, no savings confirmation (R042), no partner scan screen, no offline capability (R114). One of "the two moments that decide everything." → Design the pair: member side (offline card → scan → "Member rate honoured — you saved 45 SAR" into the tally) + minimal partner web view.
11. **[High] Abandoned PSP session = dead-end that blocks re-purchase.** DRAFT counts toward `CAT_ALREADY_COVERED` (`subscriptions.service.ts:188-199`); retry throws an English-only error; nothing explains DRAFT. → DRAFT card: "payment not completed" + **Resume payment** + **Discard**; expire stale drafts. (R112, R118)
12. **[High] "Nothing was charged" is asserted when it may be false.** `checkout/page.tsx:470-471` fires on any error — including post-charge persistence failures (charge happens *before* the transaction, `subscriptions.service.ts:227-247`). → Reserve for confirmed 402 declines; otherwise "we're checking — you won't be charged twice" + server reconciliation. (R006)
13. **[High] The renewal-reminder promise is printed but unbacked.** Promised at `checkout/page.tsx:461-464`; `subscriptionRenewalTemplate` (`mail.templates.ts:442`) has zero call sites; no scheduler. The silent charge is "the #1 trust-killer in KSA" (R025). → T-3-day reminder job shipped with recurring billing.
14. **[High] The commerce dashboard savings hero reads "Saved 0 SAR" — structurally forever.** `portal/page.tsx:208-230` sums order `discountTotal` (`account.service.ts:205`), which membership orders never set (`subscriptions.service.ts:278-312`). The anti-churn number (R041) proves the opposite. → Source from redemption events + member-rate deltas; until real, keep the beta ledger.
15. **[High] Commerce mode drops the WHY; the ID never visibly activates.** Benefits grid exists only in the waitlist variant; the plan builder shows only box contents; success renders a generic check circle though `CatIdCard` supports `membershipActive` (`cat-id-card.tsx:24,190`). → Benefits row on the builder + real card flipping Active on success. (R031, R073)
16. **[High] Cat coverage can silently mismatch the plan.** No `?cat=` defaults to ALL active cats (`checkout/page.tsx:169-172`); adjusting tiers never touches cats; no selection UI. A 3-cat household on an ESSENTIAL 1-cat box. → Pre-checked cat coverage chips on the builder; recompute on change.
17. **[High] The manage page hides the next charge.** `subscriptions/page.tsx:13-22` omits `nextBillingAt` (the API serializes it); only a delivery date shows. → "Renews 12 Aug — 249 SAR, VAT included" per card. (R025, R021)
18. **[High] Raw English server errors surface in the Arabic UI at ~15 sites.** `login/page.tsx:80`, `subscribe/page.tsx:372` (raw message as toast *title*), `subscriptions:53`, `settings:385,446`, `checkout:474`, `verify-email:51`, `cat-manage-drawer:40`, `addresses:69`… API messages like "email must be an email" reach Arabic members at peak-stress moments. → Error codes from the API + shared `friendlyError(err, isAr)` (extend the existing `registerErrorMessage()` pattern). (R084, R101, R113)
19. **[High] Email-OTP verification hard-gates the Cat ID.** `register/page.tsx:105` → `/verify-email`; the whole portal spins until `emailVerified` (`portal/layout.tsx:35,38`). First value hostage to email deliverability, against the <2-minute north star. → Soft-gate: name the cat and run the ceremony immediately; require verification before outbound actions only.
20. **[High] "Wrong email? Fix it here" creates a duplicate account and orphans the first.** `verify-email/page.tsx:95-110` pushes to `/register` with the wrong-email session live. → Authenticated change-email endpoint, inline on the verify page. (R115)
21. **[High] The post-deletion farewell is a dead query param.** `settings/page.tsx:158` redirects to `/?farewell=1`; nothing anywhere reads `farewell` (grep-confirmed). The leaver lands unacknowledged on a sales page. → Quiet farewell banner on the homepage. (R064, R068)
22. **[High] Address deletion is one tap, no confirmation, no undo, no edit.** `addresses/page.tsx:94-104`; the box's delivery address. The only destructive action in the app that doesn't confirm. → Inline confirm + edit/set-default (PATCH). (R116, R117)
23. **[High] "Notify me" dead-ends at a login wall and loses the destination.** `products/page.tsx:204-211` → `/portal/subscribe?from=shop`; guests bounce via `portal/layout.tsx:33` `router.replace("/login")` with no `?next=`. Highest-intent pre-launch signal discarded. → `/register?next=…` + preserve `next` through the portal redirect.
24. **[High] Membership — the revenue product — is absent from the header nav.** `site-header.tsx:60-66`; `t.nav.plans` exists in the dict but is unused. Nav has (broken) Shop and Blog instead. → Add the Membership item; two lines.
25. **[High] The feeding calculator computes the product's promise, then goes nowhere.** `tools/feeding/page.tsx:264-327` shows "Your monthly plan" + SAR cost with zero CTA. Best-aligned SEO page, zero funnel entry. → CTA card carrying weight/age via sessionStorage (the hero's existing pattern).
26. **[High] Three contradictory ID states on adjacent surfaces.** Welcome badge "Inactive" (`welcome/page.tsx:127`) vs card pill "Verified" (`cat-id-card.tsx:332-341`) vs cats-list "Inactive" ungated by commerce mode (`cats/page.tsx:212-214`). → One vocabulary driven by one function. (R040, R087)
27. **[High] No bridge from the Inactive ID to activation — and onboarding copy that expires.** "When memberships launch…" (`welcome/page.tsx:118`) isn't gated on `commerceEnabled()`; the Inactive pill is never tappable; checkout exists but no cat surface routes there. → Tappable status → plan builder; branch copy on commerce mode.
28. **[High] The "bring them home" phone number can silently fail to save.** `cats/new/page.tsx:84-92` — `.catch(() => {})` then local state shows it saved. A lost cat scanned at a clinic shows "Emergency: —". → Surface failure with retry, without blocking the ceremony. (Card job #1, R115)
29. **[High] The live card preview is below the fold on mobile in BOTH the hero and Add-Cat.** `app/page.tsx:59-150` and `cats/new/page.tsx:136-243` (no `order-*`; the journey does it right at `cat-onboarding-journey.tsx:167,217`). The product's signature interplay is desktop-only in a mobile-dominant market. → Mirror the journey's ordering / compact sticky mini-card.
30. **[High] The community's "always visible" section dock is occluded by both sticky headers.** Dock `sticky top-0 z-20` (`community-browse.tsx:299`) under the portal's `top-0 z-30 h-16` header (`portal/layout.tsx:103`) and the public floating header. → Offset by header height.
31. **[High] Public profiles hardcode `membershipActive={false}`.** `community-profile-view.tsx:134`. The moment commerce flips on, every paying member's shared profile publicly shows "Inactive". → Pass real status through the community read model (already selected in `verify.service.ts`).
32. **[High] Plan contents are English-only and leak the "mass" merchandising grade.** Single `label` in seed (`seed.ts:98-136`) rendered verbatim in the Arabic UI (`subscribe:221-231`, `checkout:300-309`); "Dry food — mass (kg)" tells Essential buyers they get the cheap stuff. → `labelAr`/`labelEn` with member-facing names.
33. **[High] Invoices are a dead button; VAT 15% is never broken out anywhere in the UI.** `orders/page.tsx:61` (no onClick, `aria-label="invoice"` unlocalized); no order-detail route; success screen discards `taxTotal`/`orderNumber`. CLAUDE.md mandates the breakout. → Order-detail + invoice view (net / VAT / total) + PDF.
34. **[High] `/contact` and all five `/legal/*` pages declare canonical=homepage.** Inherited from `layout.tsx:81` — Google is told they're duplicates. → Per-page `alternates`.
35. **[High] The feeding calculator is unusable non-visually.** Unlabeled sliders/toggles, no `htmlFor`, selection color-only (`tools/feeding/page.tsx:79-207`). → Labels + `aria-pressed` + radiogroup. (WCAG 1.3.1/4.1.2)

### Medium

36. **[Medium] Email cannot be changed anywhere.** The login credential + recovery channel has no edit path (`settings/page.tsx:330`). → Change-email flow (also fixes #20).
37. **[Medium] PDPL data export fails silently.** `settings/page.tsx:141-152` — no `onError` on the most compliance-sensitive button. → Toast + retry (pattern exists 10 lines below).
38. **[Medium] "Remember me" is a false promise.** Tokens always persist to localStorage + 30-day cookie regardless (`lib/auth.tsx:107-123`). → sessionStorage/session-cookie when unchecked; longer-term, httpOnly sessions.
39. **[Medium] 2FA: no QR (raw base32 shown; `otpauthUrl` fetched and ignored), no recovery codes, and Google-only accounts can never disable it** (`settings/page.tsx:458,517-527`). → QR render + one-time recovery codes + fresh-credential re-auth.
40. **[Medium] Expired reset link strands the member on a form that can't succeed.** `reset-password/page.tsx:46-48`. → Swap to invalid-link state + one-tap "send me a new link".
41. **[Medium] Community consent is one-shot forever and narrower than what it gates.** Re-publicising never re-attests; new gallery photos never re-checked; attestation not viewable/withdrawable by name (`cat-community-panel.tsx:48-51`, `cats.service.ts:739-741`). → Informed-consent sentence + "Consented {date} · make private anytime" + re-attest on new photos. (R106)
42. **[Medium] No block/mute — a harassed member's only remedy is self-removal.** HARASSMENT is in the report taxonomy but no block capability exists. → v1: one-tap visibility controls + documented harassment path.
43. **[Medium] Ghost-town amplifiers.** Raw view counts ("7 views"), "Showing 12 of 12 cats" (`community-browse.tsx:429-435,494-497`) — while the page's own comment forbids small member counts (R006). View counting is also materially wrong (cache-deflated, bot-inflated, `community.service.ts:123-126` vs `revalidate: 60`). → Threshold displays; beacon-based counting.
44. **[Medium] A member browsing the community has no path to share their own cat.** Share CTA exists only in the zero-cats empty state; the control is buried in a manage drawer. → Inline "مكان {name} محجوز — شاركه" card in the grid.
45. **[Medium] Guest like/report intent is lost across the login round-trip.** `window.location.href` full reload, no intent param (`community-browse.tsx:153-159`). → Carry intent in `next`, apply on return. (R117)
46. **[Medium] The cancel dialog never offers pause.** `subscriptions/page.tsx:119-136`; API supports `pausedUntil`. R062's entire point is pause intercepts cancellation. → Quiet third option with resume date.
47. **[Medium] BNPL (Tabby/Tamara) offered on a monthly recurring membership.** Neither PSP supports merchant-initiated recurring; instalments on month 1 + fresh session each cycle = renewal failure by design (`checkout/page.tsx:56-57`). → Drop from subscription checkout.
48. **[Medium] R023 freedom line missing from the checkout page itself.** Pause/cancel note exists on the builder only; deep links skip the builder; card details are entered on the *next* screen. → Repeat the one-liner under the commitment line.
49. **[Medium] Journey data is only safe moving forward.** `cat-onboarding-journey.tsx:125-131` persists only on `next > step`, swallows failures; "Later"/exit persist nothing. → Persist both directions + dirty-exit guard. (R117)
50. **[Medium] Second-cat flow auto-enrolls into the 7-chapter journey; the welcome page promises "two minutes" for ~35 optional inputs.** (`cats/new/page.tsx:304`; `welcome/page.tsx:143-144`) → Non-first cats land on the cats page with the existing completeness invite; honest time framing.

*Also logged (56+):* orders empty state says "launching soon" ungated by commerce mode; support-ticket close has no confirm/reopen; verify-email auto-send failure masquerades as a cooldown; 2FA challenge detected by regex on the error message (breaks when errors localize); public-profile back-link strands portal members; reporter never learns the report outcome; `cat_hidden` notification has no appeal link; legal content policy routes reporters to email instead of the built in-app flow; bad `?cat=` param silently disables checkout; waitlist "joined" state is client-only; checkout header renders "تفعيل عضوية " with a trailing space when cats are empty.

---

## 4. Top 50 UI Improvements

### Design system (`packages/ui`)

1. **Localize the design system's SR strings** — `drawer.tsx:49` "Close", `toast.tsx:114` "Dismiss", `misc.tsx:12` "Loading", `data-table.tsx:67-71,127` sort labels + "No data" — English chrome for Arabic-default SR users. Add a `labels`/locale context; fixes every consumer at once.
2. **Kill iOS auto-zoom:** `text-base sm:text-sm` on Input/Select (`input.tsx:15`, `field.tsx:101`) — 14px inputs jolt-zoom the register/login/checkout money path.
3. **Fix sub-24px dismiss targets:** toast dismiss ≈20px (fails even WCAG 2.5.8), drawer close ≈32px, password reveal ≈24px, "make primary" star 28px — 44px hit areas via padding + negative margin.
4. **Dialog needs `max-h-[85dvh] overflow-y-auto`** (`dialog.tsx:50`) — destructive confirms render off-screen at 200% zoom (Drawer already does this right).
5. **Promote the settings-page Switch into packages/ui** — the best implementation (RTL thumb, aria-checked) is currently copy-pasted 4×; add Checkbox and Textarea primitives too.
6. **Add an `IconButton` primitive (44px default)** — 68 raw `<button>`s in 34 files hold discipline by convention only.
7. **Toast double-announcement + no touch pause:** drop per-card `role` inside the live regions; add `onTouchStart` pause; consider 6s default (tight for Arabic two-liners).
8. **Marquee is pause-on-hover only** (`globals.css:337-340`) — hover doesn't exist on touch/keyboard; WCAG 2.2.2. Add focus-within/pointer pause.
9. **DataTable scroll container unreachable by keyboard** (`data-table.tsx:52`) — `tabIndex={0}` + region role.
10. **`AnimatedCounter` defaults to `en-US`** (`animated-counter.tsx:22`) — the savings tally renders Latin digits in Arabic unless every caller remembers. Read locale from context.
11. **Dialog scrim-click unconditionally dismisses** — typed content wiped by a stray tap (`dialog.tsx:41`). Dirty-state guard prop. (R117)
12. **Deprecate one shadow vocabulary** — `soft`/`soft-lg` alias `e1`/`e2`; both used in app code.
13. **Bottom sheet lacks a grabber/swipe-dismiss** (`drawer.tsx:41`).
14. **`.pb-nav` hardcodes the nav-height estimate** (`globals.css:330`) — wrapping Arabic labels at 2x zoom overlap content. Drive from a CSS var.
15. **Reduced-motion loops snap to random frames** — add `animation-play-state: paused` for ambient loops (`globals.css:230-239`).
16. **Separator role noise** → semantic `<hr>` (`misc.tsx:6`); **Avatar alt duplicates adjacent names** → `decorative` prop (`avatar.tsx:36`).
17. **Lint fence for arbitrary values** — 73 bracket-values / 21 inline hex are healthy counts; keep them that way with an ESLint rule.

### App-level craft

18. **Tokenize `cat-id-story.tsx`** — re-declares the palette as literals (`:52,74,116,119`); won't theme. Comment `cat-id-card.tsx`'s fixed palette as export-intentional; mint `--stage` tokens for the ceremony's dark stage.
19. **Clamp non-ceremony transitions to ≤300ms** — `duration-700` (`portal/page.tsx:275`, `cat-id-card.tsx:163`), `duration-500` ×3, framer 0.5–0.6s — reads as lag, not luxury. (R072)
20. **Restore `<main>` landmarks** on home/blog/products/feeding (`<section id="main">` breaks SR landmark nav on the highest-traffic pages).
21. **CatSwitcher announces `listbox` but implements none of it** (`cat-switcher.tsx:68,87`) — no options, no arrow keys, no aria-selected. Drop the claim (disclosure pattern) or implement combobox; label the search input.
22. **Radio groups without the radio keyboard model, copy-pasted 3×** — payment methods, addresses, plans (`checkout/page.tsx:415-446,337-380`, `subscribe:246-291`). One shared component with roving tabindex.
23. **Fake tabs in community-browse** (`:300-324`) — `role="tab"` without panels/arrow keys. Use `aria-pressed` buttons.
24. **Journey stepper: tabs without panels; step changes don't move focus** (`cat-onboarding-journey.tsx:361-388`).
25. **The Add-Cat progress text is inside `aria-hidden`** (`cats/new/page.tsx:139-146`) — SR users get no step context. One-line fix.
26. **Stickers can cover the QR and ID number** — keepsake layer is z-10 over the paper band (`cat-id-card.tsx:279-299`); travels into every export. Clamp sticker `y` to keep the band clear.
27. **Crop modal overflows 360px viewports** — `FRAME_W = 300` fixed (`photo-uploader.tsx:271`) + chrome = 372px. `min(300, vw - 88)`.
28. **Card micro-type: 5.8–8.5px cqw text is font-scale-immune** (`cat-id-card.tsx:234,255,325`) — keep cqw for export; pair an on-screen HTML line in real rem. (R094)
29. **Sticker placement is pointer-only** — arrow-key nudging for the existing selection model.
30. **Gold ×3 + emoji frames on a civic credential** (`lib/cat-profile.ts:201,218,231`; 16-emoji sticker sheet) vs "no luxury gold, never infantilising". Thin the golds; swap emoji frames for the existing Illo set.
31. **Ceremony tertiary text at `text-white/50`** (`cat-id-ceremony.tsx:338,431`) — lift to /70 on the scrim.
32. **Offer badge in destructive red + strike-through price = coupon aesthetics** (`products/page.tsx:183-201`) → calm "Member rate" chip + "You save 12 SAR". (R085)
33. **Blog index never renders real cover images** — `post.coverUrl` available, never read (`blog/page.tsx:78-83`); every card is the same placeholder cat.
34. **Blog index is client-fetched only** — crawlers get skeletons; convert to server component with `revalidate` (the detail page's exact pattern).
35. **Footer legal-entity line: 11px at /60 opacity ≈3.5–4:1** (`site-footer.tsx:136`) — bump to /85.
36. **Products toolbar sub-44px** — filter chips ≈32px, search ≈34px, sort ≈34px (`products/page.tsx:79-117`).
37. **Calculator segmented/toggles sub-44px + results below the inputs on mobile** — sticky compact summary bar.
38. **Header lang/theme toggles at 40px** (`toggles.tsx` + button `sm`) — the two most-used controls for a new Arabic visitor.
39. **Community filter chips ≈30px, dropdown h-8** (`community-browse.tsx:515-549`) — `min-h-11`.
40. **Waitlist interest chips: <44px, color-only selection, no focus ring** (`subscribe/page.tsx:533-547`) — on the beta's primary conversion widget.
41. **Site-header mobile menu: no focus containment or scroll lock** (`site-header.tsx:125-143`) — `useFocusTrap` already exists in the repo.
42. **AR hero accent `whitespace-nowrap` at 48px** (`page.tsx:75`) — clips/overflows ≤375px. Allow wrapping below `sm:`.
43. **Testimonials section pops in with CLS** (`page.tsx:429`) — skeleton or SSR.
44. **Naked spinners at high-emotion entry points** — checkout, welcome, journey (`checkout:88`, `welcome:37`, `cats/new:28`) → purposeful labels ("نجهّز احتفال {الاسم}…"). (R119)
45. **Route-level `loading.tsx` is Arabic-only for everyone** — bilingual like `error.tsx`.
46. **Health-record tabs are voids** ("No vaccinations recorded", `cat-health-panel.tsx:101-116`) → welcome states with the cat's name, per the app's own R111 standard.
47. **Subscription action buttons all spin together** (`subscriptions:93-101`) — key pending state by verb (the addresses page already does).
48. **Register CTA bypasses Button's `loading` prop** (`register/page.tsx:223-224`) — loses `aria-busy` on the most important form.
49. **Community browse error says "refresh the page"** instead of the app's own `QueryError` retry pattern (`community-browse.tsx:369-374`).
50. **Dead invoice icon button + unlocalized `aria-label="invoice"`/"close"** (`orders:61`, `support:210`) — remove or wire; localize.

---

## 5. Top 10 Launch Blockers (commerce launch gate)

1. **Recurring billing + renewal reminders don't exist** — ship as one unit (tokenized Moyasar payments, renewal cron, T-3d reminder email). Without this there is no subscription business, and the first silent charge would break the product's central trust promise (R025).
2. **Live-mode silent mock fallback** — misconfigured prod approves fake payments and activates memberships. Must fail loudly (503).
3. **PSP return black hole** — all real payment rails end on a raw list with an untranslated DRAFT badge; the activation ceremony must actually be reachable (`/portal/checkout/return` + polling + CatIdCard flip).
4. **Funnel wiring** — Membership nav item; dashboard/subscriptions CTAs → `/portal/subscribe`, not the marketing tier table.
5. **DRAFT purchase trap** — resume/discard affordances + draft expiry, or your highest-intent users get hard-stuck with an English error.
6. **COGS leak on public `/plans`** — one-line strip, do it today.
7. **Shop 404 typo** (`api.ts:131`) — one character; also removes a dead top-nav destination.
8. **Honesty repairs:** fabricated testimonials replaced/removed; "any clinic with a single scan" rewritten; "memberships launch in the coming weeks" un-dated; orders empty state gated on commerce mode. Each is copy-only and each is a screenshot-able trust breach.
9. **Benefits destination + minimal redemption loop** — a small honest partner directory and the "member rate honoured — you saved X" confirmation, or the membership's stated value is unverifiable at launch.
10. **Money-surface bilingualism + VAT** — API error codes → bilingual messages at checkout; plan contents `labelAr`/`labelEn` (and kill the "mass" grade); VAT 15% broken out on success screen + invoice view (a CLAUDE.md legal requirement).

---

## 6. Top 25 Conversion Opportunities

1. Wire the funnel entry (nav item + portal CTAs → plan builder) — the single largest lever; the builder is excellent and currently unreachable by intent.
2. Build the PSP return ceremony with the real `CatIdCard` flipping Active — converts the payment into the product's second-biggest emotional moment.
3. Recurring billing + reminders — retention *is* the business model; month 2 is the conversion that matters most.
4. Fix the shop typo — resurrects an entire funnel surface.
5. Persistent header CTA "Create your cat's ID" (Login → ghost) — the only sticky action today addresses existing members.
6. Feeding calculator → plan bridge carrying weight/age (sessionStorage pattern exists) — the best-aligned SEO page currently converts at zero.
7. "Notify me" → `/register?next=…` + preserve `next` through the portal redirect — stop discarding product-level demand signals.
8. Benefits row on the plan builder ("activates {name}'s ID · member rates at partners") — commerce mode currently sells kibble, not membership.
9. Honest partner directory — unverifiable promises convert poorly and churn instantly at launch.
10. Redemption savings confirmation → cumulative tally — the R041 anti-churn engine, currently unbuilt.
11. Fix the "Saved 0 SAR" hero source — the flagship value proof currently proves the opposite.
12. Make the Inactive pill/badge tappable → plan builder — the desire mechanic needs its one-tap path.
13. Branch welcome copy on `commerceEnabled()` — otherwise launch day tells new members memberships haven't launched.
14. FAQ/objection section on the landing page (endpoint + seeds already exist) — trust-precedes-ask for renewal/pause/VAT/coverage questions.
15. Replace fabricated testimonials with real founding-member voices — fake proof is negative proof once noticed.
16. Mobile hero: live card visible while typing the name — the strongest conversion mechanic is desktop-only today.
17. Mobile Add-Cat: card above the form (`order-*` pattern exists in the journey).
18. Mobile auth: show the personalized Cat ID preview (currently `hidden lg:flex`) — the motivator is invisible where conversion happens.
19. Move the story-share CTA into the ceremony peak; consent fork attached to it — shares-per-member is a guardrail metric taxed at its highest-intent moment.
20. "Share your cat" affordance for members browsing with private cats — the community's supply engine.
21. Soft-gate email verification — first value before inbox roulette.
22. Cat coverage chips at the builder — right-sized commitments refund less and churn less.
23. Next charge + amount on subscription cards — renewal visibility is retention trust.
24. Pause option inside the cancel dialog — the R062 save-the-save.
25. Persist waitlist joined-state + carry guest like/report intent through login — recognition (R001) and never losing intent (R117).

---

## 7. Top 20 Quick Wins (each <1 day, outsized impact)

1. `\products` → `/products` (`apps/web/lib/api.ts:131`) — resurrects the shop.
2. Strip `cogs` from the public plans serializer (`plans.service.ts:24`).
3. Live mode without PSP creds → throw 503 instead of mock fallback (`payment-provider.factory.ts:36-39`).
4. Membership nav item + portal subscribe CTAs → `/portal/subscribe` (~10 lines).
5. Render the farewell banner for `?farewell=1` on the homepage (~20 lines, closes a constitutional promise).
6. Shared `friendlyError(err, isAr)` + sweep ~15 `onError` sites — biggest trust win per hour.
7. Shared `fmtSar(n, isAr)` + sweep ~15 price sites — currency currently renders 3 ways, 2 on the checkout page alone.
8. Add DRAFT to the status badge map with "payment not completed" copy + show `nextBillingAt` and amount (data already serialized).
9. Print order number + amount + VAT on the success screen (data already returned) and render `CatIdCard membershipActive` there.
10. `text-base sm:text-sm` on Input/Select — kills iOS checkout zoom.
11. Localize the 5 hardcoded English SR strings in packages/ui via a `labels` prop.
12. Community sticky dock: offset below the portal header (`top-16`).
13. Rewrite the "any clinic scan" string; un-date "coming weeks"; gate the orders empty-state copy on commerce mode.
14. Stop hardcoding `membershipActive={false}` on public profiles — one prop.
15. Address-delete confirm dialog + ticket-close confirm (copy drafted in the audit appendix).
16. Mobile ordering: `order-*` on the Add-Cat grid + compact hero card (pattern exists in the journey).
17. Unify ID-state vocabulary (gate "Inactive" on `commerceEnabled()`; welcome badge matches the pill).
18. `localizeName()` in welcome + ceremony + manage-drawer — the transliteration engine is skipped exactly where the cat is most the hero.
19. Najdi rewrites for 404/error pages, "Submit ticket" → "Send to support", "Moraqat Support" → "Moracat Care", "ببلاش" → "مجاناً".
20. Stop swallowing the emergency-phone save failure (`cats/new/page.tsx:91`) — non-blocking toast + retry.

---

## 8. Prioritized Implementation Roadmap

### Phase 1 — Critical (must fix before commerce launch)

**Money works and tells the truth:**
- Recurring billing: Moyasar tokenized payments (`save_card`), renewal cron, next-order generation, fulfillment trigger — shipped together with the T-3-day renewal-reminder email (R025). *This is the launch gate.*
- Kill the live-mode mock fallback (503 + dignified copy).
- `/portal/checkout/return`: poll → "confirming…" → activation ceremony with the real card flipping Active; DRAFT resume/discard + expiry.
- "Nothing was charged" only on confirmed declines; reconciliation otherwise.
- VAT breakout on success + order-detail/invoice view; strip COGS.
- R023 pause/cancel line on the checkout page; next charge + amount on subscription cards.

**The funnel exists:**
- Membership nav item; all subscribe CTAs → plan builder; cat-coverage chips; benefits row on the builder.
- Fix shop typo; "Notify me" → register with `next` preserved.

**Honesty repairs (all copy-scale):**
- Testimonials, clinic-scan claim, "coming weeks", orders empty state, welcome-page commerce branch, ID-state vocabulary unification + activation bridge.

**Bilingual money path:**
- API error codes + `friendlyError` sweep; plan `labelAr`/`labelEn` (remove "mass"); `fmtSar` sweep.

**Benefits are demonstrable:**
- Honest partner directory v1 + the redemption confirmation loop design (member side minimum).

### Phase 2 — High Impact

- Real savings-tally source (redemption events + member-rate deltas) feeding the R041 dashboard hero; zero-filtering discipline in commerce mode.
- Apple Wallet (PassKit) — the missing half is the iPhone-dominant Saudi half — plus offline card caching (localStorage read-only render + online/offline banner). (R034/R036/R114)
- Soft-gate email verification; authenticated change-email flow (fixes the duplicate-account trap); expired-reset-link recovery.
- Pause inside the cancel dialog; BNPL decision (recommend: drop from subscriptions).
- Mobile conversion set: hero/Add-Cat card ordering, auth-page card preview, iOS input zoom, crop-frame responsiveness.
- Accessibility set: packages/ui SR localization, sub-44px target sweep (toasts, drawers, chips, toggles, calculator), `<main>` landmarks, CatSwitcher/radio/tabs semantics, Dialog max-height, calculator labels.
- Ceremony peak: share CTA at the reveal, consent fork attached; community share affordance for members; ghost-town thresholds; consent hardening (informed sentence, withdraw-by-name, re-attest on new photos).
- 2FA QR + recovery codes; data-export error handling; "Remember me" honesty; address edit/set-default + delete confirm.
- Landing: FAQ section, canonical fixes, stale Jeddah/Riyadh metadata, calculator bridge, header CTA.

### Phase 3 — Nice to Have

- Extract inline `isAr ?` ternaries into per-surface message modules — the only durable fix for register drift, plurals ("٥ رسالة" → "٥ رسائل"), and gender agreement (female cats addressed in the masculine at the ceremony).
- Najdi voice pass on all edge states; loading-state labels everywhere; bilingual `loading.tsx`.
- Sticker band-clamp + keyboard nudging; gold/emoji thinning; card on-screen text pairing (R094).
- Blog SSR + cover images; testimonials CLS; WhatsApp contact link; org JSON-LD.
- Reporter outcome notifications; appeal deep-link; block/mute v1; on-demand revalidation on moderation hide.
- Design-system additions: Switch/Checkbox/Textarea/IconButton primitives, shadow-alias cleanup, arbitrary-value lint fence, bottom-sheet grabber, reduced-motion resting frames.
- Journey polish: bidirectional draft persistence, second-cat routing, completeness-invite threshold, honest time framing, 2FA regex → structured flag.

---

## 9. Open Questions (business decisions needed)

1. **Commerce launch date** — "in the coming weeks" is already ~1 week old and hardcoded in three places. Is there a real date? If yes, state it and honor it; if no, remove the time anchor now.
2. **BNPL on subscriptions** — Tabby/Tamara can't do merchant-initiated recurring. Drop them from subscription checkout (recommended), or keep them for a future one-off shop only?
3. **Apple Wallet** — PassKit needs an Apple Developer cert + pass-type ID. Given iPhone dominance in the target demo, is this budgeted for Phase 2? (Google Wallet already ships; the missing half is the bigger half.)
4. **Partner network reality** — how many partners are actually signed? The honest-directory recommendation (and the "founding partners" copy) depends on whether the set is 0, 3, or 30.
5. **Moyasar contract** — does the account have the payments API (tokenization) enabled, or invoices only? This determines the recurring-billing architecture in Phase 1.
6. **Verification soft-gate** — product call: is community publishing the only action that truly requires a verified email, or does support/checkout too?

---

*Full per-domain findings (7 specialist reports, ~180 findings with file:line evidence, computed contrast table, RTL/grep counts, and drafted bilingual copy rewrites) are preserved in the session transcript. This document is the synthesis of record.*
