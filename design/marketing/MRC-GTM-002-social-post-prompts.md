# MRC-GTM-002 — Claude Design Prompts for Social Posts

> Copy-paste prompt library for generating Moracat social assets, phased against
> `MRC-GTM-001-go-to-market.md` §1 (launch phases) and §6 (social operating system).
> Every prompt is self-contained: paste **Block A (Brand System)** first, then the
> phase prompt. Constraints inherit from `design/DESIGN-AUTHORITY.md` —
> no coupon shouting (R085), no fake scarcity (R006), the cat is always the hero (R082).

---

## Block A — Brand System (prepend to every prompt)

```
You are designing social media assets for Moracat — a Saudi cat membership brand.
Moracat gives every cat an official identity (a "Cat ID"), then handles its care,
records, and member benefits. Arabic is the primary language and the layouts are
RTL-native; English is secondary and never dominant.

BRAND POSITIONING
- Master line: «لكل قط هوية» (Every cat has an identity)
- Conversion line: «قطك يستاهل عضوية» (Your cat deserves a membership)
- Playful line: «مواء واحد يكفي» (One meow is enough)
- The emotional hook is NOT "save money on cat stuff". It is "your cat is somebody now."

ART DIRECTION — "warm paper, flat stickers, editorial confidence"
- Ground: warm paper-white (#FAF7F1-ish), with a subtle film-grain texture overlay (~5%).
- Sticker accent palette (flat, matte, no gradients): cream, sage green, butter yellow,
  peach, blush pink, deep leaf green. Deep green is the primary brand color;
  a warm orange paw seal is the single bold accent. NO gold, NO luxury sheen, NO glassmorphism.
- Illustration: flat kawaii line-and-fill cats, paws, hearts, fish, sprigs — drawn as
  stickers with slight rotation, as if placed by hand. Restraint: 1–3 per composition, never a collage.
- Type: Arabic display in a high-contrast editorial serif-Arabic voice (Lyon Arabic Display
  character); Latin display in Fraunces; UI text in Inter; ID numbers always in a mono face
  (IBM Plex Mono). Numbers are set proudly and large — the number IS the design.
- Signature devices you may reuse: a hand-drawn marker underline under a key word;
  a perforated-ticket edge (dashed line + notch circles); a passport/ID-card motif
  (deep-green field + warm-paper bottom band holding the mono ID number and a QR block).

VOICE
- Warm, plain, never salesy. Never shout prices or discounts. Never invent urgency.
- Always name the cat. "Cat #347 is Lulu from Al-Malqa" — never a generic stock cat.
- Fixed lexicon: member, Cat ID, benefit. Never "user", "subscriber perk", "deal".

OUTPUT RULES FOR EVERY ASSET
- Deliver each post as a self-contained HTML/CSS artifact sized exactly to its format.
- Formats: Instagram feed 1080×1350, Story/TikTok/Snap 1080×1920, X/LinkedIn 1200×675.
- Provide the Arabic caption (Saudi dialect where playful, MSA where informational)
  plus an English translation line beneath, and 5–8 hashtags.
- Arabic text must be RTL with correct shaping; never mirror the Arabic glyphs.
- Every asset must be legible at thumbnail size: one idea, one focal point.
```

---

## Prompt 1 — Pre-Launch: "The Census" (Weeks −6 to 0)

**Goal:** 1,000 Cat IDs before the box ships. Zero selling. The count is the story.

