# MRC-BRAND-001 — Visual & Art-Direction Assessment

**Date:** 2026-09-21 · **Subject:** www.moracat.co (production) · **Lens:** brand, art direction, graphic design — not UX, not code.

**What was inspected.** Full-page 1440px captures of the live Arabic/light site: Home, Benefits, Community, Adopt, Lost & Found, Feeding tool, About, Blog, Products, Register, Login, Contact, Vet login; the 12 source 3D renders and the logo file; design tokens (`packages/ui/src/styles/globals.css`) and font loading (`apps/web/app/layout.tsx`) to confirm what the pixels suggested.
**What was NOT pixel-reviewed:** the logged-in portal, dark mode, the English locale, and true phone rendering (headless capture could not emulate <500px reliably). Portal comments below are limited accordingly.

> **Governance note.** Several recommendations here contradict the current art direction ("warm paper, flat stickers", 2026-07) written into `DESIGN-AUTHORITY.md`. Per CLAUDE.md the authority wins until amended. Treat this document as the case for amending it — that is a founder decision, not an implementation detail.

---

## 0. The verdict in one paragraph

Moracat today is **a very well-made startup website with one genuinely premium idea trapped inside it.** There are two brands on the page fighting each other. **Brand A** is a pastel kawaii sticker brand: blush/butter/peach tiles, floating hearts and mice, a smiling pink plush cat, a marquee, paw trails, emoji. **Brand B** is an emerald institution: the Cat ID card, the "National Cat Census", the serial number, the perforated band, the emerald metal cat on the green register panel, Lyon Arabic headlines, Najdi-dialect copy. Brand B is the SAR 500M brand. Brand A is what every pet startup from Seoul to São Paulo looks like. Right now A owns ~80% of the pixels and B owns the 20% that people would actually remember. The entire strategy of this document is: **flip that ratio.**

Logo-removal test: remove the logo and the homepage could be any friendly DTC pet/kids/wellness brand — *until the Cat ID card appears*. The card is the only element that is unmistakably Moracat. That tells you where the identity lives.

---

## 1. Overall art direction

**Recognisable visual world?** Partially. There is a consistent *kit* (paper ground, 1px-border rounded cards, pills, stickers), but a kit is not a world. A world has a point of view about light, material, scale and subject. Moracat's pages have no light source, no material, no photography, and — remarkably for a brand whose constitution says "the cat is always the hero" — **not a single real cat on the homepage.** The hero's protagonist is a placeholder card reading «قطك» with a generic paw icon.

**Intentional or assembled?** Assembled. Evidence, all visible on production today:

- **Four illustration tiers on one page**: flat vector stickers, 3D plush renders, 3D metal renders, and system emoji (🎉 on Adopt, 😺💗🚀 on About, 🤍 on Lost & Found). Home's pillar grid puts a 3D plush cat in one tile and a flat vector mouse and flat "CAT FOOD" cans in the next three. That reads as "we ran out of renders", not as a system.
- **The project's own rule is broken**: the 3D tier is documented as "ONE per screen, ≥64px, never as an icon". `/adopt` shows five 3D objects on one screen, three of them as 64px feature-row icons.
- **A collision bug is live on `/about`**: a flat green cat illustration sits on top of the H1 «نبني مستقبل تربية القطط» and covers the eyebrow chip. On a premium brand's About page this is the equivalent of a typo on the shop window.
- **English inside Arabic art**: the flat can illustration says "CAT FOOD" in English, three times on the Arabic homepage. For a brand whose stated rule is "Arabic leads", the illustrations themselves are Western.
- **Two wordmarks**: the header uses the custom-lettered مرقط/Moracat lockup; the footer sets «مرقط» in plain Lyon Arabic. Those are different drawings of the brand's own name 3,000px apart.

**What should become uniquely Moracat** (expanded in §9): the ID band, the serial, the emerald object, the official cat portrait, the census number.

---

## 2. Typography

### What is actually there
| Role | Face | Reality |
|---|---|---|
| Arabic — everything | Lyon Arabic **Display**, **Regular only** (one .otf) | used for H1, nav, buttons, body, 11px captions |
| Latin display | Fraunces | barely visible on the Arabic site |
| Latin UI + all digits | Inter | digits are deliberately routed to Inter via unicode-range |
| Serial / data | IBM Plex Mono | also being applied to Arabic labels on the card |

### The choice is right; the execution has four real errors

1. **Every Arabic heading is faux-bold.** Only the Regular weight is loaded, yet H1–H3 compute to `font-weight: 600`. The browser is smearing the outlines to fake a bold. At 50–70px this thickens Lyon's hairlines and clogs its counters — the exact refinement you paid for is being destroyed. Premium brands never ship synthesized weights. **Fix:** license and load true Medium/Bold cuts of Lyon Arabic Display (verify available weights with Commercial Type), and add `font-synthesis: none` so this can never silently recur.
2. **Letter-spacing is breaking Arabic script.** The codebase has 126× `tracking-tight`, 39× `tracking-wide` and ~25 custom `tracking-[0.14–0.28em]` with no RTL reset. Arabic is a connected script — tracking doesn't "air it out", it **tears the joins**. It is visible on the single most important object in the product: on the Cat ID card, «رقم الهوية» and «هوية رسمية» render as disconnected letters (ر ق م  ا ل ه و ي ة). Footer column titles carry 2.16px tracking; H1s carry −1.26px which crushes joins instead. **Fix:** `[dir="rtl"] * { letter-spacing: 0 !important }` as a global floor, then express Arabic emphasis through weight, size and kashida-free width — never tracking.
3. **A display face is doing body-text work.** Lyon Arabic *Display* has high contrast and tight apertures designed for ≥28px. At 12–14px (nav, card body, captions, FAQ, footer) it turns grey, spindly and slightly "newspaper". This is the main reason inner pages feel thin and cheap even though the headline face is excellent. **Fix:** a dedicated text/UI Arabic companion (see system below).
4. **Three Arabic faces on one 530px card.** The Cat ID shows Lyon (labels), a heavy fallback sans (the name «قطك»), and mono-with-tracking (the micro labels). The soul of the product is the least typographically disciplined object on the site.

