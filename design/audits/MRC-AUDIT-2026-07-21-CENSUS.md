# MRC-AUDIT-2026-07-21 — Phase 0 "Cat Census" Pre-Launch Audit

**Date:** 2026-07-21
**Lens:** Phase 0 (pre-launch). Commerce is hard-off (`COMMERCE_ENABLED=false` / `PAYMENTS_MODE=mock`). The product being launched is **the Cat Census** — a campaign to register cats and issue free Cat IDs. It is **not** evaluated as a live subscription company. The question is not "should commerce launch" (it correctly does not). The question is: **is the census ready to run, and to win?**
**Method:** four parallel deep-dives over the actual codebase (frontend/UX/QA, backend/security/technical, marketing/business/competition) + direct reads of the hero, census engine, GTM plan, and the 2026-07-19 ELITE audit. Every finding traces to a file:line or a named doc.
**Relationship to the ELITE audit (2 days prior):** the census pivot landed *after* it. Its verdict ("58/100, do not launch commerce") stands for commerce — but most of its business Criticals (box pricing inversion, no auto-renew, VAT cliff) are **latent** for a census where nothing is for sale. This audit re-scores through the Phase-0 lens and confirms several ELITE findings are already fixed (the reveal ceremony, RTL discipline on the funnel pages).

---

## 0. The one-page verdict

**Census-readiness: 65/100. The concept and craft are genuinely strong. Do not run this at scale yet — three census-specific defects would poison the exact number the campaign exists to produce, and you are flying with no instruments.**

The census is the right strategy, honestly built. `census.service.ts` refuses to seed a floor, round up, or show "spots remaining" — the number on the front page is real, and that honesty *is* the campaign. The reveal ceremony is best-in-class. The brand is the best asset in the company. The GTM plan is unusually thorough.

But four things block a **scaled** census (a controlled soft-census with friends/vets can start this week):

| # | Blocker | Evidence | Why it's fatal to a census specifically |
|---|---|---|---|
| **1** | **Nothing stops one account from inflating the count.** `POST /cats` has no throttle, no per-account cap, no CAPTCHA anywhere in signup. | `cats/cats.controller.ts:46` ("unlimited"); global 120/min/IP only | The census's entire brand claim is "this number is real." A scripted actor exhausts the 1,000-slot founding cohort in <10 min. The display is honest; the **input** is undefended. |
| **2** | **The homepage tells every non-Riyadh visitor a false, city-specific promise.** | `lib/i18n.ts:75-76` (ar), `:169-170` (en): "Founding Member — Riyadh Class of 2026" hardcoded | The code already fixed this everywhere else (per-city `foundingClassLabel`, `cats.service.ts:875`). The trust-critical section of the front door was never updated. A Jeddah owner is lied to on the page whose only job is to be believed. |
| **3** | **Zero analytics. You cannot measure the census.** | Only JSON-LD in the app; no GA4/Meta/TikTok/Snap pixel, no analytics env keys | Phase 0 exists to produce a measured number by channel. `?src=` stand attribution is the *only* instrument. Paid social, influencer, and PR conversion are invisible. You cannot run §12's "kill any channel under X" rules without the data those rules consume. |
| **4** | **The founding-member benefit is vaporware.** | GTM §1 promises "locked founding price for life" + physical tag; no `foundingBenefit` state exists in schema | The campaign recruits 1,000 emotionally-invested people around a perk that isn't in the product. If it's empty at redemption, your ambassador cohort becomes your harshest critics. |

None of these is expensive. #2 is a copy edit. #1 is a `@Throttle` + a daily cap. #3 is a scripted-consent analytics layer. #4 is a schema field. **This is a to-do list, not an incident report** — but items 1–3 must land before you point paid reach or press at the front door.

---

## 1. Final scores (Phase-0 census lens, /10)

