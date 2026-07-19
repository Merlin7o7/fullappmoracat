# MRC-AUDIT-2026-07-19 — Full Pre-Launch Audit

**Date:** 2026-07-19
**Method:** nine parallel specialist audits over the actual codebase — security/pentest, backend + data model, frontend + performance + SEO, acquisition funnel, logged-in portal, vet platform, design system + a11y, Arabic + Saudi market fit, business + investor case. Every finding is traced to a file and line. Nothing was taken on faith from prior audits; where a prior fire was claimed fixed, it was re-verified in source.

**Corpus:** ~69k LOC TS/TSX · 115 Prisma models · 55 web routes · 37 API controllers (241 routes, 72 under `/vet`) · 45 services · 41 components · 96 commits · **0 paying customers**.

---

## 0. The one-page verdict

**Overall: 58/100. Do not launch commerce. Do launch a narrow beta.**

The engineering is materially better than the business. Several subsystems — webhook settlement, the lifecycle idempotency ledger, the consent architecture, the Arabic localization libraries, the checkout commitment block — are better than what most Series A companies ship. That is a real, unusual asset.

But three findings, each independently verifiable, put the current plan in doubt:

| # | Finding | Evidence |
|---|---|---|
| **1** | **The box costs 19–35% MORE than buying the identical items from Moracat's own store.** There is no saving to sell. | `import-catalog.ts:103,175` (1.8× markup) vs `seed-catalog.ts:40,55,71` |
| **2** | **Nothing auto-renews.** Every member must manually re-buy every 3 months — a ~2× LTV penalty vs. autoship. | `subscriptions.service.ts:126-136`, `lifecycle.service.ts:65-119` |
| **3** | **VAT registration is ~150 subscribers away and deletes ~35% of contribution margin.** ZATCA Fatoora e-invoicing is entirely unbuilt. | `pricing.ts:16-24`; ZATCA threshold SAR 375,000 |

And two live security Criticals, one of which is a same-day one-line fix.

**The mitigating fact that shapes all triage:** `render.yaml` ships `COMMERCE_ENABLED=false` / `PAYMENTS_MODE=mock`, and `env.validation.ts:60` *refuses to boot* with commerce on against a mock PSP. Most money-path Criticals are **latent — they detonate the day commerce flips on, not today.** That gate is why this is a to-do list and not an incident report.

---

## 1. Final scores

| Category | Score | One-line justification |
|---|---:|---|
| Product | 55 | Real craft; the loops that make it a product are missing |
| Design | 78 | Genuine token system, hand-tuned contrast, 98.3% logical RTL |
| UX | 62 | Best-in-class recovery surfaces, weak persuasion and retention surfaces |
| UI | 76 | Public + portal are brand-distinct; admin is generic SaaS |
| Accessibility | 58 | Good foundations; radiogroups keyboard-broken on the purchase flow |
| Performance | 48 | Zero `next/image`, zero server prefetch, 310 KB unsubsetted Arabic OTF |
| Security | 62 | Strong posture overall; one stored XSS, one token-scope Critical |
| Business | 38 | Inverted value proposition, no auto-renew, VAT cliff unmodelled |
| Marketing | 45 | No analytics of any kind; pricing behind a login |
| Brand | 82 | The strongest asset in the company |
| Engineering | 74 | Default-deny auth, zero `any` in 23,930 lines, correct money types |
| Scalability | 55 | Unbounded crons and queries; no cache layer; Redis claimed but unwired |
| Code Quality | 72 | High, with a comment-vs-code truthfulness problem |
| Localization | 61 | 91-scoring libraries, 44-scoring pages |
| Vet Platform | 34 | Excellent backend; UI written against an API that doesn't exist |
| Community | 45 | A privacy-respecting static gallery, not a network |
| SEO | 40 | Zero hreflang in a bilingual product; three list pages ship skeletons |
| Mobile | 52 | 14px inputs zoom on iOS everywhere; checkout CTA occluded |
| **Overall** | **58** | |

---

## 2. Cross-cutting root causes

Four patterns explain most individual findings. Fixing the pattern is cheaper than fixing the instances.

### 2.1 The comments describe the intent; the code does something else
The single most repeated failure mode.

- `subscriptions.service.ts:729` states a paused member must never watch their boxes shrink. The code makes them watch — the counter decays to "0 of 6" directly beneath copy promising it won't.
- `verify.service.ts:22` documents that only the Moracat app resolves the QR. No app-side resolver exists.
- `account.service.ts:379` notes prayer-aware timing is coming. The cron has no clock; birthday emails fire at 03:00 Riyadh.
- `schema.prisma:2183` states clinical records cannot be deleted "by design." `onDelete: Cascade` on `ClinicalEntry.cat` erases a cat's entire medical history.

**The Design Authority is being cited in comments as though citation were compliance.** Three of four portal Criticals would have been caught by asking *"does the code do what this comment says?"* — add that as a review step.

