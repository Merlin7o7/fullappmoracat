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

## Motion

Acknowledge taps ≤100ms (R071). Transitions 150–300ms (R072). Richest animation
reserved for the Cat ID reveal (R073). Motion explains, never impresses (R074).
Always honour `prefers-reduced-motion` (R075). Real pressed/loading/done button
states (R078). Restraint (R080).

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
