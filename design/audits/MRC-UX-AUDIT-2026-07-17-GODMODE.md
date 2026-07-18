# MORACAT — God-Mode Product Experience Audit

**Reference:** MRC-UX-AUDIT-003 · **Date:** 2026-07-17 · **Method:** full read-only audit of every surface — marketing site, auth + onboarding, money path, member portal, community, admin panel, emails, and design system — by seven parallel specialist reviews, each judged against `design/DESIGN-AUTHORITY.md` (R001–R120), synthesized against the 2026-07-12 audit (MRC-UX-AUDIT-002, scored 64/100) and the 14 commits shipped since. Every finding cites file:line evidence from the current working tree.

---

## 1. Executive Summary

### Overall product score: **68 / 100** (up from 64 on 2026-07-12)

**The verdict in one paragraph:** Moracat has world-class *moments* connected by broken *promises*. The Cat ID ceremony, the Najdi greeting engine, the RTL/Arabic engineering, the consent architecture, and the payment-capture discipline are genuinely at the Apple/Stripe bar the repo demands — several specialist reviewers called individual pieces best-in-class. But the product currently makes at least **six written claims that are false** ("renews 17 Oct" — nothing renews; "we'll remind you" — no scheduler exists; "Best value" — no discount exists; "Prices include VAT" — VAT is 0% and unregistered; homepage promises a computed plan — the funnel sells three tiers; every shared cat profile publicly stamps the cat **"Inactive"**). And commerce is **deployed to production while the back office cannot operate it**: a support agent can resolve roughly 1 of the top 10 member problems from the admin panel — no refund UI, no order detail view, no admin subscription controls, and dashboard revenue that counts cancelled orders.

**What improved since 2026-07-12** (verified in code): the silent mock-payment fallback now fails loudly (`payment-provider.factory.ts:47`); the PSP return black hole is 80% fixed — `/portal/checkout/return` polls and runs a real activation ceremony (scored 8.6/10); the plan funnel is wired into the portal; the shop typo, COGS leak, and fabricated testimonials are resolved; the box builder and consumption quiz shipped.

**What the pivot broke:** moving to prepaid terms via Tamara dissolved the old "silent renewal charge" risk — but created a new class of money-trust defects: **cancel now confiscates a prepaid term** with no refund path, **pause deactivates the Cat ID while Moracat holds the member's money** and silently eats the paused months, an **abandoned Tamara tab locks the cat out of purchase** with no resume, and the **term-end cliff** (first cohort: ~October 2026) has no reminder, no lapse state, and no renewal mechanism.

### Biggest strengths
1. **The Cat ID ceremony** — two-act stamping theatre with exemplary a11y, reduced-motion discipline, and the best copy in the product. A real Spotify-Wrapped foundation.
2. **RTL/Arabic engineering** — one physical-direction class in the entire web app; SSR-correct locale; Hijri-aware dates; Arabic-Indic digits; the strongest RTL implementation any reviewer had audited.
3. **Honesty infrastructure** — capture-before-activate, webhook claim guards, "nothing was charged" discipline, PDPL consent minted server-side, empty states that welcome instead of apologize.
4. **The design system** — full HSL token system with *documented contrast rationale per token*, motion governance, elevation ladder. 8.1/10 maturity.
5. **In-memoriam, greeting, and grief design** — «في الذاكرة 🤍», records preserved forever, «حياك الله يبو مشمش»: emotional design most products never attempt.

### Biggest weaknesses
1. **Promises without machinery** — renewal dates, reminders, "reminders honoured", vaccination due-dates: all stored or printed, none acted on. The product *records* care but never *performs* it.
2. **The money aftermath** — everything after payment (subscriptions page, cancel/pause economics, orders, invoices, admin operations) is the weakest surface family in the product (5.4–5.7/10).
3. **The onboarding wall** — email-OTP hard-gates the Cat ID; the sub-2-minute north star is unreachable for 100% of real users; the only fast path (Google) is a decoy button.
4. **Pride surfaces that undercut pride** — "Inactive" pill on shared profiles, unbranded WhatsApp share previews, no Apple Wallet in an iPhone-dominant market.
5. **English leaking into an Arabic-first product** — ~15+ raw English server errors at peak-stress moments, English-only SR strings in the design system, English-only OG card.

### Launch readiness
- **Community mode: ready** (fix the Inactive pill today — one line).
- **Commerce: live but not operable.** The gate moved from "money doesn't work" (July 12) to "money works once, several promises around it are false, and no one can service it." The two deadlines are structural: **first support escalation** (any refund/address/cancel request → engineer with a DB console) and **first term-end** (~October) with no renewal machinery. §4 lists the twelve fires in order.

---

## 2. Scores

### By category

| Category | Score | Movement | Rationale |
|---|---|---|---|
| **Overall product** | **68/100** | ▲ +4 | Money now flows and the ceremony is reachable; honesty and operability regressed in new ways. |
| Product strategy | 6/10 | ▼ | The tier pivot is defensible but unreconciled: homepage still promises computation, the authority amendment still forbids tier tables, and the quiz ignores the cat-profile data it already holds. |
| UX | 6.5/10 | — | Excellent flows undermined by dead-ends: OTP wall, Tamara lockout, notify-me black hole, feeding-tool cul-de-sac. |
| UI | 8/10 | — | Real system, real restraint. Docked for sub-44px clusters, faux-bold Arabic display, micro-type in px. |
| Conversion | 5/10 | ▲ +1 | Funnel wired and return ceremony built; still Tamara-only, fake "Best value", and the two highest-intent public surfaces (products, feeding tool) convert at zero. |
| Trust & honesty | 5.5/10 | ▼ | Six false written claims (see §4). The July-12 honesty repairs held; a new generation appeared with the pivot. |
| Accessibility | 7/10 | — | Strong bones (focus, reduced-motion, contrast math). Docked for English SR chrome, feeding-tool labels, tab semantics, 3 computed contrast failures. |
| Mobile | 7/10 | — | Thumb-zone nav and safe-areas excellent; hover-only affordances, sub-44px filters, hero card below fold persist. |
| Design system | 8/10 | — | See §6. |
| Emotional design | 7.5/10 | ▲ | Ceremony + greeting + grief design are rare; docked because the care loop is passive and the ceremony exits into a sales pitch. |
| Operations (admin) | 4/10 | new | 1 of 10 core support tasks fully possible; revenue math wrong; commerce half missing. |