### 2.1b Every localization failure is a *last-mile* failure
`datetime.ts`, `money.ts`, `phone-field.tsx`, `otp-boxes.tsx`, `latinizeDigits`, `monthsLabel`, the `marquee-rtl` keyframes, the VAT toggle — **the hard, correct work is already written and sitting in the repo.** It was applied at display time, one call site at a time, instead of being encoded into the shared components where it would be automatic.

This makes the Critical tier unusually cheap. **Fixing two components (`field.tsx`, `input.tsx`) and adding three primitives (`Money`, `CatId`, `PhoneInput`) collapses roughly 40 findings.** The genuinely expensive items are only ZATCA invoicing and server-side calendar preference.

Concrete consequences of the missing `dir` awareness:
- **9 of 9 password inputs render RTL** — and `field.tsx:29` switches to `type="text"` on reveal, so a password containing `@ . !` or digits **visibly scrambles while the user watches**.
- **7 of 8 email inputs render RTL** (`verify-email:234` is the one that's right — proof the rule is known).
- **The Cat ID manual-entry field** (`vet/scan/page.tsx:413`) — the fallback when the QR scan fails — has `font-mono`, `uppercase`, `tracking-wide`, `spellCheck={false}`, and no `dir`. A hyphenated alphanumeric is a bidi worst case; a vet comparing their typed input to a printed card sees a different string. **The Cat ID fails at the moment of verification.**
- **225 unisolated Arabic interpolations**, 112 ad-hoc `dir="ltr"` spans, and `<bdi>` used exactly **twice** — including the ceremony's own `aria-live` announcement, which interpolates both a cat name and a Cat ID unisolated.

### 2.2 Excellent shared libraries that the pages refuse to use
`money.ts`, `datetime.ts`, `greeting.ts`, `errors.ts`, `translit.ts` are the work of a real localization engineer. Then 104 files bypass them with 2,034 inline ternaries; 11 sites print `249 SAR` instead of `٢٤٩ ر.س`; 41 sites render raw English `e.message`. Same story in the design system: `packages/ui` exports 12 components, so 8 missing ones get rebuilt 3–5× each.

**The fix is enforcement, not authorship.** Lint rules + component completion, not rewriting.

### 2.3 Authored in English, translated to Arabic
Arabic-only strings with no English counterpart: **zero**. The asymmetry runs one way. Every dead ternary, discarded `labelAr`, and masculine-default imperative is downstream of that ordering — in a product whose constitution says Arabic is the default experience.

### 2.4 Built from a vision document rather than from a first cohort
115 models, 72 vet endpoints, a full cart/coupon engine with no UI, loyalty/wallet/badges that are read-only shells — all before one paying customer. **~12,800 LOC per unit test file in a system that moves money and stores clinical records.**

---

## 3. Launch blockers — the 25 that gate going live

Ordered by "what breaks first."

### Ship today (hours)
1. **Stored XSS → account takeover.** `community/[slug]/page.tsx:67` — `JSON.stringify` into `<script>` doesn't escape `/`. Chains with tokens in `localStorage` (`auth.tsx:113`) for persistent access surviving password change. Self-propagating via public cat profiles. Fix: `.replace(/</g,"\\u003c")`. Same at `blog/[slug]:138`. Then move refresh token to httpOnly cookie.
2. **Add a CSP.** None exists anywhere in `apps/web`; helmet covers only the JSON API.
3. **`portal/welcome:179` renders the placeholder `MRC-····-····` as a real Cat ID on fetch failure.** A fake ID at the ceremony.
4. **`blog/[slug]:80` and `community/[slug]:11` turn API outages into 404s.** Googlebot deindexes every article on a 5-minute outage. `vet-directory:69` already does this correctly.
5. **Address deletion NULLs an active subscription's delivery address** — hard delete, no FK guard, no confirm, single tap. `addresses.service.ts:45`.

### Legal / representation (days, copy-only)
6. **ToS says subscriptions auto-renew. Nothing renews.** `legal.ts:164` vs `checkout:559`. In a dispute the terms win and the marketing becomes the misrepresentation.
7. **Privacy policy says "payments are not yet enabled"** two pages from a live Tamara flow. `legal.ts:44`.
8. **Dashboard labels term-end "Renews"/"التجديد"** for a date nothing happens on. `membership.tsx:104`.
9. **No refund/cancellation policy exists customer-facing** while the hero promises "Cancel anytime" on a 100% prepaid product.
10. **`welcome:235` claims a 3-month minimum and no VAT**; `checkout:57` offers 1 month and `orders:205` prints a VAT line.
11. **Cat ID "brings them home" is false on three surfaces.** QR is non-resolvable, no public `/found/:token`, verify API refuses in prod. Build it or strip the claim.
12. **No Commercial Registration number disclosed.** Required by Saudi E-Commerce Law; Saudi buyers check for it.

### Compliance / deliverability
12b. **Every customer receipt email asserts a 15% VAT line from a non-VAT-registered entity.** `mail.templates.ts:434` hardcodes `ضريبة القيمة المضافة (١٥٪)` — not gated on `VAT_ENABLED`, which the same file imports and uses correctly 20 lines earlier. Every receipt reads "VAT (15%) — 0.00 ر.س". That is a false tax representation in a financial document. The web UI handles the identical case correctly at `orders/page.tsx:203`, so this is oversight, not design.
13. **Zero unsubscribe link and no `List-Unsubscribe` header.** Breaks Gmail/Yahoo bulk-sender rules outright.
14. **Notification preferences are write-only decoration** — never read by the mailer or notifier.
15. **PDPL export omits clinical entries, weights, consent grants, and the access ledger** while claiming to be "everything we hold."
16. **Owner cannot read their cat's clinical record at all.** No owner-facing endpoint returns `ClinicalEntry`. Combined with #15, there is **no path in the product by which an owner obtains their cat's medical record.**

### Vet platform (do not go live without)
17. **Counter-mode PIN token is signed with the user access secret and `jwt.strategy.ts:25` never checks `typ`.** A 4-digit PIN yields a 12h full bearer token that survives offboarding.
18. **No consent check on the vet write path.** `vet-records.service.ts:130` checks existence only. Any vet at any org can author medical facts on any cat.
19. **The vet portal cannot render its own API's responses.** `vet-api.ts` diverges from the shipped NestJS contract in field names, enum values and envelope shape on nearly every endpoint; `vetFetch<T>` is a raw cast so nothing throws — screens render blank.
20. **Four of six vet nav destinations 404.** Independently confirmed by two auditors.
21. **`vaccinationStatus` is set to `UP_TO_DATE` unconditionally on any vaccination entry** — a member-facing badge that becomes false the moment a clinic uses the feature correctly.

### Money path (before `COMMERCE_ENABLED=true`)
22. **`provider:"WALLET"` falls through to the mock provider** → fully-paid order, zero money moved.
23. **No cart ownership model.** Every cart is `userId: null`; checkout consumes any `cartId` and empties it.
24. **No idempotency anywhere** — double-tap checkout charges twice; double-activate charges 3,174 SAR for a 1,587 SAR membership.
25. **Tamara webhook JWT verified but never bound to the payload**, no `exp` check, no processed-event ledger. One valid token replays against arbitrary orders forever.

---

## 4. Top 25 quick wins (high value ÷ effort)

1. Escape the JSON-LD injection — one line, closes a Critical.
1b. **Add `dir` awareness to `field.tsx` + `input.tsx`** — ~3 lines, fixes 9 passwords, 7 emails, and ~20 other RTL-broken inputs at once. The single highest leverage change in the repo.
1c. **Gate the 15% VAT line in `mail.templates.ts:434` on `VAT_ENABLED`** — one condition, removes a false tax claim from every receipt.
1d. **Fix `normalizePhone` (`auth.service.ts:901`)** — a bare `9665…` currently becomes `+966966551234567`. Saudis routinely omit the plus. `vet-patients.service.ts:121` already has the correct implementation; reuse it.
2. `[dir="rtl"] { letter-spacing: 0 }` — Arabic headings are currently tracked.
3. Add `--warning-ink` token; fix the two bare `text-warning` at 2.60:1 on clinical warnings.
4. `text-sm` → `text-base` in `input.tsx:15` — stops iOS zoom in **every form in the app**.
5. Wire the built-and-unreachable `/skip` endpoint to a button.
6. Ship the 1-month trial tier — `TERM_OPTIONS` already includes `1`; it's a config change.
7. Install analytics (PostHog + pixels). Currently **zero** instrumentation. One day; unblocks all learning.
8. Add `/vet-directory` to `sitemap.ts` — your best trust asset is unindexed and unlinked.
9. Fix `notificationHref` to honour `data.renewUrl` — the renewal reminder is currently an unclickable dead button.
10. Route the 6 consumer-facing `e.message` leaks through `friendlyMessage()`.
11. Replace the 11 raw `"SAR"` sites with `formatSAR()`; add an ESLint ban on the literal.
12. Add `dir` to the `Field` component — fixes ~14 RTL-broken email/password/OTP inputs.
13. `اشتراك` → `عضوية` in checkout (4 strings) — stop using the churn word at the moment of payment.
14. Add `<main>` landmarks to the 4 public pages using `<section id="main">`.
15. `aria-label` on the 5 unnamed icon-only buttons (incl. the theme toggle, on every page).
16. Lazy-import `lib/card-export` (jsPDF ~350 KB) and `qrcode.react` — one line per call site, removes the PDF stack from three route bundles and QR from the homepage.
17. Exempt `.animate-spin` from the reduced-motion kill — 68 spinners are frozen for those users.
18. `min-h-touch` token; codemod the 64 `min-h-[44px]` literals.
19. Add `@@index([microchipNo])` — the only identifier that works for a stray currently seq-scans.
20. Add `@@unique([provider, providerRef])` on Payment — one line, before any real payment exists.
21. Delete the `db push` instructions from `DEPLOY.md` (3 places) — following them permanently bricks deploys.
22. Fix the mobile checkout double-bottom-bar occluding the pay button.
23. Start Apple Developer org enrollment — the blocker is lead time, not code, and it's free to begin.
24. Correct the stale VAT claim in `CLAUDE.md` and the stale plan/break-even figures in `README.md`.
25. Enforce `perUserLimit` on coupons and make redemption atomic.

---

## 5. Economics — the finding that outranks the rest

Cost data in the repo is real and reconciles exactly: 259 SKUs with true supplier costs, `Plan.cogs` computed from them rather than hand-entered. Verified COGS: Starter 104.75, Standard 150.75, Premium 245.25.

**But `import-catalog.ts:175` prices every store SKU at `cost × 1.8`. So Moracat's own retail price for the box contents is computable:**

| Plan | Same items at Moracat store price | Box price | Customer pays |
|---|---|---|---|
| Starter | 184 | 249 | **+35%** |
| Standard | 273 | 349 | **+28%** |
| Premium | 444 | 529 | **+19%** |

A subscription box that costs more than à-la-carte has no economic reason to exist. The July audit saw the symptom ("savings = 0 SAR forever", "fabricated Best value badge") and treated it as a copy bug. **It is the pricing.** Premium also ships the *same* Josera 2kg dry bag as Starter — acknowledged in a code comment.

**Contribution margin, rebuilt adversarially** (packaging 10, delivery 28, fulfilment 8, PSP 5%, shrink 2%): blended **36.9%** pre-VAT, **23.9%** post-VAT. Note the internal contradiction: the box model assumes 12 SAR delivery while `cart.service.ts:9` charges customers **25 SAR** — and boxes are heavier (Standard ≈ 12 kg gross).

**The VAT cliff:** registration is mandatory at SAR 375,000 rolling — **~150 concurrent members**. Because prices are VAT-*inclusive* by design, registering doesn't raise price; it removes **~35% of contribution margin**. ZATCA Fatoora e-invoicing is entirely unbuilt (fines SAR 5,000–50,000 per violation).

**LTV:CAC** at post-VAT term CM of 247 SAR:

| Scenario | Term renewal | LTV | LTV:CAC @200 SAR |
|---|---|---|---|
| Manual renewal (today) | 35–45% | 380–449 | **1.9–2.2×** ❌ |
| Auto-renew shipped | 60% | 618 | **3.1×** ✅ |
| Auto-renew + fixed value prop | 70% | 823 | **4.1×** ✅ |

**At today's configuration the business does not clear 3:1 at any plausible CAC.** Paid acquisition against a 747 SAR upfront ask is cash-flow negative on day one.

**`apps/web/lib/pricing-engine.ts` contains the best economic thinking in the repo and has zero importers.** Promote it server-side and make it authoritative.

---

## 6. Strategy — the sequencing argument

**Which side is harder? Clinics, decisively.** There are ~434 veterinary clinics nationally. Consumer acquisition is scalable and impersonal; clinic acquisition is field sales, one at a time. And **the clinic side has no value proposition in the code**: zero references to settlement, commission, payout, or invoicing across all vet and partner modules. You are asking a working clinic to change its intake workflow in exchange for a directory listing.

**The case against current sequencing:**

1. The box has no moat and negative differentiation (§5) — it will never beat noon/Amazon.sa/Petzone on price.
2. The Cat ID's entire value is contingent on clinics. Consumer-first ships the ID into a vacuum, teaching the first cohort it's a decoration. **First impressions of an ID that does nothing are very hard to reverse.**
3. "Get consumers, clinics follow" needs density that pressures clinics. With 434 clinics and a realistic year-one base of ~1,000 spread across two cities, **no individual clinic ever feels demand pressure.** The consumer flywheel cannot bootstrap this side.
4. Reversed it works: 10 clinics in one Riyadh district issuing Cat IDs at intake = zero-CAC distribution, an ID that works on day one, a data moat starting immediately, and a pre-qualified audience to sell boxes to. **Clinics are an acquisition channel being treated as a feature.**

**Synthesis:** keep the box as revenue, but geo-concentrate to one Riyadh district and make clinic acquisition the primary GTM motion. Do not launch nationally.

**The cold-start play already latent in your code:** `writeVaccination` → `dueAt` → the existing lifecycle engine reminds the owner → they return to *that clinic*. Recall marketing clinics don't do. Pair it with a **vaccination + travel health certificate PDF generator** and **clinic-created provisional patients** — free, works on patient #1, works for non-members, replaces a real paper process, and every certificate seeds a cat record an owner can later claim.

**On the "operating system" framing — push back.** Nothing third-party runs on Moracat: no clinic API, no partner SDK, no developer surface. It's an application suite the company built for itself. The framing has already cost you 115 models before a paying customer, and it reads as a yellow flag in a partner meeting. **Truer framing the code actually supports:** *"the health passport that makes a Saudi cat's history portable — funded by the food she eats."*

---

## 7. Moat ranking

| Rank | Candidate | Defensibility | Distance | Assessment |
|---|---|---|---|---|
| 1 | Longitudinal cross-clinic clinical record | **Very high** | Very far — 72 endpoints, **zero clinics, zero records** | The only true moat. Slowest, hardest |
| 2 | Vet network | High | Far — portal built, no acquisition machinery, no monetization | Real, not started |
| 3 | Arabic content/SEO corpus | Medium | **Close** — engine built, hreflang missing | Best effort:reward in the plan |
| 4 | Brand / Cat ID | Medium | **Closest** — genuinely excellent | Your real current advantage. Not a moat |
| 5 | Community | Low as built | Medium | A directory, not a network |
| 6 | Box / supply chain | **None** | Shipped | Same distributor as everyone |

---

## 8. Top 25 delight features

1. Public `/found/:token` lost-cat page with a masked relay number — makes the flagship promise true.
2. Apple Wallet pass (iPhone-dominant market; blocker is enrollment lead time).
3. Owner-side medical timeline merging vet-written and owner-entered rows, visually distinguished.
4. Owner weight entry + sparkline — `CatWeightRecord.source` already anticipates `"owner"`.
5. Vaccination certificate PDF, bilingual, clinic-letterheaded.
6. Travel/export health certificate — the highest-value document a Saudi clinic produces.
7. "Since you were here" dashboard strip built from data that already exists.
8. Restore `/portal/welcome` as the post-ceremony stop (or delete 279 lines of dead constitution).
9. Cat ID as a primary nav destination — if it's the soul, give it a door.
10. Cat birthday card, shareable, auto-generated.
11. Adoption-day anniversary alongside birthday.
12. Litter-box / feeding streak with a genuinely useful (not gamified) insight.
13. "Your cat this year" annual recap, shareable.
14. Rescue-cat age entry ("about 2 years") — the machinery already exists in the feeding calculator.
15. Searchable breed combobox with "Mixed / Domestic" pinned — the majority KSA answer.
16. Box contents echo before payment + "what's in next month's box."
17. Skip/swap a single item rather than the whole box.
18. Prayer-aware send windows (R107) — named in the authority, unimplemented, and a genuine Saudi-native differentiator.
19. WhatsApp as a notification channel — the enum declares it; nothing writes it.
20. Delivery tracking with carrier name and ETA.
21. Multi-cat household view with per-cat consumption.
22. Vet visit summary sent to the owner as a shareable document.
23. Cat-of-the-week featuring real community cats.
24. Printed ID card fulfilment as a paid add-on.
25. Offline-signed Ed25519 passes that actually verify — making the existing offline banner true.

---

## 9. Top 25 growth ideas

1. **Clinic-issued Cat ID at intake** — zero-CAC distribution, solves cold-start on the hard side. Highest strategic return.
2. Arabic programmatic SEO: per-breed, per-city, per-condition pages. Blocked on hreflang.
3. Fix hreflang / add `/ar` `/en` segments — unlocks the entire English organic surface (currently zero).
4. Referral with real value exchange — "recognition, not coupons" will produce ~zero referrals on a 747 SAR purchase.
5. 1-month trial tier to fix the paid-acquisition math (config change).
6. Public `/plans` page — pricing is currently behind a signup wall.
7. Community proof on the homepage: live cat count + real faces, where `MemberVoices` returns null.
8. Referral attribution on cat-profile shares (`?ref=`).
9. Pre-filled Arabic share text on profile share — the referral card 500 lines away already does this.
10. Email on community activity (first like, milestones) — smallest diff, highest ROI in the audit.
11. Win-back at D+14/30/90 — the idempotency ledger makes each cheap and safe.
12. Shelter and rescue partnerships issuing Cat IDs at adoption.
13. Breeder partnerships issuing IDs at sale.
14. Groomer and boarding partners requiring the ID.
15. Vet-directory city landing pages (currently all self-canonical to bare `/vet-directory`).
16. Feeding calculator → plan CTA (currently a terminal node).
17. Instagram/TikTok-native Cat ID story format — the 9:16 artifact exists but lives on an orphaned route.
18. Cat-owner WhatsApp community per district.
19. Founding-member cohort with a *defined* benefit (used 6+ places, defined nowhere).
20. Vet clinic co-marketing: "we issue Moracat IDs" window decal.
21. Municipality / Vision-2030 animal-welfare alignment for the ID.
22. Cat cafe and pet-friendly venue partnerships.
23. Content partnership with Saudi vets for genuinely authored (attributable) health content.
24. Lost-cat network as a standalone free product — highest viral coefficient in the roadmap.
25. GCC expansion (UAE/Kuwait/Qatar) once the record moat is real.

---

## 10. Top 25 revenue opportunities (ranked rev × speed × fit)

| # | Opportunity | Score | What's already built |
|---|---|---:|---|
| 1 | **Auto-renew** (recovered, not new, revenue) | 100 | Scheduler, ledger, Tamara adapter, term stacking |
| 2 | À-la-carte store / top-ups | 80 | 259 SKUs, costs, inventory, full cart+coupon+checkout API — **only the UI is missing** |
| 3 | 1-month trial tier | 80 | `TERM_OPTIONS` includes 1; seeds set `minTermMonths: 1` |
| 4 | Clinic SaaS subscription | 60 | 72 endpoints, RBAC, org/staff/agreement/invite |
| 5 | Cat ID as a paid standalone tier | 48 | Fully built, currently free |
| 6 | Vet appointment booking + commission | 45 | Consent tiers, `PartnerOrg`; no booking, no settlement |
| 7 | Pet insurance distribution | 40 | Records = underwriting data. **Partner, don't build** |
| 8 | Supplier/brand placement in boxes | 36 | Real catalog + `PlanContent` recipes. How box companies actually make money |
| 9 | Printed ID card fulfilment | 32 | Card renders at ID-1 ratio, print/PDF ship |
| 10 | Grooming/boarding marketplace | 18 | `PartnerOrg` is generic enough |
| 11 | AI health assistant | 18 | **Defer** — a feature, not a business, and a clinical liability surface |
| 12–25 | Corporate gifting · adoption-partner referral fees · premium community tier · breeder tools · multi-cat discounts · annual prepay discount · gift subscriptions · seasonal limited boxes · litter subscription standalone · prescription-diet channel · telemedicine referral · lab-result integration fees · data insights for brands (aggregate, consented) · white-label clinic portal | — | Speculative; revisit after the wedge works |

---

## 11. Top 25 AI features (deliberately conservative)

Ranked by value ÷ liability. **Clinical advice is the line — never cross it.**

1. Arabic content generation for programmatic SEO pages (human-reviewed).
2. Photo → breed suggestion at cat creation.
3. Photo quality/NSFW screening before community publication (currently **zero** content review).
4. Weight-trend anomaly flag → *"worth mentioning to your vet"*, never a diagnosis.
5. Vaccination-schedule inference from partial records.
6. Support-ticket triage and routing.
7. Support-reply drafting for staff (human-sent).
8. Clinical note structuring assist — vet-authored, AI-formatted, never AI-authored.
9. Lab-result OCR into structured `LabResultDto`.
10. Handwritten vaccination-card OCR — huge for onboarding non-member cats.
11. Arabic ↔ English record translation for travel documents.
12. Duplicate-cat detection across clinics.
13. Feeding-plan refinement from actual consumption.
14. Churn-risk scoring for retention outreach.
15. Box-contents personalization from allergies (`CatAllergy` is collected and never consulted).
16. Photo auto-crop for the Cat ID card.
17. Cat name transliteration assist (extends the existing `translit.ts`).
18. Moderation queue prioritization.
19. Fraud/abuse pattern detection on likes and referrals.
20. Vet break-glass anomaly detection (velocity, unusual access).
21. Smart reorder timing from consumption.
22. Community caption suggestions.
23. Search query understanding for the vet omnibox.
24. Automated changelog / release notes from commits.
25. Test generation for the 236 untested routes.

---

## 12. Top 25 partnership ideas

Clinics (the wedge) · shelters and rescues · breeders · groomers · boarding and hotels · pet sitters · pet insurers · pet food brands (placement) · litter brands · veterinary labs · pharmacy chains · e-pharmacy · municipality animal services · Vision 2030 animal-welfare programs · Saudi veterinary association · vet schools · pet-friendly cafes and venues · airlines (travel certificates) · relocation and pet-shipping companies · Tamara/Tabby co-marketing · mada/Apple Pay launch co-marketing · noon/Amazon.sa as a channel rather than a competitor · Saudi pet influencers · cat shows and expos · corporate wellness/gifting programs.

**The only one that matters in the next 90 days is the first.**

---

## 13. The perfect launch checklist

**Gate 0 — security (hours)**
- [ ] Escape JSON-LD injection at both sites; add CSP
- [ ] Move refresh token out of `localStorage` to httpOnly cookie
- [ ] Split the vet counter-token secret; reject `typ` in `jwt.strategy.ts`
- [ ] Gate the vet write path on consent + an open visit
- [ ] Per-email cap on password reset; `photoUrl` host allowlist

**Gate 1 — honesty (days, mostly copy)**
- [ ] ToS renewal language corrected; privacy payment claim corrected
- [ ] Refund/cancellation policy written, linked from footer and pay button
- [ ] "Renews" → "Paid through" on the dashboard
- [ ] Cat ID "brings them home" either built or removed from all three surfaces
- [ ] `welcome` 3-month/no-VAT claims corrected or route deleted
- [ ] "Upgrade plan" retired until a plan-change API exists
- [ ] Offline banner copy made true
- [ ] CR number displayed

**Gate 2 — compliance**
- [ ] Unsubscribe link + `List-Unsubscribe` header
- [ ] Notification preferences actually consulted before send
- [ ] PDPL export extended to clinical entries, weights, grants, ledger
- [ ] Owner-facing medical timeline endpoint shipped
- [ ] ZATCA Fatoora path designed before crossing 150 members

**Gate 3 — the product works**
- [ ] Vet web/API contract reconciled + zod at the boundary + vet e2e coverage
- [ ] Four dead vet routes built or delisted
- [ ] Scanner fallback for Safari/iPadOS
- [ ] `vaccinationStatus` derived at read, never stored
- [ ] Public `/plans` page with full comparison
- [ ] mada + Apple Pay at checkout
- [ ] Checkout order summary: shipping, delivery window, VAT row, box echo, trust marks
- [ ] `labelAr`/`unitAr` migration so the Arabic checkout isn't half-English

**Gate 4 — you can learn**
- [ ] Analytics + pixels installed
- [ ] Post-VAT economics modelled with real 3PL quotes
- [ ] Box recipes re-cut to beat à-la-carte by ≥15%
- [ ] Auto-renew shipped (opt-out, loud T-7, one-tap cancel)

---

## 14. Roadmaps

### 30 days — "stop the bleeding, learn something"
**Week 1:** Gate 0 + Gate 1 in full. Analytics installed. Real 3PL quotes obtained.
**Week 2:** Re-cut box recipes; promote `pricing-engine.ts` server-side; model post-VAT pricing. Public `/plans`. Gate 2 compliance items.
**Week 3:** Auto-renew (opt-out + T-7 + one-tap cancel). 1-month trial tier. Wire `/skip`. Quick-wins list.
**Week 4:** Vet contract reconciliation + vet e2e. Freeze all other vet work. Recruit 5 pilot clinics in **one** Riyadh district.

**Exit criteria:** honest funnel, measurable funnel, an economically viable box, auto-renew live, 5 clinic conversations in progress.

### 90 days — "prove the wedge"
- mada + Apple Pay; checkout summary complete
- Vaccination + travel certificate PDF; clinic-created provisional patients
- Clinic-issued Cat ID loop, with a clinic-facing "IDs issued / patients returning" dashboard
- Owner medical timeline; owner weight entry; shipped/delivered comms; dunning ladder; win-back
- hreflang + `/ar` `/en` segments; first 20 programmatic Arabic SEO pages
- Component library completion (Select, Alert, SearchInput, Tabs, Progress); a11y radiogroup fixes
- Arabic enforcement pass: dictionary extraction for the top 10 flows, `arPlural`, genderless CTAs
- Test coverage to ~60% of routes, with vet and money paths first

**Exit criteria:** 300 paying members in one district · 5 clinics issuing IDs · verified post-VAT CM ≥30% · a real month-3 renewal number.

### 1 year — "build the moat"
- Vet network to 50+ clinics; clinic SaaS billing; PMS bridge or CSV day-book
- Clinical record depth: vitals, problem list, dosing, allergy provenance, amendment windows
- Machine auth (scoped API keys), webhooks, export — the integration surface that makes "OS" honest
- Lost-cat network as a standalone free product
- À-la-carte store UI (the API is already built)
- Apple Wallet; offline signed passes that genuinely verify
- Mobile app if and only if the web PWA proves the daily habit
- GCC expansion evaluation
- Insurance distribution partnership (partner, don't build)

---

## 15. Architecture for 10 million cats

The current design is a single NestJS service + Next.js + one Postgres, with no cache layer, no queue, and crons that load whole tables into memory. It will not survive 10M cats without these changes — most of which are far cheaper now than later.

**Do now, while tables are small (one migration):**
- The ~15 missing indexes (esp. `SubscriptionCat.catId`, `Cat.microchipNo`, `Order.subscriptionId`, `CatVaccination.dueAt`)
- `@@unique([provider, providerRef])` on Payment
- `onDelete: Restrict` on all financial and clinical relations; `SetNull` on audit subjects
- `@db.Timestamptz` everywhere — currently **zero** usage; a KSA business computing term ends and birthdays in `timestamp` shifts every boundary by 3 hours, and migrating later is a table rewrite
- Partial unique indexes for `isDefault`/`isCover`/`isPrimary` flags
- `pg_trgm` GIN on `nameNormalized` — infix `contains` cannot use the current btree

**Data layer:** pooled Neon URL with `connection_limit` validated at boot (currently only a comment in `render.yaml`); `DIRECT_DATABASE_URL` enforced for migrations; read replicas for community and directory reads; cursor pagination everywhere (the vet module already does this correctly — port the pattern); partition `ClinicalEntry`, `RecordAccessLog`, `AuditLog`, and `Notification` by time once each passes ~50M rows.

**Compute:** extract the lifecycle engine to a dedicated worker (a sleeping free-tier instance runs no crons today); batch every cron with cursors and `take`; move PDPL export, PDF generation, and CSV export to a job queue writing to object storage; add Redis for throttling (currently in-memory per instance, and Redis is already claimed in four files while wired in none), sessions, and hot caches.

**Delivery:** HTTP cache headers on plans/breeds/cities/FAQs/blog (currently only community sets them); CDN for R2 assets with `next/image`; ISR for public content once the root layout stops forcing dynamic.

**Correctness at scale:** an idempotency-key table for all money mutations; a `ProcessedWebhookEvent` ledger; an hourly reconciliation sweep against the PSP for `AUTHORIZED` payments older than 10 minutes; conditional atomic stock decrement; a `CouponRedemption` and `GiftCardTransaction` ledger.

**Observability:** structured request IDs, PII redaction (member emails are currently logged at info level), business metrics on the funnel, alerting on the moderation queue and break-glass velocity.

**Organizational:** the vet platform should become a separate deployable before it has real clinical traffic — different uptime profile, different compliance surface, different release cadence.

---

## 16. What is genuinely world-class — and why

Stated precisely, because these are the assets to build on.

**Payment integrity.** All four providers verify signatures and **fail closed on an unset secret** — the classic bug is absent. `timingSafeEqual` throughout. Replay blocked by an atomic CAS claim, not a status read. **Amount tampering is structurally impossible** — amounts come from the DB, never the payload. No return handler trusts `?status=paid`. Better than most production codebases.

**Money types.** All 115 models checked: every monetary column is `@db.Decimal`. `Float` appears only on weights and coordinates. Not one money-as-Float — the mistake that's nearly unfixable later.

**Auth posture.** Default-deny with global guards, `@Public()` opt-in, no handler ever taking `userId` from body or query, all ten cat mutation paths through `ownedCat()`, and the JWT strategy re-fetching the user every request so revocation is immediate. **Zero `any` in 23,930 lines.**

**The lifecycle idempotency ledger.** Claim-then-act against a unique key, backed by a real index. N replicas cannot double-send. Better than most production billing systems.

**The health check.** Diffs bundled migrations against `_prisma_migrations` and 503s on drift, so orchestrators hold the previous revision. Most projects ship `return {status:"ok"}`.

**The PSP return page (8.7/10).** Poll cap, 60s reassurance state, terminal state that hands the promise to email rather than spinning, dignified failure reconstructing the exact prior checkout URL, active-card reveal. *Most payment flows have one of those five. This has all five.*

**The checkout commitment block.** `249 × 3 = 747 paid today` with the term-end date computed using the **same month arithmetic as the API**, so the preview can never disagree with the invoice.

**Record integrity in the vet module.** Never updated in place; `revise()` inserts a new row marking its predecessor `AMENDED`; retraction preserves fact and reason while withholding payload; intern drafts hold side effects until co-sign; self-co-sign blocked.

**The consent model.** Tiered, ledgered, with break-glass that provably cannot self-escalate, and allergies/current-meds pinned unconditionally into T0 — which is what makes it clinically safe.

**Arabic localization infrastructure (91/100).** `money.ts` uses FIRST-STRONG-ISOLATE for bidi safety. `datetime.ts` implements Hijri/Gregorian with `islamic-umalqura` and routes money dates through one preference so a member never sees a Hijri "paid through" beside a Gregorian delivery date. `greeting.ts` has a genderless fallback (`يا أهل {cat}`) that is the single most elegant line of Arabic in the repo.

**RTL discipline.** 289 logical properties vs **5** physical — and all 5 are where physical is correct. Better than most shipped products.

**Design tokens.** Contrast hand-computed, not guessed: `--info` darkened with a comment, `--destructive-foreground` switched from white to ink because white computed 3.50:1. 29/34 pairs pass light, 30/34 dark.

**Brand.** Film-grain paper ground, hand-drawn marker underline, perforated ticket-notch, a Cat ID card that tilts on pointer move and fills in as you type your cat's name. Public and portal surfaces are recognizable with the logo removed — at the Apple/Linear bar.

**Cat creation (8.7/10).** One required field on the happy path. Name carries over from the landing page so it's never typed twice. Owner name collapses to "We found you." The ceremony is gated on a real created row, honours reduced motion, and lands the payoff.

**And the deepest one:** capture-before-activate, coverage-aware lapse logic that refuses to tell a renewed member their membership ended, server-minted PDPL consent, Gregorian-forced money dates. **This is a founder who builds trust into the schema.** In a market where trust is the binding constraint on premium subscription commerce, that is durable and hard to copy. It is cultural, not technical. It simply isn't yet pointed at a defensible business.

---

## 17. The three questions to answer before raising

1. **"Your box costs 19–35% more than the same items in your own store. Why would anyone buy it twice?"**
2. **"You have 72 vet endpoints and zero clinics. Walk me through signing clinic number one — and what they get, given there's no settlement, commission, or payout in your code."**
3. **"What's your month-3 retention?"** — currently unanswerable: no customers, no auto-renew, no analytics.

Answer those three with data and this becomes fundable. The execution ability is not in question; the evidence is in the repo. What's missing is a first cohort, an honest margin, and a wedge.