### Other observations
- **Numerals are inconsistent inside single components.** Home: «أول ١٠٠٠ قط … دفعة الرياض ٢٠٢٦» next to «رقم 86» and «70 قط». Feeding tool: six tiles in Western digits and one («٢٠٢٫٣٥ ر.س») in Arabic-Indic. Pick one. Recommendation: **Western digits everywhere in product UI** (matches Saudi banks, Absher, STC — it is the contemporary Saudi convention and keeps serials unambiguous); Arabic-Indic reserved for large editorial set-pieces only, and only in a face that draws them beautifully.
- **Scale is timid.** Desktop H1 ≈ 70px, H2 38px, H3 24px, body 16, captions 12. The ratio between the biggest and smallest type is ~6×. Fashion/hospitality brands run 12–20×. Nothing on the site is *big*.
- **Everything is centred.** Centre-aligned Arabic H2 + centred grey sub-line + centred pill is the section template on every page. Centred type is the default of templates; right-anchored, ragged-left Arabic with a strong margin is the default of editorial design.
- **Buttons**: pill + gradient orange + arrow icon. The gradient and the 9999px radius are the two most "app-store" signals on the page.
- **Fraunces** is the signature font of the 2020–23 DTC wave (soft, wonky, friendly). It is a trend marker, and it has no designed relationship with Lyon Arabic.
- **Inter** is the single most recognisable "SaaS" typeface in the world. All your numbers — the most Moracat thing you own (serials, census count) — are set in it.
- **Page `<title>`** is English-first: "Moracat — The cat membership | مرقط" on an Arabic page.
- The tagline **«لِحياة قطّك كلّها» appears nowhere in the web app.** The brand's one line of poetry is not on the brand's website.

**Verdict:** currently reads *friendly-editorial, slightly generic*. It should read *premium, editorial, Saudi-contemporary*. It is one licence purchase, one companion face and one CSS rule away from that.

---

## 3. Colour

### What is there
- Emerald `hsl(166 91% 19%)` ≈ **#045D47** — correct, and handsome. Used for: footer, login button, the register panel, toggles. That's it.
- Ground: warm paper **#FBF8F4** + 5% grain. Good. Keep.
- Accent/CTA: orange **#F66B2D**, rendered as a vertical gradient pill. This is the colour of *every primary action on the site*.
- Decorative family: blush #FFB8BA, butter #FBEBBB, peach #FFDFC7, sage-blue #8AA4AE, leaf green, cream #F6E6D4 — used as full tile backgrounds, chips, the announcement bar, and section bands.

### Assessment
- **Emerald is the brand colour in name and the footer colour in practice.** Above the fold on Home there are ~2% emerald pixels (one small button) excluding the card. The colour a visitor associates with "click here" is orange. If someone described the site from memory they'd say "cream and orange with pastel boxes".
- **The pastel family is the single biggest driver of the "cute pet startup" read.** Blush pink + butter yellow + baby peach is the global nursery/kawaii palette. It is also culturally placeless — nothing about it says Riyadh.
- **Two greens, unmanaged.** Flat illustrations use a yellower leaf green (hsl 145) beside the blue-leaning emerald (hsl 166). On the footer the sprig and the ground visibly disagree.
- **The card's deep emerald gradient (#0E4A3B → #04211A) is the most expensive-looking colour on the site** and appears exactly once.
- Peach announcement bar + cream section band + paper ground = three near-identical warm off-whites stacked. They read as indecision rather than hierarchy.

### Refined palette (emerald untouched)

| Token | Value | Use |
|---|---|---|
| **Primary / CTA** — Emerald | `#045B46` | all primary buttons, links, active states, full-bleed chapters |
| Emerald Deep | `#03261E` | hero grounds, dark theme base, card field |
| Emerald Mist | `#E8EFEB` | the only tinted surface allowed (replaces blush/butter/peach tiles) |
| **Background** — Paper | `#FAF7F2` | page ground (keep grain) |
| **Surface** | `#FFFDF9` | cards, inputs |
| **Secondary** — Plaster | `#E7DFD2` | section bands, dividers, muted chips (replaces cream/peach) |
| **Text** — Ink | `#0B1E19` | unchanged |
| **Muted** text | `#5B6B65` | unchanged family, keep ≥4.5:1 |
| **Accent** — Seal Copper | `#B5532A` | the paw seal, the marker underline, one highlight per screen. Never a button fill. |
| Signal (alerts only) | existing success/warn/destructive | unchanged |

Rules: (1) **Emerald is the action colour.** Orange stops being a button. (2) Copper replaces tangerine — it's the same warmth pulled toward clay/henna/copper dallah metal, it bridges to the existing copper-metal mouse, and it stops fighting the emerald. (3) Blush, butter, peach, sage are **retired as UI surfaces**; they may survive only *inside* illustrations. (4) No gradients on controls. (5) One emerald full-bleed chapter per long page, minimum — the brand colour must be *experienced*, not just clicked.

---

## 4. Layout & composition

**The one template.** Almost every section on every page is: centred eyebrow chip → centred H2 → centred grey line → a grid of equal white rounded-2xl cards with 1px border → generous blank → repeat. Counted in source: 320× `rounded-xl`, 214× `rounded-full`, 153× `rounded-2xl`. Cards contain pills which contain icons in circles. This is the shadcn/Tailwind default aesthetic; it is the most recognisable "AI/SaaS-assembled" look on the web in 2026, regardless of how carefully it was built.

