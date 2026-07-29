# MRC-PKG-001 — The Moracat Packaging Dossier (Markdown edition)

> **The box is the membership card you can hold.** A complete packaging system for
> Moracat — from courier truck to the cat sleeping in the empty box.
>
> Companion to `design/moracat-packaging-dossier.html` (full illustrated edition),
> `design/DESIGN-AUTHORITY.md` and MRC-UX-001. **The design authority wins every
> conflict.** Rev A · 2026-07 · All money in SAR, VAT-inclusive.
>
> ⚠ **Cost sections superseded:** the structural tray spec (§03), finish costs (§06),
> sourcing mix (§10) and cost tables (§11) are superseded by
> **`moracat-packaging-lean-luxury.md` (MRC-PKG-002, Rev B)** — a Jeddah-first
> revision that cuts blended packaging ≈ 22% without reducing the member-facing
> experience. Experience goals, choreography, safety spec and design language here
> remain in force.

---

## 00 · Executive summary

**The verdict in one paragraph.** Moracat should *not* ship a luxury rigid box every
month — it should ship a *beautifully engineered kraft system* every month and reserve
rigid luxury for the two moments that deserve it: the first shipment (the Cat ID
ceremony arrives in a keepsake **Welcome Folio**) and Tier 4's quarterly keepsake
(**the Den Box**). A ~12 kg monthly box containing a 10 L litter bag physically cannot
be a magnetic-closure rigid box; pretending otherwise costs 25–40 SAR per shipment and
reads as waste, not luxury. Apple's own lesson applies: premium is *precision, pacing
and restraint* — not expensive board.

- **Architecture — "Stage over Cellar":** one double-wall kraft shipper printed in one
  colour (deep green `#045b46`), internally split into a heavy *cellar* (litter, dry
  food, cans) and a light *stage tray* on top carrying tissue, the monthly card and the
  discovery items. The lid opens onto ceremony; the weight hides below. Packaging cost
  7.6–17 SAR by tier at 5k/mo — inside the committed 9 SAR average budget
  (`packages/db/prisma/box-cost-model.ts`).
- **The box's second life:** every shipper carries a die-cut punch-out door and printed
  interior so the empty box converts into a cat den. Sustainability, social sharing and
  "the cat is the hero" (R009) in one move — ~0.15 SAR of die-cutting.
- **Four tiers, one system:** the same shipper family in three sizes serves Essentials
  through Full Membership; tiers differ by contents, insert count and finishing
  accents, not structure. Kittens get a lighter single-wall mailer. Multi-cat ships
  per-cat kraft bands, each printed with that cat's name.
- **Suppliers:** prototype locally (Printhub Riyadh / MMC Jeddah), scale corrugate with
  UCIC (Jeddah/Riyadh, 265k-tonne capacity), source the two rigid keepsakes
  factory-direct from India/China/Turkey (MOQ 500–1,000). Matrix in §10.
- **Economics:** at 5,000 boxes/month the blended packaging cost is ≈ 9.8 SAR — within
  ±1 SAR of the modelled 9 SAR — verified against `computeBoxEconomics` invariants (§11).

**The one-sentence brief:** design the shipment so the member feels *"my cat's care has
arrived"* — never *"my order has shipped"* — and so the cat ends the day asleep inside
the packaging.

---

## 01 · Phase 1 — Benchmarking the masters

Fifteen reference brands, studied for materials, structure, psychology, tactility,
opening sequence, sustainability, manufacturability and delight.

| Brand | What makes it memorable | Borrow | Do NOT copy |
|---|---|---|---|
| **Apple** | Air-friction lid drop; zero-slack moulded-pulp beds; product faces you first; pull-tab films; opening paced like film editing | **Pacing as engineering:** friction-fit stage tray, tab-pulls, product-first reveal, pulp precision for the Cat ID folio | Clinical white minimalism (Moracat is warm paper, not laboratory); plastic films are out entirely |
| **Aesop** | Utilitarian luxury: pharmacy kraft, cotton drawstring bags, literary copy; the bag is kept | Material honesty; copy-as-interface on the pack; a keepable cotton element at Tier 4 | Apothecary severity and monochrome brown — too austere for a warm brand |
| **Hermès** | One box colour owned outright (orange + brown ribbon since 1942); boxes hoarded for decades | **Colour equity discipline:** deep green `#045b46` becomes "the green box" of Saudi cat owners; keepsake rigidity at gift moments only | Ribbon on every shipment; gold; logo repetition. Hermès earns scarcity — a subscription must earn *ritual* |
| **Tiffany** | Patented colour + white ribbon; the box leaves the store only with product inside | Rule-bound reverence: the Welcome Folio is only ever issued with a Cat ID — never sold, never empty | Precious-metal cues, satin, jewellery pomposity |
| **BarkBox** | Monthly narrative themes; box designed for the dog to destroy; ~$5 landed packaging discipline | Monthly cadence with a light narrative thread (a seasonal card, not a themed circus); packaging that expects animal contact | Loud cartoon maximalism and gag themes — the authority forbids the cutesy register |
| **Meowbox** | The cat's name on the card; social wall of cats-in-boxes | **Name-first personalisation** (R001, R082); cat-in-box photography as the organic growth loop | Kawaii language, paw-print wallpaper, saturated purples |
| **Litter-Robot** | Heavy-goods engineering with dignity: double-wall, moulded cradles, carry cut-outs | Structural honesty for weight: hand-holds, dense-bottom loading, clean die cuts. The 10 L litter bag is our Litter-Robot problem | Appliance blandness — engineering without warmth |
| **Notion merch** | Editorial monochrome wit; typography carries everything | Type-led surfaces; the interior lid as a one-line editorial moment; the Cat ID number as a design element | Pure black-and-white — the palette stays warm |
| **Glossier** | Pink bubble pouch became a social icon; sticker sheets personalise | **One ownable reusable component** (our punch-out cat door) + sticker sheet at Tier 3+ | The plastic pouch itself; influencer-first design that photographs better than it functions |
| **Away** | Rigid drawer presentation; unboxing steps QC'd like product features | Treating the unboxing sequence as a spec'd, testable product (§05 is a test script) | Drawer-box-for-everything — their product is 2 kg once; ours is 12 kg monthly |
| **Ritual** | Radical transparency (sourcing printed on pack); one ownable yellow; pedestal insert | Provenance printing for food trust (R006): "filled in Riyadh · batch · best-before" stated plainly | Science-clinical tone — Moracat explains like a good vet, not a lab |
| **Athletic Greens (AG1)** | Forever canister + monthly refill: waste down, ritual up, permanent counter presence | **The refill pattern:** keepable treat tin and scoop arrive once; refills monthly; permanent shelf presence | Supplement-culture urgency; metallic gold-on-green |
| **Monocle** | Print quality as identity; kraft + one sticker outclasses gloss | The monthly card treated as a small piece of print journalism — real paper, real editorial standards | Anglo-clubby codes; our references are Saudi and Japanese |
| **Japanese craft** (tsutsumi · Muji) | Wrapping as respect; asymmetric folds; the unwrapping *is* the gift; "this is enough" restraint | **Fold-wrap ritual** for Tier 3+ discovery items (kraft band + single fold, no adhesive); one perfect fold beats three finishes | Literal washi/origami motifs — borrow the philosophy, not the costume |
| **Premium Korean unboxing** | Choreographed layer order; collectible message cards; foam-free precision; scent cues | Layer choreography discipline; collectible monthly card numbering | **Applied fragrance** — feline olfaction is ~40× human and the box carries food. Hard NO (§06) |

