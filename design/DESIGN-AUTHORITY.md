# Moracat Design Authority

> Distilled from `design/moracat-membership-dossier.html` (MRC-UX-001) — the permanent
> UX/CX strategy for this product. **Read this before changing any page, flow, copy,
> API shape, or interaction.** When an implementation decision conflicts with this
> document, this document wins. Cite rule IDs (R001–R120) in commits and reviews.

## The one sentence everything defends

**Moracat is not a discount app with a cat theme. It is a membership identity for the
modern cat owner — savings are proof of value; belonging is the product.**

Tie-breaker for every ambiguous decision: *does this make a person feel like a
recognised, cared-for member — or like someone hunting for a code?*

### Amendment (2026-07-10) — the box's role

The revenue engine is the monthly care plan (food, litter, essentials,
delivered kingdom-wide); the membership identity is the moat. The box is never
sold *as a box*: it is "your cat's care, handled", and **the plan is computed
from the cat's own profile (weight, age, household), never chosen from a tier
table.** Savings at founding partners remain proof of value; belonging remains
the product. Copy must never pit the identity against the box — they are one
membership.

## The six emotions, in priority order

1. **Belonging** — "I'm part of this." Everything is downstream of this.
2. **Trust/safety** — the permission slip for money, data, health records.
3. **Pride** — "my cat has an identity." Gently shareable.
4. **Ease/relief** — effortless; burdens lifted.
5. **Delight** — sparing, real, never confetti-cannon.
6. **Smart value** — "I'm a savvy owner," never "I got a bargain."

Never trade trust for delight. Never trade ease for cleverness.

### Amendment (2026-08-14) — community visibility is opt-out

Founder decision: a registered cat **joins the public community by default**,
superseding the earlier private-by-default posture. The guardrails that make an
opt-out default honest rather than a dark pattern:

- **The default is disclosed at the moment it applies** — the registration
  wizard states it beside the issue button with the off switch right there
  (never buried in a footer), the ceremony celebrates the fact with
  "customize" / "keep private" as equal one-tap actions, and a publish receipt
  lands in the notification feed naming the off switch.