Specifics:
- **Home hero**: two equal columns, type right, card left, each floating in haze with four stickers orbiting. Nothing bleeds, nothing overlaps, nothing is cropped, nothing is large. The card is ~385px wide on a 1440 canvas (27%). The protagonist is small.
- **Home pillars**: a 2×4 zig-zag of text-tile / pastel-picture-tile. The picture tiles are ~600×290 coloured rectangles with a ~120px illustration centred in them — i.e. 85% empty pastel. This is the weakest composition on the site and it sits directly under the hero.
- **"العدّ بدأ"** — the census is the best idea on the site and it is presented as a centred paragraph and a small white card. The *number* — the thing that makes a census a census — is an 11px pill reading "70" in the hero.
- **Adopt and Lost & Found are the same page** with the nouns swapped: pink cat, H1, two pills, search, filter pills, dashed empty box, orange heart. Identical skeletons for an aspirational act (adoption) and an emergency (lost cat) means neither has an emotional register.
- **Feeding tool**: a pure SaaS dashboard — stat tiles with circle icons, segmented controls, steppers, progress bar. Competent, anonymous.
- **Empty pages ship empty**: `/blog` renders a title and ~600px of nothing; `/products` is a single card. Blank is not minimal; minimal is composed.
- **Section transitions** are hairline + tint change only. There is no rhythm of scale (big/quiet/big), no chapter breaks, no full-bleed moments until the footer.
- **Register** is the exception and the proof: a 45% emerald panel, metal cat, paper-colour Lyon headline. Hard edge, two materials, one object, real colour. **This is what the whole site should feel like.**

### More distinctive compositions
- **Right-anchored editorial grid.** 12 columns; Arabic headlines hang from the right margin, ragged-left, spanning 7–8 cols; supporting text in a narrow 4-col measure; imagery bleeds off the *left* edge. Asymmetry that is native to RTL is something no Western template gives you for free.
- **Ledger, not cards.** Moracat is a *register*. Present lists (benefits, FAQ, steps, partners, latest registrations) as ruled ledger rows — hairline rules, mono serial in the first column, Lyon in the second, no boxes. It is more premium, more distinctive, and conceptually on-brand.
- **One radius, derived from the card.** ID-1 cards have a 3.18mm corner on 85.6mm (≈3.7%). Make that the brand's only curvature: ~12px on cards, ~10px on buttons and inputs. Retire the pill as the default shape; keep `rounded-full` for avatars and the seal only.
- **Scale contrast.** One element per viewport should be uncomfortably large: a 160px census numeral, a card at 60% viewport width cropped by the fold, a cat's face at full-bleed.
- **Emerald chapters.** Alternate paper chapters with full-bleed Emerald Deep chapters (census, membership, footer). Dark emerald + paper type + metal object is already your most premium combination.

---

## 5. Imagery

**Current state: there is no imagery system.** The only photographs on the site are member-uploaded phone pictures on `/community` — warm, real, charming, and completely untreated (mixed crops, colour casts, 1:1 tiles with a like-counter bubble). Everywhere else, illustration substitutes for photography. No products, no homes, no people, no hands, no Saudi interiors, no box.

This is the largest single gap between Moracat and any premium lifestyle brand. Aesop, Loro Piana, Le Labo, Kinfolk-era DTC, Bateel, The Chedi — every one of them is recognisable from *a photograph with the logo cropped out*. Moracat has no photograph.

### Recommended direction: **"Official Portrait" + "Majlis Level"**

Two complementary modes, both ownable:

1. **The Official Portrait (studio, signature).** Cats photographed the way a state photographs its citizens: frontal or strict ¾, eye-level, direct gaze, single hard key light with a real shadow, seamless backdrop in **Emerald Deep, Plaster, or Paper** only. No props, no toys, no tongue-out cuteness. Dignified, slightly mysterious, a little funny *because* it's so serious. Every portrait is composited into the ID band (see §9). This is *minimal studio × editorial*, and it is conceptually welded to the product — a competitor can copy a pastel palette in a day; they cannot copy "the national portrait archive of Saudi cats".
2. **Majlis Level (lifestyle, documentary).** Saudi domestic life happens low — floor seating, rugs, cushions, low tables, trays — which is *exactly a cat's altitude*. Shoot at 30–40cm camera height in real contemporary Saudi homes: terrazzo and limestone floors, plaster walls, deep window reveals with hard afternoon light and long shadows, a corner of a sadu-weave cushion or a dallah tray *out of focus at the frame edge*, a hem of a thobe or abaya passing, hands only — never posed faces. Natural light only, 35–50mm, warm-neutral grade, shadows allowed to go green-black. This is *documentary × architectural*: Saudi by light, material and altitude, never by ornament.