| # | Section | Score | One-line justification |
|---|---|---:|---|
| 1 | Product Vision | 8 | "Every cat deserves an identity" lands in 5 seconds and reads as a movement, not a box. |
| 2 | Landing Pages | 7 | Hero is disciplined and honest; sunk by the false founding-city copy, no session awareness, thin social proof. |
| 3 | Cat Census Campaign | 6 | Real (non-fake) scarcity + a genuine data-journalism hook, undercut by undefined perk, inflation risk, half-built referral loop. |
| 4 | Marketing | 5 | Plan is a 7 (comprehensive, disciplined budgets); instrumentation is a 2 (no analytics), Snapchat/WhatsApp/email-nurture gaps. |
| 5 | Website | 7 | Honest, performant census path with real loading/error/empty states; some flow gaps and friction. |
| 6 | UX | 6 | The reveal ceremony is world-class; the path to it is 9 inputs, has a register re-entry trap, and a newborn deadlock. |
| 7 | UI | 8 | Genuinely premium restraint; strong logical-RTL, token discipline, motion reserved for the ID (R073). |
| 8 | Technical | 7 | Race-safe `catNumber`, strong auth, solid kill-switch, memoized census; thin unit tests, the bot gap. |
| 9 | QA | 6 | Good double-submit + duplicate-name handling; the newborn deadlock and `/register` re-entry are real breaks. |
| 10 | Security | 6 | Strong posture (magic-byte sniffing, refresh rotation, default-deny); census bot-inflation is a live Critical. |
| 11 | Vet Ecosystem | 4 | Correctly designed, but UI/API contract broken, zero clinics — the Phase-0 exit gate (3-clinic redemption) can't pass today. |
| 12 | Business Model | 3 | Inverted value prop, no auto-renew, VAT cliff, ~4–5× optimistic margin math. Latent for census, fatal for the box. |
| 13 | Psychology | 8 | Identity/pride/belonging is the strongest lever in the plan and it's well-reasoned. |
| 14 | Competition | 6 | Real moat identified (cross-clinic records); analysis is shallow and "speed is the moat" is asserted, not funded. |
| 15 | Launch Readiness (census) | 5 | A controlled census can start now; a *scaled/viral* one cannot — inflation + no analytics + false copy. |
| 16 | Brand | 9 | «لكل قط هوية». Warm, composed, ownable, culturally fluent. The standout. |
| 17 | Legal / Compliance | 6 | Real PDPL export/erasure + modeled consent; incomplete photo erasure, no content moderation, ZATCA unbuilt (latent). |
| 18 | Data & Analytics | 2 | Near-zero. Stand `?src=` capture is the only instrument; the single worst gap for a measurement campaign. |
| — | **Overall (census-readiness)** | **6.5** | Elite brand + craft, unproven economics, three fixable census defects, no measurement. |

### Requested composite scores

| Composite | Score |
|---|---|
| Overall Product | 65 / 100 |
| Brand | 9 / 10 |
| Marketing | 5 / 10 |
| UX | 6 / 10 |
| UI | 8 / 10 |
| Technical | 7 / 10 |
| Security | 6 / 10 |
| Business | 3 / 10 |
| Launch Readiness (census) | 5 / 10 |
| Cat Census Campaign | 6 / 10 |
| Investor Confidence | 6 / 10 — the craft and brand are fundable; the economics are not yet proven and the box is priced above retail. |

### Probabilities (honest ranges, not cheerleading)

- **Chance of viral growth:** ~40–50%. The named-cat / sequential-ID / ceremony mechanic is a real status-signal hook, but the viral *loop* (referral queue-jump) is half-built and there's no instrumentation to optimize it. Fix the loop + wire analytics and this moves to 60%+.
- **Chance of product-market fit:** **Registry/identity PMF: medium-high** — a free national Cat ID solves a real, unserved need. **Subscription-box PMF: low** until the box is repriced below à-la-carte. These are two different bets; the census only needs the first.
- **Chance of becoming the industry standard:** **medium, execution-gated.** Moracat is the only player building the cross-clinic record layer (a genuine moat). Realizing it depends on shipping a vet platform that currently can't render its own API, and on funding the "speed" the strategy leans on. The path is real; the risk is execution, not concept.

---

## 2. What is genuinely excellent (protect these)

These are unusual and must not regress under deadline pressure:

