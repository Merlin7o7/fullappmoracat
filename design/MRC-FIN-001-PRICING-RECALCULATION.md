# MRC-FIN-001 — Market Pricing Recalculation & Sourcing Analysis

**Date:** 2026-07-23 · **Status:** Decision document — supersedes the internal-only value math in `seed-catalog.ts` and amends MRC-LAUNCH-001 §7
**Method:** live prices read from amazon.sa, zarafaksa.com (Zarafa/الزرافة), petzone.com/ksa, pethouseksa.com (Pet House / بيت الأليفة), mycat.com.sa (My Cat/قطتي) on 2026-07-22/23; wholesale costs from `packages/db/data/supplier-catalog-2026-07.psv` (verified against the three box recipes in `seed-catalog.ts`); import economics from sourced industry research.
**Every figure is tagged:** ✅ VERIFIED (read from a store page / repo file / cited source) or ⚠️ ESTIMATE (reasoned; treat as planning input).

---

## 1. The verdict in one paragraph

Our current store markup (2.8× over wholesale) prices us **60–100% above the real Saudi market**, and all three subscription boxes — 249/349/529 SAR — cost the member **34–45% MORE than buying the identical items from Petzone or Zarafa**, several of which ship free above 200 SAR. The internal value ledger ("box saves 15–23% vs our store") is arithmetically true and commercially fictional, because members price-check against the market, not against us. The market's average multiple over *our own wholesale cost* is ≈ **1.6×** (range 1.3× wet food → 3.0× creamy treats), not 2.8×. Competitive box prices are roughly **199 / 259 / 399**, which our current cost structure supports only with a ~10% COGS negotiation, a mada-default payment rail, and (to restore full margin) recipe re-engineering toward high-spread categories. Direct import is **not** worthwhile now (5–15% net at our scale, and our two biggest food brands are locked by exclusive distribution) but becomes a 20–30% lever at monthly-container volume — its immediate value is as **negotiating leverage** with the current distributor.

---

## 2. Verified market prices vs our costs and prices

### 2.1 The nine box-recipe SKUs ✅ VERIFIED

| SKU (box item) | Our wholesale | Our store @2.8× | Amazon.sa | Specialty stores (in-stock lead) | Market multiple over our cost |
|---|---|---|---|---|---|
| Kit Cat Petite Pouch 70g | 3.50 | ~9.80 | 5.16 (4.48/pc in 24-pk) | **5.50** Petzone · 5.75 Pet House · 6.00 My Cat | **1.5–1.6×** |
| Josera SensiCat 2kg | 46.00 | ~129 | 84.86 | **75.00** My Cat (OOS) · 82.50 Petzone (DailyCat) · 69 Zarafa (Kitten GF) | **1.6–1.8×** |
| Acana wet can 85g | 4.95 | ~13.90 | 9.95 promo / 8.09 in 24-pk | **6.50** Petzone & My Cat · 6.95 Pet House | **1.3–1.4×** |
| Wellness CORE Purely pouch 85g | 5.50 | ~15.40 | 7.04/pc (24-pk) | **7.38**/pc Zarafa (8-pk) · 8.25 Petzone | **1.3–1.5×** |
| LindoCat The Original 10L | 24.00 | ~67 | Prestige 56.28 (equiv) | **55.00** Zarafa (OOS) · category 40–55 | **1.7–2.3×** |
| LindoCat Advanced Clumping 10L | 49.00 | ~137 | 101.89 (OOS) | 79.50–90 Zarafa/My Cat (OOS) | **1.6–1.8×** |
| Kit Cat Wet Wipes 80ct | 12.00 | ~34 | 20.85 | **18.95** Petzone · 19.99–25 Zarafa · 30 My Cat | **1.6–1.7×** |
| Beaphar Calming Bits 35g | 6.50 | ~18 | 100.27 (intl outlier — discard) | **13.00** Zarafa (OOS; only KSA stockist) | **~2.0×** |
| Zolux Sweeties 7-stick pack | 6.25 | ~17.50 | 2.50/stick (intl) | **18.95** Petzone 7-pk · 2.25/stick singles | **2.9–3.0×** |

Category benchmarks ✅: premium wet pouch/can 70–85g = **5.50–8.95** (sensible single benchmark ~6.50) · mid-range 10L clumping litter = **40–55** · 2kg premium European dry = **75–95**.

### 2.2 What this says about markups