Not recommended: playful (that's every pet brand), glossy luxury lifestyle (reads imported/fake), cinematic teal-orange (dated), stock photography of any kind (fatal).

**Treatment for UGC (community):** you can't art-direct uploads, so art-direct the *frame*: 4:5 crop, the ID band overlaid at the bottom with the cat's real serial, subtle unified tone curve, like-counter removed from the image. The frame makes amateur photos look like an archive.

---

## 6. 3D visual language

**What exists:** 12 × 1024px cut-out WebPs of seven characters; *plush* (light theme) and *metal* (dark theme).

**Honest read:**
- **The emerald metal set is excellent raw material.** Satin-anodised green with gunmetal details, embossed whiskers, a little Koons, a little Bearbrick, a little incense-burner. On the emerald register panel it is the most premium pixel cluster on the site. It is collectible-object language, which is lifestyle/fashion language.
- **The plush set is the problem.** A pink felt egg-cat with a ‿ smile and blush-pink toe beans is a nursery toy. It appears as the hero object on Benefits, Community, Adopt and Lost & Found — it is, de facto, the brand mascot, and it's the most "cute pet brand" element in the entire system. On `/lost-found` a smiling pink toy presides over a page for people whose cat is missing. That is a tonal failure, not just an aesthetic one.
- **The set is not one set.** The can is a photoreal macro of woven linen with visible thread; the cat is smooth felt with a different stitch logic; the paw is a beige soap-like form. Different implied lens, different texture scale, different stitch language, different proportions. They read as separately generated images, not as one artist's scene. Premium 3D identities (Apple Wallet-era Revolut, Nothing, Arc) are consistent to the point of obsession.
- **Technical:** 1024px sources with soft matte edges, no contact shadow of their own (a CSS drop-shadow approximates one), no shared ground plane, no consistent light direction between plush and metal. At hero scale on retina they will soften. There are gaps (no plush leaf, no metal fish/paw), which is why flat stickers get mixed in.

**Should 3D be a major part of the identity? Yes — the metal, not the plush — and rebuilt as one authored kit.**

### Direction
- **Materials (three only):** (1) satin-anodised **emerald metal**; (2) brushed **copper** for the single accent object (mouse/seal); (3) **unglazed limestone/plaster** for plinths, grounds and secondary objects. Optional fourth for warmth: **dense emerald wool felt** with tone-on-tone stitching — a grown-up replacement for plush. **No pink. No faces with smiles** — eyes and nose only; expression comes from posture. That one change moves the cat from "toy" to "talisman".
- **Lighting:** one hard key, upper-**right** (light enters from where Arabic reading begins), ~45° elevation, plus a very low fill. Long, soft-edged, *real* cast shadow on the ground — Saudi afternoon sun, not softbox studio. Same rig for every object, forever.
- **Camera:** 85mm-equivalent, ~8–10° above horizon, strict front or 30° ¾. Never top-down, never wide-angle.
- **Proportion:** one shared unit — all objects fit a common bounding cylinder so they can stand in a row like chess pieces. Squat, heavy, low centre of gravity (the current cat's egg form is right).
- **Ground:** objects always *stand on something* — a paper ground with true shadow, or a limestone plinth on Emerald Deep. Never floating, never on pastel.
- **Production:** one 3D artist, one Blender/C4D scene, exported at ≥3000px with alpha *and* baked shadow pass, plus a 12-frame turntable for subtle motion. This is a ~2-week commission and it becomes packaging, OOH, app icon, merch and retail display for years.

**Use 3D for:** the hero object of a chapter, empty states, onboarding ceremony, campaign key visuals, packaging, physical collectibles (the metal cat as a real desk object for founding members is a PR story by itself).
**Never use 3D for:** feature-row icons, anything <120px, distress contexts (lost cat, errors involving money, medical), the vet portal, more than one per viewport.

---

## 7. Saudi identity

**What is Saudi about the site today?** One thing, and it's real: **the voice.** «وش تعني العضوية؟», «إحنا نعدّهم، قط قط», «أسئلة تسألونها كثير», «لا سمح الله». White-Najdi dialect, written with confidence. That is a genuine cultural signal and it's better than any pattern. Second, partially: the *concept* of a national census — civic, institutional, very current-Saudi in spirit. Visually, however, the site is placeless. Swap the text to Korean and nothing looks wrong.

**Subtle signals to build (no patterns, no palms, no falcons):**
- **Light.** Hard sun, deep shadow, long afternoon rakes. The Gulf's defining visual condition. Put it in photography and in 3D lighting. Pastel haze gradients are the opposite of this light.
- **Material.** Plaster, limestone, terrazzo, sand-coloured stone, anodised metal, copper. The palette in §3 is drawn from these, not from a sticker sheet.
- **Architecture as composition.** Najdi building is about *mass and aperture*: thick plain walls, small deep openings, strong horizontal bands. Translate that into layout: large plain fields, small precise apertures of content, the horizontal ID band. The reference is Diriyah/KAFD restraint, not ornament.
- **Altitude.** Majlis-level photography (§5). Nobody else in pet care has a culturally-specific camera height.
- **Typography.** Arabic genuinely leading; consider a Saudi-made companion face (e.g. evaluate Thmanyah's type family — confirm licence terms) so even the body text has provenance.
- **Civic design language.** Saudi residents live inside beautifully-made official digital artefacts (Absher, Tawakkalna, national ID, Nafath). The Cat ID riffs on that. Lean in: serials, batch names («دفعة الرياض ٢٠٢٦»), Hijri + Gregorian dates on the card, city codes. It's affectionate parody of officialdom — deeply local humour, zero clichés.
- **Naming.** Name plans, batches, colours and objects in Arabic first with meaning (مرقّط itself is a gift). "Emerald Deep" should have an Arabic name in the guidelines before it has an English one.
- **Restraint with green.** Emerald on paper with copper is *not* the flag; saturated green + white would be. Keep emerald deep and blue-leaning, as now.

---

## 8. Premium perception

| Against… | Where Moracat falls short |
|---|---|
| **Premium fashion** | No photography; no scale drama; faux-bold type; pastel palette; pill buttons with gradients. |
| **Premium hospitality** (Aman, Bateel, Six Senses) | No materiality or light; nothing feels *made of* anything; emoji in headings. |
| **Premium lifestyle/DTC** (Aesop, Le Labo, Wild One, Maxbone) | No product or packaging imagery; mascot is a toy; brand colour under-used. |
| **Modern Saudi startups** (Salla, Tamara, Jahez, Thmanyah) | Moracat is *on par or better* in craft and voice. It looks like a good Saudi startup. That is precisely the ceiling to break. |

**What stops it reading as a SAR 500M brand, in order of damage:**
1. No photography, no real cat, no physical product anywhere.
2. Pastel-kawaii colour and the pink plush mascot.
3. Cards-and-pills template composition; everything centred; nothing large.
4. Typographic errors on Arabic (faux bold, torn joins, display face at text sizes).
5. Four illustration tiers + emoji = visual noise and inconsistency.
6. Emerald absent above the fold; orange gradient pills as the action colour.
7. Visible defects: About H1 collision, empty Blog, mixed numerals, 409px raster logo, English-first title.
8. Decoration as filler: floating stickers, paw trails, marquee, haze blobs — motion and ornament standing in for content.

**Changes that raise perceived value fastest:** real weights of Lyon; kill tracking on Arabic; emerald CTAs; delete the pastel tiles; one emerald full-bleed hero with a real cat inside a large ID card; SVG logo; remove emoji; remove 70% of stickers.

---

## 9. Distinctive brand assets — ranked by how hard they are to copy

1. **The ID Band (الشريط).** The paper strip at the bottom of the Cat ID — perforation line, mono serial, seal. Promote it from a card detail to *the* brand framing device: every cat photo, community tile, ad, story, box label, invoice and email header sits above the same band with a real serial. Logo-off recognition solved. Uncopyable because the serials are real.
2. **The Official Portrait.** A growing archive of Saudi cats shot like citizens. Campaign-ready, PR-ready, exhibition-ready («وجوه مرقّط»).
3. **The Serial as typography.** `MRC-2K9F-7YQ3` set large, as a graphic. A custom monospaced numeral set (even just 0–9, A–Z, hyphen) drawn to sit with Lyon would be a proprietary asset for ~1 week of a type designer's time.
4. **The Census Number.** A live, giant, always-visible count — «٧٠ قطّاً وما زلنا نعدّ». Branded data viz: one number, treated monumentally. Becomes OOH: just the number and the band.
5. **The Emerald Object family.** Metal cat + six companions, one rig. Also physical.
6. **The Seal.** The copper paw stamp as the single accent — approvals, founding status, verified clinics, wax-seal on packaging. One seal, one colour, used sparingly like a hanko.
7. **Right-hung Arabic headlines with the marker stroke.** Keep the hand-drawn underline but make it *one* copper stroke, used once per page, always under the last word. A gesture, not a decoration.
8. **Ledger layouts.** Ruled rows with serial columns as the house list style.
9. **Majlis-level photography.** A culturally-specific camera height as a brand rule.
10. **The Guilloché.** The engraving pattern already on the card, used as the *only* permitted pattern (tissue paper, box interior, certificate backgrounds) — proprietary by construction, Saudi by association with official documents, not by motif.

---

## 10. Page-by-page

### Home `/`
- **Impression:** friendly, soft, competent; a Notion-template warmth. The card is the only memorable thing.
- **Works:** the question headline «كم قط يعيش في السعودية؟» (great line, great face); the card's emerald/paper split and serial; dialect copy; paper + grain ground; the single-field "what's your cat's name?" entry.
- **Weak:** card is small and features a placeholder instead of a cat; four orbiting stickers; haze blobs; the "70" census count is an 11px pill; orange gradient pill CTA; pillar grid (85%-empty pastel tiles, mixed flat/3D, English "CAT FOOD"); marquee.
- **Generic:** centred H2 sections, FAQ accordion card, final CTA card with plush heart and corner stickers.
- **Change:** Full-bleed **Emerald Deep hero**. Card at ~55–60% viewport width, rotated ~6°, cropped by the fold, containing a **real official cat portrait** and a real serial. Headline in Paper, 110–128px, right-hung, true Bold. The census count as a 160px numeral beside it. Emerald→paper input + solid paper/emerald button (no gradient, 10px radius). Delete stickers, haze, paw trail. Replace marquee with a **live ledger ticker** of latest registrations (`MRC-… · لوسي · الرياض`). Replace the 2×4 pillar grid with **three ledger rows** + one large photograph. Turn «العدّ بدأ» into an emerald chapter built around the number and the founding-batch seal. Put the tagline «لِحياة قطّك كلّها» in the closing chapter, large, alone.

### Benefits `/benefits`
- **Impression:** SaaS "how it works" page. Three numbered icon cards, a dashed empty box with the pink cat, a CTA card.
- **Works:** honest copy about partners not yet signed.
- **Weak/generic:** icon-in-circle step cards; an empty state as the main content of the page; pink mascot.
- **Change:** Reframe as **"what the ID opens"** — a large card on the right, and ledger rows of partner *categories* hanging off it with the seal marking "founding partner — soon". No dashed box; show the honest state as a ruled list with «قريباً» in mono. No 3D here.

### Community `/community`
- **Impression:** the warmest page because it has real cats; visually a generic photo-grid with filter pills.
- **Works:** real animals, real names («مارلي القحطاني» is wonderful).
- **Weak:** tiny plush cat floating bottom-left of the hero for no reason; like-bubble on every photo; 1:1 crops; eight filter pills in a row; double header (H1 then another centred H2 saying nearly the same thing).
- **Change:** Make this **the archive**. 4:5 tiles, each with the ID band + real serial beneath the photo; name in Lyon, city in mono. Remove the second header and the plush. Filters collapse into one ledger-style control row. Feature one "portrait of the week" at 2×2 scale to break the grid.

### Adopt `/adopt` and Lost & Found `/lost-found`
- **Impression:** the same template twice; five 3D objects on Adopt; a smiling toy on a missing-cat page.
- **Change (Adopt):** warm, hopeful, photographic — lead with portraits of waiting cats; empty state is typographic («ما في قط ينتظر بيت اليوم») with no heart render and no 🎉. Remove 3D feature icons; use ledger rows.
- **Change (Lost & Found):** its own sober register — no mascot, no stickers, no orange. Emerald Deep header, clear two-action split, high-legibility sans for all content, the *poster* as the visual unit (photo + band + serial + last-seen district). This is the page people screenshot into WhatsApp groups; design the poster, not the page.

### Feeding tool `/tools/feeding`
- **Impression:** clean SaaS calculator. Title even says "محرك" (engine).
- **Weak:** stat-tile grid with circle icons; mixed numeral systems; floating can sticker.
- **Change:** Present the result as a **prescription slip / ration card** — one paper document with ruled rows, big mono numerals, the cat's name at top, band at bottom, printable/shareable. Inputs become a quiet right-hand column. Same function, but now it's a Moracat artefact instead of a dashboard.

### About `/about`
- **Impression:** weakest page visually. Live overlap bug on the H1; emoji as heading icons beside line icons; two generic card grids of check-lists.
- **Change:** fix the collision today. Then rebuild as an **editorial essay**: one full-bleed photograph, a right-hung manifesto in large Lyon (3–4 short paragraphs), the founder's note signed, the emerald object once, the tagline. Zero cards, zero checkmarks, zero emoji.

### Blog `/blog`
- **Impression:** title + void.
- **Change:** never ship empty. Until there are posts, show a composed "first issue coming" cover. When populated: magazine index — one lead story with large image, then a ruled list with issue numbers in mono. Article pages need the text companion face and a 62–68 character measure.

### Products `/products`
- **Impression:** a "coming soon" card with the orange linen can.
- **Works:** «نجهّز متجرنا بهدوء» is a lovely, confident line.
- **Change:** let the line be the page: huge right-hung headline on Plaster, one object on a plinth with a real shadow, one sentence, one emerald button. No pill chip, no floating fish.

### Register / Login
- **Impression:** **best page on the site.** Emerald half, metal cat, paper headline.
- **Weak:** the form half is haze-gradient + pills + orange gradient button; stickers orbit the metal cat and cheapen it; the cookie bar collides with the form.
- **Change:** remove the four stickers; give the cat a ground shadow/plinth; form on flat Paper with 10px-radius fields and an emerald button. This page is the prototype for the whole redesign.

### Contact `/contact`
- **Impression:** tidy and thin — four pill cards of Latin text.
- **Change:** ledger rows; Riyadh/Jeddah set large in Lyon; one line of voice. Small effort, consistent finish.

### Vet portal entry `/vet`
- **Impression:** unstyled utility login with an orange gradient button.
- **Change:** appropriately sober — but it should feel like the *institutional* face of the brand: emerald header band, seal, no orange. Clinics are judging whether you are a serious partner.

### Cat ID card (component)
- **Works:** proportions, emerald/paper split, perforation, serial, guilloché. This is the brand.
- **Weak:** torn Arabic micro-labels (tracking), three Arabic faces, generic paw placeholder in the homepage preview, the word «معاينة» floating top-left.
- **Change:** one Arabic display + one Arabic text face, zero tracking; true Bold for the name; Hijri/Gregorian issue date; batch line; the copper seal given room. In marketing contexts, *always* show it with a real cat.

### Portal (not pixel-reviewed)
From source only: a green "clubhouse" rail and a glass bottom pill nav. Apply the same rules — emerald actions, one radius, ledger lists, no pastel tiles — and re-audit visually once a session is available.

---

## 11. Scorecard

| Category | Score | Why |
|---|---|---|
| Brand distinctiveness | **5** | The Cat ID and census concept are truly distinctive; everything around them is category-generic. |
| Premium perception | **5** | Careful craft, but pastel + pills + toy mascot + no photography cap it at "good startup". |
| Typography | **4** | Excellent headline face undermined by faux bold, tracking that tears Arabic, a display cut at 12px, mixed numerals, three faces on the card. |
| Colour | **6** | Emerald, ink and paper are right. The pastel family and orange-as-CTA dilute it; emerald is under-experienced. |
| Layout | **5** | Clean, consistent, fully predictable. One template repeated; everything centred. |
| Composition | **4** | No scale contrast, no bleed, no crop, no overlap (except the accidental one on About). Pastel tiles are 85% empty. |
| Imagery | **2** | There is none beyond untreated UGC. No cat on the homepage of a cat brand. |
| 3D design | **5** | Metal emerald = 8 in potential. Plush pink = 3. Inconsistent set, low-res, floating, over-used against the project's own rule. |
| Arabic design | **6** | Genuinely Arabic-first, RTL-native, great dialect voice — marked down for real script-handling errors and English inside illustrations. |
| Saudi identity | **4** | Carried entirely by copy and concept. Visually placeless. |
| Visual consistency | **5** | Tokens are consistent; illustration tiers, numerals, wordmarks and tone are not. |
| Art direction | **5** | A kit, not a point of view. No light, material, or photographic stance. |
| Memorability | **5** | People will remember "my cat got an ID card". They will not remember what the site looked like. |
| Marketing potential | **7** | Very high latent potential — ID, census, serials, portraits, metal object are all campaign engines — barely exploited yet. |

No single headline number is offered on purpose: the spread (2 → 7) *is* the finding. The ideas outscore the execution by a wide margin, which is the good way round.

---

# Moracat Visual Art Direction 2.0 — «السجل» (The Register)

**Premise.** Moracat is the register of Saudi cats. Everything visual descends from the dignity — and gentle humour — of an official document made with extraordinary care.

### Visual personality
**Dignified · Warm · Exact · Quietly witty · Material · Najdi-calm.** (Drop: cute, playful, bubbly.)

### Typography
| Level | Arabic | Latin | Spec |
|---|---|---|---|
| Display XL (hero, numerals) | Lyon Arabic Display **Bold** (true cut) | Lyon Display / keep logo lettering for wordmark only | 96–128px desktop / 44–56 mobile, lh 1.05, tracking 0 |
| H2 | Lyon Arabic Display Medium | — | 48–56 / 32, lh 1.15 |
| H3 | Lyon Arabic Display Medium | — | 28–32 / 22 |
| Body / UI / nav / buttons | **Arabic text sans** — first choice Graphik Arabic (same foundry as Lyon, designed to pair); zero-cost option IBM Plex Sans Arabic (already pairs with your Plex Mono); evaluate Thmanyah Sans for Saudi provenance | Graphik or Plex Sans (retire Inter) | 17px body lh 1.8; 15px UI; **never below 13px Arabic** |
| Data / serials | — | IBM Plex Mono (later: custom MRC numerals) | Latin + Western digits only. **Never applied to Arabic.** |

Rules: `font-synthesis: none`. Arabic `letter-spacing: 0` always. Western digits in UI; Arabic-Indic only in Display XL set-pieces. Right-hung, ragged-left by default; centre only for ceremony (ID reveal). Retire Fraunces. Arabic page titles Arabic-first.

### Colour
As §3: Emerald `#045B46` (action), Emerald Deep `#03261E`, Emerald Mist `#E8EFEB`, Paper `#FAF7F2`, Surface `#FFFDF9`, Plaster `#E7DFD2`, Ink `#0B1E19`, Muted `#5B6B65`, Seal Copper `#B5532A`. Proportions per page ≈ 60 paper / 25 emerald / 10 ink / 4 plaster / **1 copper**.

### Photography
Official Portrait (studio; emerald/plaster/paper seamless; hard single key; direct gaze; no props) + Majlis Level (30–40cm camera; real Saudi homes; natural hard light; hands and hems, not faces; stone, plaster, textile at frame edge). Warm-neutral grade, deep green-black shadows, no filters, no stock, ever. First shoot: 2 days, 12–15 founding-member cats in Riyadh — that single shoot supplies the homepage, ads, stories and press for six months.

### 3D
One authored kit. Satin emerald metal / brushed copper / limestone (+ optional emerald felt). No pink, no smiles. Hard key upper-right, real cast shadow, 85mm, 8–10° elevation, shared bounding unit, always grounded on paper or plinth. ≥3000px + shadow pass + turntable. One per viewport, ≥160px, never as icon, never in distress contexts.

### Graphic elements
(1) **The ID Band** — perforation + mono serial + seal, under every image. (2) **The Seal** — copper paw, once per view at most. (3) **The Serial** as large type. (4) **Hairline ledger rules** instead of boxes. (5) **The guilloché** as the only pattern. (6) **One copper marker stroke** per page. Retired: floating stickers, paw trails, haze blobs, pastel tiles, emoji, marquee of benefits, gradient buttons, dashed "empty" boxes. The flat sticker family survives only in genuinely playful, low-stakes moments inside the portal (celebrations, streaks) — never in marketing surfaces.

### Layout
12-col, right-anchored. Alternating **paper chapters** and **emerald chapters**. One oversized element per viewport. Lists as ledgers. One radius (~12px cards / ~10px controls) derived from the card. Imagery bleeds left. Section padding 160px desktop / 88px mobile, but *filled with scale*, not emptiness. Mobile: the band becomes the sticky bottom CTA — the page literally sits on the ID strip.

### Motion
**Stamped, not bouncy.** Retire spring overshoot (`--ease-spring`) from marketing surfaces. Vocabulary: a serial *printing* glyph-by-glyph (keep — it's perfect); a seal *pressing* (scale 1.08→1, 140ms, slight opacity ink-spread); the card's single light sweep (keep); numerals *ticking* like a mechanical counter; chapter transitions as slow 600–800ms fades with 12px travel. Nothing floats, nothing loops idly. Reduced-motion fully respected.

### Arabic ↔ English
Arabic is the master artwork; English is a quiet caption. In lockups: Arabic 1.6–2× the optical size of Latin, Latin in the text sans, small caps feel, set beneath or to the left. On the English locale, keep Arabic present as a graphic (serial labels, the wordmark, the tagline) — the brand is bilingual, never translated. No English inside illustrations or renders.

### Brand signature
**The Band.** A strip of warm paper, a perforated edge, a serial number in mono, a copper seal — under a cat looking straight at you from an emerald field. If a viewer sees only that strip at the bottom of a billboard, a box, or a story, they know it's Moracat.

---

# Redesign priorities

### MUST CHANGE
1. Load true Lyon weights; `font-synthesis: none`; zero letter-spacing on Arabic (fixes the torn labels on the Cat ID).
2. Add an Arabic text/UI companion face; stop using the Display cut below ~24px.
3. Emerald becomes the CTA colour; orange gradient pills retired; copper as seal-only accent.
4. Retire blush/butter/peach/sage as surfaces; delete the homepage pastel pillar grid.
5. Commission the first Official Portrait shoot; put a real cat in the hero card.
6. Rebuild Home hero as an emerald full-bleed chapter with the large card + monumental census number.
7. Retire the pink plush as mascot; metal emerald becomes the 3D tier in both themes; enforce one-per-viewport.
8. Remove emoji, floating stickers, haze blobs and the paw trail from all marketing pages.
9. Fix live defects: About H1 collision, empty Blog, mixed numerals, English-first `<title>`, raster 409px logo → SVG, footer wordmark ≠ logo.
10. Give Lost & Found its own sober visual register.

### SHOULD CHANGE
- ID Band as universal image frame (community tiles first).
- Ledger rows replace card grids on Benefits, Contact, FAQ, Adopt info.
- One radius system; pills only for avatars/seal.
- Right-hung editorial alignment; larger type scale.
- Feeding tool result as a "ration card" artefact.
- About as an editorial essay; tagline placed on Home and About.
- Commission the unified 3D kit (one artist, one rig, hi-res, shadow pass).
- Replace Inter/Fraunces with the Latin partners of the chosen Arabic faces.

### NICE TO HAVE
- Custom MRC monospaced numerals/letters for serials.
- Physical metal cat for founding members.
- Hijri + Gregorian dates and batch line on the card.
- Live registration ticker; "portrait of the week".
- Guilloché tissue/box-interior; wax-style copper seal on packaging.
- Arabic names for every colour and object in the guidelines.

### DO NOT CHANGE
- **The Cat ID card concept and structure** (emerald field, paper band, perforation, mono serial, guilloché, ID-1 ratio).
- **Emerald `#045B46`, Ink, Paper ground + grain.**
- **Lyon Arabic Display for headlines.**
- **The dialect voice** and lines like «كم قط يعيش في السعودية؟», «نجهّز متجرنا بهدوء», «إحنا نعدّهم، قط قط».
- **The census concept** and founding-batch framing.
- **The custom مرقط / Moracat lettering** (redraw as vector, don't redesign).
- **The register-page composition** (emerald half + metal object).
- **The ID-number "printing" ceremony and the card's single light sweep.**
- Arabic-first, RTL-native construction.

---

# Final deliverable

### 1. Top 10 visual problems
1. No photography; no real cat on a cat brand's homepage.
2. Pastel-kawaii palette + pink plush mascot define the first impression.
3. Faux-bold Arabic headlines (single Regular weight at 600).
4. Letter-spacing tearing Arabic script — on the Cat ID itself.
5. Display typeface used for 12–14px body/UI.
6. Emerald nearly absent above the fold; orange gradient pills are the action colour.
7. One centred cards-and-pills template on every page; no scale, bleed or asymmetry.
8. Four illustration tiers + emoji; 3D set internally inconsistent and over-used.
9. Visually placeless — Saudi only in the copy.
10. Visible finish defects (About overlap, empty Blog, mixed numerals, raster logo, two wordmarks, English in art, English-first title, missing tagline).

### 2. Top 10 visual opportunities
1. The ID Band as universal signature. 2. The Official Portrait archive. 3. The monumental census number. 4. The emerald metal object family (digital + physical). 5. Serials as typography / custom numerals. 6. The copper seal. 7. Emerald full-bleed chapters. 8. Right-hung RTL editorial grid + ledger lists. 9. Majlis-level documentary photography. 10. Guilloché as the sole proprietary pattern.

### 3. Moracat Visual Identity 2.0
«السجل» — the register of Saudi cats: emerald, paper, copper; a dignified portrait above a perforated serial band; Arabic set large and hung from the right; one grounded metal object; hard Saudi light; nothing floats, nothing is pink, nothing is there to fill space.

### 4. Recommended design system
Tokens per §3; one radius from the card; ledger row, band-framed image, chapter (paper/emerald), seal, serial, document (ration card, certificate, poster) as the core components; pills and bordered feature cards demoted to portal utility; 3D and sticker usage rules enforced in lint/review; amend `DESIGN-AUTHORITY.md` "Illustration tiers" and colour sections accordingly.

### 5. Recommended photography direction
Official Portrait + Majlis Level, as specified in §5 and AD 2.0. Hard light, real shadow, emerald/plaster/paper grounds, 30–40cm lifestyle altitude, real Saudi interiors, hands not faces, no stock.

### 6. Recommended 3D direction
Single authored kit; satin emerald metal, brushed copper, limestone (+ emerald felt); no pink, no smiles; key light upper-right; 85mm; grounded with true shadows; ≥3000px; one per viewport; never as icons or in distress contexts.

### 7. Recommended typography system
Lyon Arabic Display (true Medium/Bold) for display; a dedicated Arabic text sans for everything ≤24px with its matched Latin; Plex Mono (→ custom) for Latin serials only; zero Arabic tracking; no synthesis; Western digits in UI; 12–20× scale range; right-hung alignment.

### 8. Recommended colour system
Emerald `#045B46` · Emerald Deep `#03261E` · Emerald Mist `#E8EFEB` · Paper `#FAF7F2` · Surface `#FFFDF9` · Plaster `#E7DFD2` · Ink `#0B1E19` · Muted `#5B6B65` · Seal Copper `#B5532A`. Emerald is action; copper ≤1%; pastels retired from UI. Verify AA on every text/ground pair during implementation.

### 9. Recommended page composition
Open on an emerald chapter with one oversized subject → paper chapter of right-hung editorial text + one bleeding photograph → ledger of facts → emerald chapter built on one number or one object → quiet paper close with a single line and one emerald button → footer with the *real* wordmark. One large thing per viewport; at most one 3D object; at most one copper mark.

### 10. Prioritised roadmap
| Phase | Time | Work | Effect |
|---|---|---|---|
| **0 — Stop the bleeding** | 2–3 days, code only | Arabic tracking reset; `font-synthesis:none`; fix About overlap; unify numerals; SVG logo + same wordmark in footer; remove emoji; Arabic-first titles; hide/compose empty Blog; drop plush from Lost & Found | Removes every "cheap" tell at zero design cost |
| **1 — Re-key the system** | 1–2 weeks | License Lyon weights + text companion; emerald CTAs; copper accent; retire pastel surfaces; one radius; strip stickers/haze/marquee from marketing pages; tagline placed | Site shifts from "cute startup" to "calm, serious, emerald" |
| **2 — Make the pictures** | 2–4 weeks (parallel) | Official Portrait shoot (12–15 cats); first Majlis-level set; commission unified 3D kit | Supplies the assets everything else depends on |
| **3 — Recompose** | 3–4 weeks | New Home (emerald hero, big card + real cat, census numeral, ledger rows); Community as archive with ID Band; Register polish; Lost & Found poster system; About essay; Feeding "ration card" | The brand becomes recognisable logo-off |
| **4 — Extend** | ongoing | Custom serial numerals; physical metal cat; packaging with band/seal/guilloché; campaign system (number + band OOH; portrait stories); portal + dark-mode visual audit; amend DESIGN-AUTHORITY | Identity leaves the website and becomes a brand |

**Sequencing logic:** Phase 0 is free and embarrassing not to do. Phase 1 changes the feeling without new assets. Phase 2 is the long pole — start it on day one. Phase 3 should not begin until the first portraits exist, because the redesign is built around them.