- **The honest census engine.** `census.service.ts` — real count or say-so, no floor, no "1,000+", 30s memo with in-flight de-dup matching the CDN `s-maxage`. Load-safe against a viral spike. This is the campaign's integrity, in code.
- **The Cat ID reveal ceremony** (`cat-id-ceremony.tsx`). Glyph-by-glyph name stamping, reduced-motion fallback, focus trap, no pre-ticked share default, honest failure-to-save. The one moment the Design Authority says to over-invest in — and it delivers. (This resolves the ELITE audit's "fake ID on failure" finding on the primary path.)
- **The Cat ID is un-gated by email verification** (`auth.service.ts:145`). Friction-free to the hero moment; verification only gates *public* UGC. Exactly right.
- **Security foundations.** Race-safe `catNumber` sequence, refresh-token rotation with reuse detection, magic-byte upload sniffing (blocks SVG/HTML-as-image), default-deny auth, real CORS allow-list, no secrets in repo, real PDPL export/erasure.
- **The kill-switch.** Global default-allow `CommerceGuard`, every commerce surface marked `@Commercial()`, boot refuses `COMMERCE_ENABLED=true` without a live PSP. Commerce cannot leak through while off.
- **The brand + GTM strategy.** Culturally fluent, disciplined budget tiers with hard cut-rules, the "nobody knows how many cats Riyadh has" data-journalism hook. Rare depth.

---

## 3. Priority matrix

Impact/Difficulty/Time are for the census. "Latent" = real but doesn't detonate until commerce flips on.

### 🔴 Critical — before pointing paid reach or press at the front door

| Issue | File / source | Impact | Difficulty | Time | ROI |
|---|---|---|---|---|---|
| **C1. No bot/abuse control on `POST /cats`** — one account exhausts the founding cohort; the census's honesty claim is undefended at the input | `cats/cats.controller.ts:46`; template exists at `community-likes.controller.ts:14` | Very high | Low | 0.5 d | Extreme |
| **C2. False "Riyadh Class of 2026" on homepage** for every non-Riyadh visitor | `lib/i18n.ts:75-76, 169-170` (fix already exists in `cats.service.ts:875`) | High | Trivial | 1 h | Extreme |
| **C3. Zero analytics** — census is unmeasurable by channel | no pixel/GA in `apps/web`; no analytics env keys | Very high | Medium | 2–3 d | Extreme |
| **C4. Founding-member benefit undefined in schema** — headline perk is vaporware | GTM §1 vs schema (no `foundingBenefit`) | High | Medium | 2–3 d | High |
| **C5. CAPTCHA/proof-of-humanity absent from signup** (compounds C1) | `auth.controller.ts:21` (8/min, no CAPTCHA) | High | Low-Med | 1 d | High |

### 🟠 High — before or during the census ramp

| Issue | File / source | Impact | Time |
|---|---|---|---|
| H1. `/register` has no already-authenticated guard; header/footer never session-aware → returning members hit the signup wall or make duplicate accounts | `middleware.ts:23`, `site-header.tsx:115`, `site-footer.tsx:48` | 0.5 d |
| H2. 9 required inputs vs the "under six / two minutes" north star, still promised in the hero | `register/page.tsx:244-266` + `cats/new/page.tsx:399`; hero `i18n.ts:29` | 1 d |
| H3. Referral viral loop half-built — `Referral` model + `referralCode` exist, but "+10 places / visible queue position" (GTM §9) is not implemented | schema `referrals`; no queue logic in `account`/`cats` services | 3–5 d |
| H4. Newborn-kitten age deadlock — 0y/0m can never satisfy `ageKnown`; Issue-ID button never enables | `cats/new/page.tsx:404-406` | 2 h |
| H5. Contradictory price-visibility promise — `/portal/welcome` says "no prices before ready"; live `/portal/subscribe` ComingSoon shows plan prices | `welcome:219` vs `subscribe:652-693` | 2 h |
| H6. Snapchat underweighted + WhatsApp absent in GTM — the two biggest KSA peer-sharing surfaces | GTM §6 (Snap = 1 line), no WhatsApp channel | plan work |
| H7. No email nurture sequence designed for register→waitlist→convert | GTM has no email section | plan work |
| H8. **[Latent]** Reconcile GTM unit economics (55% margin, LTV 1,700–2,300) with audit reality (24% post-VAT, box > à-la-carte) before spending §12 budget toward paid | GTM Exec Summary vs ELITE §5 | analysis |

### 🟡 Medium

| Issue | File / source | Time |
|---|---|---|
| M1. `deleteAccount` orphans cat photos in R2 — PDPL erasure incomplete for media (single-cat delete does it right; account delete doesn't) | `account.service.ts:516-519` vs `cats.service.ts:523-566` | 0.5 d |
| M2. Admin census dashboard mixes demo cats — no `isDemo:false` filter, unlike the public service | `analytics.service.ts:29` | 1 h |
| M3. No community photo moderation / NSFW screening on a feature that publishes named cats by district | ELITE §community | 2–3 d |
| M4. No re-engagement drip during the census window ("347 more cats since Lulu") to extend FOMO past the single registration moment | GTM gap | 1 d + copy |
| M5. Homepage OG image is static — doesn't render the live census number (missed share hook); per-cat cards already dynamic | `app/opengraph-image.tsx` | 0.5 d |
| M6. Thin census-phase social proof — only the single latest public cat; a short rotating recent-cats list would help the first 5 seconds | `page.tsx:551-559`, `FoundingNote` | 0.5 d |
| M7. Pull the lost-cat poster network + neighborhood leaderboard (GTM §15 moonshots #1, #8) forward into Phase 0 — both are stronger shareability than the core plan and #1 is a zero-downside public service | GTM §15 | plan work |

### 🟢 Nice to have

- N1. Password show/hide toggle hit area < 44px (`field.tsx:53-61`) — on the exact form everyone funnels through.
- N2. `/verify/cat/:token` has no rate limit (`verify.controller.ts:11`) — high-entropy token makes it low-risk.
- N3. No "Census" entry in top nav (`site-header.tsx:65`) — only path back is logo→scroll.
- N4. Phone min-digit rule differs between screens (8 vs 9: `register:135` vs `cats/new:408`).
- N5. CI dependency audit is `continue-on-error: true` — tighten or alert.
- N6. Two migrations share timestamp `20260720010000_*` — relies on alphabetical tie-break; fragile.

---

## 4. Section notes (beyond the matrix)

**§3 Cat Census Campaign.** The concept is right and rare: honest scarcity (sequential IDs, not countdown clocks), a dataset story the press will actually pick up. Two structural risks beyond the perk-vaporware issue: (a) the Phase-0 *exit gate* ("redemption tested end-to-end at 3 clinics") **cannot pass today** — the vet platform can't render its own API (ELITE: 34/100), so early founders get an ID with no live partner behind it, concentrating the "decoration" risk in the highest-status cohort; (b) consider **not activating "Founding Member" status until the 20-partner gate is met**, or state in copy that perks activate *at launch, not at registration*, so early joiners aren't quietly disappointed.

**§11 Vet Ecosystem.** This is the true long-term moat — the only player building cross-clinic records — and it's the census's implicit promise (health is one of the Cat ID's four jobs). But it is the least ready surface, and the field pitch ("live in 45 minutes, 5-second verification") currently sells something that doesn't work on the demo iPad. For the census, the ask is narrow: make **one** clinic's verification + record flow real before the founder-led vet pitch starts, so the demo is truthful.

**§13 Psychology / Virality.** Would someone proudly share their Cat ID? Yes — this is the strongest asset. But the public-profile surface (named cat + district + owner) needs an explicit "what's public by default vs opt-in" decision paired with real moderation (M3) before you actively encourage a *national* index of pets by name and neighborhood.

**§17 Legal.** PDPL export/erasure are real (fix the photo-orphan, M1). Before running the census publicly, confirm the live status of: Privacy Policy, ToS, UGC/photo consent copy, and marketing-consent capture at registration. ZATCA e-invoicing is unbuilt but **latent** (only matters when commerce + VAT threshold hit).

**§18 Data & Analytics.** The whole point of Phase 0 is a *measured* number. Today you can report the total and per-stand yield (`?src=`), nothing else. You need, minimum: GA4 + Meta + TikTok + **Snapchat** pixels, a `cat_registered` conversion event fired at ID issue, UTM→registration attribution joined to the `WaitlistEntry.source`/`sourceCode` you already capture, and a simple funnel dashboard (visit → name entered → account → Cat ID issued → public opt-in → referral sent). North-star metric: **Cat IDs registered/week**; guardrail: **% real/verified** (defends against C1).

---

## 5. Action plan

### Week 1 — "Make the number trustworthy and measurable"
1. C1 + C5: `@Throttle` + per-account daily cap on `POST /cats`; add Turnstile/hCaptcha to `/auth/register` and first-cat creation.
2. C2: kill the hardcoded "Riyadh Class of 2026" copy; use the real per-city `foundingClassLabel`.
3. C3: wire GA4 + Meta + TikTok + Snapchat pixels behind consent; fire `cat_registered` at ID issue; build the funnel dashboard.
4. H4 + H5: fix the newborn deadlock; reconcile the price-visibility promise (strip prices from ComingSoon or align the welcome copy).

### Week 2 — "Make the funnel not leak"
5. H1: `/register` guard for authenticated sessions + session-aware header/footer CTAs.
6. C4: define `foundingBenefit` as real product state; decide perk-activation timing (registration vs launch) and make copy honest.
7. H2: cut the funnel toward the north star — default Google SSO to drop the password, defer `gender`/`city`, or update the "two minutes" promise to the truth.
8. M1 + M2: fix PDPL photo erasure; exclude demo cats from the admin dashboard.

### Week 3 — "Make it spread"
9. H3: build the referral queue-jump (+10 places, visible honest position) — the plan's growth engine.
10. M5 + M6: dynamic OG with the live count; rotating recent-public-cats strip for social proof.
11. M7: pull the lost-cat poster network + neighborhood leaderboard into the core Phase-0 asset set.
12. Vet: make one real clinic verification/record flow work end-to-end for a truthful founder demo.

### Week 4 — "Seed supply and press"
13. Sign the first cohort of vet + retail partners (GTM §1 gate: 10 + 10) with a demo that now works.
14. M3: ship photo moderation before actively encouraging public cats.
15. M4: launch the re-engagement drip.
16. Brief the 5 embargoed journalists on the census-data angle (GTM §10).
17. H8 (parallel, non-blocking for census): reconcile the unit-economics before any commerce-scaling spend.

### Pre-launch checklist (census go/no-go)
- [ ] `POST /cats` throttled + capped; CAPTCHA on signup; % real-registrations dashboard green.
- [ ] No false city copy anywhere on the front door.
- [ ] Analytics live; `cat_registered` firing; per-channel attribution verified end-to-end.
- [ ] Founding benefit defined + activation timing honest in copy.
- [ ] `/register` guarded; funnel field-count matches the promise.
- [ ] Privacy Policy / ToS / UGC consent / marketing consent live and linked.
- [ ] Photo moderation on for public cats; PDPL erasure frees media.
- [ ] One vet verification flow demonstrably real.

### Launch-day checklist
- [ ] Uptime monitor on `GET /health` + census endpoint; alert on error-rate + on registration anomaly (C1 tripwire).
- [ ] Dashboard visible to the team: live count, per-channel registrations, % verified.
- [ ] First founding cats are real, named, public-opted-in (seed the "Cat #N is …" beat honestly).
- [ ] Press embargo lifts with a working front door and a truthful number.

### First 30 days
- Weekly north-star review (IDs/week) with the kill/scale rules from GTM §12 — now that you have the data to run them.
- Watch referral share of new registrations; iterate the queue-jump copy.
- Convert the first vet demo into the first signed clinic; test redemption for real.

### First 90 days
- Hit the GTM §1 exit gate honestly (1,000 real IDs, 20 live partners, redemption tested at 3 clinics) — do not open commerce before it passes.
- Reprice the box below à-la-carte and build auto-renew **before** flipping commerce (the census's whole value bridge depends on the box being a real deal).
- Model the VAT cliff into the spend plan.

### First year
- Riyadh → Jeddah → Eastern Province, led by the compounding assets (stands, partner network, referral engine, content library), not rented ads.
- Turn the registry into the moat: cross-clinic records live, Cat ID accepted at partner clinics as the identity standard.
- Re-audit against this document; the target is a census that produced a real, defensible number — and a subscription the box's economics can actually sustain.

---

*Prepared 2026-07-21. Findings are file-cited; scores are Phase-0 census-lensed and deliberately ruthless. The headline is not "this is broken" — it's "this is unusually well-built and three cheap fixes stand between it and a census worth trusting."*