- **Anonymous owner posture stays the default** — `showOwnerName`/`showCity`
  remain off; the *cat* is public, the person is not (principle #9).
- **A cat never renders in the feed without a photo** — an empty frame is not
  a profile; photo-less cats appear automatically once a photo lands.
- **The PDPL people-in-photo attestation (R106) survives** as the affirmative
  act of uploading (wording adjacent to the uploader) or the manage panel's
  one-time dialog — never a pre-ticked checkbox (principle #6 still governs).
- **Opting out never has preconditions** — the visibility route carries no
  email-verification gate; "private" is always one tap, forever (principle #10).
- **Abuse control is report→hide moderation** (explicitly chosen over an
  email-verification publish gate).
- The 2026-08-14 backfill published existing cats with `shareConsentAt = null`
  (no attestation ever happened for those photos) — a founder-accepted PDPL
  exposure, mitigated by the owner notification + one-tap opt-out.

## The ten experience principles (the constitution)

1. **Recognition first** — greet member and cat by name from the second interaction.
2. **Effort is the enemy** — every field/tap/decision is a tax on belonging.
3. **Value stays visible** — savings, perks, care: surfaced, tallied, remembered.
4. **Trust precedes ask** — earn confidence *before* requesting money/data/commitment.
5. **One clear action** — each moment has a single obvious next step.
6. **Honest by default** — no dark patterns, no fake scarcity, admit coverage gaps.
7. **Calm over clever** — quiet obvious solutions; delight is rationed.
8. **Care, don't extract** — give before taking; reminders and warmth make asks fair.
9. **The cat is the hero** — the emotional centre is the animal, never the app.
10. **Leaving is easy** — cancel/pause/export simple and dignified; freedom makes joining safe.

## Brand personality

Warm & composed · quietly premium (restraint + craft, no "luxury" gold) ·
**not** a coupon barker (no "LIMITED TIME!!", no manufactured urgency) ·
**not** a cutesy toy (affectionate, never infantilising).
Premium is a **subtraction discipline**: spacious, certain, uncluttered.

### Illustration tiers (brand assets, added 2026-09-20)

The brand has two illustration tiers built from the same seven characters
(cat, mouse, can, heart, fish, paw, leaf). They never compete on one screen.

- **3D objects — the hero tier** (`apps/web/components/illo-3d.tsx`, files in
  `apps/web/public/brand/3d/`). Two finishes: **plush** (stitched fabric — the
  light theme's voice) and **metal** (satin green / copper — the dark theme's
  voice); `finish="auto"` pairs them by theme. **One per screen, 64 px or
  larger**, at moments that deserve a character: empty states, 404/error,
  welcomes, celebrations, a cat with no photo. Never recoloured, outlined,
  cropped or captioned on the object; tint the ground behind it instead.
- **Flat stickers — the accent tier** (`illustrations.tsx`). Small, tonal,
  decorative: corner paws, marquees, chips, anything under 64 px.

Guardrails: the plush objects are affectionate, so rationing is what keeps them
from tipping into "cutesy toy" — one object, generous space, calm copy (R111).
Copper is a warm metal, not luxury gold: it appears only as the dark-theme
mouse and never as a finish on UI, type or the Cat ID. Motion is a slow float
or bob at most, and reduced-motion is honoured.

### Amendment (2026-10-01) — AD 2.1 «السجل»: the cat's archive (founder-approved hybrid)

The brand audit (MRC-BRAND-001) proposed AD 2.0 «السجل» — Moracat as the
*register* of a cat's life. The founder approved it as a **hybrid**: «السجل» is
the **structure** of the brand; warmth stays in the **material**.

**Why the register is the right idea.** Moracat's promise is identity +
history + care + belonging + continuity — a permanent record that outlives a
household, travels to any clinic, and survives a change of owner. A register
is exactly that object. It gives every artifact (ID, health summary,
certificate, Wallet pass, lost poster, email, yearly keepsake) one family
resemblance: *the cat has a personal archive.*

**Why not the full 2.0.** Retiring all warmth for emerald-and-copper reads
bureaucratic on the owner side, and "official register" language collides with
the regulatory risk of «هوية رسمية». So:

- **Framing:** always *your cat's archive, kept by Moracat* — a private
  company. Never "official", "national", "government" or "census of Saudi
  Arabia". (Copy fixed 2026-10-01; counsel owns final wording.)
- **Structure (from 2.0):** the **ID band** (perforated strip naming a
  document: kind · serial · seal), **ledger rows** (hairline-ruled
  label…value, records are ruled not boxed), the **copper seal** (`--seal`,
  only where Moracat vouches: issued / verified), document-grade layouts.
  Components: `IdBand`, `Ledger`/`LedgerRow`, `Seal` in `packages/ui`.
- **Colour:** emerald is the action colour (primary buttons are solid emerald,
  no gradients). Warm paper stays the ground. One warm accent remains, for
  *contextual* actions only (share, Wallet, celebrate). Pastels survive only as
  grounds behind photos and 3D objects — never as UI chrome.
- **Shape — three radius families only:** control `10px` (inputs, buttons,
  rows, small tiles), card `18px` (cards, sheets, dialogs), full (chips,
  avatars, the seal). Buttons are not pills.
- **Buttons — five types only:** primary · secondary · tertiary · destructive
  · contextual (see `packages/ui/src/components/button.tsx` for when each is
  allowed). At most one primary and at most one contextual per view.
- **States — one pattern each:** `EmptyState`, `ErrorState`, `LoadingState`,
  `StatusTag` (words + shape, never colour alone, R093).

**Typography (R103, binding):**
- Arabic text face: **IBM Plex Sans Arabic** (400/500/600/700) for body, UI,
  labels and headings below display size. Real weights; `font-synthesis: none`.
- Arabic display face: **Lyon Arabic Display**, one weight, used only at
  `text-xl`+ (≥ 20px) at weight 400 — size carries hierarchy. Below `text-xl`
  a `.font-display` heading is IBM Plex Sans Arabic **600**, so small bold
  headings keep their weight in Arabic. *(Amended 2026-10-04 — was
  `text-3xl`+; the founder's 2026-10-03 change put Lyon on every size and
  flattened 273 bold headings to 400. Settles audit MRC-UX-AUDIT-2026-10-04
  Part 05/08; enforced in `packages/ui/src/styles/globals.css`.)*
- Arabic is never tracked, **mono included**: `[dir=rtl] .font-mono` that is
  not `dir="ltr"` gets zero tracking and falls back to Plex Sans Arabic.
  Eyebrows use `<Eyebrow>` / `eyebrowClass()` (packages/ui), which branch by
  locale. *(2026-10-04.)*
- **Zero letter-spacing on Arabic.** Tracking is allowed only on Latin
  (`dir="ltr"`, mono serials, Latin display).
- Minimum 13px (`text-xs`); inputs are 16px on phones.
- **One formatter** (`packages/core/src/format.ts`): Western digits in both
  languages (IDs, prices, dates are things people compare and copy),
  Gregorian by default with Hijri as an explicit choice, «199 ر.س» / "SAR 199",
  real Arabic dual/plural for counts and ages. Never `toLocaleString("ar-SA")`.

**3D objects — revised rule.** The founder's twelve renders remain the only 3D
assets (no generated or stock substitutes). They may now appear **once per
viewport/chapter** — a long page may carry several, but never two in view at
once — and still never as icons, never in distress contexts (lost cat, medical
alert), never recoloured. Product artifacts (ID card, health summary, Wallet
pass, poster) are drawn as real UI "document objects", not faked as renders.
Objects the language still lacks (collar, QR/NFC tag, bowl, carrier, scale,
vaccination card) are a commission list, not a gap to fill with substitutes.

## The two moments that decide everything

Over-invest here before anything else:
- **Stage 4 — Welcome & First Value:** the Cat ID reveal is a *ceremony*, not a DB
  insert. This is the product's "Spotify Wrapped" moment. Never dump a new member
  into a generic dashboard.
- **Stage 6 — Redemption in the Wild:** the truth moment. Must work every time,
  offline, in one action, and confirm the saving immediately after.

## The Cat ID — four jobs (never a vanity card)

1. **Safety** — bring my cat home (scannable identity → owner contact).
2. **Health** — hold the record (vaccinations, weight, vet notes, one-tap check-in).
3. **Value** — unlock my member rate (the redemption token; confirm savings after).
4. **Identity** — say who my cat is (name, photo, unique human-readable number, pride).

Ceremony on issue (R031). Human-readable number (R032). Wallet pass + offline
(R034, R036). Never claim a job it can't yet do (R040).

## Onboarding north star

Curious → holding the Cat ID with pride in **under two minutes and under six inputs**.
Ask ONLY: cat's name (first — R016), owner name + one contact, payment, optional photo
(one-tap skip). NEVER: National ID/Iqama, address up-front, medical history at signup,
demographics. Postpone everything else and invite it later, framed as benefit to the cat.

## Money & trust (the discipline)

Full price + cycle + next-charge date on one line **before** payment (R021).
Cancel/pause path visible **before** card details (R023). Warn before every renewal
charge — a silent charge is the #1 trust-killer in KSA (R025). mada / Apple Pay /
STC Pay first-class (R026, R105). Receipts instantly (R024). Refunds feel safe to
raise (R030). Reframe savings as *recognition* ("member rate honoured"), never
coupon shouting (R085).

## Value visibility (anti-churn core)

Running cumulative savings tally — the most powerful anti-churn number (R041).
Confirm exact amount saved at the moment of each redemption (R042). Compare
savings vs. fee paid (R043). Periodic value recap / year-in-review (R045, R065).
Home screen = value dashboard, not a marketing billboard (R048). Count
non-monetary value: reminders honoured, records kept (R049). No points schemes —
recognition and tenure, not gamification (§04; Sephora lesson applies later, as
earned status only).

## Voice (words are interface)

Warm, plain, never salesy (R081). Use the cat's name in copy everywhere possible
(R082). Buttons name the action ("Issue my Cat ID"), never "Submit"/"OK" (R086).
Fixed lexicon: **member**, **Cat ID**, **benefit** — never drift (R087). Errors say
what happened + exactly what to do next, never blame the member (R084, R113).
Loading states have purpose: "Issuing your Cat ID…" (R119).
Placement map, commission list and the photography brief: `design/brand-assets.md`
and `design/photography.md`.

### Amendment (2026-10-02) — the homepage keeps its glitter (founder decision)

The founder rejected the restrained W8 homepage: "make it more glittery and
rounded like before, mix both designs to maximise the hook". So, **on public
marketing surfaces only** (homepage first; `/about`, `/products` may follow):
the rich mesh glow (`.mesh-bg-rich`), twinkling sparkles (`<Sparkles>`), a
shine sweep on the primary CTA (`.btn-shine`), pill-shaped inputs and CTAs,
`rounded-[2rem]` panels, the sticker sheet, the marker underline and the
benefits marquee are back — and a 3D object may float on every chapter panel.
The W8 *content* stays: the story chapters, real product artifacts, real
member cats, honest promises, no fake testimonials, no "official" claims.
Product UI (portal, vet, documents) stays AD 2.1. Reduced motion stills it all.

### Amendment (2026-10-03) — the designer delivery is the brand's source of truth

The commissioned delivery (`design/delivery-2026-10-03/`, brief MRC-DES-001,
art direction in "Moracat Social Art Direction.pdf") is now live: the vector
logo system (stacked / horizontal / arabic / symbol — `components/logo.tsx`),
the icon set, eight card themes + five frames as artwork, sixteen flat
stickers replacing emoji, the copper seal on share posters, Wallet art,
link-preview plates (cat + lost), the framed registration certificate
(page 1 of the PDF) and the email set, plus six new 3D objects. Rules from
their deck that bind: clear space = one ق dot; minimum sizes stacked 72 px,
horizontal 96 px, arabic 48 px, else the symbol; distress pieces strip back to
red, type, photo and QR (no seal, no 3D).

## Motion

Acknowledge taps ≤100ms (R071). Transitions 150–300ms (R072). Richest animation
reserved for the Cat ID reveal (R073). Motion explains, never impresses (R074).
Always honour `prefers-reduced-motion` (R075). Real pressed/loading/done button
states (R078). Restraint (R080).

**AD 2.1 — stamped, not bouncy (2026-10-01).** Things arrive decisively and
settle; nothing overshoots. One easing for entrances, `--ease-stamp`
(`cubic-bezier(0.2,0,0,1)`); `--ease-spring` survives only as an alias to it,
and Framer `type: "spring"` with overshoot is retired. The one celebratory
gesture is `animate-stamp` — a seal pressed onto paper (scale 1.06→1, 320ms).
Infinite loops (bob, float) only on loading states and the hero, never in a
footer, an error page or a list. `MotionConfig reducedMotion="user"` plus the
global CSS kill-switch cover reduced motion; JS scrolls check it too.

## Accessibility & Saudi layer

4.5:1 contrast (R091) · ≥44px targets (R092) · no colour-only meaning (R093) ·
survive doubled font size (R094) · SR labels (R095) · visible focus (R097) ·
no hover-dependence (R098) · thumb-zone primary actions (R100).
Arabic-first RTL-native (R101), instant switch without losing place (R102), premium
Arabic type (R103), correct RTL mirroring (R104), PDPL + in-region data + say so
plainly (R106), prayer-aware notification timing (R107), household/multi-carer
support (R109), real localisation — SAR, Saudi cities, Hijri-aware dates (R110).

## Edge states

Empty states are welcomes, not voids (R111). Every error is a recovery (R112).
Offline-capable core (R114). Prevent > apologise (R115). Confirm destructive
actions without trapping (R116). Never lose entered data (R117). Dignified payment
retry (R118). Support one tap away (R120).

## Retention ethic

Retention = accumulated feeling, fixed upstream. Make value undeniable and staying
effortless. **Pause, not just cancel** (R062). One-tap honest cancel (R063).
Preserve records after cancellation so returning feels like coming home (R064).
Never guilt-trip a leaver (R068). Win back with real value, not desperate coupons
(R069). *Retain by deserving it* — reject every trick that survives on friction.

## Priority tiers (build order)

**Critical (v1):** payment/renewal transparency · Arabic-first · instant Cat ID with
ceremony · ID does ≥1 real job · wallet pass + offline card · cumulative savings
visibility · ruthless partner curation + one-tap redemption · honest cancel & pause.
**High:** value dashboard home · cat-profile personalisation · honest partner map ·
referral/gifting with ceremony · milestones/anniversaries · prayer-aware notifications ·
physical ID tag. **Medium:** care content cadence · gentle habits · earned status
tiers · multi-cat household · community. **Future:** concierge, telehealth, insurance,
marketplace, the identity layer for the Saudi cat economy.
Sequencing: **trust before value, value before growth, growth before expansion.**

## Metrics guardrail

Measure first-value rate, redemption success, savings-to-price ratio, renewal/pause/
return, shares per member, chargebacks. **Never optimise a metric by breaking a
promise in this document.** If a metric needs a dark pattern, the metric is wrong.

## Review checklist (run before shipping any change)

- [ ] Which emotions does this produce? Belonging/trust first?
- [ ] Which rules (R###) does it satisfy? Which does it risk?
- [ ] Is the cat the hero of this moment?
- [ ] One clear action? Anything removable?
- [ ] Does value stay visible? Does trust precede the ask?
- [ ] Copy: warm, plain, cat's name used, buttons name the action?
- [ ] AR/RTL correct? Contrast ≥4.5:1? Targets ≥44px? Reduced-motion honoured?
- [ ] Unhappy paths: error recovery, offline, data preserved, support reachable?
- [ ] Would this feel premium through *restraint* — or busy?