### By surface (specialist scorecards, averaged)

| Surface | Score | Best screen | Worst screen |
|---|---|---|---|
| Marketing/public | 7.1 | Homepage hero (8.0) | Products (5.3), Feeding tool (5.7) |
| Auth + onboarding | 7.6 craft / **north star unreachable** | Landing name-first (8.9), Ceremony (8.1) | Verify-email as a wall (6.9) |
| Money path | 6.4 | PSP return ceremony (8.6), Product intro (8.8) | Subscriptions manage (5.4) |
| Member portal | 7.3 | Cat ID card (8.9), Dashboard (8.0) | Health panel (5.4) |
| Community | 6.6 | Ceremony share step (8.9), Report flow (8.1) | Public browse (6.0) |
| Admin | 5.8 | Moderation queue (9), Staff/RBAC (8) | Orders (3.5), Customer 360 (5) |
| Design system | 8.1 | Color/RTL/motion (9) | i18n architecture (5), docs (4) |

---

## 3. The Customer Journey — Visitor → Renewal

```
VISITOR ──────────► ACCOUNT ─────────► CAT ID ──────────► SUBSCRIPTION ────► DASHBOARD ────► COMMUNITY ────► RENEWAL
homepage hero 8.9   register 7.0      ceremony 8.1       subscribe 7.9      portal 8.0     browse 6.0      ░░ VOID ░░
  │                   │                  │                  │                  │              │               │
  ▼ friction          ▼ friction         ▼ friction         ▼ friction         ▼ friction     ▼ friction      ▼ friction
• "computed plan"   • Google button    • ceremony exits   • Tamara-only      • care loop    • "Inactive"    • "renews {date}"
  copy vs tier        is a DECOY         into a SALES       wall (no mada/     passive:       pill on every   is FALSE — no
  reality (C-M4)    • email-OTP WALL     PITCH (H-A3)       Apple Pay) H-P1    dueAt stored,   shared          scheduler,
• products           gates the ID —   • share artifact   • fake "Best         never acted    profile C-C1    no reminder,
  "Notify me" →       <2min impossible   on an ORPHANED     value" badge     • savings=0 SAR • unbranded      no lapse state,
  login black hole    for 100% of        route /welcome     H-P2               forever (H2    OG share        no re-up flow
  (C-M1)              users (C-A1)     • no wallet pass,  • abandoned          prior audit)    preview H-C1  • cancel mid-term
• feeding tool      • English errors     no download at     Tamara = locked  • both quick   • ghost-town      CONFISCATES the
  computes the        at every anxious   the peak (H-A4)    cat, no resume     actions →      tabs (C-C2)     prepaid money
  price then dead-    moment (H-A1)                         (C-P4)             same page                      (C-P3); pause
  ends (H-M6)                                             • upfront total    • health = URL                   kills the ID
                                                            hidden until      field (C-D1)                    while money is
                                                            checkout (R021)                                   held (H-P3)
```