- **Average market multiple over OUR wholesale: ≈ 1.6×** (weighted by our COGS mix). By category ✅: wet food ~1.3–1.6× · dry food ~1.7–1.85× · litter ~1.6–2.3× · grooming ~1.6–1.7× · treats/supplements ~2.0–3.0×.
- Competitor **retail margins over their own buy price** are consistent with the industry-verified norms (pet food 25–35%, accessories 40–60%): Petzone selling Acana at 6.50 vs our cost 4.95 implies ~24–31% gross margin *if they pay what we pay* — i.e., ⚠️ our distributor prices are roughly ordinary retailer wholesale, **we hold no cost advantage today**.
- **Our current model vs market:** store 2.8× (market 1.6×) — 75% above; boxes at 2.16–2.38× effective (price÷COGS) vs market 1.6× — hence the premium below.

### 2.3 The three boxes vs the real market ✅ (baskets priced item-by-item, in-stock specialty leads)

| Box | Plan price | Market DIY basket | Box premium over DIY | Notes |
|---|---|---|---|---|
| Starter | 249 | **~176–186** (82.50 pouches + 75–85 dry + 18.95 treats) | **+34–41%** | |
| Standard | 349 | **~231–252** (97.50 cans + 75–85 dry + 40–55 litter + 13 calming) | **+38–51%** | Acana at 6.50 locally guts the old Amazon-based estimate |
| Premium | 529 | **~365–405** (177–198 pouches + 75–85 dry + 80 litter + 18.95 wipes + 18.95 treats) | **+31–45%** | |

**Delivery does not rescue the comparison:** Petzone ships free >200 SAR (Standard and Premium DIY baskets qualify) ⚠️ so "we include delivery" is only a real advantage on Starter-sized baskets. The one honest weakness in the DIY alternative: **stock reliability** — Zarafa/My Cat show heavy out-of-stock, Amazon's premium lines flicker in and out ✅. "Never think about it, never out of stock" is a true differentiator; "cheaper" currently is not.

---

## 3. How far can prices come down? (the margin machinery)

Cost model per box (from `packages/core` `DEFAULT_COST_MODEL`, ✅ verified in code): packaging 10 + delivery 28 + fulfilment 8 = **46 SAR fixed** + shrink 2% of goods + PSP (Tamara ~6.5%+1.5 today; mada via Moyasar ~2.5% blended ⚠️). The 46 SAR fixed load is 18–23% of a 200–250 SAR box — this, plus wet food's terrible 1.3–1.4× spread, is why price-matching DIY with current recipes is nearly margin-free.

```
Contribution/box = Price − Goods×1.02 − 46 − Price×PSP% − (if VAT-registered) Price×15/115
```

### 3.1 Three scenarios (current recipes kept for comparability; mada rail assumed except where noted)

| | **A — Conservative** | **B — Competitive** ★recommended base | **C — Aggressive** |
|---|---|---|---|
| Prices (S/St/P) | **249 / 349 / 529** (unchanged) | **199 / 259 / 399** | **176 / 219 / 345** |
| vs DIY market basket | +37/+45/+38% | **+10/+8/+4%** | −3/−9/−10% |
| Requires | Honesty rewrite of all "savings" copy | COGS −10% (negotiated) + mada default | COGS −20%+ (direct import at scale) |
| Contribution/box @0% VAT | 90 / 140 / 220 = **36/40/42%** | 52 / 68 / 118 = **26/26/30%** | 40 / 45 / 90 = **23/20/26%** |
| Contribution @15% VAT (stress) | 57 / 95 / 151 = 26/31/33% of net | 26 / 34 / 66 = **15/15/19%** | 17 / 16 / 45 = 11/8/15% |
| Per-sub-month GP (Standard, VAT) | 95 | 34 | 16 |
| Verdict | Margin-safe, conversion-hostile: a price-checking member finds +45% and the trust brand dies by screenshot | Sellable and honest; margins thin post-VAT → must be repaired by §3.2, not by price | Only viable as a growth loss-leader at container-scale COGS; not now |

★ **Recommendation: Scenario B prices + §3.2 recipe re-engineering + §3.3 store repricing**, which together restore post-VAT contribution to ~20–25% while keeping the member-visible premium vs DIY in single digits (or at genuine parity). Do not launch commerce at Scenario A prices — the elite audit's "no saving to sell" finding, which the 2.8× ledger appeared to fix, is fully alive at the market level.

