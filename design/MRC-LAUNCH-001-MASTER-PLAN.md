# MRC-LAUNCH-001 — Moracat Master Launch Plan & Operating Manual

**Version:** 1.0 · **Date:** 2026-07-22 · **Status:** Working document — the single pre-launch operating manual
**Scope:** Everything between today's state (Census live, commerce dark, zero physical operations) and a business serving thousands of paying members.
**Companion documents:** `design/DESIGN-AUTHORITY.md` (experience constitution), `design/audits/MRC-AUDIT-2026-07-19-ELITE.md` (latest deep audit, 58/100), `design/moracat-vet-portal-dossier.html` (MRC-VET-001), MRC-GTM-001 (Census strategy).

---

## 0. How to read this document

This is not advice. It is an audit of what exists, a checklist of what doesn't, and a sequenced plan to close the gap. Every score is grounded in the actual codebase, the four prior audits (2026-07-04 → 07-19), and the real production state as of 2026-07-22. Where something is opinion, it says so.

**The one-paragraph truth:** Moracat has built a genuinely world-class *digital* product — the Cat ID, the census, the community, the vet platform architecture, and a payment engine with better integrity than most funded startups — and has built **0% of a physical commerce business**. No supplier contract, no inventory, no warehouse, no packaging, no packed box, no shipped box, no courier account, no accounting system. Worse, the *model* of the commerce business is currently broken on paper: the box costs more than its contents bought separately, nothing auto-renews, and checkout is routed exclusively through the most expensive payment method in the Kingdom. The digital foundation deserves a 8/10; the business wrapped around it is at 2/10. This document exists to fix the second number without damaging the first.

---

## 1. Executive Summary

### 1.1 Where Moracat actually is (2026-07-22)

| Layer | State |
|---|---|
| **Live product** | Saudi Cat Census + Cat ID + community at www.moracat.co. ~48 cats, ~45 users in prod. Commerce code deployed but dark (`COMMERCE_ENABLED=false`). |
| **Commerce engine** | Built and latently complete: 3 plans (249/349/529 SAR/mo, 3-mo min prepaid term), Tamara checkout, lifecycle engine (term-end invitations, lapse, reminders), 259-product supplier catalog imported, admin refund/order tooling. Never processed a real riyal. |
| **Vet platform** | 71 API routes, append-only clinical records, consent tiers — architecturally excellent, but the elite audit scored it 34/100 because the portal UI is written against an API contract that doesn't fully match, browser-level verification never happened, and **zero clinics are signed**. |
| **Physical operations** | Nothing exists. Not one box has ever been packed. |
| **Company** | Legal entity exists (مؤسسة عبدالرحمن منصور الغامدي التجارية). Not VAT-registered (0% by design, deliberate). No accounting software, no trademark filing confirmed, no Maroof registration confirmed. |
| **Team** | One founder. Every SOP in this document currently has the same owner. |
| **Regression risk (TODAY)** | Yesterday's rollback (commits 206edd3, 44b4619) removed census bot-protection, Turnstile, ALL analytics, founding-benefit framework, and the referral loop from production. Prod is currently **unprotected and unmeasured** at its front door. The work is intact in git (0e2f3bc + 96a21df). |

### 1.2 Launch Readiness Score

A single number would lie. Three honest ones:

| Track | Score /100 | Meaning |
|---|---|---|
| **Community/Census launch** (what's live) | **76** | Live, safe, well-crafted. Docked for the rolled-back protection/analytics, 2 open security criticals, and a growth loop that is currently deleted from prod. |
| **Commerce launch** (taking money) | **41** | Engine is real, but the offer loses to your own store, retention machinery is one-shot, unit economics fail post-VAT, and the entire physical chain is unbuilt. |
| **Operations maturity** (serving thousands) | **12** | Software-only. No supplier agreements, inventory, fulfillment, support SOPs, bookkeeping, or second person. |
| **Composite (weighted 30/40/30)** | **≈ 48/100** | Consistent with the 58/100 elite audit two days ago minus the rollback regression, plus honest weighting of physical ops which prior audits under-weighted. |

### 1.3 The Five Critical Issues (each one alone blocks commerce)

1. **The box has negative value vs. your own catalog.** Store retail = cost × 1.8; box price = cost × ~2.2–2.4 effective. A member who checks prices discovers the membership *costs* them 19–35%. This is the single most dangerous fact in the company: the product's core promise ("savings are proof of value" — your own design authority) is currently false. Fix: reprice the box to land 8–12% *below* à-la-carte retail of identical contents, and show the ledger on the box page ("Contents worth 412 SAR — you pay 349").
2. **Nothing auto-renews and the only PSP can't fix it.** Tamara is BNPL — it cannot tokenize a card for merchant-initiated recurring charges. Every term end is a full re-decision → realistic term-to-term retention 30–45% instead of 75–85%, roughly halving LTV. Fix: integrate Moyasar (or HyperPay/Tap) for mada + Apple Pay with tokenization, make auto-renew the default with honest opt-out (the "no automatic renewal — ever" copy was the right *honesty* fix for the current engine, but the engine itself is the wrong shape for a subscription business).
3. **Tamara-only checkout costs ~6–7% + fixed fee per transaction** vs ~1–2.5% on mada. On the Standard plan that is ~55–70 SAR of margin per term handed to the PSP for customers who didn't need installments. Fix is the same Moyasar integration as #2 — Tamara becomes an *option*, not the door.
4. **The VAT cliff at ~SAR 375,000 rolling revenue (~150 concurrent Standard subs).** Registration becomes mandatory, prices are VAT-inclusive by design, so ~13% of revenue (≈35% of contribution margin) evaporates overnight, and ZATCA Fatoora e-invoicing (Phase 1 immediately, Phase 2 integration by wave) is entirely unbuilt. Fix: register *voluntarily before launch*, price the plans with VAT inside from day one (the current 249/349/529 can absorb it if the COGS work in §7 is done), and build Fatoora-compliant invoices now while there are zero customers, not at 150.
5. **Two live security criticals from the elite audit are (as far as any record shows) still open:** stored XSS via `JSON.stringify` into a `<script>` tag at `community/[slug]/page.tsx:67` (chains with localStorage tokens → account takeover surviving password change), and the vet counter-mode PIN token signed with the user-access secret with no `typ` claim check (`jwt.strategy.ts:25`). Both are fixable in under a day. Verify against current code and close before anything else in this document.

### 1.4 Quick Wins (days, not weeks — ordered by impact per hour)

1. **Restore the census hardening** — cherry-pick `0e2f3bc` + `96a21df` (fail-open Turnstile already included), add **both** `moracat.co` and `www.moracat.co` to the Turnstile widget's hostname allowlist, deploy with `TURNSTILE_ENFORCE` unset (fail-open), watch for token success in logs for 48h, then enforce. This single action restores: bot protection, GA4/Meta/TikTok/Snap/Clarity analytics (keys already purchased and pasted — currently dormant), founding benefits, the referral recognition loop, and the PDPL photo-erasure fix.
2. **Fix the two security criticals** (§1.3.5).
3. **Register on Maroof** (Ministry of Commerce e-store trust mark) and put the badge in the footer — near-zero effort, materially raises Saudi consumer trust.
4. **File the trademark at SAIP** for "Moracat / مرقط" (word + logo, classes 31 pet food, 35 retail, 44 veterinary, 42 software). ~2,000–3,500 SAR, protects the brand before it's visible.
5. **Set up accounting from riyal zero** — Qoyod or Wafeq (both ZATCA-integrated, Arabic-first, ~100–200 SAR/mo). Connect the bank account. There is currently no ledger of anything.
6. **Hand-pack one box.** Buy one unit of each Standard-plan item from the supplier, a stock kraft mailer, tissue, and a printed card. Photograph the unboxing. This costs <500 SAR and converts the box from a spreadsheet abstraction into a physical fact — it will immediately surface weight, dimensional issues, and the real courier quote.

### 1.5 Highest-ROI Improvements (weeks)

| # | Improvement | Why it's the highest leverage |
|---|---|---|
| 1 | **Reprice the box below à-la-carte + show the value ledger** | Turns the core promise from false to demonstrably true. Everything else is downstream of having an offer worth buying. |
| 2 | **Moyasar integration (mada + Apple Pay + tokenization)** | Simultaneously fixes auto-renew (LTV ×~1.8), payment cost (−4–5 pts of revenue), and conversion (mada is how Saudis pay; BNPL-only checkout reads as a debt product). |
| 3 | **Voluntary VAT registration + Fatoora invoices now** | Converts a future cliff into a solved constant. Investors will ask; "handled from day one" is the right answer. |
| 4 | **A 20-box founder-fulfilled pilot** (§12, weeks 3–6) | De-risks the entire physical chain with real members before any warehouse or 3PL commitment. Chewy and BarkBox both started literally this way. |
| 5 | **One named Riyadh founding clinic, onboarded in person** | The elite audit's strategic finding stands: clinics are the hard side of the network and currently get zero value. One real clinic using the portal weekly is worth more than the other 70 API routes. |

---

## 2. PHASE 1 — Business Audit (24 sections, scored 1–10)

Scoring rule: 10 = Series-A-ready best practice; 5 = functional but fragile; 1 = does not exist. Scores reflect **today's production state**, not code that exists but is dark or rolled back.

### 2.0 Scorecard

| # | Section | Score | Priority | Difficulty |
|---|---|---|---|---|
| 1 | Business Model | **3** | 🔴 P0 | Medium |
| 2 | Brand | **8** | 🟢 P3 | — |
| 3 | Positioning | **7** | 🟡 P2 | Low |
| 4 | Product — digital | **7.5** | 🟡 P2 | Medium |
| 5 | Product — physical box | **2** | 🔴 P0 | Medium |
| 6 | Website | **7.5** | 🟡 P2 | Low |
| 7 | Technology | **7** | 🟡 P1 | Medium |
| 8 | Pricing | **3** | 🔴 P0 | Low |
| 9 | Subscription mechanics | **4** | 🔴 P0 | High |
| 10 | Logistics | **1** | 🔴 P0 | Medium |
| 11 | Packaging | **1** | 🔴 P0 | Medium |
| 12 | Marketing | **2** | 🔴 P1 | Medium |
| 13 | Social media | **3** | 🟡 P1 | Low |
| 14 | Customer support | **5** | 🟡 P1 | Low |
| 15 | Finance & accounting | **3** | 🔴 P0 | Low |
| 16 | Operations | **1** | 🔴 P0 | Medium |
| 17 | Inventory | **1** | 🔴 P0 | Medium |
| 18 | Legal & compliance | **5** | 🔴 P0 | Low |
| 19 | Supplier management | **3** | 🔴 P0 | Medium |
| 20 | Vet partnerships | **2** | 🟡 P1 | High |
| 21 | Growth strategy | **4** | 🟡 P1 | Medium |
| 22 | Retention | **3** | 🔴 P0 | High |
| 23 | Referral system | **3** | 🟡 P1 | Low |
| 24 | Community | **6.5** | 🟢 P2 | Low |

### 2.1 Business Model — 3/10 🔴

- **Why:** The declared model (membership identity monetized through a care subscription) is strategically sound and differentiated — that's worth the 3. But the current implementation inverts it: the box is priced *above* its own à-la-carte contents (import-catalog retail = cost × 1.8 vs box effective ~×2.2+), retention is structurally one-shot (no auto-renew), and the only payment rail eats 6–7%. The elite audit's math stands: post-VAT LTV:CAC does not clear 3:1 at any plausible CAC.
- **Risks:** First cohort of savvy members discovers the negative savings publicly (screenshot of store price vs box price on X) → the brand's central claim collapses. Churn cliff at every 3-month term end. VAT cliff destroys margin exactly when growth starts working.
- **Recommendations:** (a) Reprice per §7 so contents-at-retail > box price, always, provably. (b) Auto-renew default via tokenized mada. (c) Register VAT voluntarily; price VAT-inside from day one. (d) Consider a small paid membership fee (e.g., 19 SAR/mo standalone "Moracat Member" with partner discounts + wallet card) so identity has a revenue line independent of the box — but only after partners exist (R040: never promise a network you don't have).
- **Priority/Difficulty:** P0 / Medium — repricing is a spreadsheet + seed change; auto-renew is a real integration (~2–3 weeks).

### 2.2 Brand — 8/10 🟢

- **Why:** The "warm paper, flat stickers" art direction, bilingual RTL-native execution, ceremony design, and a written design constitution (R001–R120) put brand craft above nearly every regional competitor and most funded DTC brands. The Arabic localization libraries scored 91/100 in the elite audit.
- **Risks:** Brand quality is currently *ahead* of business truth (premium brand, unproven offer) — a gap that reads as deception if the box disappoints. Lyon Arabic ships regular-only (faux-bold headings). Brand is unregistered (no confirmed SAIP filing) — a squatter filing "مرقط" in class 31 would be expensive.
- **Recommendations:** File SAIP trademark now (quick win #4). License the Lyon Arabic bold cut. Keep brand and truth in lockstep — every claim on the site must survive an auditor (R006 already encodes this; keep citing it).
- **Priority/Difficulty:** P3 maintenance / trademark is P0-easy.

### 2.3 Positioning — 7/10 🟡

- **Why:** "Membership identity, cat is the hero, savings are proof" is a genuinely differentiated position vs. Salla pet stores and Instagram sellers. The Census front door ("Riyadh Class of 2026", founding member ≤1000, derived-not-stored) is excellent GTM craft.
- **Risks:** Two positioning claims are currently unbacked: savings (see 2.1) and partner benefits (no partners). The homepage previously advertised a computed-plan story while checkout sold tiers — reconciled in the god-mode remediation, but the tension will return with every new surface.
- **Recommendations:** Adopt a hard rule: a benefit appears on a marketing surface only after it is redeemable. Sequence: census → box (repriced) → named founding partners (1–5, by name, R040) → network language.
- **Priority/Difficulty:** P2 / Low.

### 2.4 Product — digital — 7.5/10 🟡

- **Why:** Cat ID + ceremony + community + portal + lifecycle engine + admin + vet platform is an enormous, mostly-verified surface (169–171 e2e checks at last green). Money integrity is genuinely world-class (Decimal everywhere, fails closed, amount tampering structurally impossible).
- **Risks:** The recurring failure mode named by the elite audit — *comments describe the intent, code does something else* — is a process risk that will keep reintroducing bugs. The rolled-back wave means prod digital ≠ repo best state. Apple Wallet still `apple:false`; Google OAuth decoy history; ~15 English error sites in Arabic UI (partially fixed).
- **Recommendations:** Re-land the rolled-back wave first. Add the audit's review question ("does the code do what this comment says?") to the review checklist. Then freeze digital feature work — the marginal digital feature is worth far less than the first packed box.
- **Priority/Difficulty:** P2 / Medium.

### 2.5 Product — physical box — 2/10 🔴

- **Why:** The box exists as recipes in `seed-catalog.ts` and real supplier COGS (104.75 / 150.75 / 245.25 SAR). That's a plan, not a product. No sample has been assembled; no weight/dimensions are known; no item has been quality-checked in hand; Premium's dry-food reconciliation (Josera Sensi 2kg) was done on paper.
- **Risks:** Unknown box weight → courier cost is a guess (dry food + litter is *heavy*; a 7–9 kg box can cost 35–60 SAR intra-KSA, worse to remote regions). Expiry management for food is unplanned. A recipe item going out of stock at the supplier has no substitution rule.
- **Recommendations:** Hand-pack all three tiers this week (quick win #6). Weigh them. Get real courier quotes against real weights. Write the substitution policy (same nutritional class, equal-or-higher retail value, notify member). Decide litter strategy explicitly — litter may deserve exclusion from the box (weight killer) in favor of a partner-discount or add-on rail.
- **Priority/Difficulty:** P0 / Medium.

### 2.6 Website — 7.5/10 🟡

- **Why:** 58-page production build, bilingual RTL-first, ceremony at 8.6/10, honest checkout, funnel wired, dynamic OG, strong a11y baseline (focus traps, skip links, reduced-motion work done). Four audits of iteration show.
- **Risks:** SEO remains the weakest web pillar (blog metadata, per-cat OG image now exists but sitemap coverage and content depth are thin). Analytics are dark post-rollback — you cannot see the funnel you built. The store is hidden (`isStorePublished=false`) with placeholder Arabic product copy behind it.
- **Recommendations:** Restore analytics (quick win #1). Native-Arabic review of the 259 catalog items (`needs-ar` keywords are already flagged) before any store unhide. Add content SEO only when there's someone to write it — thin AI content in Arabic pet care would damage the trust brand.
- **Priority/Difficulty:** P2 / Low.

### 2.7 Technology — 7/10 🟡

- **Why:** Modern monorepo, typed end-to-end (zero `any` in ~24k lines), migrations disciplined, kill-switch fails closed and is two-pass e2e-proven, Sentry wired, health checks schema-aware, lifecycle idempotency ledger. This is above-market engineering.
- **Risks:** The 2 open security criticals (§1.3.5). Tokens in `localStorage` (XSS blast radius) and no CSP/HSTS noted in the 07-07 audit — verify current state. Single-region single-instance Render API; no documented backup/restore drill for Neon; no load test has ever run; the cron blind spot class (schedulers bypass route guards) needs a standing rule. One founder = bus factor 1 on infra.
- **Recommendations:** Close criticals; add CSP + HSTS; move tokens to httpOnly cookies when feasible; run one Neon point-in-time-restore drill and write down the RTO; add an uptime monitor on `/health` (was still open as an ops task); load-test checkout at 50 rps before any paid campaign.
- **Priority/Difficulty:** P1 / Medium.

### 2.8 Pricing — 3/10 🔴

- **Why:** Real supplier COGS and a clean VAT-toggle architecture (`pricing.ts`) earn the 3. But the *numbers* fail: box > à-la-carte, Tamara-only fee load, VAT-inclusive posture without VAT headroom, and the "Best value" theater was already caught and removed once.
- **Risks:** Repricing after launch punishes founding members (or requires grandfathering complexity). Under-pricing to fix the optics could push break-even beyond reachable subscriber counts.
- **Recommendations:** Full framework in §7. Target: box price = à-la-carte retail × 0.90 ± 2%, gross margin ≥ 45% *after* VAT and payment fees, contribution ≥ 30% after shipping+packaging.
- **Priority/Difficulty:** P0 / Low (it's arithmetic + a seed re-run; the discipline is the hard part).

### 2.9 Subscription mechanics — 4/10 🔴

- **Why:** Prepaid 3/6/12-month terms with a lifecycle engine (T-7/T-1 invitations, graceful lapse, DRAFT resume, honest cancel/pause) is well-built machinery — for the wrong shape. One-shot prepay via BNPL is a *payment plan*, not a subscription.
- **Risks:** The first term-end cliff for the earliest cohort arrives ~Oct 2026. Without stored payment methods, every renewal is a fresh conversion event competing with every other demand on the member's attention.
- **Recommendations:** Moyasar tokenization → auto-renew default with pre-charge notification (7 days, per honest-by-design rules and Saudi consumer-protection norms), keep Tamara as an upfront-installments *option*, keep the prepaid-term product for gift/commitment discounts.
- **Priority/Difficulty:** P0 / High (PSP integration + lifecycle changes + copy truthing).

### 2.10 Logistics — 1/10 🔴

- **Why:** Nothing exists: no courier account, no rate card, no pickup arrangement, no delivery SLA, no returns route, no COD decision.
- **Risks:** Kingdom-wide promise vs. reality: remote-region surcharges, heat degradation of food in summer transit (it is 45°C in Riyadh in July), failed-delivery rates in KSA are high without WhatsApp coordination.
- **Recommendations:** §6.3. Start with an aggregator (Torod or Shipox) to get SMSA/Aramex/iMile rates without volume commitments; Riyadh-only for the pilot; explicit no-COD (prepaid product); WhatsApp delivery notifications.
- **Priority/Difficulty:** P0 / Medium.

### 2.11 Packaging — 1/10 🔴

- **Why / Risks / Recommendations:** Does not exist in any form. Full program in §6.5 + §6.6. The unboxing IS the product moment for a membership brand — this is the highest-craft physical surface and it's at zero.
- **Priority/Difficulty:** P0 / Medium (4–6 week lead time on custom boxes — order early).

### 2.12 Marketing — 2/10 🔴

- **Why:** Assets exist (analytics keys purchased, Meta ad account connected via MCP, IG handle, dynamic OG cards, referral loop *written*), but: analytics rolled back (blind), zero paid campaigns ever run, no content calendar, no creator relationships, no email nurture. The Census GTM design is genuinely good — unexecuted.
- **Risks:** Spending on ads before analytics restore = unmeasurable burn. The census growth window (founding-1000 scarcity) decays if unpromoted.
- **Recommendations:** Full playbook §8. Sequence: restore measurement → organic census push (UGC of ceremonies) → 3–5 micro-influencer cat accounts (KSA cat Twitter/X and IG are unusually strong) → small paid tests only after CAC instrumentation works.
- **Priority/Difficulty:** P1 / Medium.

### 2.13 Social media — 3/10 🟡

- **Why:** @moracat.sa exists; no evidence of a posting engine, content pillars, or Arabic-first short-video presence. The product generates photogenic moments (ceremony, member numbers, cat profiles) that currently evaporate unposted.
- **Recommendations:** §8.2. Cadence over polish: 4–5 posts/week reels-first, member-cat features (with the consent machinery you already built), founding-member countdown content honest per R006 (no fake scarcity — you deliberately have no "N left" counter; market the *cohort*, not the countdown).
- **Priority/Difficulty:** P1 / Low.

### 2.14 Customer support — 5/10 🟡

- **Why:** Real ticket system with categories, staff replies, email notifications, admin customer-360 — better tooling than most pre-launch companies. Missing: SOPs, SLAs, WhatsApp channel (where Saudi customers actually are), macros/canned responses, and any second responder.
- **Recommendations:** SOP library in §11. Add WhatsApp Business (or at minimum a wa.me deep link routed to the founder's business number) before commerce flips; Saudi buyers pre-purchase-check via WhatsApp/DM, and its absence suppresses conversion.
- **Priority/Difficulty:** P1 / Low.

### 2.15 Finance & accounting — 3/10 🔴

- **Why:** A real financial model exists (COGS-true pricing work, break-even ~945 subs computed) and money-handling *code* is excellent. But the company has no books: no accounting software, no chart of accounts, no bank-reconciliation habit, no monthly close, no cash-flow forecast document.
- **Risks:** ZATCA penalties post-VAT-registration for record gaps; investor diligence fails on day one without ledgers; founder cannot answer "what did you spend last month?"
- **Recommendations:** Qoyod or Wafeq now (quick win #5); chart of accounts in §7.6; weekly 30-min finance ritual (reconcile, categorize, update the 13-week cash forecast).
- **Priority/Difficulty:** P0 / Low.

### 2.16 Operations — 1/10 🔴 & 2.17 Inventory — 1/10 🔴

- **Why:** Zero physical operations of any kind. Inventory exists only as a Prisma model and a Salla legacy (explicitly ignored per the 07-15 decision).
- **Recommendations:** Full operations manual §6 and inventory system §11.5. Pilot phase runs from the founder's home/garage with a spreadsheet — that is *correct* at this stage; the mistake would be leasing a warehouse before 200 subscribers.
- **Priority/Difficulty:** P0 / Medium.

### 2.18 Legal & compliance — 5/10 🔴

- **Why:** Entity exists; legal pages shipped (07-08 fix); PDPL work is real (consent at share-time, erasure cascade — though the photo-erasure fix was in the rolled-back commits); commercial registration presumably covers e-commerce activity (verify the ISIC activities on the CR include retail of pet supplies + subscription/e-commerce).
- **Gaps:** Maroof registration (unconfirmed), SAIP trademark (unconfirmed), VAT/Fatoora posture (§1.3.4), SFDA/MEWA angle on pet food (mitigated if buying from a KSA-licensed distributor — the supplier holds import compliance; **confirm in writing** that the supplier's products are SABER/MEWA-cleared), municipal (Balady) + Civil Defense licensing *when* a storage location exists, terms-of-sale specifics for prepaid terms (refund formula for mid-term cancellation is still a policy hole — flow exists, numbers don't).
- **Priority/Difficulty:** P0 / Low (mostly paperwork).

### 2.19 Supplier management — 3/10 🔴

- **Why:** A 259-product PSV with real costs is genuine leverage — most founders start without it. But: single supplier, no signed agreement, no credit terms, no MOQ/lead-time data, no price-protection clause, no backup source per category.
- **Recommendations:** §6.1. Get a simple supply agreement (prices held 6 months, lead times, return-of-defectives, no-MOQ pilot clause). Identify one backup distributor per core category (dry food, wet food, litter). Never build recipes around single-source SKUs without substitutes.
- **Priority/Difficulty:** P0 / Medium.

### 2.20 Vet partnerships — 2/10 🟡

- **Why:** The platform is built; the partnership *program* isn't: zero clinics signed, no settlement/commission model in code, portal-vs-API contract mismatches, no in-clinic materials, no onboarding kit.
- **Recommendations:** The elite audit's inversion stands and this document adopts it: geo-concentrate on one Riyadh district; the wedge is the **vaccination/travel-certificate PDF + clinic-created patients** (gives clinics value on day one with no consumer-side liquidity needed); fix the portal/API contract before the first demo; sign 1–3 *named* founding clinics (R040).
- **Priority/Difficulty:** P1 / High — but decoupled from commerce launch; do not let it block the box.

### 2.21 Growth strategy — 4/10 🟡 · 2.22 Retention — 3/10 🔴 · 2.23 Referral — 3/10 🟡

- **Why:** Census GTM is a real strategy (4). Retention machinery is honest but one-shot (3 — see 2.9); vaccination `dueAt` is now acted on by the lifecycle engine, birthdays/anniversaries exist — good bones. Referral recognition loop (honest "brought" counts, no line-jumping) was built and then rolled back with the wave (3).
- **Recommendations:** Restore the wave. Retention = auto-renew (§2.9) + the care loop (vaccination reminders that lead to a clinic visit that writes back to the record — the thesis join already works) + box-cycle anticipation content ("your August box ships in 3 days" with a teaser). Referral: keep recognition-first pre-commerce; add a tangible reward (one free month per 3 activated referrals) only post-commerce, funded from the CAC line.
- **Priority/Difficulty:** P1 / Medium.

### 2.24 Community — 6.5/10 🟢

- **Why:** Live with ~11+ real public cats, real photos, likes, honest collections, moderation (reactive report→hide), consent-first sharing, per-cat OG cards. Cold-start solved with real members, not seeds. Docked: small absolute size, no ML/pre-publish moderation, engagement loops (comments/follows) deliberately absent, and growth features currently rolled back.
- **Recommendations:** Keep it small and real. The census cohort ("Class of 2026") is the community engine — invest in member-cat features and offline moments (a Riyadh founding-members meetup at a partner clinic/cat café would be worth 50 features).
- **Priority/Difficulty:** P2 / Low.

---

## 3. PHASE 2 — Master Launch Checklist

Legend: ✅ done/verified · 🔶 built but dark/rolled back/unverified · ☐ not done. Items marked **[C]** gate the commerce flip; **[S]** gate scale (>500 subs).

### 3.1 Company & Legal

- ✅ Commercial registration (مؤسسة عبدالرحمن منصور الغامدي التجارية) — ☐ **verify CR activity codes** cover pet-supplies retail, e-commerce, subscription services
- ☐ **[C]** Maroof registration + badge in footer
- ☐ **[C]** SAIP trademark filing — word + logo, classes 31/35/42/44 (ar + en marks)
- ☐ **[C]** Voluntary VAT registration + ZATCA Fatoora Phase-1-compliant invoices (QR code TLV, seller name/VAT number, VAT breakout — the invoice code exists; make it Fatoora-conformant)
- ☐ Business bank account confirmed + ☐ **[C]** accounting software (Qoyod/Wafeq) live with chart of accounts (§7.6)
- ☐ Payment gateway agreements: 🔶 Tamara (sandbox creds only — production creds needed) · ☐ **[C]** Moyasar (or HyperPay/Tap) merchant account for mada/Apple Pay/tokenization
- ✅ Terms of service · ✅ Privacy policy (PDPL) · ✅ Refund/shipping pages exist — ☐ **[C]** add the **mid-term refund formula** (policy numbers, not just flow) and prepaid-term terms-of-sale
- 🔶 PDPL: consent at share-time ✅ · erasure cascade incl. cat photos 🔶 (in rolled-back commits) · ☐ RoPA (record of processing activities, 1-page) · ☐ breach-notification runbook (72h SDAIA window)
- ☐ Supplier compliance letter: written confirmation products are MEWA/SABER-cleared for KSA sale
- ☐ **[S]** Balady municipal license + Civil Defense certificate when a dedicated storage space exists
- ☐ **[S]** Insurance: inventory/contents cover at minimum; consider product-liability when volumes justify
- ☐ Domain protection: moracat.sa / مرقط domains, common typos; registrar 2FA + lock
- ☐ Founder-absence continuity note: where credentials live (password manager), who can act (bus factor 1 today)

### 3.2 Product (before commerce flip — all [C])

- 🔶 Repriced box seed: box ≤ 0.92 × à-la-carte retail of contents, margins per §7 — ☐ decided ☐ seeded ☐ verified on prod
- ☐ Value ledger on the box/plan page ("contents worth X SAR")
- ☐ Hand-packed sample of ALL THREE tiers: weights, dimensions, photos
- ☐ Substitution policy written (out-of-stock item → same class, ≥ value, member notified)
- ☐ Expiry rule: nothing ships with <60 days shelf life; FEFO picking
- ☐ Litter decision: in-box vs add-on vs excluded (weight economics)
- ☐ Arabic product names/descriptions native-reviewed (259 items carry `needs-ar`)
- ☐ Real product photography (manufacturer images licensed or own lightbox shots — placeholder images currently)
- ☐ First 3 monthly themes planned (§6.7) with recipes locked and stock confirmed

### 3.3 Website & App

- ✅ Census/community/portal/ceremony/admin live · ✅ bilingual RTL-native · ✅ error states/silent-failure sweep done
- 🔶 **Restore rolled-back wave** (Turnstile fail-open + hostnames fixed, bot throttles, analytics, founding benefits, referral card, PDPL photo erasure) — the top item on the whole checklist
- ☐ Fix stored XSS `community/[slug]/page.tsx:67` · ☐ fix vet PIN token `typ` confusion `jwt.strategy.ts:25`
- ☐ CSP + HSTS headers · ☐ evaluate httpOnly-cookie session migration
- 🔶 Store unhide (`isStorePublished`) — only after Arabic review + photos + pricing coherence with box
- ☐ **[C]** Live-mode checkout dress rehearsal: real mada tx, real Tamara tx, webhook through Cloudflare (WAF allow rule for `/api/payments/webhooks/*`), refund round-trip, invoice PDF correct
- ☐ **[C]** Emails end-to-end on prod domain: verify Resend domain, then order-confirm/receipt/renewal-invite/lapse/box-shipped (box-shipped template ☐ doesn't exist yet)
- ☐ **[C]** `COMMERCE_ENABLED=true`, `PAYMENTS_MODE=live`, `NEXT_PUBLIC_COMMERCE_ENABLED=true`, `API_BASE_URL`, production PSP keys — the known env flip list
- ☐ Uptime monitor on `/health` + alert to founder's phone
- ☐ Load test: 50 rps browse, 10 rps checkout, 30 min soak — before first paid campaign
- ☐ Backup drill: one Neon PITR restore rehearsal, RTO written down
- ☐ SEO: sitemap covers store+blog, per-page metadata audit, favicon/apple-icon set complete
- ☐ Wallet: Google Wallet envs set (issuer account exists?) · Apple Wallet certs (post-launch OK)
- ☐ Decommission-or-decide the legacy Salla store (currently "ignored" — either redirect its traffic to moracat.co or shut it; a live second storefront with stale prices is a trust leak)

### 3.4 Operations (full manual in §6)

- ☐ Supply agreement signed (§6.1) · ☐ backup supplier per core category
- ☐ First PO placed (pilot quantities, §11.5) · ☐ receiving checklist used (§6.2)
- ☐ Storage space designated (home/garage OK for pilot): shelving, off-floor, cool/dry, pest-checked
- ☐ Packing station: table, scale, tape gun, box stock, insert stock, QC checklist laminated
- ☐ Courier account via aggregator (Torod/Shipox) · ☐ test shipment to self across town · ☐ label printing workflow
- ☐ Returns address + damaged-goods photo protocol (§11)
- ☐ WhatsApp Business number live, linked from site + order emails
- ☐ Cycle-count habit: weekly full count during pilot (it's one shelf)

---

## 4. Website Deep Checklist — pages, flows, states

The prior audits already forced most of this; listed here as the standing conformance set. Every item must hold in **both** ar and en, mobile-first, RTL-correct.

**Pages (all exist unless noted):** Landing/census · /register · /login (+2FA) · /verify (rate-limited) · cat creation + ceremony · /portal (dashboard, roster, health, health-access ledger, subscriptions manage, orders+invoices, addresses, settings, welcome, checkout, checkout/return) · /community (+/[slug] + OG routes) · /products ("Inside the box") · /benefits · blog · legal set · admin (orders+detail+refund, subs+actions, customers-360, tickets, staff, census-abuse 🔶, waitlist, revenue) · vet portal (71-route surface — ☐ browser-verified never done).

**Flows that must have an unhappy path (verified in god-mode remediation, re-verify at flip):** abandoned Tamara DRAFT → resume · payment failed → retry with different method (☐ requires Moyasar) · cancel → pause-first dialog → term keeps servicing · lapse → EXPIRED gracefully, Cat ID never confiscated · refund request → admin flow → member notified · email change → pending-email verification · account delete → PDPL cascade.

**Notifications matrix (email · in-app):** verify/OTP ✅ · welcome ✅ · Cat-ID issued ✅ · password changed ✅ · order confirm/receipt ✅ · subscription confirmed ✅ · renewal T-7/T-1 ✅ · lapse ✅ · vaccination due ✅ · birthday/anniversary ✅ · ticket opened/replied ✅ · **box shipped + tracking ☐ (doesn't exist — required for commerce)** · **delivery failed ☐** · **refund processed ☐ (verify)**. Push/SMS: none — acceptable for launch; WhatsApp template messages are the KSA-native upgrade path **[S]**.

**Error states:** every authed query has a warm error card (done in remediation) · payment errors human-readable ar/en (~15 English sites were flagged; ☐ sweep again) · 404/500 branded ✅.

---

## 5. Customer Experience — the full journey

Touchpoint map, with current state and required improvement:

| Stage | Touchpoint | State | Gap / improvement |
|---|---|---|---|
| Discover | IG/TikTok ad or friend's ceremony share | 🔶 shares work; no ad engine | Restore analytics; UGC-first creative (§8) |
| First visit | Census landing, live count, founding cohort | ✅ strong | Keep honest (no fake scarcity — R006) |
| Sign up | Register (<2 min, OTP un-gated) | ✅ | Turnstile restore (fail-open) |
| Cat ID | Ceremony: name stamped, member no., oath, share | ✅ 8.6/10 | Protect this — it's the brand's signature moment |
| Consider | Plan page, value ledger | 🔴 ledger doesn't exist; value currently negative | §7 repricing + ledger — the make-or-break screen |
| Buy | Checkout (term selector) | 🔶 Tamara-only | mada/Apple Pay default; Tamara as option |
| Wait | Order confirmed → shipped | 🔴 no shipped email, no tracking surface | Build box-shipped notification + tracking link + "what's inside" teaser |
| Receive | Courier handoff | 🔴 nothing | WhatsApp delivery coordination; §6.3 |
| Unbox | The box itself | 🔴 nothing | §6.5–6.6 — the second signature moment |
| Use | Feeding, litter, play | — | QR card in box → cat's profile + feeding guide (engine exists in packages/core) |
| Care loop | Vaccination reminders → clinic visit → record | ✅ thesis join works | Needs a real clinic (§2.20) |
| Renew | T-7/T-1 invitation → term end | 🔶 honest but manual | Auto-renew default post-Moyasar |
| Support | Tickets + email | ✅ tooling | WhatsApp channel; SOPs §11 |
| Refer | Recognition loop | 🔶 rolled back | Restore; reward tier post-commerce |
| Belong | Community, milestones, founding cohort | ✅ | Offline meetup; member-only drops **[S]** |

**Design rule for the physical journey:** the box must feel like it comes from the same universe as the ceremony — warm paper, flat stickers, Arabic-first. A member who loved the digital ceremony and receives a generic brown box with a packing slip will feel the brand break.

---

## 6. Operations Manual

### 6.1 Supplier onboarding & management

**Now (pilot):** one KSA distributor (the PSV source). Actions: (1) sign a 1–2 page supply agreement — prices held 6 months, stated lead time per category, defective-return right, no-MOQ pilot clause, invoice terms (net-15 or prepaid); (2) obtain their CR + MEWA/SABER compliance confirmation in writing; (3) get a named contact + WhatsApp; (4) agree a pilot order and a standing monthly order rhythm.
**Scale [S]:** second distributor per core category (dry, wet, litter, toys/accessories); quarterly price re-quotes; consider direct brand relationships (Josera etc. have KSA agents) at >1,000 subs for 10–20% COGS improvement; never let one supplier exceed 70% of COGS.
**Scorekeeping:** per-supplier one-pager — fill rate, defect rate, lead-time variance, price changes. A supplier that misses two consecutive orders gets a backup activated.

### 6.2 Receiving & quality control

Checklist per delivery: count vs PO → damage inspection (crushed/torn/leaking) → **expiry check: reject anything <90 days** → lot/expiry recorded in the inventory sheet → shelve FEFO (first-expiry-first-out, oldest at front) → discrepancies photographed and claimed within 48h. QC sampling: open one unit per new SKU per order; smell/seal check on food.

### 6.3 Shipping & logistics

- **Courier:** start via aggregator (**Torod** or Shipox) — instant access to SMSA, Aramex, iMile, J&T rates with no volume contract; pick per-shipment by price/destination. Expect ~20–30 SAR intra-Riyadh, ~28–45 SAR major cities, up to 60+ SAR remote regions for a 5–9 kg box. **Real quotes require real weights — hand-pack first.**
- **Pilot scope: Riyadh only.** Kingdom-wide is a promise the unit economics can't yet verify; the census is Riyadh-framed anyway ("Riyadh Class of 2026"). Expand city-by-city with measured shipping cost per city.
- **Heat protocol (May–Sep):** no wet food / treats that melt in transit unless courier is same-day/refrigerated; ship early-week to avoid weekend depot dwell; warn members via the shipped email that food should be brought in promptly.
- **No COD.** The product is prepaid by nature. (COD is ~60% of KSA e-commerce but does not fit subscriptions; revisit only for the à-la-carte store.)
- **Delivery coordination:** courier WhatsApp/SMS + Moracat shipped-email with tracking. Failed delivery → SOP §11.3.
- **Workflow:** order batch cut Sunday → pick/pack Mon–Tue → courier pickup Tue/Wed → delivered Thu latest → "how was the box?" prompt the following week.

### 6.4 Warehouse (staged)

| Stage | Trigger | Setup |
|---|---|---|
| 0. Home/garage | now → ~150 subs | 2–3 metal shelving units, pallet-free, off-floor, A/C or at least shaded (food!), digital scale, packing table. Cost: <3,000 SAR. |
| 1. Small storage unit / micro-warehouse | ~150–500 subs | ~20–40 m², Balady + Civil Defense paperwork, basic racking, dehumidified. |
| 2. 3PL fulfillment | ~500+ subs **[S]** | Riyadh 3PLs (Salasa, Quickup, Diggipacks) do storage+pick+pack+ship per-order; kits/subscription boxes need a 3PL that accepts kitting projects. Keep the *insert/personal touch* even at 3PL — pre-print cards monthly. |

Organization: ABC layout (A = current-month recipe items at waist height; B = next month + evergreen; C = slow accessories up high). Bin labels = SKU + expiry. Cleaning: weekly sweep; food sealed in lidded bins (pest control — this is Riyadh).

### 6.5 Packaging Program (the full recommendation)

**Structure — one custom mailer, three sizes** (self-locking mailer box, no tape on the opening flap, tear-strip optional):

| Tier | Est. box (cm) | Est. shipped wt | Notes |
|---|---|---|---|
| Starter | ~30×22×12 | 2.5–4 kg | Confirm by hand-pack |
| Standard | ~35×26×14 | 4–6 kg | The volume driver — optimize this one |
| Premium | ~40×30×16 | 6–9 kg | 2 kg dry food bag dominates; consider bag-as-base layout |

**Materials & construction:** E/B-flute corrugated, 3-ply for Starter/Standard, 5-ply (BC-flute) for Premium (weight!). Outside: kraft natural (on-brand "warm paper") with 1–2 color flexo print — cheapest premium look, avoids full-color litho cost. **Inside: 1-color print surprise** (paw pattern / "أهلاً بالمرقط" welcome line) — inside print is the highest-ROI premium cue. Matte finish, no lamination (eco + cost). Water-based inks, FSC/recycled board — state it on the box, quietly.
**Print method by volume:** ≤500 units digital print or plain kraft + large brand sticker (pilot!); 500–3,000 flexo 2-color; >3,000 offset/litho-lam if design demands.
**Internal kit per box:** kraft crinkle paper or tissue (brand green tissue + sticker seal) · **thank-you/welcome card** (A6, member's cat name handwritten during pilot — do this, it's free magic) · **QR card** → the cat's profile + this month's feeding notes · monthly theme card listing contents with retail values (the printed value ledger) · brand sticker sheet (members put them on laptops = free ads) · welcome booklet in box #1 only (membership guide, benefits, how vaccination reminders work).
**Custom tape:** skip — self-locking mailer needs none; brand sticker as seal instead (cheaper, cleaner).
**Seasonal:** Ramadan + National Day (Sep 23) sleeve or card swap, not a new box — sleeves are cheap, boxes aren't.
**Damage prevention:** heavy items (food bags, litter) at base; crinkle fill so nothing rattles (shake test every box); fragile items center-boxed; max 9 kg per box (courier surcharge cliff + carrier abuse rises with weight).
**Suppliers:** local first — Riyadh/Jeddah corrugated converters (e.g., Napco-affiliated converters, Saudi Paper, local box factories via Maroof-listed packaging suppliers) for boxes; Alibaba/Noissue-type for tissue/stickers/cards if local MOQs are hostile. Lead time: **custom boxes 4–6 weeks — order the pilot's plain-kraft stock NOW and the custom run in parallel.**
**Cost model (Standard tier, planning figures — validate with quotes):**

| Volume | Box | Tissue+crinkle | Cards+sticker | Total/box |
|---|---|---|---|---|
| 100 (pilot, kraft+sticker) | ~6–9 | ~2 | ~2.5 | **~11–13 SAR** |
| 1,000 (custom flexo) | ~7–10 | ~1.5 | ~1.5 | **~10–13 SAR** |
| 5,000 | ~5–7 | ~1 | ~1 | **~7–9 SAR** |

Budget **12 SAR/box** in the pricing model (§7); it's honest at launch volumes.

### 6.6 The unboxing experience (sequence design)

Open flap → inside-print reveal → tissue with sticker seal → **theme card on top** (never products first — context first) → cat's-name welcome card → products layered by size → sticker sheet at bottom as the "one more thing". Rule: the member should be able to film a 20-second unboxing where every frame looks intentional. Test: film it yourself for all three tiers before locking the layout; iterate until the video needs no editing.

### 6.7 Subscription Box Strategy

- **Contents:** 5–7 items. Anchor (dry food, ~40–50% of COGS) + 1–2 consumables (treats/wet pouches) + 1 rotating toy/accessory + 1 care item (dental, grooming, litter deodorizer) + 1 surprise/delight small item. Premium adds count and grade, not just size.
- **Value math (the law):** printed retail value of contents ≥ **1.15×** box price, using *your own store's à-la-carte prices* — self-consistent and audit-proof (R006). Never print a "value" using invented MSRPs.
- **Themes:** monthly, Arabic-first names, 3 locked ahead. Launch runway: **"صندوق التأسيس" (The Founding Box)** → Ramadan prep → Summer indoor-play. Themes drive the rotating items only; the anchor stays consistent (cats hate food churn — and switching dry food monthly is *bad for cats*; the theme rotates around the food, never the food itself without owner opt-in).
- **Repetition avoidance:** 6-month no-repeat rule on toys/accessories; track per-member shipped-SKU history (the Prisma order lines already give you this); consumables repeat by design.
- **Personalization ladder:** v1 = tier recipes + food-type preference (the feeding engine already computes needs); v2 = swap windows before each box; v3 = per-cat picks. Do NOT build v2/v3 pre-launch.
- **Exclusives [S]:** at ~1,000 subs, one Moracat-branded item per quarter (bandana, sticker toy, bowl) — costs ~5–15 SAR, photographs beautifully, can't be price-compared, lifts perceived value disproportionately. This is the BarkBox margin trick and it's legitimate.
- **Excitement mechanics:** shipped-email teaser ("one item this month has your cat's name on it"), community unboxing thread each cycle, founding-member early theme votes (belonging = the product).

---

## 7. Financial Framework & Pricing Calculator

> **2026-07-23 amendment:** the market-price research this section called for is done — see `design/MRC-FIN-001-PRICING-RECALCULATION.md`. Verified result: the 2.8× store is 60–100% above real KSA market; all three boxes price 34–45% above the identical DIY basket at Petzone/Zarafa; recommended prices ≈ 199/259/399 with per-category store markups (~1.7× blended), recipe re-engineering toward high-spread items, and a −10–15% distributor negotiation backed by a direct-import quote. MRC-FIN-001 supersedes the illustrative numbers below where they conflict.

All figures SAR. Current real inputs: plans 249/349/529 per month, COGS 104.75/150.75/245.25, 3-month min term prepaid, Tamara ~6.5%+1.5/tx (verify your contract; BNPL merchant rates in KSA run 6–8%), mada via Moyasar ~1% + fixed (verify), packaging 12/box, shipping 30/box Riyadh planning figure.

### 7.1 Core formulas (the ones that run the business)

```
Gross Profit /box      = Price − COGS − Packaging − Shipping − PaymentFee − VAT_remitted
Contribution Margin    = Gross Profit /box ÷ Price
CAC                    = Total marketing spend ÷ new paying subscribers   (blended; also track paid-only)
LTV (contribution)     = GP/box × boxes/month × avg lifetime months
  where avg lifetime   = 1 ÷ monthly churn        (or term-based: termGP × 1/(1−renewal rate))
LTV:CAC target         ≥ 3   ·  CAC payback ≤ 6 months
Burn                   = monthly cash out − cash in ·  Runway = cash ÷ burn
Break-even subs        = Fixed monthly costs ÷ GP per sub-month
Inventory turnover     = COGS (period) ÷ avg inventory value  (target 8–12×/yr for consumables)
AOV (store)            = revenue ÷ orders ·  Repeat rate = customers with ≥2 orders ÷ all customers
```

### 7.2 The Standard plan today vs. fixed (per 3-month term)

| Line | Today (Tamara-only, 0% VAT) | Fixed (mada default, VAT-registered) |
|---|---|---|
| Revenue (3 × 349) | 1,047.00 | 1,047.00 (VAT-inclusive) |
| − VAT remitted (15/115) | 0 | −136.57 |
| − COGS (3 × 150.75) | −452.25 | −429.64 *(−5% via repricing/negotiation)* |
| − Packaging (3 × 12) | −36.00 | −36.00 |
| − Shipping (3 × 30) | −90.00 | −90.00 |
| − Payment fee | −69.56 (6.5%+1.5) | −13.61 (mada ~1.2% + fixed) |
| **Gross profit / term** | **399.19 (38.1%)** | **341.18 (32.6%)** |
| Effective monthly GP | 133.06 | 113.73 |

Read this table honestly: **even after VAT registration, switching the default rail off Tamara claws back most of the VAT hit.** The "today" column also silently assumes VAT never arrives — it will at ~150 subs, at which point today's structure drops to ~26% contribution. The fixed column is the only durable one.

**And the value ledger must still work:** contents at à-la-carte retail must print ≥ 1,204 SAR/term (1.15×). With store retail at cost × 1.8, contents retail = 452.25 × 1.8 ≈ 814 — **it doesn't clear.** This is the pricing knot in one line: either box price comes down, store retail markup goes up (defensible at ×2.0–2.2 for convenience retail; market-check against Saudi pet e-tail), COGS comes down, or contents are re-specified. Solve simultaneously: set store retail ≈ market price of each SKU (not a blanket ×1.8), then price the box at Σ(retail) × 0.87–0.92. If that lands below ~40% contribution, change the recipe, not the honesty.

### 7.3 LTV under the two retention regimes (Standard, fixed-column GP)

| | Manual re-buy (today) | Auto-renew (Moyasar) |
|---|---|---|
| Term-to-term retention | ~35% (assumed; BNPL re-decision) | ~75% (industry prepaid-auto norm) |
| Expected terms | 1/(1−.35) ≈ 1.54 | 1/(1−.75) = 4.0 |
| LTV (contribution) | ~525 | ~1,365 |
| Max CAC at 3:1 | **175** | **455** |

A 175-SAR CAC ceiling in a niche category with unproven creative is a coin flip. 455 is a business. **This table is the whole argument for Moyasar.**

### 7.4 Pricing calculator (framework for any SKU/box)

```
Floor price  = (COGS + Packaging + Shipping + Support&Returns reserve [3% rev]
               + Refund/damage buffer [2% rev]) ÷ (1 − PaymentFee% − VAT% [15/115] − TargetContribution%)
List price   = min( ceiling from value rule: Σ retail × 0.87–0.92 ,
                    max( floor price , psychological anchor ) )
Term discounts: 6-mo −5%, 12-mo −10% (prepaid cash is worth it); never discount below floor.
Wholesale/partner: retail × 0.75 min — only for named partners, post-launch.
```

Worked example, Standard: floor = (150.75+12+30+10.47+6.98)/(1−0.012−0.1304−0.30) = 210.2/0.5576 ≈ **377**… which exceeds 349. Meaning: at 30% target contribution with VAT and current COGS, **349 is below floor**. Options: accept ~27% contribution at 349 (viable if CAC stays <300 with auto-renew), cut COGS ~10% via supplier negotiation at volume, or move Standard to 379. Decide explicitly — do not discover this at sub #151.

### 7.5 KPI set & dashboards

**Weekly founder dashboard (one page):** new registrations · census count · activation rate (register→Cat ID) · new subs · churn/renewal rate · MRR-equivalent (active terms ÷ 3) · CAC blended · GP/box · cash balance · runway · NPS/box rating · support tickets open · on-time-ship %.
**Monthly:** LTV:CAC · cohort retention curves (by signup month) · inventory turns · dead stock >60 days · per-channel CAC · referral-attributed % · community WAU · vet-portal weekly active clinics.
**Tooling:** GA4 + Meta pixel (restore!), a Metabase/Grafana on the Neon replica for product metrics **[S]** — but until 500 subs, a hand-updated Google Sheet weekly is *better* (forces the founder to touch the numbers). Investor expectations at seed: 3–6 months of cohort data, LTV:CAC path >3, GM% >40, churn <7%/mo equivalent, and evidence the founder knows these numbers cold.

### 7.6 Chart of accounts (starter, for Qoyod/Wafeq)

Revenue: 4001 subscription boxes · 4002 store à-la-carte · 4003 shipping income · 4090 discounts (contra). COGS: 5001 product · 5002 packaging · 5003 inbound freight · 5004 shrinkage/damage. Opex: 6001 payment fees · 6002 courier out · 6003 marketing/ads · 6004 software/infra (Render, Vercel, Neon, Resend, R2…) · 6005 salaries · 6006 rent/storage · 6007 professional (accounting, legal, SAIP) · 6008 refunds reserve. Liabilities: 2001 **deferred revenue — unshipped prepaid boxes** (critical: a 12-month prepay is NOT income on day one; recognize per box shipped) · 2002 VAT payable.

---

## 8. Marketing Playbook

### 8.1 Sequencing (do not run these out of order)

1. **Measure** (this week): restore analytics wave; verify GA4/Meta/TikTok/Snap events fire on register + cat-create + (later) purchase; UTM discipline on every link.
2. **Organic census push** (weeks 1–4): the founding-cohort story. Assets already exist in-product (ceremony share cards, per-cat OG, member numbers).
3. **Micro-influencers** (weeks 2–6): 5–10 KSA cat accounts, 10k–100k followers, IG+TikTok+X. Offer: free founding Cat ID ceremony content + (once physical) a free box. Pay small flat fees (500–2,000 SAR) over rev-share complexity. KSA cat Twitter/X is unusually active — do not skip X.
4. **Paid tests** (only after 1–3): 3,000–5,000 SAR/month across Meta+TikTok+Snap, 3 creatives each, kill anything with CPL > 2× best. Snapchat over-indexes in KSA — test it seriously.
5. **Commerce launch burst** (flip week): concentrated spend + influencer posts in the same 72h window + PR pitch to Saudi tech/lifestyle media (the "national cat census/registry" angle is genuinely newsworthy — pitch that, not the box).

### 8.2 Channel plan

| Channel | Role | Cadence | Notes |
|---|---|---|---|
| Instagram (@moracat.sa) | Brand home, member features | 4–5/wk, reels-first | Ceremony clips, member cats (consent machinery exists), unboxings |
| TikTok | Reach engine | 3–4/wk | Raw > polished; founder-voice census updates work |
| Snapchat | KSA-native reach + ads | ads + occasional | Highest KSA penetration per riyal in many niches |
| X | Cat community + PR | daily lightweight | KSA cat community lives here; census milestones, member spotlights |
| YouTube Shorts | Repurpose | weekly | Repost reels |
| WhatsApp | Support + delivery + (later) broadcast | — | Business number is a launch requirement |
| Email | Nurture + lifecycle | drip ☐ unbuilt | Post-registration 5-email drip (census story → cat profile completion → community → benefits → box waitlist) — the machinery (Resend + templates) exists, the drip doesn't |
| SEO/blog | Long-term | 2/mo native-Arabic | Only with a real writer; thin content harms trust |
| Offline | Vet clinics, cat cafés, adoption events | monthly | QR standees at founding clinics; Riyadh cat café partnership for the meetup |
| Universities | Ambassadors **[S]** | — | Post-500 subs |

### 8.3 Budget & KPIs (first 90 days)

Total ~25–40k SAR: influencers 8–12k · paid tests 9–15k · packaging/photo/content props 3–5k · PR/events 3–5k · tools 2–3k. KPIs: CPL (registration) < 8 SAR · register→Cat ID > 60% · Cat ID→sub (post-flip) > 8% · blended CAC < 250 initially, path to < 175 · referral share of signups > 15% (the loop is built — restore it).

### 8.4 Growth loops (rank-ordered)

1. **Ceremony share loop** (built): every new member's share card is an ad with a soul. Instrument its K-factor.
2. **Referral recognition → reward** (built/rolled back): restore; add one-free-month at 3 activated referrals post-commerce.
3. **Community profile SEO**: public cat profiles with OG cards are indexable surface — ensure crawlability.
4. **Clinic loop** (later): clinic-created patient → owner claims profile → member. This is the vet platform as an acquisition channel, and it's the durable one.

---

## 9. Technology & Analytics Audit (delta view)

Full state in §2.7. The standing conformance list:

| Area | State | Action |
|---|---|---|
| Security | 🔶 2 criticals open; CSP/HSTS ☐; localStorage tokens | Fix criticals now; headers next; cookie migration when practical |
| Scalability | Single Render instance; fine to ~1k subs | Load test before paid traffic; Render autoscale **[S]** |
| Backups | Neon PITR exists, never drilled | One restore rehearsal + written RTO |
| Monitoring | Sentry ✅ (DSN set?), /health schema-aware ✅ | Uptime monitor + phone alert ☐ |
| Logging | pino + request-id ✅ | Retention policy note (PDPL) ☐ |
| Analytics | 🔴 rolled back | Restore — blocking all marketing |
| Payments | Integrity world-class; rail mix wrong | Moyasar **[C]** |
| Auth | Default-deny, 2FA, throttles ✅ | Google OAuth cred still missing (decoy removed — fine) |
| Testing | 169–171 e2e two-pass, unit suites ✅ | Add: renewal-time-advance e2e, live-PSP smoke pre-flip |
| Deployment | push-to-main auto-deploy; migrations via DIRECT URL (known trap) | Document the flip-day runbook (§15) |
| Disaster recovery | ☐ | 1-page: DNS, env dump locations, restore steps, PSP support contacts |

## 10. Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Box value discovered negative publicly | High (certain if unfixed) | Fatal to brand | §7 repricing before flip — hard gate |
| R2 | Term-end churn cliff (first cohort ~Oct 2026) | High | Halves LTV | Moyasar auto-renew before first cliff |
| R3 | VAT cliff at ~150 subs unprepared | High if growth works | −35% contribution overnight + penalties | Voluntary registration + Fatoora now |
| R4 | Security critical exploited (stored XSS) | Medium | Account takeover, trust loss, PDPL breach | Fix this week |
| R5 | Census brigaded/botted (protection rolled back) | Medium | Data pollution, founding-cohort devaluation | Restore wave |
| R6 | Supplier stockout mid-cycle | Medium | Missed ship week | Substitution policy, 2-week safety stock, backup supplier |
| R7 | Summer heat damages food in transit | Medium (seasonal) | Refunds, reviews | §6.3 heat protocol |
| R8 | Shipping cost reality > 30 SAR model | Medium | Margin erosion | Hand-pack + real quotes before pricing lock |
| R9 | Founder is a single point of failure (ops+eng+support) | Certain | Everything stalls on illness/travel | Continuity note; first hire = ops/packing at ~150 subs |
| R10 | Tamara production creds/webhook (Cloudflare WAF) fail on flip day | Medium | Dead checkout at launch | Dress rehearsal **[C]**, WAF allow rule pre-verified |
| R11 | CAC exceeds ceiling | Medium | Burn without growth | Kill-criteria on ad sets; referral/organic-first mix |
| R12 | Refund abuse / high damage rate | Low-Med | Margin | 2% buffer priced in; photo protocol; per-member anomaly flag |
| R13 | Legacy Salla store diverges (stale prices live) | Medium | Trust/price-integrity leak | Decommission or redirect ☐ |
| R14 | Competitor clones the census motif | Medium | Differentiation erosion | Speed + trademark + community depth; the registry data moat compounds |
| R15 | Vet portal contract mismatch demoed to a real clinic | Medium | Burns scarce clinic goodwill | Fix contract before first demo |
| R16 | Prepaid revenue spent before service delivered | Medium | Cash crisis at scale | Deferred-revenue accounting (7.6) + 13-week cash forecast |
| R17 | Bad first-box reviews (QC misses) | Medium | Retention + social proof | 100% QC during pilot; founder packs first 100 personally |

## 11. Customer Support SOP Library

Every SOP: acknowledge < 4 business hours (WhatsApp/ticket), resolve target < 48h, always bilingual, always end with the member's cat's name (the CRM knows it — use it).

- **11.1 Refunds:** Member requests via portal (flow exists) → admin reviews within 24h → policy: unshipped boxes of a prepaid term refund at 100% of remaining pro-rata minus payment fee; shipped boxes non-refundable except defect → process via PSP refund API (admin modal exists) → confirmation email ☐ verify exists. *The pro-rata numbers must be published in Terms (§3.1 gap).*
- **11.2 Returns/damaged/wrong item:** Photo via WhatsApp/ticket within 7 days → no physical return required under ~100 SAR item value (return shipping costs more — Chewy rule: refund/replace and let them keep it; it builds legend) → replacement in next box or immediate reship if food → log SKU + lot for supplier claim.
- **11.3 Late/failed delivery:** Tracking checked daily during ship week → courier no-scan 48h → founder calls courier → member proactively messaged (never let them ask first) → failed twice → reroute or refund shipping.
- **11.4 Cancellations:** In-product (pause-first dialog exists) → exit survey (1 question: why) → pause offered with Cat ID intact (already the design) → winback email at 30 days ☐ unbuilt, add to lifecycle engine.
- **Password/Cat ID/account:** self-serve flows exist (reset, 2FA, change-email); SOP = never manually edit identity fields in DB; use admin tools only; Cat ID numbers are never reissued (the ordinal is the soul — R-series).
- **Community moderation:** report → hide within 12h → three strikes → suspend (admin machinery exists); photos of identifiable people without consent → immediate hide (PDPL).
- **Partner/vet support:** dedicated email; clinical-data questions NEVER answered over WhatsApp (consent-tier machinery is the only channel); break-glass events reviewed within 24h.

### 11.5 Inventory Management System

- **Pilot method:** one Google Sheet: SKU · on-hand · lot/expiry · committed (next cycle recipes × active subs) · available · reorder point. Weekly full count (it's one shelf). Move to the Prisma inventory model + admin UI when the sheet exceeds ~50 active SKUs **[S]**.
- **How much to buy (pilot):** next cycle's committed + 20% safety. With supplier lead time L ≈ 1–2 weeks and a monthly cycle: `Reorder point = (daily usage × L days) + safety stock (20% of cycle demand)`. Order 2 weeks before pack week.
- **Forecasting:** subscribers are the forecast — you know exactly what next month's demand is (active subs × recipe). This is subscription's superpower: near-zero demand uncertainty. The only forecast risk is growth-rate on new subs; buy that portion no more than 3 weeks out.
- **ABC:** A = anchors (food) — never stock out, 3-week safety; B = consumables — 2-week; C = toys/accessories — buy-to-plan, no safety (substitution policy covers).
- **Dead stock:** >60 days unassigned → next box's surprise item or community giveaway (marketing, not loss).
- **Shrinkage/expiry:** FEFO enforced at shelving; monthly expiry sweep; damage logged to 5004 so the P&L sees it.
- **Barcodes:** skip at pilot (recipes are fixed kits — pick errors are structurally unlikely); adopt SKU barcode scanning at 3PL handoff **[S]**.

---

## 12. 90-Day Launch Plan (2026-07-22 → 2026-10-20)

Critical path: **security fix → wave restore → pricing decision → Moyasar → pilot boxes → dress rehearsal → commerce flip.** Everything else parallelizes around it. Owner is the founder unless marked; first hire (part-time packer/ops, ~week 8) takes 📦 items.

**Weeks 1–2 (Jul 22 – Aug 4) — Truth & Foundations**
- Day 1–2: fix 2 security criticals; restore rolled-back wave (Turnstile hostnames + fail-open); verify analytics events fire. *Milestone: prod protected & measured.*
- Day 3–5: hand-pack all 3 tiers; weigh; courier quotes via Torod; photograph.
- Week 2: pricing decision (§7.2/7.4 — the founder's single most important decision this quarter); Moyasar merchant application (KYC takes days–weeks — start NOW); voluntary VAT registration filed; Qoyod/Wafeq live; Maroof + SAIP filings; supply agreement to supplier.
- Marketing: organic census content starts (3 posts/wk); influencer outreach list of 20.

**Weeks 3–6 (Aug 5 – Sep 1) — Founder-Fulfilled Pilot**
- Recruit 20–30 pilot members from the founding cohort (real money, founder-priced −20% "founding pilot" honestly labeled).
- Order pilot inventory + plain-kraft packaging stock; order custom box print run (4–6 wk lead → arrives ~week 8–10).
- Pack + ship pilot cycle 1 (Riyadh only). 100% QC. Founder delivers 5 personally (learn everything).
- Build: Moyasar integration (tokenized mada/Apple Pay + auto-renew default + pre-charge T-7 notice); box-shipped email + tracking; Fatoora-conformant invoice; winback email.
- Vet track (parallel, non-blocking): fix portal/API contract; demo to 3 Riyadh clinics; sign 1 named founding clinic.
- *Milestone: first real box in a real member's hands; NPS collected.*

**Weeks 7–9 (Sep 2 – Sep 22) — Hardening & Rehearsal**
- Pilot cycle 2 with fixes from cycle-1 feedback; custom boxes arrive → unboxing film test (§6.6).
- Dress rehearsal **[C]**: live mada tx, live Tamara tx, webhook through Cloudflare, refund round-trip, invoice QR validates, renewal time-advance test fires the invitation email.
- Load test; Neon restore drill; uptime monitor; flip-day runbook written (§15).
- Arabic catalog review done; store unhide decision; Salla decommission.
- Marketing: influencer content contracted for launch week; paid test budget armed; PR pitch drafted (census/registry angle) — National Day (Sep 23) content ready.
- *Milestone: every [C] item in §3 checked.*

**Weeks 10–13 (Sep 23 – Oct 20) — Commerce Launch**
- Week 10: **flip** (env changes per runbook) in a low-traffic window; 48h soak with founder watching Sentry + orders; then launch burst (influencers + paid + PR in 72h).
- Weeks 11–13: weekly ship cycles; daily dashboard; kill/scale ad sets; first-cohort renewal machinery verified against the ~Oct term-end cliff (this is R2's deadline — auto-renew must be live before it).
- *Milestone: 100+ paying subscribers, first renewal cohort retained >60%, contribution margin within 3 pts of model.*

## 13. Profit Simulator

Assumptions: avg plan ≈ Standard (349), fixed-column economics (§7.2: GP ≈ 113.7/sub-month after VAT, mada-default, incl. packaging+shipping+fees), marketing at steady-state CAC 200 blended, monthly churn equivalent post-auto-renew ~8% (→ replacement spend included). Fixed opex tiers: founder-only ≈ 14k/mo (infra ~2k, tools ~1k, storage ~1.5k, misc ~2k, founder draw ~7.5k) · +packer ≈ 22k · small team ≈ 65k · company ≈ 240k.

| Subs | Rev/mo | GP after variable | Marketing (replace+grow) | Opex | **Net/mo** | Note |
|---|---|---|---|---|---|---|
| 100 | 34,900 | 11,370 | ~4,000 | 14,000 | **−6,600** | Expected loss; pilot scale |
| 500 | 174,500 | 56,850 | ~16,000 | 22,000 | **+18,900** | First real profit; VAT registered by here (already priced in) |
| 1,000 | 349,000 | 113,700 | ~28,000 | 65,000 | **+20,700** | Team absorbs margin; 3PL transition |
| 5,000 | 1,745,000 | 568,500 | ~110,000 | 240,000 | **+218,500** | COGS −10% at this volume not yet counted (upside) |
| 10,000 | 3,490,000 | 1,137,000 | ~200,000 | 400,000 | **+537,000** | ~15% net margin — healthy DTC subscription |

Cash-flow note: prepaid terms mean cash arrives ahead of cost — at growth, operating cash flow looks *better* than P&L (the reverse of most DTC). This is a financing advantage **only if** deferred revenue discipline (§7.6) prevents spending unshipped-box cash. Under today's Tamara-only/no-auto-renew structure, the 1,000-sub row is roughly **break-even instead of +20k** and the 500-sub row is negative — a second way of seeing §1.3's verdict. (The previously computed "break-even ~945 subs" belongs to that old structure.)

## 14. Investor Readiness

**What would impress today:** the design system + census GTM craft · payment-integrity engineering · the vet platform architecture (append-only records, consent tiers — this is *infrastructure*, and infra is the fundable story) · Arabic-first depth in a market where competitors localize as an afterthought · founder's demonstrated audit-fix-verify loop (four audits, visible score trajectory).
**What would concern them:** zero revenue ever processed · unit economics that failed their own audit · bus factor 1 · no cohort data · no signed clinic · no physical op ever executed · books that don't exist.
**What's missing for a seed conversation:** 3 months of paying-cohort data with one observed renewal cycle · LTV:CAC trajectory · the clinic wedge proven with 1–3 named clinics actually using the portal weekly · clean ledgers · a data-room folder (CR, VAT cert, trademark filing, supply agreement, cap/ownership clarity for a sole establishment → likely needs conversion to a SPC/LLC before investment — start that conversation with a lawyer early, it takes time in KSA).
**Metrics to have cold:** the §7.5 weekly dashboard, verbatim.

## 15. Launch-Day / Week-One / Month-One Checklists

**Flip day (runbook):** morning, low traffic · Render: `COMMERCE_ENABLED=true`, `PAYMENTS_MODE=live`, prod Tamara + Moyasar keys, `API_BASE_URL` · Vercel: `NEXT_PUBLIC_COMMERCE_ENABLED=true` · Cloudflare webhook allow rules verified again · buy one real Starter sub yourself end-to-end (both rails) · refund one of them · watch Sentry + `/admin` orders for 4h · rollback = flip the two env vars back (the kill switch is two-pass-proven — trust it) · only then: announcement posts go out.
**Week one:** daily: orders reconcile vs PSP dashboard vs bank · ship every order < 72h · reply every ticket/WhatsApp < 4h · daily standup-with-yourself against §7.5 dashboard · no new features, only fixes.
**Month one:** first renewal-invitations observed and measured · first full P&L from Qoyod against §13's 100-sub row · NPS/box-rating collected from ≥80% of shipped boxes · post-mortem doc: model vs actual (COGS, shipping, CAC, churn) → reprice/re-plan explicitly.

## 16. What would make Moracat a billion-riyal company?

Not the box. The box is the revenue engine that funds the moat; the moat is **being the identity and health-record layer for every cat in the Kingdom, then the Gulf.**

1. **The registry becomes default.** Census → national registry credibility → the Cat ID is what vets ask for at the front desk. Government/municipal partnership (pet registration, rabies/vaccination compliance, Vision-2030 animal-welfare programs) converts a startup product into civic infrastructure. That's winner-take-most.
2. **The clinic network is the hard side — win it.** 434 clinics nationally. At 30% weekly-active adoption, Moracat owns the pet-health workflow layer: SaaS fees, appointment demand routing, and (the real prize) the only structured longitudinal pet-health dataset in the region.
3. **Insurance is the monetization endgame.** Pet insurance in KSA is embryonic. The party holding verified health records + vaccination compliance + breed/age data is the natural underwriting partner (takaful-structured, with a licensed insurer). This is where LTV goes from hundreds to thousands of riyals.
4. **Commerce expands from box → marketplace.** Once logistics muscle exists: à-la-carte store, pharmacy fulfillment against vet prescriptions (the clinical-record join makes this defensible), partner-brand exclusives, Moracat-brand consumables at 60%+ margin.
5. **Lost & Found + QR/microchip layer** makes the Cat ID physically indispensable — the emotional lock-in feature that markets itself every time a cat is found.
6. **Geographic sequence:** Riyadh → KSA cities → UAE/Kuwait/Qatar (same language, payment rails, courier networks). The census motif re-runs per city ("Class of…"), a repeatable launch playbook.

The compounding loop: every box funds the community, every community member feeds the registry, every registry entry makes clinics need the portal, every clinic record makes insurance possible, and insurance makes the membership priceless. **Guard the sequence: never let step n's marketing promise step n+2's product** — that rule (R006, honesty as strategy) is, genuinely, the reason this company can be trusted with a national registry at all.

---

*End of MRC-LAUNCH-001 v1.0. Review cadence: re-score §2 monthly; re-run the §3 checklist before any launch gate; amend rather than fork (this document is the operating truth, like the Design Authority).*