```
[PASTE BLOCK A]

TASK: Design one week of pre-launch social posts (7 assets) for Moracat's Phase 0
campaign: «التعداد الوطني للقطط» — the Saudi Cat Census.

THE CAMPAIGN IDEA: Nobody knows how many cats live in Riyadh. Moracat is counting
them, one free Cat ID at a time. The first 1,000 IDs are permanently marked
"Founding Member — Riyadh Class of 2026" with real sequential low numbers.
There is nothing to buy yet. Registration is free and takes under two minutes.

HARD RULES
- Do not mention prices, plans, boxes, or discounts anywhere. Nothing is for sale yet.
- Scarcity claims must be literally true: the ID numbers really are sequential.
  Never write "only X left" or a countdown timer.
- The single call to action across all seven: «سجّل قطك — مجانًا» (Register your cat — free).

THE SEVEN POSTS
1. FEED 1080×1350 — Manifesto post. Full-bleed warm paper, the line «لكل قط هوية»
   with a marker underline under «هوية», one flat sticker cat. Nothing else.
2. FEED 1080×1350 — The census counter. A single enormous mono number (e.g. 347)
   as the entire composition, with «قط مسجّل في الرياض» beneath. The number is the art.
3. FEED 1080×1350 — Founding cat portrait card. A photo frame slot (leave a labeled
   placeholder) with the cat's name and ID number set like a passport entry:
   «لولو · قط رقم ٠٠٠٣٤٧ · الملقا». Perforated-ticket edge.
4. STORY 1080×1920 — The Cat ID card reveal teaser: the deep-green ID card at a
   3D tilt, half-entering frame, mono number legible, QR block visible. Caption space at bottom.
5. STORY 1080×1920 — "How it works" in three stamped steps: name → photo → ID issued.
   Under two minutes. Numbered stamps, not icons-in-circles.
6. FEED 1080×1350 — Behind the build: a flat-illustration cross-section of the
   Moracat stand totem (oak top, brass plaque, NFC+QR tile) with the caption framing
   "we're building the places where cats get registered".
7. X/LINKEDIN 1200×675 — Founder builds-in-public card: this week's census number,
   one honest lesson, no logo dominance. Editorial, mostly type.

Also produce: a highlight-cover set (3 circular covers — العدّاد / المؤسسون / كيف أسجل)
and the exact Arabic caption + English gloss for each of the seven posts.
```

---

## Prompt 2 — Launch Week (Week 0, Riyadh)

**Goal:** synchronized reveal — subscriptions on, press embargo lifts, Founders' Majlis, first 100 boxes hand-delivered.

```
[PASTE BLOCK A]

TASK: Design Moracat's launch-week social kit (9 assets), day by day. This is one
city (Riyadh), one week, everything synchronized. The census has already registered
1,000+ cats; those founding members hear everything first.

DAY MAP
- Day 1 — THE REVEAL: memberships open. Founding members were emailed at 9am;
  the public post lands at 5pm. Members always first — say so.
- Day 2–3 — THE FOUNDERS' MAJLIS: invite-only evening for the first ~100 founding
  members, partner vets, and creators. Cats welcome. Portraits shot against a
  founders' wall listing cats #1–1000.
- Day 4–7 — THE 100 BOXES: the team hand-delivers the first 100 boxes in Riyadh
  and leaves a polaroid of the moment with each member.

THE NINE ASSETS
1. FEED 1080×1350 — Day 1 reveal. The membership exists. Deep green, restrained,
   one line: «قطك يستاهل عضوية». No price on the image.
2. STORY 1080×1920 — "Founding members first" — an honest timeline graphic:
   ٩ صباحًا للمؤسسين · ٥ مساءً للجميع.
3. FEED CAROUSEL (4 slides, 1080×1350) — What a membership actually is:
   (i) the Cat ID and its four jobs — safety, health, value, identity;
   (ii) the box computed from *this specific cat's* profile;
   (iii) member rates honoured at partner clinics and stores;
   (iv) full price, cycle, and next charge stated plainly on one line, with the
   cancel path named. Honesty is the design here — set the terms in clear type, not fine print.
4. STORY 1080×1920 — Founders' Majlis invitation card. Numbered, letterpress feel,
   perforated edge. Elegant, quiet, no event-poster clutter.
5. FEED 1080×1350 — Majlis recap: a grid of founding cat portraits, each labeled
   with name + ID number. Leave labeled photo placeholders.
6. STORY 1080×1920 — The founders' wall: cats #1–1000 as a dense typographic wall
   of names, with one name highlighted. Screenshot-bait.
7. FEED 1080×1350 — "Box #1 went to Mishmish in Al-Nakheel." The named label
   («مشمش، صندوقك وصل») is the hero — the box as a doorstep object, photo placeholder.
8. STORY 1080×1920 — Hand-delivery series template: reusable frame for daily
   delivery clips, with a slot for cat name, district, and box number.
9. X/LINKEDIN 1200×675 — Press card for the embargo lift. The infrastructure story:
   "A Saudi startup is building the country's first pet identity registry."
   Include the census number as the proof point.

Also produce: a Snapchat AR lens concept brief (cat passport-photo booth — face-tracked
ID card frame for cats) described in enough detail for a lens designer to build.
```

---

## Prompt 3 — First 90 Days: "Prove the Machine"

**Goal:** value stays visible, redemption becomes content, referral engine switches on, National Day moment.