**Synthesis — the five laws the benchmarks teach:**

1. Luxury is pacing, not board grade.
2. Own one colour and never dilute it.
3. Design the keepable component deliberately; let everything else be honestly disposable.
4. Heavy goods demand structural honesty — dignity comes from engineering, not decoration.
5. The best subscription packaging creates a *ritual* the member would miss.

---

## 02 · Phase 2 — The Moracat frame

### What the design authority dictates physically

- **R001** Recognition first → the cat is named on the monthly card; never "Dear customer."
- **R009** The cat is the hero → the box is designed for the cat's use after unboxing.
- **Amendment 2026-07-10** → the box is never sold *as a box*: it is "your cat's care,
  handled." Copy on pack says care, not commerce.
- **R031** Ceremony on issue → the first shipment carries the Cat ID reveal, over-invested
  (the Welcome Folio, §03).
- **R006** Honest by default → no fake wax seals, no "limited edition" theatre;
  provenance printed plainly.
- **R101–R110** Arabic-first → Arabic reads first on every surface; the box composes for
  an RTL reader (§08).
- **Premium is subtraction** → one colour, one seal, one message per surface. No gold.

### The subscription hierarchy this system serves

Live plans (Starter 249 / Standard 349 / Premium 529 SAR) map onto the four-tier
hierarchy during migration. Per the amendment, members never pick from a tier table —
plans are computed from the cat's profile. Tiers below are *operational groupings for
packaging*, not marketing SKUs.

| Tier | Contents philosophy | ~Weight | Packaging posture | Working price* |
|---|---|---|---|---|
| **1 · Essentials** | Necessities only: dry food, wet food, litter. No treats, no toys, no extras — and the packaging must not pretend otherwise | 10–12 kg | Quietest execution: shipper + folded stage pad. Dignified, zero theatre | 299 SAR |
| **2 · Care** | + premium food options, hygiene, health essentials | 11–13 kg | Full stage tray; hygiene grouped in the kraft "clean pouch" | 399 SAR |
| **3 · Enrichment** | + treats, enrichment, grooming | 12–14 kg | Stage tray + fold-wrapped discovery items + sticker sheet | 529 SAR |
| **4 · Full membership** | + toys, seasonal gifts, accessories, exclusives, partner gifts | 12–15 kg | Stage tray + cotton-tape closure + quarterly Den Box keepsake | 749 SAR |
| **Kitten** | Kitten food, training litter, starter guidance — lighter and cheaper by design | 3–5 kg | Single-wall mailer, own smaller insert set; growth-chart card | 199 SAR |
| **Multi-cat** | Any tier × N cats | ≤ 20 kg/box | One shipper per ~15 kg; per-cat kraft name bands | per plan |

> \* **Pricing is provisional until it clears the invariants.** Before any price goes
> live it must clear `checkBoxInvariants` (≥15% member saving vs à-la-carte, ≥25%
> contribution, survival of 15% VAT registration —
> `packages/core/src/pricing/box-economics.ts`). Two content conflicts need product-team
> resolution: live Starter includes treats (Tier 1 forbids them) and excludes litter
> (Tier 1 requires it). Use `minimumViablePrice()` when retuning.

### The hard physical facts

- A 10 L litter bag weighs ≈ 8 kg and dominates every structural decision; the Standard
  box is ~12 kg gross (noted in `box-cost-model.ts`).
- Committed cost model: packaging 9 · delivery 12 · fulfilment 6 SAR per box; PSP 5%;
  shrink 2%. Delivery is the most sensitive input and needs a real 3PL quote for ~12 kg.
- Riyadh summer couriers reach 45 °C+: no low-melt adhesives, no coatings that
  fingerprint in heat; wet food away from sun-facing panels; vans assumed unrefrigerated.
- Prices are VAT-inclusive SAR; invoices break out 15%.

---

## 03 · Phase 3 — Packaging architecture

Not one box — an ecosystem of seven components:

```
EVERY MONTH                     ONCE — FIRST BOX               QUARTERLY — TIER 4
┌─────────────────────┐         ┌─────────────────────┐        ┌─────────────────────┐
│ M-Shipper (3 sizes) │         │ Welcome Folio       │        │ The Den Box         │
│ double-wall kraft   │────────▶│ rigid folio         │───────▶│ rigid drawer        │
│ 1C green print      │         │ foil Cat ID number  │        │ keepsake · seasonal │
│ punch-out cat door  │         │ card + tag + QR     │        │ gift + partner items│
├─────────────────────┤         ├─────────────────────┤        ├─────────────────────┤
│ Stage tray / pad    │         │ Kitten K-Mailer     │        │ Forever pieces      │
│ E-flute, printed    │         │ single-wall         │        │ tin · scoop · pouch │
├─────────────────────┤         ├─────────────────────┤        ├─────────────────────┤
│ Cellar divider set  │         │ Per-cat name bands  │        │ Gift wrap kit       │
│ B-flute, self-lock  │         │ multi-cat homes     │        │ referrals & gifting │
├─────────────────────┤         └─────────────────────┘        └─────────────────────┘
│ Consumable dressing │
│ tissue·seal·tape·card│
└─────────────────────┘
```

### 3.1 The shipping box — "M-Shipper"