### 3.2 Recipe re-engineering — the margin lever pricing can't reach

Rank recipe items by **market-multiple over our cost** and shift weight toward the top ✅:

| Spread champion | Multiple | Spread loser | Multiple |
|---|---|---|---|
| Zolux Sweeties treats | 2.9–3.0× | Acana wet cans | 1.3–1.4× |
| LindoCat Original litter | 1.7–2.3× | Wellness CORE pouches | 1.3–1.5× |
| Beaphar calming | ~2.0× | Kit Cat pouches | 1.5–1.6× |
| Josera dry | 1.6–1.8× | | |

⚠️ Worked example — restructured Standard at **239 SAR**: 12× Kit Cat pouches + Josera 2kg + LindoCat Original 10L + Sweeties 7-pk + Beaphar calming → COGS ≈ 116.5 (after −10% negotiation), DIY market value ≈ 228 → **member pays ≈ +5% vs DIY for zero effort**, contribution ≈ 71 (30%) at 0% VAT, ≈ 41 (**20% of net**) VAT-registered. Add one Moracat-exclusive item (branded toy/bandana, cost 5–15, un-price-checkable) and the box wins on both value optics and margin. Same exercise applies to Starter and Premium — lock final recipes only after the founder tastes/handles samples (MRC-LAUNCH-001 §6.7 rules still apply: the dry-food anchor never rotates without owner opt-in).

### 3.3 Store (à-la-carte) repricing — from blanket 2.8× to market-aligned category markups

| Category | Current | Market says | **Set to** | Example (sell/cost/margin) |
|---|---|---|---|---|
| Wet food | 2.8× | 1.3–1.6× | **1.45×** | Acana can 6.75 / 4.95 / 27% |
| Dry food | 2.8× | 1.7–1.85× | **1.7×** | Josera 2kg 79 / 46 / 42% |
| Litter | 2.8× | 1.6–2.3× | **1.9×** | LindoCat Orig 45.9 / 24 / 48% |
| Treats/supplements | 2.8× | 2.0–3.0× | **2.4×** | Sweeties 14.9 / 6.25 / 58% |
| Grooming | 2.8× | 1.6–1.7× | **1.7×** | Wipes 19.9 / 12 / 40% |
| Accessories/toys | 2.8× | (40–60% retail margin norm ✅) | **2.2×** | |

Blended ≈ **1.7×** — implement as per-category markup in `import-catalog.ts` (replace the single `markup` option), keep `CATALOG_MARKUP` env override per category. Consequences: (a) the store becomes genuinely shoppable rather than decorative; (b) the box invariant `minMemberSaving: 0.15` vs our own store can no longer be met by inflating the store — **redefine the invariant against the market benchmark basket** (new input: per-SKU `marketPrice`, refreshed quarterly) or lower it to 0.05 with delivery included; today's code would correctly refuse to seed, which is the invariant doing its job.

---

## 4. Hypothetical sourcing analysis — bypassing the distributor

Full research in the appendix sources; summary applied to Moracat:

### 4.1 Who we can and cannot buy from directly ✅/⚠️

| Brand | Direct-import feasibility | Why |
|---|---|---|
| Josera / JosiCat | **Closed** | Muntajat operates josera.muntajat.sa — de-facto exclusive KSA distribution ✅; manufacturer won't issue SFDA dossiers to a second importer ⚠️ |
| Applaws | **Closed** | Same — applaws.muntajat.sa ✅ |
| Acana | **Closed** | Champion is Mars-owned (2023) ✅; appointed-distributor-only ⚠️ |
| Wellness CORE | Unlikely | US corporate export controls ⚠️; no KSA exclusive found ✅ but small accounts refused |
| **Kit Cat** | **Open** ⚠️ | Singapore mid-size, no verified KSA exclusive; mixed 20ft first orders ~USD 15–30k customary |
| **LindoCat** (Laviosa) | **Open** ⚠️ | Litter makers are commodity-open; full-container economics (24–26t, ~€8–15k product) |
| **Zolux** | **Open** ⚠️ | French accessory house, exports to 60+ countries, mixed-pallet/container accounts |
| **Beaphar** | **Open** ⚠️ | No KSA distributor found ✅ — also an *assortment gap we could own* (only Zarafa stocks the treats, OOS) |

### 4.2 The cost stack per SAR 100 of retail ⚠️ ESTIMATE (verified components cited)