```
[PASTE BLOCK A]

TASK: Design a repeatable 90-day content system (10 templates, not one-offs) for
Moracat's post-launch period. These are TEMPLATES the team will refill weekly, so
every asset must have clearly labeled swap slots (cat name, ID number, number values,
photo). Target: 120 paying members, 1,500 Cat IDs, 15 partner locations.

CONTENT PILLARS AND THEIR RATIOS (respect these)
Cats of the Census 35% · Care, honestly 25% · The Membership 20% ·
Behind the build 10% · Play 10%

THE TEN TEMPLATES
1. «قط الأسبوع» (Cat of the Week) — Sunday feature frame, 1080×1350. Portrait +
   name + ID number + one line the owner wrote. Must feel like a magazine cover, not a badge.
2. Savings tally card, 1080×1350 — a real member's real number:
   «وفّرت ١٨٧ ريال هذا الربع». The number set huge in mono; the receipt-like breakdown
   beneath in small honest type. Never framed as a discount — it is proof of value.
3. Redemption cam frame, 1080×1920 — 15-second vertical clip frame for a real
   member-rate moment at a partner: lower-third with partner name and exact amount saved.
4. «اسأل الدكتورة» (Ask the Vet) — biweekly live cover + a shorts frame, 1080×1920.
   Vet-reviewed, plain Arabic, calm. Clinical credibility without clinical coldness.
5. Care explainer carousel, 4 slides 1080×1350 — e.g. «جدول تطعيمات القطط».
   Information design: a real readable schedule table, sticker illustration used only as punctuation.
6. Unboxing chain frame, 1080×1920 — the choreographed unbox: ID materials on top,
   food beneath. Slot for "the one unlisted extra".
7. «وين مقوقع؟» (Where's he hiding?) — weekly find-the-cat game, 1080×1350.
   A photo slot with a playful circled-answer variant for the follow-up story.
8. Partner announcement card, 1080×1350 — "Al-Olaya Vet now reads Moracat IDs."
   Brass counter-sign motif, in the family of payment-network stickers. Restrained, official-feeling.
9. Census milestone post, 1080×1350 — for #1000, #5000: the number alone, ceremonial.
   Include one variant that credits the specific milestone cat by name.
10. Saudi National Day (Sep 23), 1080×1350 + 1080×1920 — «أكثر قط سعودي» UGC contest.
    Saudi green in OUR palette (deep leaf, warm paper), heritage-styled portrait frame.
    Reverent and playful, never kitsch, never flag-draped clichés.

For each template, deliver: the HTML/CSS artifact, a labeled list of swap slots,
and a filled example using cat "Lulu, #000347, Al-Malqa".
```

---

## Prompt 4 — The Referral Engine: «عزيمة»

**Goal:** cat-to-cat invitations, the clowder as a status object, the shelter multiplier.

```
[PASTE BLOCK A]

TASK: Design the visual system for Moracat's referral engine (6 assets). The
mechanic: any member can gift a friend's cat a free Cat ID and founding-style
first-box pricing. The invitation comes FROM THE CAT — "Lulu invites Mishmish to
get his ID." Cat-to-cat framing is the whole psychological move, and it is honest.

DESIGN CONSTRAINTS (non-negotiable)
- Recognition over gamification. No points casino, no confetti explosions,
  no progress-bar guilt, no leaderboards of who referred most.
- Rewards are ceremonies and objects, not coupons.
- The referrer's reward pays only after the friend's first RENEWAL — say this plainly
  wherever the reward is shown.

THE SIX ASSETS
1. The عزيمة invitation card, 1080×1350 — shareable, from cat to cat. Reads like a
   real invitation: the inviting cat's name and ID number at top, the invited cat's
   name written in as if by hand. Beautiful enough that people send it as a gift.
2. "Lulu's clowder" (مجموعة لولو) profile module, 1080×1350 — a visual family tree
   of the cats a member brought in. Each node is a small ID card. Designed to be
   screenshotted and shown off — this is a status object.
3. Milestone recognition set, 4 cards 1080×1350 — 1 referral: engraved thank-you card ·
   3: premium collar tag · 5: Member Ambassador invitation · 10: your cat becomes a
   box-sticker character. Each should feel like an award, not a tier badge.
4. The shelter multiplier card, 1080×1350 — every 3rd successful referral donates a
   first month to a shelter cat: «مجموعة لولو ساعدت ٤ قطط من الملاجئ».
   Giving is the flex. Warm, quiet, factual — never a charity guilt-trip.
5. STORY 1080×1920 — the invitation share frame, for the moment right after a member
   sees a big saving or their cat's year-in-review. High-emotion, low-pressure.
6. Badge sheet — Founding Member, Guardian, Clowder of 5, tenure rings. Small,
   tasteful, engraved-feeling profile marks. Deliver as a single spec sheet artifact
   showing each badge at 3 sizes with usage rules.
```

---

## Prompt 5 — Seasonal Spine (Months 4–12)