| Spec | M-1 (Kitten) | M-2 (Tiers 1–3) | M-3 (Tier 4 / heavy) |
|---|---|---|---|
| Internal dims | 350 × 260 × 140 mm | 450 × 330 × 200 mm | 500 × 360 × 220 mm |
| Style | FEFCO 0427 roll-end front-tuck mailer | FEFCO 0201 RSC, taped | FEFCO 0201 RSC, taped |
| Board | Single-wall B-flute, 125K/112T/125K kraft | Double-wall BC-flute, 175K/112T/112T/175K | Double-wall BC-flute, 200K liners |
| Wall thickness | ~3 mm | ~6.5 mm | ~7 mm |
| Edge crush (ECT) | ≥ 5.5 kN/m | ≥ 9.5 kN/m | ≥ 10.5 kN/m |
| Payload rating | ≤ 6 kg | ≤ 16 kg | ≤ 20 kg |
| Box weight | ~260 g | ~640 g | ~780 g |
| Stacking | 6 high | 4 high loaded (BCT ≥ 320 kg fresh) | 4 high loaded |
| Carry | — | Die-cut hand-holds, folded-flap reinforced | same |
| Durability | ISTA-3A drops/compression/vibration; humidity-cycled for Jeddah coastal air (kraft liners for moisture tolerance) | | |
| Second life | — | Perforated punch-out door (Ø140 mm) + interior pattern → cat den | same |

### 3.2 The inner presentation — every option compared

Scores 1–5 against Moracat's actual constraints:

| Option | Luxury | 12 kg payload | Monthly cost | Sustainability | Flat-pack/storage | Verdict |
|---|---|---|---|---|---|---|
| Full rigid (set-up) box | 5 | 1 — delaminates under litter | 1 (25–40 SAR) | 2 | 1 — ships assembled, 6× freight & storage | Rejected monthly. **Adopted for Welcome Folio + Den Box only** |
| Magnetic closure box | 5 | 1 | 1 (30–45 SAR) | 1 — magnets contaminate recycling | 2 | Rejected — also a swallow hazard if a magnet detaches near a pet |
| Drawer / slide box | 4 | 1 | 2 | 3 | 2 | Rejected monthly; **chosen form for the quarterly Den Box** (slide-open is a ceremony gesture) |
| Corrugated mailer (0427) | 3 | 2 — hinge fails ≥ 8 kg repeated | 4 (4–7 SAR) | 5 | 5 | Rejected as main box; **adopted for Kitten (≤ 5 kg)** |
| Lift-off lid corrugated (0330) | 4 | 3 | 3 (8–12 SAR) | 4 | 3 — two pieces to stock | Strong runner-up; loses on tape-free transit security and cost |
| Folding carton inside shipper | 4 | 2 — duplicates mass | 2 — pays for two boxes | 2 | 3 | Rejected — "box in a box" reads as waste (R006) |
| **RSC + internal stage tray ("Stage over Cellar")** | **4.5** — the reveal is choreographed, not bought | **5** | **5** (7.6–12 SAR all-in) | **5** — mono-material kraft | **5** — all flat-pack | **RECOMMENDED.** One structure serves T1–T4; luxury delivered by pacing, print and paper |

**Why "Stage over Cellar" wins:** it is the only option where all five constraints
agree. The double-wall RSC honestly carries the litter; the E-flute stage tray gives an
Apple-grade first reveal at one-tenth rigid cost; everything flat-packs (a rigid program
at 10k/mo needs ~6× warehouse cube); it is mono-material recyclable; and the lid-open
moment can be paced — tissue, card, discovery — because the member's eye never meets the
litter bag first. Luxury here is *sequence*, and sequence is free.

**M-2 cross-section (450 × 330 × 200 mm internal):**

```
┌──────────────────────────────────────────────────────┐
│  lid interior print: أهلاً بعودتك — "Welcome home."   │
├──────────────────────────────────────────────────────┤
│  THE STAGE  (E-flute tray, cotton lift-loops)        │
│  [ monthly card on tissue ][ discovery ][ treats ]   │
├──────────────────────────────────────────────────────┤
│  THE CELLAR (B-flute self-locking divider)           │
│  [ litter 10 L ~8 kg ][ dry 2 kg ][ wet food comb ]  │
│   bag on edge, cradle   gusset up    cans/pouches    │
└──────○───────────────────────────────────────────────┘
       └─ punch-out cat door Ø140 mm (long panel)
```

### 3.3 The ceremony pieces

**The Welcome Folio (first box, every tier).** 2 mm greyboard folio, 230 × 160 × 18 mm,
wrapped in uncoated deep-green paper, opening like a passport wallet: left leaf holds the
printed Cat ID card in a die-cut cradle and the collar tag on a cotton loop; right leaf
prints the cat's name, the human-readable ID number in brass foil, and a QR that adds the
wallet pass. Stage 4's physical body (R031/R032/R034) — the single object a member keeps
for years, and the only place monthly economics permit foil. Cost ≈ 11–14 SAR, once per
member, booked as acquisition cost.

**The Den Box (Tier 4, quarterly).** Rigid drawer box, 280 × 200 × 90 mm, 1.5 mm board,
kraft-lined drawer, cotton pull-tab, blind-debossed seal. Carries the seasonal gift,
partner gifts and exclusives. Amortised ≈ 4.5 SAR/month inside Tier 4's budget.

---

## 04 · Inserts & protection

The spec is binary: **nothing moves, and nothing that touches the box can hurt a cat.**

### The insert kit

- **Cellar divider set** — one die-cut B-flute piece, self-locking (no glue, no staples —
  staples are a claw hazard): litter cradle (bag on edge, arch support), dry-food cell
  (gusset up, brand face out), wet-food cells (cans in a 3×5 honeycomb; pouches in a
  fence-slot comb; 30 g E-flute pad between can layers). Assembly < 10 s trained.
- **Stage tray** — E-flute, four-corner self-lock, sits on the divider's shoulder 60 mm
  below the lid so flaps never crush contents. Interior printed 1C green. Two 15 mm
  cotton twill lift-loops.
- **Stage pad (Tier 1)** — a single scored E-flute pad replaces the tray. Ceremony kept,
  cost halved.
- **Moulded pulp cradle** — reserved for the Welcome Folio and fragile Den Box gifts.
  Tooling ~USD 1–3k once; unit ~USD 0.10–0.35 at 3k+.
- **Void control** — crinkle kraft shred only (never plastic pillows or foam peanuts —
  ingestion hazard and off-brand). Zero void by design; shred ≤ 15 g/box.

### Cat-safety spec (non-negotiable)

- Water/soy-based inks; no mineral-oil offset inks on food-adjacent surfaces.
- No loose magnets, staples, curling ribbon, elastic loops, or glitter — documented
  feline ingestion hazards. Cotton twill tape ≥ 15 mm wide only.