**The journey's shape:** emotional altitude *rises* through the ceremony (the product's best 60 seconds), then leaks at every hand-off. The three worst hand-offs: **ceremony → sales pitch** (pride is never banked before the ask), **payment → aftermath** (the subscriptions page can't answer "what am I paying?"), and **term → renewal** (a cliff no one has built a bridge for). The single most valuable structural change in this audit: **let value land before every ask, and make every printed promise mechanically true.**

---

## 4. The Twelve Fires (cross-cutting critical findings, ranked)

Every item below is either a false written claim, a trust-destroying dead-end, or an operational impossibility. IDs refer to the specialist sections in §5.

1. **"Renews 17 Oct 2026" and "we'll remind you before it" are both false.** No scheduler exists anywhere in `apps/api` (verified: zero `@Cron`/`ScheduleModule`). Nothing renews, nothing reminds, nothing handles term-end. `checkout/page.tsx:498,502`, `checkout/return/page.tsx:180`. Breaks R006/R025 — the exact trust rule the authority calls the #1 KSA trust-killer. *Fix now in copy ("delivered monthly until {date} — no automatic renewal, ever"), then build the term-end lifecycle (§9.1).*
2. **Cancel confiscates a prepaid term.** `subscriptions.service.ts:406-419` sets CANCELLED immediately and deactivates the cat — killing deliveries the member paid up to 6,348 SAR upfront for, with no member-facing refund path (RefundsService is admin-only… and has no admin UI either). Dialog copy "billing will stop" is false — billing already happened. R030/R063/R064. This manufactures the first chargeback cohort.
3. **Pause economics are broken.** Pause flips the Cat ID INACTIVE while Moracat holds the money, doesn't extend `endsAt` (paused months are simply lost), and `resume()`/`skip()` corrupt `nextBillingAt` semantics (`subscriptions.service.ts:371-404`). R062 inverted.
4. **Abandoned Tamara session = locked-out cat.** DRAFT blocks re-purchase (`CAT_ALREADY_COVERED`), the checkout URL is never persisted, no resume action exists, no expiry sweep; the error renders as a payment failure claiming "nothing was charged" with a suggestion to "pick another payment method" — which doesn't exist. `subscriptions.service.ts:80`, `checkout/page.tsx:508-519`.
5. **Tamara is the only rail.** No mada, no Apple Pay, no STC Pay — in the market where those are how a company signals legitimacy — despite the Moyasar adapter existing and being wired in `payment-provider.factory.ts:53-59`. Adds BNPL-eligibility rejection as a failure mode for full-payers. R026/R105. Likely the single largest conversion lever in the codebase.
6. **Admin cannot operate the commerce it's selling.** No order detail view (fulfillment can't see what's in the box, including the just-shipped box customization), no refund UI (endpoint exists, zero callers), no admin subscription actions, no shipments surface (schema built, orphaned), no payments ledger, and dashboard revenue sums CANCELLED/FAILED orders (`analytics.service.ts:19-22`). Support walkthrough: **1 of 10 core tasks fully possible.**
7. **Email-OTP hard-gates the Cat ID.** The whole cats controller is `@RequireEmailVerified()` (`cats.controller.ts:38`) — first value is hostage to email deliverability; the <2-min north star is unreachable for every real user. The Google fast path renders as a **decoy button** that toasts "isn't set up yet" (`google-button.tsx:70-85`) and recommends a phone path that's also off.
8. **Every shared cat profile publicly shows "Inactive".** `community-profile-view.tsx:134` hardcodes `membershipActive={false}` without `hideStatus`; with commerce now enabled the pill renders "Inactive" on the one page owners are meant to share proudly. **One-line fix. Do it today.**
9. **"Prices include VAT" while `plans.ts:7-8` documents 0% VAT, not registered.** A compliance exposure and a CLAUDE.md contradiction. Reconcile with the legal entity before scale marketing.
10. **The homepage promises a computed plan; the funnel delivers three tiers.** `i18n.ts:40,93` ("You don't pick from a table — we compute your cat's plan") vs `PLANS` 249/349/529 chosen via guided picker. The consumption quiz is a defensible *derivation* — but it ignores the weight/age/household data the profile already holds (multi-cat homes get under-recommended), and the copy is now a bait. Resolve in either direction: re-blend `recommendPlan`'s household/senior rules into the quiz and keep the promise, or rewrite the promise as "guided fit." (§12, decision 1.)
11. **The "Best value" badge is fabricated.** All terms are `price × months`, zero discount (`checkout/page.tsx:424-441`) — plus a silent default to 3 months after the result screen advertised "from 1 month." A dark pattern in an honesty-constitution product. Delete today.
12. **The "Notify me" black hole.** Every product CTA routes guests to a login that discards destination and intent (`portal/layout.tsx:34` has no `?next=`), and the button doesn't do what it says. The highest-intent public traffic converts at zero. (Fix `next=` today; rebuild the page per §7.)

**Also at P0 severity, smaller blast radius:** ~15+ raw English server errors across the Arabic UI at peak-stress moments (login, checkout, verify) — the localization sweep in §9.2; and three computed contrast failures — email CTA white-on-orange **2.93:1**, dark-mode destructive buttons **3.50:1**, ceremony glass-button hover ≈1.1:1 in light theme (§6).

---

## 5. UX Audit by surface (condensed; severity · evidence · why)

### 5.1 Marketing / public site — 7.1/10

The homepage hero (live-typing cat name onto the ID card) is the strongest conversion mechanic in the product and must not be touched. The honesty discipline from July 12 (dark testimonials, honest empty partners) held.

- **[Critical] Notify-me black hole** — fire #12 above. `products/page.tsx:204-212` → `portal/layout.tsx:34`.
- **[Critical] VAT claim** — fire #9. `i18n.ts:52,105` vs `plans.ts:7-8`.
- **[Critical] Computed-plan copy vs tier reality** — fire #10. `i18n.ts:40,93`.
- **[Critical] Blog error tells the public to "make sure the API is running"** — `blog/page.tsx:53`, both languages. R084/R113.
- **[High] Canonical bug deindexes /contact and all /legal/*** — root `alternates.canonical: "/"` (`layout.tsx:81`) inherited by any page defining metadata without its own `alternates`. Google is told they're duplicates of the homepage.
- **[High] /benefits is orphaned** — absent from header nav and `sitemap.ts:23`. The page that best expresses "savings are proof of value" is undiscoverable.
- **[High] Geography contradicts itself** — "across Saudi Arabia" (announcement, features) vs "Jeddah & Riyadh" (metadata `layout.tsx:63`, OG image, JSON-LD). The share card tells a Dammam visitor she's excluded.
- **[High] OG/social card is English-only, emoji-branded** (`opengraph-image.tsx`) — the most-seen off-site surface is the least on-brand artifact in the repo. R101/R103.
- **[High] Feeding tool: worst a11y + biggest wasted intent** — unassociated labels, unnamed toggles, 200-step sliders (`tools/feeding/page.tsx:110-242`); computes the monthly cost of the exact product then offers no path to it.
- **[High] Error page claims "support is one tap away" with zero support taps** (`error.tsx:24-28`); route loading state is Arabic-only ("لحظة…", `loading.tsx:9`).
- **[High] "discounts" lexicon drift** — `membership.tsx:39`, `moracat-story.tsx:80,127` say "خصومات/discounts" while `/benefits` correctly says "member rate honoured." R085/R087.
- **[Medium]** "From 249 SAR" under a "one clear price" promise; upfront-term billing shape never mentioned pre-checkout (R021 spirit); hero accent `whitespace-nowrap` overflow risk ≤360px; Arabic typo «بقطّطكم» → «بقططكم» in the first line every visitor reads; blog has three names (Blog/Journal/Knowledge Center); red "Offer" badge + strike-through = coupon aesthetics (R085); nested `<Link><Button>` invalid HTML across ~10 files; WhatsApp label on a tel: link; cookie banner focus/PDPL polish; manifest/theme color drift.

### 5.2 Auth + onboarding — craft 7.6, structure failing the north star

Real journey today: 6 screens, 4–7 typed inputs, 7–13 interactions, **~2.5 min best case / 3.5–5 min typical** — the email-OTP wait is the variance bomb. Under-2-minutes is achievable only via Google, which isn't configured.

- **[Critical] OTP wall + decoy Google** — fires #7. Un-gate `POST /cats` (keep the guard on community writes); verification becomes a parallel task, not a wall.
- **[High] English-only errors everywhere** — `auth.service.ts:87,167-174,186,451,464`, surfaced raw at `register:261`, `login:80`, `verify-email:83`. The register page comment claims the API is "already localized" — it is not.
- **[High] "Wrong email? Fix it here" creates duplicate accounts** — `verify-email/page.tsx:95-110` re-registers instead of patching the pending email; the original account (with burned member number) is orphaned.
- **[High] The ceremony exits into a sales pitch; the share artifact is orphaned** — `cats/new/page.tsx:296-305` routes onClose → `/portal/subscribe`; the 9:16 story share lives on unreachable `/portal/welcome`. The viral loop is built and unplugged.
- **[High] No wallet pass or download at the peak** — R034/R036 (Critical tier) absent from the entire flow.
- **[Medium]** PDPL people-consent checkbox required even with no photo (`cat-id-ceremony.tsx:396-408`); SMS register path uses a plain field with `otp.length < 4` gating 6-digit codes (guaranteed failure, `register:169`); step 2/2 re-asks known owner name/phone; 2FA detected by regex on an English error string (`login:81` — breaks the moment errors localize); lockout offers no recovery; landing caps the cat name at 24 chars silently vs 60 in cats/new; terms links inside the checkbox label toggle it.

**Ceremony verdict:** genuinely premium theatre (stamping rhythm, spring physics, exemplary a11y, honest failure states) that still isn't Wrapped because: it ends in a privacy form + pitch instead of pride; the artifact can't leave the screen (no share at peak, no wallet, no download); the script has zero personal specificity (no "Member no. 214 · Issued in Riyadh, 17 July 2026", no Hijri date); the cat's *name* is never stamped — only the serial; no haptic beat; unrepeatable after the session. Recommended final sequence in §10.

### 5.3 Money path — 6.4/10, the trust seam

Fires #1–#5 and #11 above. Additional findings:

- **[High] The subscriptions page hides the money truth** — shows "249 SAR · Monthly" when the member paid 747–6,348 upfront; `termMonths`, `termTotal`, `endsAt` are all serialized and simply not rendered (`subscriptions/page.tsx:78`). The one page that should answer "what am I paying?" can't.
- **[High] Return page can poll forever** — no timeout on `refetchInterval` (`checkout/return/page.tsx:77`); if Tamara never sends a webhook the spinner is eternal.
- **[High] Orders: dead invoice button, no detail route, missing FAILED/REFUNDED badge mappings** — `orders/page.tsx:61`; the invoice and detail endpoints exist unused. R024.
- **[Medium]** "Nothing was charged" asserted for *any* error incl. validation errors; quiz/box state evaporates on refresh (R117); box builder ignores the cat's stored `lifeStage`/`isNeutered` and asks the owner to re-declare per line; sterilised filter can hide the recommended pick; consumption quiz lost the old engine's multi-cat/senior rules (3-cat households get Starter); double-activate TOCTOU (two tabs → two Tamara sessions, no idempotency key); client `renewalDate` math (`setMonth` unclamped) can differ from stored by 3 days; empty state exits to `/#plans` via raw `<a>`.
- **What's excellent and must be preserved:** the R021 commitment line ("249 × 3 = 747 SAR paid now"), pause/cancel promise before card details (R023), capture-before-activate, webhook claim guard, failure emails, Arabic-first hosted page, the product intro (8.8), and the return ceremony (8.6).

### 5.4 Member portal — 7.3/10, the passive care loop

- **[Critical] Health documents require pasting a URL** — `cat-health-panel.tsx:194`; members have photos of vaccine cards, not hosted links. Job #2 of the Cat ID is effectively unusable; `PhotoUploader`→R2 infra already exists.
- **[Critical] `dueAt` is stored and never acted on** — no reminder, no dashboard surfacing, ever. The dashboard ledger *counts "reminders honoured"* while zero reminders exist. The product's first proactive act of care is unbuilt. R049/P8.
- **[Critical] Apple Wallet hard-`false`** (`wallet.service.ts:49`) in an iPhone-dominant market. R034 unmet for the majority.
- **[Critical] No milestones or anniversaries anywhere** — `birthDate` and `memberSince` both in the model; a birthday card frame already exists in the card renderer; nothing fires. High-tier authority item, zero implementation.
- **[High]** Commerce mode replaces the warm care ledger with a generic Orders/Cats/Wallet grid (R049 violated exactly when money starts); R043 savings-vs-fee is a TODO (`portal/page.tsx:244`); hover-only "make primary" star invisible on touch (R098); both hero quick-actions link to the same page; the everything-drawer buries health at the bottom; "Moraqat Support" typo in the support thread (R087); ticket categories are commerce-only in a community-mode product; no prayer-aware/quiet-hours notification scheduling (R107, zero implementation).
- **[Medium]** 2FA shows a raw base32 secret while `qrcode.react` is installed and `otpauthUrl` is fetched and ignored; "Learn about Moracat" on every dashboard visit forever (R048); pause has no duration and cancel doesn't offer pause side-by-side; gallery photo delete is hover-only + unconfirmed; Smart Feeding leads with "93% confidence" machine-speak.
- **Excellent, preserve:** Najdi greeting through the cat; the cqw-locked ID-1 card (8.9); in-memoriam lifecycle; PDPL photo-consent asked exactly once; the honest DRAFT→"Awaiting payment" mapping; ID alphabet excluding 0/O/1/I/L (R032); fail-closed wallet availability; settings' export/delete dignity (best "leaving is easy" story in the codebase).

### 5.5 Community — 6.6/10, right concept, flat surface

The model (consent-gated directory + hearts + Featured, no points/streaks/comments) is **correct for this authority**. The consent spine is exemplary — private by default, server-minted attestation timestamps, strict allow-list read model, the ceremony's no-default identity fork.

- **[Critical] "Inactive" pill on every public profile** — fire #8. One line.
- **[Critical] Featured/Trending/Most-Loved are sorts masquerading as collections** — "Featured" has no `where isFeatured` (shows everyone, featured-first); "Trending" is all-time views. At launch scale: the same six cats reshuffled behind four doors. R006.
- **[Critical] `viewCount` doesn't count views** — ISR caching means the API detail (the only increment site) fires ~once/60s regardless of visitors, while bots increment freely. A publicly displayed number that isn't what it claims — and it's the "Trending" sort key.
- **[High]** The WhatsApp/IG share preview is a raw photo — no per-slug OG route exists; the pride artifact ships unbranded (the single biggest belonging/growth lever available); city facets return all active cities (filter-to-zero-results); public city is silently derived from the *delivery address* (PDPL smell); report reasons omit **animal welfare** — the most likely serious report in a cat community.
- **[Medium]** `role="tablist"` without tab semantics; flag icon on every browse card (negative priming); guests can't report public content; exact `birthDate` exposed when the owner consented to *age*; gender is the one field outside the consent model; like/report endpoints ride the global throttle only; "Showing 8 of 8 cats" leaks the ghost town the page's own comment forbids advertising.

### 5.6 Admin — 5.8/10, a moderation console bolted onto a commerce business

Fire #6. The bones (RBAC, audit log, confirm-with-reason, atomic suspend) are right; the commerce half is missing. Support-task walkthrough: refund ✗ · address change ✗ · failed-payment investigation ✗ · admin cancel/pause ✗ · resend Cat ID ✗ · merge duplicates ✗ · PDPL execution ✗ · ban abuser ✓ (exemplary) · edit order ✗ · "where's my box?" partial.

- **[Critical]** Refund endpoint has zero UI callers; no order detail page (fulfillment can't see box contents); order status is an unconfirmed inline `<select>` with **no onError handler** and an any→any transition graph; no admin subscription actions; revenue sums cancelled/failed orders.
- **[High]** Nav shows all 12 items to every staff role — 6 dead-end 403s for the support persona; ticket queue returns every ticket with full threads unpaginated; no path from ticket → customer 360 (email is dead text); customer 360 omits tickets/addresses/payments/Cat ID/wallet actions; PDPL requests can't be executed by an agent; Shipment/Driver/DeliveryZone models have zero surface.
- **[Medium]** Products page: no edit UI, no search (API supports both); FAQ/announcement deletes skip the confirm dialog; audit viewer under-filtered; waitlist is a CSV, not a launch tool; no merge-accounts capability; `en-US` hardcoded in dashboard KPIs.

### 5.7 Emails — 7/10 shell, P0 defect

15 bilingual RTL-correct templates with plain-text twins, legal footer, warm copy, renewal-warning and pause-first framing already written. Defects: **CTA white-on-orange 2.93:1** (the web system's own tokens document that orange takes ink, not white — `mail.templates.ts:27`); muted gray 4.17–4.46:1 at footnote sizes; no Gmail dark-mode defenses; the Cat-ID-issued email (the Wrapped email) renders a text chip instead of the card; brand constants drift from web because they're re-declared instead of shared.

---

## 6. UI & Design System Audit — 8.1/10 maturity

| Area | Score | Headline |
|---|---|---|
| Color | 9 | Full HSL var system, documented intent per token, light+dark first-class. Computed failures: dark destructive fill+white 3.50:1; dark destructive badge 4.42:1; email CTA 2.93:1. |
| Typography | 8 | Real scale with paired leading/tracking; masterful unicode-range Lyon scoping. **Lyon Arabic ships one weight — every Arabic bold heading is synthetic faux-bold** (largest gap to R103). 33× untokenized `text-[10px]` micro-type fails user font scaling (R094). |
| Spacing / radius / shadow | 8 | Tokenized; elevation ladder with theme-aware warm shadows. Minor arbitrary-value drift. |
| Motion | 9 | Easing tokens, R072-compliant durations, triple-covered reduced-motion, R073 honoured to the letter (richest animation genuinely only in the ceremony). |
| Components | 8 | 12 a11y-first primitives. Missing: Checkbox, RadioGroup, Textarea, Switch, Tabs, Tooltip — each already hand-rolled in app code, some 3–4×. 76 raw `<button>`s unpoliced. |
| RTL | 9 | One physical-direction class in the whole app (intentional). 3 unmirrored arrows (`portal/page.tsx:337,407`, `admin/support:123`). Currency drift: Latin "SAR" on 8+ Arabic surfaces; three competing formatting idioms; no shared `formatSAR()`. |
| i18n architecture | **5** | The structural weak point: hundreds of inline `isAr ?:` ternaries across ~50 files — untranslatable-by-a-translator, no completeness check, voice drift invisible, strings duplicated. The typed-dictionary pattern already proven in `tools/feeding` should be generalized per-route. |
| A11y | 8 | Global focus-visible, skip links, 44px discipline with rule-citing comments. English-only SR strings in packages/ui (toast "Dismiss", drawer "Close", spinner "Loading", DataTable sort labels); DataTable "sticky" header doesn't stick; error toasts auto-dismiss recovery instructions. |
| Emails | 7 | §5.7. |
| Docs/testing | 4 | R-rules cited in code comments (rare, excellent) but no component docs, no visual regression, zero automated a11y/RTL testing; `pnpm e2e` covers no UI. |

**Ceremony-specific P0:** `cat-id-ceremony.tsx:334` forces `text-white` on `variant="glass"` whose light-theme hover is `bg-white/80` → white-on-white at the flagship moment's hover state.

---

## 7. Redesign Plan (per surface: problems → redesign → impact → priority)

| Surface | Core problems | Redesign | Impact | Priority |
|---|---|---|---|---|
| **Checkout** | False renewal line; Tamara-only; fake badge; validation errors framed as payment failures; 5 stacked cards | Truth-first commitment line ("747 SAR today · delivered monthly until 17 Oct · **no automatic renewal — ever**"); reinstate mada/Apple Pay row via the wired Moyasar adapter; delete the badge; error taxonomy (already-covered gets its own card + link); sticky mobile total bar | Attacks the two biggest conversion killers (payment wall, price honesty) at once | **P0** |
| **Subscriptions manage** | Hides term economics; cancel confiscates; pause kills the ID; DRAFT has no resume | Card reads "Premium — paid through 17 Oct · 2 of 3 boxes remaining · 1,494 SAR total" (all fields already serialized); cancel = "won't renew, everything you paid for still arrives" + separate refund-request path; pause extends `endsAt` and keeps the ID active; DRAFT rows get "Complete payment" (persist Tamara's URL) + 24h expiry sweep | The page where post-money trust is kept or lost; currently the weakest surface in the product | **P0** |
| **Onboarding** | OTP wall; decoy Google; redundant step 2; ceremony exits into pitch | Un-gate `POST /cats`; verification becomes parallel ("while {cat}'s card settles, confirm your email"); hide Google until configured — or configure it; collapse cats/new to one screen when owner data exists; ceremony final sequence per §10 | Makes <2 min *possible*; banks pride before the ask | **P0** |
| **Admin: Order detail + refunds** | Fires #6 | `/admin/orders/[n]`: status stepper (valid transitions + confirm), items incl. box customization, payment card with **Refund** modal (amount, mandatory reason, audit note), shipping card with tracking | Unlocks support tasks 1/9/10; makes R030 operationally true | **P0** |
| **Admin: Customer 360** | 90-degree view; no actions | Add tickets/addresses/payments/Cat ID header block/wallet credit/admin sub actions (pause/cancel behind confirm+reason — `subscriptions.write` permission already seeded, unused)/PDPL export-delete kebab/per-customer audit trail | Turns 6 impossible tasks into 2–3-click tasks | **P0** |
| **Community profile + shares** | Inactive pill; unbranded OG; views-forward layout | `hideStatus` today; per-slug `opengraph-image.tsx` (warm paper, sticker-framed photo, name in display type, MRC number, "Member since", wordmark); lead the page with identity line (name + member-since + ID number), hearts stay, views leave | Every WhatsApp share becomes a branded membership artifact — the highest-leverage growth surface, near-zero marginal cost | **P0** (pill) / **P1** (OG) |
| **Portal dashboard** | Care loop passive; commerce mode drops the ledger; R043 TODO | Add one "Coming up for {cat}" row (next vaccination from `dueAt`, next box, birthday — max 2 items); commerce value strip = "Saved X SAR — against Y in membership" with the care ledger as line two, never dropped; touch-visible rail actions | Status dashboard → care dashboard; the anti-churn number plus the weekly return reason | **P0** |
| **Health panel** | URL-only documents; no reminders; icon-only mobile tabs | PhotoUploader for documents; `dueAt` cron → notification + dashboard chip ("a reminder, honoured"); warm per-tab empty states; weight sparkline | Activates Cat ID job #2; creates the recurring-visit habit | **P0** |
| **Products page** | Notify-me black hole; can't sell | Pre-commerce: "Inside the box" — every card CTA "This comes in the plan →"; one real public notify capture (no auth); kill strike-through pricing | Worst page (5.3) becomes a funnel feeder | **P1** |
| **Feeding tool** | Worst a11y; dead end | Steppers + labeled inputs; results panel bridges: "A Moracat plan covers this for {price} SAR/mo → Build {cat}'s plan", carrying weight/age via the existing sessionStorage pattern | The highest-intent public tool finally converts | **P1** |
| **Community browse** | Dishonest tabs; ghost-town amplifiers | "New members" (real), "Featured" (actually filtered, hidden when empty), "Loved this week" (7-day window — honest and cold-start-friendly); kill Trending until views are real; reserved-seat ghost card in the grid | Four doors into four rooms; return visits become rational | **P1** |
| **Cats area** | Everything-drawer | Per-cat page `/portal/cats/[id]`: ID card hero + tabs (Record · Photos · Community · Settings); drawer only for quick ID display; dashboard deep-links carry the cat | The cat becomes a *place*, not a modal | **P1** |
| **Support (member+admin)** | Lexicon typo; wrong categories; queue doesn't scale | Fix "Moraqat"; categories keyed on commerce mode; paginate admin queue + member mini-360 rail + internal notes + assignment; WhatsApp deep-link as second door | R120 becomes real | **P1** |
| **Blog** | 3 names; flat bodies; jargon errors | One name ("المدونة / Journal"); markdown rendering; reading time + related posts; human error copy | "Vet-backed" becomes structurally visible | **P2** |
| **Emails** | CTA contrast; text-chip Wrapped email | Ink-on-orange; render the actual card image in the Cat-ID email (export pipeline exists); Gmail dark-mode overrides; share BRAND constants with web | The inbox finally matches the product | **P1** |

---

## 8. Quick Wins (< 1 hour each; ~30 items, ordered by impact-per-minute)

**Honesty & money (do these first, today):**
1. `hideStatus` on the public profile CatIdCard (`community-profile-view.tsx:134`).
2. Delete the "Best value" badge (`checkout/page.tsx:437-441`).
3. "Renews {date}" → "delivered monthly until {date} — no automatic renewal" (`checkout/page.tsx:498`, `return/page.tsx:180`) and drop the unbacked "we'll remind you" line until the job exists.
4. Remove "pick another payment method" copy (`checkout/page.tsx:517`, `return:212`).
5. Special-case `CAT_ALREADY_COVERED` with a "Go to your subscription" card.
6. Render `termTotal`/`termMonths`/`endsAt` on subscription cards (already serialized).
7. Poll timeout on the return page (~8 min → honest terminal state).
8. Admin revenue: filter out CANCELLED/FAILED/RETURNED (`analytics.service.ts:19-22`, 3 lines).
9. ConfirmDialog + onError on admin order status change (`admin/orders/page.tsx:40-96`).
10. Add FAILED/REFUNDED to `order-status-badge.tsx`.

**Conversion & flow:**
11. `?next=` carry on the portal auth redirect (`portal/layout.tsx:34`) — halves the notify-me hole.
12. Hide the Google button when unconfigured (`google-button.tsx:70` → return null); fix its "or mobile number" claim.
13. Fix `otp.length < 4` → `!== 6` + OtpBoxes on the SMS register path (`register:159-169`).
14. Auto-skip cats/new step 2 when owner name+phone exist.
15. Subscriptions empty state → `/portal/subscribe` via `<Link>` (`subscriptions:115`).
16. Dashboard/cats empty-state CTAs → `/portal/cats/new` directly.
17. `/benefits` into header nav + sitemap.
18. Canonicals for /contact + /legal/* (H1 SEO bug).

**Craft & a11y:**
19. Email CTA `accentInk: "#14261f"` (`mail.templates.ts:27`).
20. Dark `--destructive-foreground` → ink (`globals.css:135`).
21. Ceremony glass button → explicit on-scrim classes (`cat-id-ceremony.tsx:334`).
22. `rtl:rotate-180` on the 3 unmirrored arrows; localize `aria-label="Back"`.
23. 2FA: render `otpauthUrl` as `<QRCodeSVG>` (dependency installed).
24. Gate the PDPL people-consent checkbox on `photoUrl` present.
25. Gallery-delete + FAQ/announcement-delete confirm dialogs.
26. Hover-only affordances visible on coarse pointers (rail star, gallery delete).
27. «بقطّطكم» → «بقططكم» (`i18n.ts:14`); "Moraqat Support" → "Moracat" (`support:159`).
28. Blog error copy → human (`blog/page.tsx:53`); bilingual `loading.tsx`; `/contact` link on `error.tsx`.
29. "discounts" → "member rates/مزايا" (3 sites).
30. Feeding tool `htmlFor`/`id` pairs + named toggles (~40 min).
31. `ANIMAL_WELFARE` report reason; "Featured" tab actually filters; remove flag icon from browse cards.

---

## 9. High-Impact Improvements (real development, ranked by leverage)

1. **The term-end lifecycle** (the renewal machine): scheduler (`@nestjs/schedule`) driving — T-7/T-1 "your term is ending" notifications with one-tap renew (new Tamara session); graceful lapse state ("{cat}'s membership ended — records safe, welcome back anytime", R064); DRAFT expiry sweep; vaccination `dueAt` reminders; birthday/anniversary events. **One scheduler, five promises become true.** This converts the product's biggest broken promise into its loudest differentiator: *we never charge silently — ever.*
2. **Honest cancel/pause economics**: cancel = won't-renew (paid boxes still arrive) + member-initiated remainder refunds via the existing RefundsService; pause extends `endsAt` and never deactivates the ID.
3. **mada + Apple Pay via the wired Moyasar adapter** — likely the single largest conversion lever in the codebase.
4. **Admin commerce half**: order detail + refund UI, admin subscription actions, payments ledger, shipments board, permission-aware nav, ticket→customer linking. (The panel needs its commerce half built on its existing excellent bones, not a rebuild.)
5. **Un-gate the Cat ID from email verification** + configure Google + localize the auth error surface via error codes (`EMAIL_TAKEN`, `TOTP_REQUIRED`…) — fixes the regex-2FA fragility simultaneously.
6. **Apple Wallet pass** (.pkpass) — the market-fit half of R034; plus offline QR caching to close R036 end-to-end.
7. **Care activation**: health-document photo upload; `dueAt` reminders; "Coming up for {cat}" dashboard row; R043 savings-vs-fee line.
8. **Dynamic OG membership card** per community slug + rebuilt bilingual site OG card.
9. **i18n extraction** — per-route typed dictionaries (the `tools/feeding` pattern) + ar/en key-diff script; unlocks translator review of the Najdi voice, kills string duplication, makes the error-code sweep durable. Plus shared `formatSAR()`.
10. **Quality gates**: Playwright × axe-core over 6 routes × {ar,en} × {light,dark}; UI-package labels prop for SR strings; missing primitives (Checkbox, RadioGroup, Textarea, Switch, Tabs); Lyon Arabic bold cut (or `font-synthesis: none` + regular-weight Arabic headings).
11. **Consumption quiz × cat profile**: re-blend `recommendPlan`'s household/senior/health rules; seed box-builder facets from the cat's stored `lifeStage`/`isNeutered`. "Ask what they use, check it against what the cat needs, and say so" — that sentence is the brand.
12. **Community engagement (authority-compatible)**: weekly collections; Cat-of-the-week ceremony (admin Feature action already notifies beautifully — add cadence + home slot + keepsake frame); founding-member tenure marker from `sharedAt`; fixed warm-Arabic compliment reactions («ما شاء الله»، «يجنن») instead of comments — near-zero moderation surface; follow-a-cat with private counts.

---

## 10. Premium Experience Ideas (buildable, authority-compatible)

**The ceremony, completed** — recommended final sequence: stamp the cat's *name* first, then the number *(haptic tick via `navigator.vibrate`)* → card springs in, one light sweep → inscription line ("Member no. 214 of the founding class · Issued in Riyadh, 17 July 2026" — Hijri-aware) → the safety oath ("If Simba is ever lost, this card brings him home" — copy that already exists at `cats/new:206`) → two pride actions: **Save story for Instagram** · **Add to Wallet** → then one quiet line: "Next: Simba's plan →". The community-share decision moves out of the ceremony into the community panel where it belongs. Make the ceremony replayable forever from the cat's page.

**Cat birthday ceremony** — `birthDate` exists; the birthday card *frame already exists* in the renderer. On the day: dashboard card auto-wears the frame, one notification («مشمش يكمل سنتين اليوم 🎂»), one-tap share via the existing story pipeline. Three existing systems, one afternoon of wiring.

**Moracat Day (member anniversary)** — at `memberSince + 1yr`: a year-in-review story frame (R045/R065): saved X SAR, Y records kept, Z photos, W hearts — through the existing `shareStoryPng` path. The actual Spotify-Wrapped the dossier asks for.

**Tenure moments** — the ledger already computes `memberDays`; at 100/365/500 days the tile becomes «١٠٠ يوم معنا 🐾» for one day, AnimatedCounter doing the reveal. First-record celebration: first vaccination logged → «أول سجل بصحة مشمش — محفوظ للأبد» and the counter animates 0→1.

**Seasonal, quietly** — Eid/National-Day card frames (a switch-statement addition), offered in-season, never auto-applied; the footer mouse-chase carries a tiny lantern during Ramadan (one Hijri date check). Prayer-aware quiet hours for all outbound notifications (Umm al-Qura times; the Hijri util exists) — a signature Saudi-native differentiator no global competitor will copy.

**Recognition surfaces** — hero card remembers the typed name in the closing CTA («سمسم جاهز لهويته؟»); blog end-CTA greets the pending cat by name; Arabic-Indic digits on the hero preview card in AR; the benefits page renders each partner rate as a mini Cat-ID-styled chip — the ID visually doing its value job on the marketing page; a ghosted dashed Cat ID card in the community grid: «محجوز لقطك» — belonging made spatial.

---

## 11. Design System Recommendations (tokens & components)

1. `--accent-on-dark: 18 93% 62%` + `--warning-on-dark` (the ceremony's dark-scrim family, currently hand-rolled 7+ times); dark `--destructive-foreground` → ink; dark destructive badge text bump.
2. `fontSize["2xs"]` (0.6875rem, tracked) + codemod the 33 `text-[10px]` (R094).
3. `formatSAR(amount, locale, {tabular})` — «١٢٩ ر.س» / "129 SAR", LTR-wrapped digits, tabular-nums; adopt at the 10+ drift sites; re-export constants to `mail.templates.ts` so email/web can never diverge again.
4. `uiDict` (close/dismiss/loading/back/viewAll/sort/noData) + optional `labels` props on packages/ui components — Arabic SR chrome everywhere, one fix.
5. New primitives in priority order: Checkbox, RadioGroup (generalize the ceremony's AppearanceOption), Textarea, Switch (promote the settings implementation, already copy-pasted 4×), Tabs, IconButton (44px default).
6. Button `asChild`/Slot support; sweep the `<Link><Button>` nestings.
7. License Lyon Arabic Display Bold, or set `font-synthesis-weight: none` and design regular-weight Arabic headings.
8. `/design` internal route (or Ladle) rendering every primitive × variant × state × direction — doubles as the visual-regression fixture; wire axe-core into e2e.

---

## 12. Strategy tensions requiring a business decision

1. **The tier question.** The authority amendment says "never chosen from a tier table"; the shipped product is three tiers behind a quiz. Either (a) amend the authority to bless "guided fit from the cat's needs" and rewrite the homepage promise, or (b) re-blend true profile computation into the quiz and keep the promise. The audit recommends **(b) — it's a few days of work, the `recommendPlan` engine already exists, and "computed from your cat" is the moat copy no competitor can honestly say.** Either way, the homepage and the funnel must stop contradicting each other.
2. **Renewal model.** Prepaid terms with *invited* renewal (never auto-charge) is a genuinely stronger trust story for KSA than tokenized auto-renewal — but only if the term-end lifecycle (§9.1) exists. Decide: invited-renewal-forever (recommend for launch) or tokenized auto-renew later; the copy today must match whichever is true.
3. **Payment rails.** Are Moyasar production credentials available? mada/Apple Pay reinstatement is blocked on this business fact, not code.
4. **VAT.** Registered or not? The homepage claim, the invoice requirement in CLAUDE.md, and `plans.ts` currently disagree three ways.
5. **Mid-term refunds.** What is the actual policy (pro-rata? boxes-remaining?)? The cancel flow and Tamara dispute-exposure both hang on this.
6. **Google OAuth + Apple Wallet certificates** — both are configuration/certificate purchases, both are the fastest paths to the north star (<2 min) and R034 respectively.
7. **Partner network reality** — benefits still have no destination; the honest-directory recommendation depends on whether signed partners number 0, 3, or 30.

---

## 13. Final Vision

When this plan is executed, here is the product:

A Saudi cat owner types her cat's name into a warm paper page and watches it stamp itself onto a deep-green card, in premium Arabic, right-to-left, before she's given anything else. Ninety seconds later — no inbox roulette, no decoy buttons — the press stamps *Luna*, then a number no other cat will ever hold, her phone ticks once in her hand, and a line appears: *Member no. 214 of the founding class · Issued in Riyadh*. The card slides into Apple Wallet. The story card goes to her sister on WhatsApp — and arrives framed, named, and branded, because pride is the product's growth engine and every share is a small ceremony of its own.

The plan she buys never surprises her. The price on the button is the price on the receipt; the term says exactly when it ends; and the product's proudest sentence is printed right under the pay button: **we will never charge you silently — we invite you back, every time.** When she pauses for the summer, Luna's card stays active and her months wait for her. When she cancels, everything she paid for still arrives, and the goodbye says her records are safe for whenever she returns — and because leaving was dignified, she does return.

The dashboard greets her the Najdi way and leads with what matters: Luna's vaccination is due next week — *we'll remind you, that's what we're for* — the box lands Thursday, and the member rate has now saved her more than the membership costs, and it says so, plainly, in one line. On Luna's birthday the card quietly wears a party frame for the day. On Moracat Day, a year of belonging becomes a story card: what she saved, what she recorded, who loved Luna's photos.

And behind the curtain, a support agent sees her whole world on one screen and fixes any of it in three clicks — because premium is not the landing page; premium is what happens when something goes wrong.

Every screen holds the same conviction: **the cat is the hero, the member is recognised, effort is the enemy, and nothing — nothing — is ever promised that the machinery cannot keep.**

That is a product worthy of the ceremony it already knows how to perform.

---

*Full per-domain findings (7 specialist reports, ~200 findings with file:line evidence, computed contrast tables, support-task walkthroughs, and drafted copy) were produced in this audit session; this document is the synthesis of record. Compare against MRC-UX-AUDIT-2026-07-12.md for the delta.*