**Goal:** the year's fixed cultural moments, each with a distinct treatment.

```
[PASTE BLOCK A]

TASK: Design Moracat's seasonal campaign spine — one key visual plus a story frame
for each of the six moments below. Each moment gets its own treatment inside the
same brand system: same palette and type, different mood.

1. WORLD CAT DAY (Aug 8) — «١٠٠٠ صورة» community gallery push. A mosaic wall of
   member cat portraits forming one composition. Feed 1080×1350 + a submission story frame.
2. WINTER CARE SEASON (Nov–Jan) — warmth and health content; boarding-partner push
   for travel season. Cozy without going Nordic-Christmas; keep the warm paper ground.
3. FOUNDING DAY (Feb 22) — heritage-styled cat portrait frame. Saudi heritage
   references handled with genuine respect and research, never costume-cat comedy.
4. RAMADAN — kindness-to-cats tradition content. Reverent, ZERO selling, no CTA,
   no logo dominance. Rooted respectfully in the tradition of mercy toward cats
   (the story of Muezza, Abu Hurairah). Copy must read as though a scholar reviewed it,
   because one will. Also: a suhoor-hours posting frame, and a «سقيا القطط» summer/heat
   water-station announcement card for street cats.
5. EID — «عيدية للقطط»: gift a membership. The gifting ceremony flow rendered as a
   shareable card — the gift is an identity, not a discount code. Crescent-skin wallet pass variant.
6. YEAR-ONE ANNIVERSARY — every member's cat gets a shareable year-in-review card:
   boxes received, vet visits logged, total saved, records kept, the clowder grown.
   Design it as the year's single most beautiful artifact; it is the compounding asset.
   Include the "paid for itself ✓" line only when the math is genuinely true.

For each: feed 1080×1350, story 1080×1920, Arabic caption + English gloss.
Deliver a one-page contact sheet at the end showing all six side by side, so the
year reads as one coherent system.
```

---

## Prompt 6 — Always-On Utility & PR Moments

**Goal:** the assets that keep working after the spend stops.

```
[PASTE BLOCK A]

TASK: Design Moracat's evergreen utility and PR assets (7 pieces). These are not
campaign posts — they are the things that keep earning attention for years.

1. LOST-CAT POSTER — the free generator's output: a weatherproof A4/A3 poster any
   owner (member or not) can make. Huge cat photo, name, district, a QR that reports
   a sighting to the owner. Must be legible from 3 metres on a lamppost, must survive
   a black-and-white photocopy, and must carry Moracat's mark quietly at the foot.
   This is a public service first and an ad second — design it that way.
2. FIRST REUNIFICATION story card, 1080×1350 — the day a lost cat comes home via a
   tag scan. Reserved template; report only when real, never staged.
3. "STATE OF SAUDI CATS" annual report cover + 3 inner data-viz spreads — designed
   like a central bank report, about cats. Include a district heatmap of registered
   cats and the most popular cat names index. Serious typography, playful subject.
4. NEIGHBOURHOOD LEADERBOARD card, 1080×1350 — «الملقا: ٣١٢ قط مسجّل · النخيل: ٢٨٩».
   District pride, honestly counted.
5. THE ONE BILLBOARD — a 16:9 landscape key visual carrying nothing but a
   live-updating census number and «لكل قط هوية». No product, no price, no URL clutter.
   Designed to be photographed by strangers.
6. THE CLOSING BILLBOARD (end of year one) — one line:
   «١٢٬٠٠٠ قط لهم هوية. شكرًا.» No logo. If it works without the logo, the brand passed.
7. PARTNER COUNTER SIGN — the small brass "We read Moracat IDs" sign, rendered as
   both a physical mockup and a 1080×1350 announcement post. Ubiquity of this sign
   across the city IS the brand campaign.

Deliver each with production notes: dimensions, bleed, materials where physical,
and the minimum legible size.
```

---

## Usage notes

- **Order matters.** Prompt 1 must run and ship before Prompt 2 — launch week's
  credibility rests on a real census number to put on the asset.
- **Refuse fabricated numbers.** Every number in these assets (census count, savings
  tally, clowder size) must come from the live product. Placeholder values in generated
  artifacts must be visibly labeled as placeholders so nothing fake ships by accident.
- **Review gate.** Before publishing any generated asset, run it against the
  DESIGN-AUTHORITY review checklist — especially R006 (no fake scarcity),
  R040 (claim nothing the product doesn't do), R082 (name the cat), R085 (no coupon shouting).

*— MRC-GTM-002, 2026-07-19. Companion to MRC-GTM-001.*