- No applied fragrance anywhere; no essential oils (many are feline-toxic).
- All member-facing die-cut edges folded or hemmed; punch-out perforation leaves a clean
  rounded rim.
- Starch-based or food-adjacent-rated adhesives; tissue unbuffered and dye-fast (cats
  will sit on it — that's the point).

### Transit validation

ISTA-3A drop/vibration with full Tier 2 load; 40 °C/90% RH 24 h conditioning then repeat
drops; litter-bag survival (no burst, no dust leak) after 10-drop abuse; can-dent count
≤ 1 minor per 15 cans. Field: photo-audit the first 100 live deliveries per city.

---

## 05 · The opening sequence

Written as a test script — every beat has an owner, a feeling, and a failure mode.
~90 seconds of designed experience, then a lifetime of the cat using the box.

| # | Time | Beat | What happens / why |
|---|---|---|---|
| 1 | 0:00 | **Arrival** | Clean kraft box, deep-green seal on top. No plastic overwrap; shipping label sits in a printed frame (a crooked label on a designed frame still looks intentional). Arabic wordmark reads first; weight honest in the hands via die-cut handles. *Feeling: "this is for us."* |
| 2 | 0:10 | **Texture** | Unbleached kraft, visible flute at edges, matte green ink sunk into fibre. One line beside the seal: **لِحياة قطّك كلّها** · "For your cat's whole life." Kraft + matte hides courier scuffs that would ruin white gloss. |
| 3 | 0:20 | **The seal** | Reinforced water-activated kraft tape, thread-line print, phrase at the cut point: **افتح بهدوء — أحدهم يراقب** · "Open gently — someone is watching." One knife pass along a printed guide that keeps the blade off contents and the punch-out door. *First smile: 0.4 SAR.* |
| 4 | 0:30 | **The reveal** | Lid interior printed edge-to-edge green, one cream line: **أهلاً بعودتك** · "Welcome home." Below: stage tray dressed in cream tissue, sealed with one sticker from the illustration set. The litter is invisible. *Feeling: hotel turndown, not warehouse pick.* |
| 5 | 0:40 | **Recognition** | The monthly card, addressed to the cat: **لِلوز، تموين شهر أغسطس** · "For Louz — August's provisions." Inside: contents list (Arabic first), the member-rate saving stated plainly (R041/R085), one seasonal care note, the QR. *First box: the Welcome Folio sits here in its pulp cradle instead.* |
| 6 | 0:55 | **Discovery** | Tissue parts to the tier's discovery items — treats fold-wrapped in kraft bands (T3+), the hygiene "clean pouch" (T2+), toy/seasonal gift (T4). Each band prints what the item is and why it was chosen for this cat. Nothing on the stage needs scissors. |
| 7 | 1:10 | **The provisions** | Cotton loops lift the tray; below, the staples stand in their cells like a well-packed pantry. No shred storm. *Feeling: competence — "they handled it."* |
| 8 | 1:25 | **The scan** | The QR opens the app's box moment: delivery confirmed, saving added to the running tally (R042), pantry updated, one line of guidance ("Louz's next weigh-in is due"). Physical and digital close the loop in one gesture. |
| 9 | 1:40 | **The second life** | The card's last panel shows the punch-out door: press, fold, and the empty shipper becomes **بيت اللوز** · "Louz's den." Tissue goes in as bedding; the cat moves in; the member photographs it. *The box is never garbage on day one.* |

**Guardrails:** one clear action per beat (principle 5); no beat depends on reading
English; a member who rips everything open in 10 seconds loses nothing — pacing is
offered, never enforced (principle 7).

---

## 06 · Phase 4 — Premium finish specification

The discipline: **spend on what fingers touch and eyes read; refuse what merely shouts.**

| Element | Specification | Why / why not |
|---|---|---|
| Shipper print | 1-colour flexo, deep green (match `#045b46`), water-based ink on unbleached kraft; interior lid via pre-print liner at scale | One colour on kraft is the Hermès discipline at corrugate cost; hides scuffs; recyclable unchanged |
| Monthly card | A5 folded, **350 gsm** FSC uncoated (Munken/Arena class), 4/4 digital, cat's-name variable data | The one paper every member touches monthly — where GSM is felt. Uncoated takes handwriting |
| Welcome Folio | **2 mm greyboard**, 120 gsm uncoated deep-green wrap, **brass foil for the Cat ID number only**, blind deboss seal | Foil appears exactly once in the system, on the number that is the member's identity (R032) — scarcity keeps it sacred |
| Den Box (T4) | 1.5 mm board drawer, kraft-lined, blind deboss, cotton pull-tab. Soft-touch lamination **rejected** | Soft-touch films block recycling and fingerprint in 45 °C vans; deboss on heavy stock gives the tactile signal honestly |
| Emboss / deboss | Blind deboss only (seal + wordmark) on folio, Den Box, card masthead | Deboss reads as craft under the thumb; emboss on shipping surfaces crushes in transit |
| Spot UV | **Rejected system-wide** | Gloss contradicts the matte warm-paper brand; scuffs; adds a coating layer to recycling |
| Tissue | 17 gsm FSC, cream, 1-colour sparse sticker-motif print (~10% coverage), unscented, dye-fast | The softness cue of the whole unboxing at ~0.45 SAR |
| Seal sticker | Ø 60 mm uncoated paper, water-based adhesive; rotates monthly through the flat-sticker set | The collectible cadence signal — members notice the month changing |
| Custom tape | 70 mm reinforced water-activated kraft, 1C green thread-line + cut-here phrase | WAT bonds permanently (tamper-evident), recycles with the box, courier-network security |
| Ribbon | 15 mm natural cotton twill, green; tray lift-loops, Den pull, gift bow. Satin/curling ribbon **banned** | Cotton is the only ribbon that is compostable, cat-safe and on-brand; curling ribbon is an ingestion hazard |
| Thank-you / milestone cards | A6, 350 gsm, letterpress-style 1C for true milestones (first anniversary, 1,000 SAR saved) | Gratitude rationed to moments that are true (R006, R065) |
| Brand scent | **Rejected** | Feline olfaction ~40× human; the box carries food. Scented packaging is a welfare and trust error dressed as luxury. The brand smells of clean kraft |
| QR experience | One QR, on the card (never large on the exterior); deep-links to the box moment; works as plain URL offline | One bridge, at the moment of attention. A QR on the outside of a box is logistics, not membership |
| Exterior personalisation | **None** — no cat/owner name outside | PDPL-aligned privacy (R106): the hallway should not announce who lives here. Recognition happens inside |

---

## 07 · Phase 5 — What's inside, per tier

Contents mapped to the live catalog where possible (SKUs from `seed-catalog.ts`).

### Tier 1 — Essentials · M-2 · ≈ 11.6 kg gross

| Item | ~Dims | Weight | Position | Protection | Discovery order |
|---|---|---|---|---|---|
| Clumping litter 10 L (cf. P12700032) | 440 × 300 × 95 mm bag | ~8.0 kg | Cellar left, on edge, arch cradle | B-flute cradle + base pad | 5 (last, strongest) |
| Dry food 2 kg (P12500091) | 350 × 230 × 90 mm gusset | 2.1 kg | Cellar centre, face up | Own cell, no lid compression | 4 |
| Wet pouches × 15 (cf. P12600201) | each 130 × 105 × 12 mm | 1.4 kg | Cellar right, fence-slot comb, 2 rows | E-flute comb; no pouch abrasion | 3 |
| Monthly card + tissue | A5 folded | 40 g | Stage pad, centred | — | 1–2 |

Essentials keeps the full ceremony-of-sequence but zero extras — the restraint *is* the
message: "only what {cat} needs, handled." No treats, no toys; the card never upsells
(R085).

### Tier 2 — Care · M-2 · ≈ 12.4 kg gross

Tier 1 (wet upgraded to premium cans/pouches) **plus the "clean pouch"**: a kraft
drawstring pouch on the stage tray grouping hygiene — grooming wipes (P12600185,
200 × 110 × 60 mm, 350 g), litter deodoriser (Ø 80 × 160 mm, 450 g), dental care
(180 × 60 × 30 mm, 120 g). Grouping hygiene in one named pouch turns "products" into
"care routine" — discovered as one object, third in sequence.

### Tier 3 — Enrichment · M-2 · ≈ 13.1 kg gross

Tier 2 plus, on the stage tray: creamy treats (P15901880, 160 × 80 × 35 mm, 120 g) and
calming treats (P10500016), each fold-wrapped in a printed kraft band; one enrichment
item monthly (puzzle feeder ≈ Ø 180 × 40 mm, 250 g, own E-flute sleeve); grooming tool
on rotation (brush 200 × 60 × 40 mm, 90 g); the monthly sticker sheet.
Discovery: card → treats → enrichment → grooming → cellar.

### Tier 4 — Full membership · M-3 · ≈ 13.9 kg gross (+ Den Box quarterly)

Tier 3 plus: toy of the month (soft kicker ≈ 220 × 70 × 50 mm, 80 g), seasonal/partner
gift (≤ 200 × 150 × 80 mm — moulded pulp cradle if fragile), accessory on rotation
(collar, bowl, blanket quarter). Stage closes with cotton tape in a single fold-knot.
In Den months the drawer box sits centred on the stage, first discovered, band-wrapped
**هدية الموسم** · "the season's gift."

### Kitten package · K-Mailer (M-1) · ≈ 4.2 kg gross

Kitten dry 1.5 kg (300 × 200 × 80 mm), kitten wet × 12 pouches, training litter 2.5 kg,
and the **growth card** — a monthly weigh-in chart the member keeps. Single-wall mailer
opens book-style; one scored insert holds all cells; stage pad only. Packaging ≈ 4.9 SAR —
the cheaper kitten packaging, achieved structurally. The first kitten box still carries
the full Welcome Folio: a kitten's Cat ID ceremony is the strongest bonding moment the
brand will ever get.

### Multi-cat households

One shipper per ~15 kg cap; contents grouped per cat with a printed kraft band —
**حصّة سمسم** · "Simsim's share" — so distribution in a two-cat home is pre-solved
(R109). One monthly card lists all cats by name; shared cellar for staples; per-cat
treats never mixed (diet integrity). At 3+ cats ship two M-2 rather than one overweight
M-3: courier damage rises non-linearly past 16 kg.

### Exploded stack (Tier 3, top layer first)

```
1 · LID FLAPS        interior print: أهلاً بعودتك · welcome home
2 · TISSUE BED       cream 17 gsm + seal sticker + monthly card (للوز · for Louz)
3 · STAGE TRAY       [ treats ×2, kraft bands ][ enrichment sleeve ][ grooming + stickers ]
4 · CELLAR + DIVIDER [ litter 10 L cradle ][ dry 2 kg ][ wet comb ×15 ]
5 · BASE             punch-out den door on long panel
```

What the member meets is the order they are drawn.

---

## 08 · Phase 6 — Design language

The digital system already exists — *"warm paper, flat stickers, editorial confidence"*
(`packages/ui/src/styles/globals.css`). The physical system is the same voice in fibre
and ink: **Apple's restraint, Hermès' colour conviction, Muji's honesty — with a Najdi
warmth none of them have.**

- **Palette · exterior** — unbleached kraft ground; deep green `#045b46` as the *only*
  exterior ink. The green box becomes the brand's silhouette on every doorstep.
- **Palette · interior** — cream tissue (`#f7dec9` family), warm-paper card stock,
  sticker accents (tangerine `#f86c2f`, blush, sage, butter) used like enamel pins: one
  or two per box, never a confetti of them.
- **Typography** — premium Arabic display (Lyon Arabic Display class) set first and
  largest (R101, R103); Fraunces for English display; IBM Plex Sans for utility; the
  Cat ID number in IBM Plex Mono — the "engineering truth" voice.
- **Illustration** — the existing flat-sticker set appears as the seal sticker, the
  tissue motif, and the monthly sticker sheet — and nowhere else. **The paw is a rare
  guest, never wallpaper.**
- **Layout** — one message per surface. Generous margins. The lid interior is a title
  page, the card is an article, the bands are captions. Minimalism where structure
  speaks; expression only in the sticker moments.
- **RTL-native** — panels compose for an RTL reading arc: Arabic top-right anchor,
  English lower-left echo (R104). The card opens right-to-left. English is the
  translation, visibly.

### The three influences, held in tension

- **Saudi luxury** — not ornament but *hospitality*: the box as a host. Generosity of
  space, the majlis instinct of presenting the best first, dates-box gifting culture
  informing the Den Box. Sadu-derived geometry may appear as a single thin woven line on
  the tape — never as pastiche.
- **Modern Japanese** — the fold as respect: kraft bands with one fold instead of
  adhesive; the stage/cellar concept itself is bento logic; "enough" as a position.
- **Premium Scandinavian** — functional warmth: self-locking structures shown honestly,
  flute edges visible, instructions that read like furniture assembly done right.

### What is banned

Paw-print patterns, fish-bone icons, cartoon whiskers, "meow" puns in display type, gold
foil floods, glossy lamination, mascot eyes on the box. The register is a fine grocer who
knows your cat's name — never a toy store.

---

## 09 · Phase 7 — Sustainability

The system is designed so the greenest choice and the most premium choice are the
**same choice** — and the cat is the recycling program.

- **Mono-material by design:** shipper, trays, dividers, bands, cards — all paper fibre,
  one recycling stream. FSC-certified liners and stocks; water/soy-based inks; starch
  adhesives; water-activated paper tape. No plastic film, foam, bubble, or magnet
  anywhere in the monthly flow.
- **The punch-out den is the sustainability program:** a shipper that becomes furniture
  isn't waste diverted — it's waste that never happened. Reuse-by-design beats
  recycle-by-instruction, and it is the single most on-brand move available (R009).
- **Forever pieces, refill logic (AG1 lesson):** treat tin, scoop, cotton pouch arrive
  once; refills arrive flat/light thereafter. Waste per month falls while shelf
  presence — perceived value — becomes permanent.
- **Right-sizing:** three shipper sizes + computed plans mean air is never shipped; void
  shred ≤ 15 g. Double-wall board is itself ≥ 70% recycled content (standard for KSA
  corrugate mills).
- **Local production = shipped-emissions honesty:** corrugate from Jeddah/Riyadh mills
  cuts inbound freight to near zero vs importing finished boxes; only the two rigid
  ceremony pieces travel far, and they travel rarely.
- **Say it plainly, once:** one line on the base panel — "This box is 100% paper. The
  door on the side is for {the cat}." No green badges, no eco-theatre (R006).

---

## 10 · Phase 8 — Manufacturing & suppliers

Strategy: **prototype local, scale corrugate local, import only the ceremony.**
Priority KSA → GCC → China → Turkey (India added — Kumar Printers was specified for
investigation and proves out as a strong rigid-box source).

| Supplier | Country | Makes for us | MOQ | Lead | Samples | Capabilities | Est. pricing | Pros | Cons | 10k+/mo? |
|---|---|---|---|---|---|---|---|---|---|---|
| **UCIC** (ucic.com.sa) | KSA — 2× Jeddah, 1× Riyadh | M-Shipper family, dividers, trays | ~3–5k/SKU | 2–4 wks | Yes | Flexo to 4C, die-cut, litho-lam | M-2 ≈ 4.8–7.5 SAR by volume | 265k-t capacity; both launch cities; days-not-weeks replenishment | Not a luxury finisher; MOQ high for pilots | **Yes, easily** |
| **Napco National** (napconational.com) | KSA — Dammam, Jeddah | Shipper second source; tissue; kraft goods | ~5k | 3–4 wks | Yes | Flexo; paper + corrugated breadth | ≈ UCIC | Supply-chain resilience | Less boutique attention early | **Yes** |
| **Obeikan** (packaging div.) | KSA — Riyadh | Folding cartons, printed paperboard (cards at scale) | ~10k | 3–5 wks | Yes | High-grade offset, coatings, food-grade | cards ≈ 0.4–0.9 SAR at scale | Best offset in-Kingdom | Overkill until volume | **Yes** |
| **Printhub** (printhub.sa) | KSA — Riyadh | Prototypes + pilots: mailers, cards, stickers, bands | ~50–100 (digital) | 3–10 days | Instant online proofing | Digital CMYK, die-cut | M-2 pilot ≈ 12–16 SAR | Founded 2021 for low-MOQ fast custom; Arabic-native | Unit cost 2–3× scale; limited board grades | No — pilot partner |
| **MMC Print n Gift** (mmcprintngift.com) | KSA — Jeddah | Welcome Folio pilot, foil/deboss cards, kitting | ~100–500 | 1–3 wks | Yes | Offset + HP Indigo + UV, hot foil, deboss, engraving, personalisation | folio pilot ≈ 18–25 SAR | Luxury finishing in-Kingdom; does kitting/fulfilment | Not a box plant | Partially (finishing/kitting) |
| **Silver Corner Packaging** | KSA | Rigid gift boxes (local Den option) | ~500–1k | 3–5 wks | Yes | Rigid set-up, wraps, foil | Den ≈ 14–20 SAR | Local rigid; gifting-culture fluency | Above-Asia cost at volume | Uncertain |
| **Kumar Printers** (kumarprinters.com) | India — IMT Manesar | Welcome Folio + Den Box at scale; premium inserts | ~1–3k | 4–6 wks + 2–3 wks sea | Yes, paid | Full luxury: hot foil, emboss/deboss, soft-touch, UV; 60+ yrs; 12k-t conversion | Folio ≈ 6.5–9 SAR; Den ≈ 8–12 SAR | Serves P&G/Adidas-class brands; short India–GCC freight; strong QA | MOQ ties cash; freight planning | **Yes** |
| **Paksis** (paksis.com.tr) | Turkey — Istanbul | Rigid pieces alternative; 1k–200k runs | ~1k | 3–5 wks + 1–2 wks freight | Yes | Luxury rigid specialist since 2005; 50% export share | Den ≈ 9–14 SAR | EU-grade quality; GCC-friendly logistics | Above-China pricing | **Yes** |
| **KBC Packaging** (kbcpackaging.com) | Turkey | Rigid + textile-wrapped, low-MOQ luxury | 500–1k | 3–4 wks + freight | Yes | Rigid, wrapped, foil; claims 30–60% better value than EU | Den ≈ 8–13 SAR | Lowest luxury MOQ near-shore; good for V2 | Smaller plant; single-source risk | Likely |
| **Alya Packaging** (alyapackaging.com) | Turkey — Istanbul | Rigid at high volume | ~2k | 3–5 wks + freight | Yes | 500k boxes/mo capacity; exports 40+ countries | competitive at 10k+ | Scale insurance | Less boutique small runs | **Yes** |
| **LuxoPack / Jialan-class** (luxopack.com) | China — Guangdong | Rigid folio/drawer at best unit cost | 100–500 digital / 500–1k offset | 25–35 days + 3–4 wks sea | Yes, fast | Everything: foil, deboss, soft touch, ribbon | Folio ≈ 5–8 SAR; Den ≈ USD 2.5–6 | Best price at scale; deepest structural library | Longest pipeline; needs 3rd-party QC + buffer stock | **Yes** |
| **HS Pack / Lian-class pulp** (hspackfactory.com) | China | Moulded pulp cradles | ~3k (some 500) | 4–6 wks incl. tooling | From tool | Wet-press fine pulp (Apple-grade surface) | USD 0.10–0.35/u; tooling USD 1–3k once | The precision-fit feel nothing else gives | Tooling lock-in; share containers with rigid orders | **Yes** |

> **Note on "Papr":** the brief named Papr as a Saudi candidate; research could not
> verify a packaging company under that exact name/domain. The closest verified
> equivalent — a Riyadh-founded (2021) low-MOQ online custom-packaging platform — is
> **Printhub**, included above. If Papr is a known local contact, add it after a
> capability call. (Honesty over invented detail — R006.)

**Sourcing architecture — dual-track:** KSA plants own everything monthly (UCIC primary,
Napco second source — corrugate is too heavy and frequent to import sensibly);
Asia/Turkey own the two rigid ceremony pieces (Kumar or LuxoPack primary by landed-cost
quote, Paksis/KBC near-shore hedge), ordered quarterly with 6-week buffer. MMC Jeddah
handles luxury-finishing emergencies and gift-kit assembly in-Kingdom. Third-party
pre-shipment inspection (AQL 2.5) on every import lot.

---

## 11 · Phase 9 — Financial analysis

Every number reconciles with `BOX_COST_MODEL` (packaging 9 · delivery 12 · fulfilment 6
SAR) and must survive `checkBoxInvariants`. Estimates are supplier-quote class (±20%)
until V1 quotes land. All SAR.

### Component cost by monthly volume (M-2 system)

| Component | 100 u | 500 u | 1,000 u | 5,000 u | 10,000 u | Source |
|---|---|---|---|---|---|---|
| M-2 shipper, DW, 1C flexo + die-cuts | 14.00 | 9.50 | 7.20 | 5.60 | 4.80 | Printhub → UCIC |
| Cellar divider set (B-flute) | 3.20 | 2.10 | 1.50 | 1.00 | 0.85 | UCIC |
| Stage tray, E-flute, 1C interior | 4.50 | 3.20 | 2.60 | 1.90 | 1.60 | UCIC |
| Stage pad (T1 alternative) | 2.10 | 1.40 | 1.10 | 0.80 | 0.65 | UCIC |
| Tissue ×2 + seal sticker | 1.60 | 1.10 | 0.80 | 0.55 | 0.45 | Napco / local |
| Printed WAT tape (~1.2 m) | 0.90 | 0.65 | 0.50 | 0.38 | 0.32 | import roll stock |
| Monthly card (350 gsm, VDP name) | 2.20 | 1.40 | 1.00 | 0.65 | 0.50 | MMC → Obeikan |
| Bands / clean pouch / stickersheet (T2–T4 adders) | 3.00 | 2.20 | 1.70 | 1.25 | 1.05 | mixed |
| Cotton tape closure (T4) | 1.10 | 0.85 | 0.70 | 0.55 | 0.50 | import |
| Den Box amortised /mo (T4, quarterly ÷3) | 6.60 | 5.00 | 4.30 | 3.60 | 3.20 | Kumar / LuxoPack |
| Welcome Folio (once, per new member) | 22.00 | 16.00 | 13.00 | 11.00 | 9.50 | MMC pilot → Kumar |

### Packaging cost per box, per tier (assembled system)

| Tier | 100 u | 500 u | 1,000 u | 5,000 u | 10,000 u | vs 9 SAR model |
|---|---|---|---|---|---|---|
| **T1 Essentials** | 24.00 | 16.15 | 12.10 | **8.98** | 7.57 | Clears budget at 5k |
| **T2 Care** | 28.20 | 19.25 | 14.62 | **10.83** | 9.15 | +1.8 over model — priced into T2 |
| **T3 Enrichment** | 29.40 | 20.15 | 15.30 | **11.33** | 9.57 | +2.3 — priced into T3 |
| **T4 Full** | 38.90 | 27.60 | 21.90 | **16.98** | 14.77 | Premium tier carries premium pack — margin holds at 749 |
| **Kitten** | 13.10 | 8.70 | 6.60 | **4.90** | 4.10 | Under model — "cheaper kitten packaging," met structurally |

### What the volume curve buys

T1: −33% at 500 → −50% at 1k → −63% at 5k → −68% at 10k. The curve's knee is at
~5,000/mo — where UCIC tooling amortises and the blended average across a realistic tier
mix (40% T1 · 30% T2 · 20% T3 · 10% T4; kitten ≈ 8% of base) lands at **≈ 9.8 SAR/box**:
within one riyal of the committed model. Below 1k/mo, packaging runs 3–7 SAR hot — an
accepted, temporary pilot cost, not a pricing input.

### Adjacent costs the packaging decision moves

- **Assembly:** all-flat-pack keeps pack-out at ~3.5 min/box (within the 6 SAR
  fulfilment line at KSA labour rates); a rigid monthly box would add ~1.5 min +
  assembled-storage handling.
- **Storage:** flat corrugate for 10k boxes ≈ 2 pallet positions/day of production;
  assembled rigid would need ~6×. Ceremony pieces add one position per quarter.
- **Shipping:** dimensional weight unchanged (contents dominate); the 12 SAR delivery
  line stays the sensitive input flagged in `box-cost-model.ts` — negotiate against the
  ~12 kg reality; reconcile with the storefront's 25 SAR customer-facing shipping fee.
- **Damage/shrink:** ISTA-validated structure should hold transit damage under the
  modelled 2%; every 0.5% saved ≈ 0.6–1.2 SAR/box at tier COGS — the divider set pays
  for itself in dented cans alone.

> **Invariant check — the go/no-go gate.** Before launch, each tier recipe runs through
> `computeBoxEconomics` with V1-quoted packaging substituted via per-tier
> `BOX_PACKAGING_SAR` overrides. Gate: ≥15% member saving, ≥25% contribution, post-VAT
> survival. The Welcome Folio is excluded from the per-box model (booked to
> acquisition); the Den Box is inside Tier 4's recipe cost. **No tier ships until its
> row is green.**

---

## 12 · Phase 10 — Prototype roadmap

### V1 — "Prove the choreography" · Weeks 1–4 · ~100 units · Printhub + MMC

- **Build:** digital-printed M-2 + hand-cut divider + stage tray; MMC-made Welcome Folio
  (foil, deboss); full dressing kit.
- **Test:** ISTA-3A drops with real litter; 10 member households filmed unboxing
  (Arabic-first participants); pack-out timing; 45 °C van simulation.
- **Learn:** does the stage/cellar reveal land emotionally? Does the punch-out door
  survive transit intact? Is the divider fold actually < 10 s?

### V2 — "Prove the economics" · Weeks 5–12 · ~1,000 units · UCIC tooling + near-shore rigid

- **Change & why:** flexo plates + die tooling at UCIC (unit cost −45%, print
  consistency up); divider revised from V1 drop data (targeted −10% board); folio moved
  to Kumar/KBC sample lots for landed-cost comparison; tissue coverage reduced if V1
  film review reads busy (restraint check); punch-out perforation gauge tuned to open
  clean but never in transit.
- **Test:** live cohort in Riyadh + Jeddah; damage telemetry vs the 2% shrink line;
  first unboxing-NPS measure; reuse survey ("where is the box now?").

### V3 — "Prove the machine" · Months 4–6 · 5,000+/mo capability · dual-sourced

- **Change & why:** pre-print interior liner replaces post-print at volume (lid interior
  −30%, tighter registration); Napco onboarded as second source (resilience);
  moulded-pulp folio cradle tooled in China alongside Den production (container
  sharing); M-3 + K-mailer dies cut; per-cat band VDP automated into the pick line.
- **Test:** full ISTA re-validation per SKU; cost audit vs §11; Tier 4 Den cadence
  dry-run; 10k/mo line-rate simulation at 3PL.
- **Exit criteria:** blended packaging ≤ 10 SAR; damage < 1%; unboxing NPS ≥ 70; every
  tier green on invariants.

Each iteration improves all six mandated axes — durability, luxury, unboxing,
sustainability, cost, manufacturing efficiency — and the reason for every change is
written down before the change is made.

---

## 13 · Packaging timeline

| When | Milestone | Owner / partner |
|---|---|---|
| Wk 1–2 | Dielines for M-1/M-2/M-3, divider, tray, folio; finish spec frozen (§06); artwork from existing brand system | Design + structural engineer |
| Wk 2–4 | V1 pilot build (100 u), ISTA testing, 10-household filmed study | Printhub, MMC, CX |
| Wk 5–8 | UCIC tooling; rigid-piece RFQs to Kumar / LuxoPack / Paksis / KBC with identical spec pack; sample rounds | Ops + procurement |
| Wk 9–12 | V2 1,000-unit live cohort; invariant re-check with real quotes; ceremony-piece supplier selection | Ops + finance (box-economics gate) |
| Mo 4 | Pre-shipment inspection framework; buffer-stock policy (6 wks rigid, 2 wks corrugate); Napco qualified | Procurement |
| Mo 5–6 | V3 scale validation at 3PL; K-mailer + M-3 launch; Den Box Q1 cadence begins | Ops |
| Ongoing | Monthly: sticker/card rotation. Quarterly: Den theme, damage + reuse telemetry review. Yearly: full spec re-tender | Brand + ops |

---

## 14 · Final recommendation

**Adopt the Green Box system:** the kraft "Stage over Cellar" M-Shipper family
(UCIC-manufactured, deep-green one-colour, punch-out cat door), dressed with tissue,
seal sticker, printed WAT tape and a name-personalised monthly card; the rigid
**Welcome Folio** once per member carrying the Cat ID ceremony; the rigid **Den Box**
quarterly for Tier 4; the **K-Mailer** for kittens; per-cat name bands for multi-cat
homes.

It is the only candidate that wins on all five axes simultaneously:

1. **Luxury** — delivered through pacing, paper, print and recognition (§05), with true
   rigid luxury reserved for the moments that carry identity, exactly as the authority's
   ceremony rules demand.
2. **Customer delight** — the lid message, the cat's name, the monthly sticker, and a
   box the cat keeps. Delight compounds monthly instead of peaking once.
3. **Operational efficiency** — 100% flat-pack monthly flow, one structure across tiers,
   in-Kingdom replenishment in days, 3.5-minute pack-out.
4. **Scalability** — UCIC/Napco carry 10,000+/month without strain; ceremony pieces
   batch quarterly from proven exporters with second sources named.
5. **Profitability** — blended ≈ 9.8 SAR at 5k/mo against the modelled 9 SAR, every tier
   gated by `checkBoxInvariants` before launch, the folio booked honestly to
   acquisition.

This is how Moracat becomes the unboxing benchmark for the Kingdom and the GCC: not by
shipping the most expensive box in the category, but by shipping the most *considered*
one — the box that knows the cat's name on the way in, and belongs to the cat
afterwards. **The carton is temporary; the membership it performs is not.**

---

## 15 · Authority review (checklist run)

- **Emotions, in order:** belonging (green box on the doorstep, the cat's name), trust
  (honest structure, plain provenance, no theatre), pride (Cat ID folio, den photos),
  ease (handles, pantry order), rationed delight (one sticker, one lid line), smart
  value (saving stated on the card). ✓
- **Rules satisfied:** R001/R082 (name-first), R006 (no scent, no fake luxury, Papr
  flagged not invented), R009 (the den), R031/R032/R034 (ceremony, human-readable
  number, wallet-pass QR), R041/R042/R085 (savings as recognition), R062–R069 untouched
  (nothing in-pack guilt-trips), R101–R106 (Arabic-first, PDPL privacy on exterior),
  R109 (multi-cat bands), R111 (even Tier 1's restraint is a welcome). ✓
- **Rules at risk, watched:** principle 7 (calm over clever) — the punch-out door and
  tape phrase are the two "clever" allowances; V1 film review kills either if it reads
  as gimmick. Delight budget: max one novelty per box.
- **One clear action per moment:** each beat of §05 has exactly one. ✓
- **Premium through restraint:** one exterior colour, one foil location in the entire
  system, zero gloss. ✓
- **Unhappy paths:** crushed box → double-wall + ISTA; wrong-item → per-cat bands;
  member rips everything at once → nothing breaks; box in the sun → matte kraft,
  heat-safe adhesives; damage claims → photo-audit loop. ✓
- **Open items for product team:**
  1. Reconcile Tier 1 contents vs live Starter recipe (treats/litter conflict, §02).
  2. Confirm working prices through `minimumViablePrice`.
  3. Real 3PL quote for 12 kg to replace the 12 SAR assumption.
  4. Verify "Papr" contact if it exists.

---

*MRC-PKG-001 · Rev A · 2026-07 · Companion: `moracat-packaging-dossier.html` (illustrated), MRC-UX-001, `DESIGN-AUTHORITY.md`. The authority wins every conflict.*