| | Via distributor (today) | Direct, small (1–2 containers/yr) | Direct, monthly containers |
|---|---|---|---|
| Landed cost | wholesale ≈ 60–70 | ≈ 50–63 | ≈ 44–55 |
| **Net saving vs today** | — | **≈ 5–15%** (0–negative on origin-wholesaler brands) | **≈ 20–30%** |

Verified inputs ✅: duty ~5% CIF on packed pet food HS 2309.10 (confirm exact line on ZATCA post-late-2025 amendment); import VAT 15% **recoverable** once VAT-registered (cash-flow float only — another reason to register now); sea freight 20ft Asia→Dammam USD 1,450–2,100, Europe→Jeddah ~USD 1,500–2,500, +~SAR 1,000–1,500 port charges + SAR 750–2,000 broker → freight ≈ **3–6% of product value** (not the decisive cost). The decisive costs: **SFDA/GHAD feed registration** (SAR 1.5–5k/SKU, 6–14 weeks, needs manufacturer cooperation — the real moat ⚠️) vs **SABER self-declaration for litter/accessories** (~SAR 1–3k/shipment ⚠️ — cheap); and **working capital** (a container = 3–6 months of stock ≈ SAR 100–200k tied up + VAT float, costing another 1.5–3 margin points at small scale ⚠️).

### 4.3 Is it worth it? — the decision

| Question | Answer |
|---|---|
| Could COGS decrease? | Small scale: 5–15% best case, only on open brands. Monthly containers: 20–30%. |
| New margins if we imported now? | ⚠️ Standard at 259 with −12% COGS: contribution ~29% (0% VAT) / ~18% (VAT) — ~3 pts better than Scenario B, **before** counting registration amortization and capital cost, which eat most of it at 1–2 containers/yr. |
| Could customer prices drop further? | At monthly-container scale, −20–30% COGS funds Scenario C (DIY-undercutting prices) at ~15–20% post-VAT contribution — that's the end-state, not the start. |
| **Verdict** | **Not now for food.** Do now: (1) use a written direct-import quote as leverage to negotiate **−10–15% + subscription-forecast rebates** from the current distributor — worth several points for one meeting; (2) at ~500 subs, pilot ONE freight-dense, SABER-only import: **a litter container** (LindoCat or Turkish bentonite ⚠️ landed ~30–40% under distributor) and/or a **Kit Cat + Zolux mixed container**; (3) treat **Beaphar** as a distribution-gap opportunity — importing a brand nobody reliably stocks is differentiation, not just margin. |

---

## 5. Actionable sequence (amends MRC-LAUNCH-001 §7 and Week-2 plan)

1. **Adopt Scenario B prices — 199 / 259 / 399** — as the working target; final numbers after the founder locks restructured recipes (§3.2) against hand-packed samples.
2. **Re-implement catalog pricing as per-category markups** (§3.3 table) in `import-catalog.ts`; re-seed; store becomes market-credible.
3. **Redefine the box value invariant against a market-benchmark basket** (new per-SKU `marketPrice` column, quarterly refresh — the 5-store price sweep in this doc is the first dataset) and rewrite every "savings" claim to survive a member holding a Petzone tab open (R006).
4. **Take the direct-import quote to the distributor** and negotiate −10–15% with a 6-month subscription forecast commitment.
5. **Moyasar/mada remains the single biggest payment-margin lever** (−4 pts vs Tamara-only) — unchanged from MRC-LAUNCH-001, now quantified into every scenario above.
6. Revisit direct import (litter container first) at ~500 subscribers; re-run §4 with real quotes then.

**Assumption register (⚠️):** mada blended fee 2.5%; COGS −10% achievable in negotiation; delivery stays 28 SAR kingdom-average (Riyadh pilot likely ~22–25); market prices are a 2026-07-22/23 snapshot — promo-sensitive (Acana 9.95 on Amazon was a deal; Zarafa OOS prices may reprint higher); Beaphar/Zolux Amazon prices are international-marketplace outliers and were excluded from benchmarks.

*Sources: live store pages (URLs in the research annexes), eightx.co & etailpet.io margin guides, trade.gov KSA tariff guide, ZATCA/PwC VAT references, SFDA Feed Law M/60 + GHAD, SABER fee schedules (Fahes, S-GE), Goodhope/Unifeeder/Hapag-Lloyd freight tariffs, GlobalPETS Middle East industry report, muntajat.sa brand sites.*
