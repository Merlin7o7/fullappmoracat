# MRC-UX-AUDIT-2026-09-21 — Complete Product & UX Reassessment

**Date:** 2026-09-21 · **Overall: 5.4 / 10** · **Verdict: do not scale acquisition on this UX; fix Phase 1 first.**

**Method.** Six parallel specialist audits over the real source (public surfaces · onboarding/auth · portal + Cat ID · commerce · vet/adoption/lost-found/transfer · design system/RTL/a11y/mobile), plus a live pass over `www.moracat.co` in Arabic at desktop and 375 px. Every finding is traced to a file/line or to what production rendered today. Nothing was taken from earlier audits on faith. Limits: source-read + live text/DOM inspection; screenshots were only partially available, no real-device or screen-reader session was run, and the uncommitted iOS app was inspected by file tree only.

**Production state that shapes everything:** prod runs in **Census mode** — commerce off (`render.yaml:21`, `lib/features.ts:6`), payments mock. A new Saudi visitor today meets "the National Cat Census", not "لِحياة قطّك كلّها".

---

## 0. One-page verdict

Moracat has one genuinely excellent object (the Cat ID card + ceremony), a distinctive brand, near-perfect RTL *layout* hygiene, and honest-by-default instincts. Around that object sits a product that **promises more than it does at almost every seam**:

| # | Finding | Evidence |
|---|---|---|
| 1 | **The Cat ID is a card, not a product.** There is no cat profile page; the "soul of the product" lives in a drawer. A scan by a non-partner vet shows nothing clinical. | `portal/cats/[id]/` has no `page.tsx`; `c/[token]/page.tsx:27` |
| 2 | **Lost & Found fails at the moment it matters.** No share button, no WhatsApp, no OG preview, no poster, no nearby alert; "lost mode" is filed under *Privacy*; QR found-reports have **no inbox**. | `portal/lost-found/page.tsx:204-251`; `public-cats.service.ts:89` |
| 3 | **Privacy promises are contradicted by the code.** "ما نكشف بريدك ولا رقمك" → adopter email is handed to the lister. "QR readable only inside the app" → false. Exported card prints the owner's phone. Medical documents sit at public URLs. | `adoption.service.ts:462`; `portal/cats/page.tsx:482`; `cat-id-card.tsx:284`; `uploads.controller.ts:24` |
| 4 | **Arabic-keyboard users cannot complete forms.** `\D` strips ٠-٩ in OTP, phone, age; the password checklist only recognises ASCII letters/digits. In an Arabic-first product. | `otp-boxes.tsx:45`; `phone-field.tsx:34`; `cats/new:69`; `register/page.tsx:34` |
| 5 | **Three positionings in two scrolls.** Hero = census. Section 2 = membership. FAQ = waitlist. `/about` = "inactive ID until you pay". "Founding Member" has three incompatible definitions. | `home-view.tsx`; `moracat-story.tsx:98-147`; `membership.tsx:183` |
| 6 | **Vet trust centrepiece is broken.** Access ledger renders blank clinic names; clinic consent request 400s; owner has no approve button; break-glass is unthrottled and exposes the owner's phone. | `access-ledger.tsx:34-46`; `vet/patients/[catId]/page.tsx:526`; `vet-emergency.service.ts:127,226` |
| 7 | **14 flat portal destinations; nothing is organised around the cat.** Mobile bottom bar gives Support a thumb slot while Lost & Found and Health are buried under "More". | `portal/nav.ts:26-48`; `portal-mobile-nav.tsx:33-68` |
| 8 | **Ownership transfer can be hijacked.** Accept requires no verified email; anyone who registers the target address unverified can take the cat and its record. | `ownership.controller.ts:57-66`; `ownership.service.ts:235,655` |
| 9 | **Commerce, when switched on, is not safe.** Multi-cat pays per cat, gets one cat's box; no month-2 fulfilment is ever generated; renewal copy contradicts itself three ways; VAT 0% vs "VAT day one". | `subscriptions.service.ts:1141-1146,258`; `subscribe/page.tsx:362` |
| 10 | **Brand typography undermines "premium".** Lyon ships one weight → ~1,000 faux-bold usages; a *display* face sets 10 px body text; negative tracking on Arabic; 310 KB raw OTF on the critical path. | `layout.tsx:36`; `tailwind-preset.ts:96-102` |

---

## PART 1 — First-impression audit (new Saudi visitor, mobile, Arabic)

**What production shows:** announcement bar → header (tiny logo, **"تسجيل الدخول" as the loudest button**, no register CTA) → badge "التعداد الوطني للقطط" → H1 **"كم قط يعيش في السعودية؟"** → 30-word subtitle → name input + "سجّل قطك" → counter "70 قط مسجّل" → Cat ID preview → marquee → "وش تعني العضوية؟" → census section → FAQ → closing CTA → footer.

| Question | Honest answer |
|---|---|
| Is the value proposition obvious immediately? | **No.** The H1 is a trivia question. "What Moracat is" lives in a subtitle most people won't read. |
| What do I think Moracat is? | A cat census / registry — possibly governmental ("وطني", "هوية رسمية"). Then a membership. Then a waitlist. |
| Who is it for / why care? | Cat owners; the *why* is unanswered. "Get counted" is the founder's goal, not the owner's. The owner's real motives — *if he's lost, he comes home; his record walks into any clinic with him* — appear only deep in the ceremony copy. |
| Why trust it? | Weak. No CR number, VAT number, Maroof/SBC badge, address, founder, vet partner, press, or testimonial. Legal entity name printed twice (bug). **"70 cats" beside "آخر تسجيل: لوسي — رقم 86"** — two numbers that disagree, on the one page whose entire premise is counting. |
| Premium? | Visually yes (paper, emerald, card). Verbally mixed. Small numbers (70) honestly shown are fine — but under a "national" banner they read as *tiny*, not *early*. |
| Saudi? | The Najdi voice ("وش", "إحنا نعدّهم، قط قط") is the most Saudi thing here and it's good. Nothing else visual is distinctively Saudi. |
| Serious tech company? | The card says yes. "قريباً" store, empty benefits page, a one-clinic directory named "عيادة مُرقّط المؤسِّسة", and a stray "CAT FOOD" string in the text layer say *pre-product*. |
| Category? | Registry + community today. Not a store (good), not yet a vet product. |
| Too much / too little? | Too much *nav* (7 links, 3 of them to thin destinations), too little *proof*. |
| Primary action | "سجّل قطك" — consistent, good. Undercut by the header (Login is brand-filled; Register absent) and by the mobile sticky CTA being **suppressed until the cookie banner is dismissed** (`mobile-register-cta.tsx:48`); the banner itself covers ~20% of a 375 px viewport. |
| What makes a user leave? | (1) "Why would I register my cat in a *census*?" (2) "رسمية" — official according to whom? (3) 70 cats. (4) Empty benefits, "قريباً" shop. (5) The hero fades in from opacity 0 — a first mobile paint was captured fully blank. |

Additional live defects: `<title>` and meta description are **English on the Arabic page**, and the description still promises "delivery across Saudi Arabia, and founding partners"; zero `hreflang`; H1 line-height 1.04 on Arabic.

**First impression: 6.0 / 10.** Beautiful object, wrong headline, thin proof.

---

## PART 2 — Complete user journey

| Stage | User goal | Business goal | Friction / confusion / trust gap (evidence) | Recommended change |
|---|---|---|---|---|
| **Discovery** | "Is this legit?" from an IG/WhatsApp link | Cheap viral acquisition | Links unfurl with English title/description; L&F and cat pages have no OG (`lost-found/[id]` is `"use client"`, no `generateMetadata`). | Arabic-first metadata; per-cat and per-alert OG images. This is the growth loop — it is currently off. |
| **Landing** | Understand in 5 s | Registration | Census framing answers the founder's question. Login outranks Register. | Hero = owner benefit; census becomes proof, not premise (Part 4). |
| **Understanding** | "What do I get, what does it cost?" | Set up future paid conversion | Census vs membership vs waitlist; `/about` says ID is "غير مفعّلة" until paid while FAQ says "مجانية اليوم ودايم" — reads as bait-and-switch. | One sentence, one model: *the ID is free forever; care plans are optional.* Delete the active/inactive ID concept. |
| **Sign up** | Get in fast | Verified, reachable member | Password-first in an OTP-native market; Arabic letters/digits never tick the password checklist; Google path stamps terms consent without showing it; no Apple on web. | Email-OTP / phone-OTP passwordless as default; password optional later. |
| **Email verification** | Not be blocked | Deliverability | Correctly *not* a wall, good resend/fix-email UX. But wrong/expired code and rate-limit all show the generic "صار خطأ بسيط" (`auth.service.ts:706-791` throw uncoded). Adopters hit `EMAIL_NOT_VERIFIED` claiming "we sent you a code" when none was sent, with no link. | Code the errors; make the gate actionable (send + inline OTP at the point of need). |
| **Cat registration** | Get the ID | Complete, contactable profile | 9 required inputs across 4 screens while the page says "اسمه أولاً — وكل شي ثاني يقدر ينتظر". Owner name asked twice. `singleScreen` unreachable for new users. Kittens < 1 month can't register. GCC 8-digit numbers can't pass. Phone required but never verified — yet sold as "the number the finder reaches". | Name + photo + life-stage chips → ID. Contact asked *after* the reveal, framed as the safety job, verified by OTP. |
| **Cat profile** | See/manage my cat | Depth, retention | No profile page. Drawer stacks 9 modules. Lost mode under Privacy. | Build `/portal/cats/[id]` as the product's home (Part 6). |
| **Membership** | Understand what paying adds | Future revenue | Ceremony exits into a forced subscribe pitch that, in prod, is a "قريباً" page. Mini-ceremony CTA says "profile", goes to subscribe. | Ceremony exits to the cat's profile. Never to a sales page, never to a dead end. |
| **Shopping** | — | — | Off in prod; see Part 8 for why the on-path isn't ready. | Keep off until Part 8 blockers close. |
| **Vet** | Save time at the clinic | Clinic-written record moat | Directory city search 400s; one self-named clinic; no discounts exist; consent loop broken in 3 places; scan shows non-partner vets nothing. | Part 9. |
| **Community** | Pride | Network effect | A privacy-respecting gallery; likes only. Photo-less public cats silently don't render, no nudge. | Keep small; make the *cat page* the shareable unit. |
| **Adoption** | Safe adoption | Supply of kitten-year members | Privacy promise broken; no report button; instant publish, no photo required; fees to SAR 5,000; hero claim "كل قط هنا يحمل هوية مرقط" not enforced. | Part 10. |
| **Lost & Found** | Get my cat back **now** | The single most viral, trust-building moment | No share, no alerting, two systems, no inbox for QR reports. | Part 11. |
| **Ownership transfer** | Hand over cleanly | Identity continuity (moat) | Unverified-email hijack; subscription block appears after submit; email-only; sender not told what's deleted; collar QR unchanged. | Verified-email gate; in-person QR handover; pre-flight checklist. |
| **Return visit** | "Anything new for my cat?" | Habit | Overdue vaccines filtered out (`account.service.ts:209`); no weight log; no push on web; cron sleeps on idle host; dashboard top slot is an upsell. | Part 7. |
| **Long-term** | Ongoing usefulness | LTV | Owner with no clinic and no `dueAt` hears nothing until the cat's birthday. | Care schedule generated from age at registration; monthly digest; yearly "cat's year" keepsake. |

---

## PART 3 — Information architecture

**Current public nav (7):** كيف تشتغل · مزايا الأعضاء · المجتمع · تبنَّ قطاً · مفقود وموجود · المدونة · حاسبة التغذية. **Current portal nav (14 flat):** Overview, My Cats, Community, Adoption, Lost & Found, Hand-overs, Notifications, Health access, Subscriptions, Orders, Addresses, Support, Settings, About.

**Problems.** Features are grouped by *how the codebase is organised*, not how owners think. Owners think: **my cat → what he needs → who can help → my account.** "Hand-overs", "Health access", "Privacy", "Lost mode" are all *properties of a cat* exposed as global destinations. "مزايا الأعضاء" (zero partners) is unnecessarily prominent; "دليل العيادات" (the actual moat) is buried in the footer. Notifications appears twice. Addresses shows with commerce off. "About" is marketing inside the member area.

### Proposed IA

**Public (4 + CTA):** `الهوية` (what the Cat ID is/does) · `تبنَّ` · `مفقود وموجود` · `العيادات` · **[سجّل قطك]** filled button, `دخول` as text link. Blog, feeding calculator, about, benefits → footer. `/benefits` leaves nav until ≥ 5 real partners.

**Member — mobile tab bar (4):**
1. **قططي / Home** — the cat(s). One cat → lands directly on the cat profile.
2. **العناية / Care** — schedule, reminders, clinics, (later) plan & deliveries.
3. **اكتشف / Discover** — community, adoption, L&F board.
4. **حسابي / Me** — notifications settings, addresses, support, legal, language.

Plus a bell in the header, and a **persistent red "قطي ضاع" emergency entry** inside every cat profile header (never in "More").

**Inside a cat profile (contextual, not global):** الهوية (card, QR, wallet, share, tag) · الصحة (timeline, vaccines, weight, documents, clinic access + access log) · الأمان (emergency contacts, lost mode, QR re-issue) · الخصوصية/الظهور · نقل الملكية / عرض للتبني (in an overflow "…" menu — rare, consequential actions don't deserve a tab).

**Global:** notifications, cat switcher, emergency. **Contextual:** everything that takes a `catId`.

This matches the five tabs already sketched in `apps/ios` (Home, Cats, Care, Discover, Profile) — web and native should share one IA, not two.

---

## PART 4 — Homepage audit

| Section | Verdict | Why / change |
|---|---|---|
| Announcement bar ("نرحّب بقططكم في كل مدن السعودية") | **Remove** | No link, no information; contradicts "دفعة الرياض". |
| Header | **Modify** | Register = filled; Login = text. 4 links. |
| Hero H1 "كم قط يعيش في السعودية؟" | **Replace** | Lead with the owner's benefit. E.g. **"هوية لقطك. لحياته كلّها."** + sub: "لو ضاع يرجع لك. وسجله الصحي معه في أي عيادة. مجاناً." The brand line "لِحياة قطّك كلّها" is absent from the page that should carry it. |
| Name input + CTA + "مجاناً · أقل من دقيقتين · بدون بطاقة" | **Keep** | Best pattern on the site. |
| Cat ID tilt preview | **Keep / modify** | Show a *sequential* example (copy promises sequential; preview shows random `MRC-2K9F-7YQ3`). Fix RTL centring bug `home-view.tsx:183`. |
| Counter chip | **Modify** | One number, one source. Reconcile 70 vs #86 or the census premise collapses. |
| Marquee ribbon | **Remove** | Repeats the section below; "إرشاد تغذية ذكي" oversells a calculator; triples text for screen readers. |
| "وش تعني العضوية؟" (4 rows) | **Replace** | With **"وش تسوّي الهوية؟"** — three jobs shown, not told: (1) ضاع → scan page demo, (2) عيادة → record demo, (3) فخر → card/story. The "monthly care — not open yet" row: **remove** from the homepage. |
| Census section | **Move down / shrink** | Becomes social proof: "قطك رقم __ في أول سجل لقطط السعودية." |
| Founding Member | **Keep, make concrete** | One definition, one cap, a live "remaining of 1000", one tangible benefit. "دفعة الرياض" → the *cat's own city* class. |
| Vet | **Add** | Even one real named clinic with a quote beats an empty benefits page. |
| Adoption / L&F | **Add (one strip)** | Two tiles with live counts. They prove the ID *does* things. |
| Products / pricing | **Absent — correct** while commerce is off. But `/tools/feeding` still shows SAR cost + "ابنِ خطة قطك" → `/portal/subscribe` — **fix the leak** (`tools/feeding/page.tsx:431-459`). |
| Social proof | **Add** | Real member cats (opt-in already exists) — a row of actual cards with names. 70 real cats > 0 testimonials. |
| Trust | **Add** | CR no., legal entity (once), PDPL line, "who can see what" in one sentence, founder name/face. |
| FAQ | **Keep** | Good, honest. Fix the ID-free-forever vs inactive-ID contradiction at source. |
| Closing CTA | **Keep** | |
| Footer | **Modify** | De-duplicate entity; add CR/VAT; remove "بوابة الأعضاء" duplicate of login. |

**Ideal order:** Header → Hero (benefit H1 + name input + card) → "لو ضاع / في العيادة / فخره" three-job demo → real cats wall + live count + founding remaining → how it works in 3 steps → clinics + adoption + L&F strip → privacy/trust block → FAQ → closing CTA → footer.

**CTA hierarchy:** one primary ("سجّل قطك") everywhere; one secondary per page max; login is never styled as a button on marketing pages.

---

## PART 5 — Onboarding

**Can a person who's never heard of Moracat understand what to do?** Yes on the happy path — the name-travels-from-hero pattern is excellent. But the promise ("his name first, everything else can wait") is false: nine things can't wait.

| Area | Finding |
|---|---|
| Account | Password-first; ASCII-only checklist; Google path records consent silently and lands on `/portal` instead of `/cats/new`; no Apple on web. |
| Verification | Non-blocking (right). Error copy generic (wrong). Verified email should gate *transfers accept* and doesn't. |
| Cat info | Sex + exact age (y/m, >0) required. Life-stage chips (هريرة / بالغ / كبير) would do; exact DOB later. |
| Photos | Optional, 25 MB cap, crop ok; raw English server errors shown; ~24 px close target; rotate re-encodes a 2200 px PNG (mobile freeze risk); public-without-photo silently doesn't list. |
| Medical | Correctly deferred — but vaccination status is never asked, which starves the reminder engine (the retention engine). |
| Ownership/contact | Required, unverified, asked twice, save is fire-and-forget with toasts firing over the ceremony; 409 retried 3×. |
| Multi-cat | Works; duplicate-name guard is good. |
| Kitten | No path. Contradicts the kitten-year strategy. |
| No cat yet | **Well handled** (`ExploreHome`). Flag lost if POST fails. |
| Adopter | Anonymous → `/login` only (no register); then the verification dead end. |
| Shopping-only | N/A in prod. |
| Vet-interested / clinic staff | No signpost anywhere in auth. |
| Clinic-claimed cats | SMS OTP dependency; no ceremony on claim (a toast). The best acquisition channel gets the worst welcome. |

### Ideal architecture

```
Hero: cat's name ─► Auth: email or phone → OTP (no password) ─► Cat: name ✓, photo (camera-first), life-stage chip
      ─► CEREMONY (ID issued)  ← the first "yes" happens in < 60 s, 4 inputs
      ─► "خلّنا نضمن يرجع لك": phone → OTP-verify → city        (safety job, post-reward)
      ─► Cat profile, with a 3-item "كمّل ملفه" checklist
```

| MUST HAVE NOW | CAN ASK LATER (progressively, in context) |
|---|---|
| Email *or* phone (verified by the OTP itself) | Password (optional, settings) |
| Terms (inline notice on all paths incl. Google) | Owner full name (ask at contact step; never twice) |
| Cat name | Exact birth date, breed, colour, weight |
| Life stage (chip) | Sex, neuter status |
| Photo (strongly encouraged, skippable) | Vaccination status + last vaccine date → *asked on first Care visit; seeds reminders* |
| — after reveal — verified phone + city | Microchip, emergency contact, acquisition source, greeting preference, waitlist consent |

Branching doors on the first auth screen, one tap each: **عندي قط · عندي هريرة · ما عندي قط بعد · عيادة**. Kitten door pre-loads the vaccine schedule — that *is* the kitten-year wedge.

---

## PART 6 — Cat profile / Cat ID

**The card is an 8. The product behind it is a 4.5.**

| Facet | State |
|---|---|
| Identity | Strong: `MRC-XXXX-XXXX` unambiguous alphabet, QR → `/c/{token}`, ID-1 ratio, founding ordinal, PDF/PNG/print/story/certificate. Arabic microtype renders at ~6–8 px in a system fallback font (`font-mono` has no Arabic). |
| Owner info | Scan page rightly shows none. **But** the detailed/export card prints owner name + phone — the artifact people share contradicts the privacy model. |
| Medical / vaccinations | Owner can add vaccine/visit/image-doc. **Cannot edit or delete anything**, cannot log weight, no PDFs, no meds/parasite; vaccines listed twice; stale cache after add (`cat-health-panel.tsx:47`); two sources of truth for vaccination status. |
| Vet records | Clinic-written entries visible with "موثّق من العيادة" — the right idea. |
| Emergency info | Exists; plain text field, not `PhoneField`. Deleted on transfer without telling the sender. |
| Lost status | Red banner on scan page only. Card has no lost state. Dashboard and switcher never show it. |
| Adoption status / transfer | No per-cat home; transfer at the bottom of a drawer. |
| QR / ID functionality | Works with any camera (the drawer that says otherwise is wrong). **No Apple Wallet** (hard-coded off, `wallet.service.ts:49`) in an iPhone-majority market. No collar-tag layout, no NFC, no owner-facing QR re-issue. |
| Timeline | None (clinic entries only). |
| Documents | Images only, **public URLs**. |
| Alerts | Upcoming only; **overdue is invisible**. |

**"If my cat disappeared tomorrow, would this genuinely help?"** — *Marginally.* Only if he wears a printed QR (there is no tag product or print layout) and a stranger scans it — and then the finder's message lands in a notification that links to a page that doesn't show it. The board post can't be shared. **No.**

**"If I went to a vet tomorrow, would it save time?"** — A non-partner clinic scanning the QR sees name/photo/breed; `vaccinationStanding` is fetched and **never rendered**. There's no shareable health summary. The owner scrolls their phone. **Barely.**

**"Would I still use this in six months?"** — Without a clinic writing records or the owner having entered `dueAt` dates: one email on the cat's birthday. **No.**

**What to build:** a real `/portal/cats/[id]` with a header (photo, name, ID, status pill that can turn red), four sections (Identity · Health · Safety · Visibility), a unified life timeline (registered → vaccines → visits → weight → photos → moved home), and a **"بطاقة العيادة" share link** — a time-limited, owner-generated read-only health summary any vet can open without an account. That single feature answers question 2 and seeds every non-partner clinic with the product.

---

## PART 7 — Dashboard

**Current order:** greeting → **membership upsell** → Cat ID card + household rail → "coming up" (max 2, upcoming only) → green hero with counters + completion bar → vanity tiles (Active cats / IDs issued — the same number) → community promo + referral. With 0 cats the hero and "0 / 0" tiles still render. It is a feature collection with an upsell on top.

**Hierarchy it should have (one screen, no scroll on mobile):**

1. **State of my cat(s), today.** Photo, name, and *one* status line chosen by priority: 🔴 lost/active alert → 🟠 overdue → 🟡 due within 30 days → 🟢 "كل شي تمام". Multi-cat = a horizontal stack of these.
2. **One next action.** The single most valuable thing: confirm vaccine date / add photo / verify phone / respond to a finder. Never two.
3. **Inbox that matters.** Finder messages, clinic access requests (with Approve inline), transfer offers, adoption enquiries.
4. **The card** — one tap to full-screen/Wallet.
5. *(commerce on)* next delivery, per cat.

**Off the dashboard:** vanity tiles, community promo, referral card (→ Me), savings tally until savings exist (it will read 0 — `Order.discountTotal` is never set by subscription orders), "تعرّف على مرقط", membership upsell as slot #1.

---

## PART 8 — E-commerce

**Production: nothing is for sale**, which is the correct decision. Assessment of the flagged-on path:

| Area | Finding |
|---|---|
| Discovery / categories / search / filters | `/products` has grid, chips, search, sort — **every card links to `/#plans`**. No PDP, no cart UI. API `cart/`, `checkout/`, `products/:slug` are orphaned. |
| Plans | 199 / 219 / 329 / 479, +180/180/280/400 per extra cat, terms 1/3/6/12 — matches MRC-FIN-002. |
| Funnel | ~9 screens; home plan choice discarded (`home-view.tsx:551`); forced quiz; no guest path; address not prefilled, no National Address / map pin. |
| Payment | mada/Visa/MC, Apple Pay, Tamara. STC Pay & Tabby wired in API, not offered. No rail logos, no CR/VAT, no returns link at the moment of payment. |
| Delivery | No first-box date anywhere. No tracking UI though `trackingNumber` is selected. Address can't be changed post-purchase. |
| Subscription truth | **No job ever generates month-2+ orders**; `nextDeliveryAt` is set once. A 12-month prepay has one order. |
| Multi-cat | Dashboard CTA forces single-cat (3 × 329 = 987 vs 889 household); household route shows single-cat price then 889 at checkout; `perCat` ignored at activation → **pays for three, one box recorded**; one formula for kitten + senior. |
| Personalisation | "Computed from the cat's profile" is a 4-question self-report; weight/diet/allergies unused. |
| Copy honesty | "بدون أي تجديد تلقائي" vs an auto-renew toggle vs FIN-002 "default auto-renew". "ألغِ متى ما تبي بضغطة" = stops renewal only. VAT (0%) on invoices vs the VAT-day-one decision. |
| Reorder / recommendations | None. |

**A or B?** *B in language, A-minus in mechanics.* The plan isn't attached to the cat (household-level, no subscribe entry on the cat, health record doesn't inform the box), and `product-intro.tsx:55-58` demotes the Cat ID to "مزية مشمولة" of the box — the exact inversion of the product's thesis. To be B: the plan must be a **section of the cat's profile**, computed from *his* weight/age/neuter/allergies, showing *his* next delivery.

---

## PART 9 — Veterinary experience

| Area | Finding |
|---|---|
| Discovery | Live: **one** clinic, "عيادة مُرقّط المؤسِّسة", under copy that says "we checked each clinic's licence ourselves". A directory of one self-named clinic reads as a placeholder wearing a verification badge. City search sends `?city=` free-text; DTO accepts `cityId` → **400**. `hours` fetched, never shown. No map, specialty, open-now, WhatsApp. Page is client-rendered ("لحظة…") — no SEO for the one page with local-search intent. |
| Discounts | **Do not exist.** `PARTNERS = []`. `/benefits` is a top-nav page describing a 3-step redemption flow for zero partners. |
| Appointments | None (fine for v1 — don't add). |
| Permissions | Tiered consent (T0/T1/T2 + expiry) is a genuinely good model, with one-tap revoke. But: clinic request 400s (`scope` not in DTO); owner notification links to a page with no Approve; unpublished live clinics can't be picked. |
| Access log | The trust centrepiece renders **blank clinic names** and English surface names in Arabic ("فُتح timeline"). |
| Break-glass | Reasoned, logged, owner-notified (good). Unthrottled, any `catId`, returns unmasked owner phone, stored as a **permanent** T1 grant — the owner sees a standing grant they never gave. |
| Data ownership | Never stated in UI; revoke dialog implies the clinic keeps its notes. `ownerConsented:true` hard-coded on clinic-created patients. |
| Documents / sharing | Images only; public URLs; no full-history PDF; no share link for non-partner vets. |
| Vet portal | Scan uses `BarcodeDetector` only → **fails on iPad/Safari**, the clinic front-desk device. "Forgot password" sends staff to the member login. |

**Priority:** fix the ledger and the consent loop *before* signing clinic #2. The first real vet who tries "request access" gets a 400.

---

## PART 10 — Adoption

Built end to end, and the adoption → Cat ID transfer linkage is the differentiator no classifieds site has. But it still *behaves* like classifieds:

- 🔴 **Broken promise:** "ما نكشف بريدك ولا رقمك" — on accept the API returns the adopter's email to the lister and the UI shows it.
- 🔴 "الرسائل تمرّ عبر مرقط" = one message + one note. No thread. Labelled "الأفضل والأأمن".
- 🟠 Instant publish, no photo required, no review; "report" is a link to `/contact`.
- 🟠 Fees up to SAR 5,000 called "مقابل رمزي" — on a page that says "مرقط ما يبيع القطط".
- 🟠 No screening: no verified-phone badge, no home questions, no adoption agreement.
- 🟡 Search by name only (who searches adoptable cats by name?); no breed/vaccinated/neutered filters; hero claims every cat holds an ID — not enforced.
- 🟡 Post-adoption: adopter lands on a list with a toast. No ceremony, no "first 30 days" guidance. **This is the kitten-year wedge walking in the door.**

**Ideal:** lister must have verified phone; photo required; cap fee at a true token (≤ SAR 300) or zero; structured 4-question adopter intro; consented contact reveal ("شارك رقمي مع …؟" toggle at accept time); signed handover with both parties scanning one QR in person; adopter gets the full ceremony ("فلان صار له بيت") + a 30-day new-home care schedule.

---

## PART 11 — Lost & Found (emergency flow)

| Question | Answer |
|---|---|
| Report instantly? | **Nearly** — 3 actions, 1 required field, prefilled from the Cat ID. Genuinely good. But the entry point is under "More" on mobile, and the *other* "أبلغ عن فقدان" button (under Privacy) creates no post at all. |
| Share the case? | **No.** No share/copy/WhatsApp button, no OG preview (link unfurls bare), no poster. The empty state *tells* you to share the link and gives you no way to. |
| Contact protected? | Relay exists and works anonymously. Choosing phone/WhatsApp publishes the raw number — no click-to-reveal. Relay has no Turnstile; 20/post/day cap lets a spammer lock out real finders. |
| Can a finder identify the cat? | Via QR if tagged; via exact microchip match only on FOUND-create (not on edit, not when LOST arrives after FOUND). No photo upload in the finder form though the help text mentions one. |
| Does the Cat ID become useful? | Only with a physical tag Moracat doesn't offer. |
| Ownership verified? | No. "I think this is my cat" is free text. |
| Optimised for urgency? | No alert to nearby members, no geo, no sighting pins, posts never expire, QR reports have no inbox. |

### Ideal emergency flow

1. **Red "قطي ضاع" button** in every cat header + dashboard; long-press from the app icon natively.
2. One screen: cat preselected, **"آخر مكان شفته"** map pin (defaults to current location), time, optional note. **Publish.** (10-char minimum description removed — a panicking owner shouldn't fail validation.)
3. **Immediately**: share sheet with WhatsApp first; auto-generated poster (photo, name, district, QR, relay link — *no phone number*); OG image so the link unfurls as the poster.
4. Push/email to members in the same city/district ("قط ضايع قريب منك").
5. The Cat ID itself turns red everywhere — card, scan page, community profile.
6. One **inbox** for all finder contact (QR scans + board + sightings), with two-way masked relay and photo.
7. Reunion: finder and owner confirm via QR scan → "رجع البيت" moment, shareable; alert auto-closes; posts auto-expire at 30 days with a "still missing?" nudge.

---

## PART 12 — Visual design

| Element | Assessment |
|---|---|
| Typography (AR) | Lyon Arabic Display is loaded — **one weight only**. 561 `font-medium` + 312 `font-semibold` + 113 `font-bold` render as synthesised bold. It also sets *all* body/UI text down to 10 px — a display face doing a text face's job. 126 `tracking-tight` + 75 `tracking-wide` hit Arabic ungated; the type scale bakes negative tracking into xl–7xl; the Cat ID sets Arabic at 0.16–0.26 em (breaks joins). Display line-heights 1.0–1.05 clip diacritics (مؤسِّس). 310 KB raw OTF on the critical path. |
| Typography (EN) | Fraunces + Inter + Plex Mono — competent; Fraunces + Inter is a very common 2023-era pairing. |
| Spacing / grid | Consistent, calm. |
| Cards / radius | 18 distinct radius values; no rule (inputs xl, cards 2xl, menu 3xl, nav 1.75 rem, one-offs 1.2/1.35/2/2.5 rem). |
| Buttons | 9 variants × 5 sizes; `primary` and `accent` are near-identical. |
| Forms | 14 px inputs (iOS zoom). Good label/describedby wiring. |
| Icons | Lucide in 159 files — the default look of every shadcn product. |
| 3D assets | 12 renders, used ~37× vs 142 flat stickers. "3D as brand language" is aspirational; three illustration tiers compete (3D, flat, Lucide-as-empty-state). Incomplete finish pairs (fish/paw/leaf). |
| Photography | None. For a product about real cats, real cats are nearly absent from marketing. |
| Colour / emerald | Tokens sound. Emerald well-used. Orange-as-text fails contrast. 73 raw `white/black` and 76 inline HSL literals bypass tokens; `illo-panel` uses Tailwind amber/orange/rose instead of butter/peach/blush. |
| Shadows / borders | Mostly disciplined e1–e3 ladder. |
| Motion | Tasteful; ceremony is the high point. Hero entrance from opacity 0 risks a blank first paint. Fixed full-viewport `mix-blend-mode` grain at z-70 + 23 backdrop-blurs = jank on mid-range Android. |
| Empty / loading / error / success | Four empty-state patterns; skeleton vs spinner has no rule (142 vs 244); `QueryError` covers ~⅓ of error sites; success = toasts only. |

| Quality | Verdict |
|---|---|
| Premium | At arm's length yes; faux-bold Arabic and 6 px card type say no up close. |
| Cohesive | Portal/public yes; admin, vet, community drift. |
| Distinctive | The Cat ID, perforated tickets, paper grain: yes. Header pill, mesh gradients, gradient text, Lucide: no. |
| Modern | Yes. |
| Saudi | **Not visually.** Only the dialect. No Saudi visual idea — and none needs to be folkloric: a passport/Absher-grade *document* aesthetic for the ID is the honest Saudi reference, and it is half-there already. |
| Trustworthy | Calm and honest-looking; undermined by copy contradictions. |
| Memorable | The card and the ceremony. Nothing else. |

**Generic tells to remove:** floating glass pill header · mesh gradient · gradient text · marquee · Lucide as illustration · emoji in headings (🐱🏥❤️🚀 on `/about`) · shadcn token skeleton verbatim.

---

## PART 13 — Arabic / RTL

**Layout: excellent.** Zero physical-direction classes across 222 files; logical properties everywhere; directional icons mostly flipped. This is rarer than it should be and deserves saying.

**Everything *inside* the layout: translated-website symptoms.**

- 🔴 **Arabic-Indic digits rejected** in OTP, phone, age, and all `type="number"` fields; password checklist ASCII-only. The UI *prints* ٨ and ٦ and refuses them as input.
- 🟠 **Digits/currency inconsistent on the money path:** "٣٢٩ ر.س" and "329 SAR" on the same checkout; raw `{p.price}` interpolation; census counter forced Latin; the new riyal symbol unused; admin has its own ternaries.
- 🟠 **Calendar disagreement:** portal Hijri (auto), ceremony + certificate forced Gregorian, community profile Gregorian-with-Arabic-digits. Same cat, three date systems. Recommendation: **Gregorian default with Latin-or-Arabic digits by preference**; Hijri as opt-in. Official identity documents must show one system everywhere.
- 🟠 **Voice split:** Najdi in the dictionary ("وش", "سوِّ", "دايم"), stiff MSA on `/about`, `/products`, `/contact`, membership ("إنها عضوية كاملة مبنية لجعل تربية القطط أسهل وأوفر وأكثر متعة"). One page uses both "أنشئ هوية مرقط" and "سوِّ هوية قطك".
- 🟠 **Terminology drift:** the ID is هوية رسمية / هوية قطك / هوية مرقط / بطاقة تعريف / بطاقة رقمية / هوية رقمية / Cat ID. The plan is خطة / باقة / اشتراك / عضوية. **The brand itself is spelled three ways: مرقط · مُرقّط · مُراقط**, and gendered inconsistently.
- 🟡 English `<title>`/description on the Arabic homepage; no `hreflang`; English unreachable by URL (cookie-only locale).
- 🟡 English-only aria labels in the shared UI kit ("Close", "Dismiss", "Loading", "Show password"); 259 `dir="ltr"` spans, 0 with `lang`.
- 🟡 Stray "CAT FOOD" text exposed from illustrations.
- ⚠️ **"هوية رسمية" / "التعداد الوطني"**: in Saudi Arabic these words belong to the state. A private establishment calling its card "official" and its list "national" is a credibility and regulatory risk. Use **"هوية مرقط"** and **"تعداد مرقط لقطط السعودية"**.

---

## PART 14 — Mobile UX

| Area | Finding |
|---|---|
| Public nav | Hamburger with 7 links; Login is the dominant header element; logo is tiny. |
| Bottom nav | Exists (good, safe-area aware). Slots: Overview · Cats · Community · **Support** · More. 10 px `leading-none` labels in a display face. L&F and Health under "More". |
| Bottom-layer collisions | Sticky register CTA, checkout bar, cookie banner, bottom nav all `z-40 bottom-0`. Cookie banner hides the primary CTA on first visit, and the CTA is programmatically suppressed until consent. |
| Forms | 14 px inputs → iOS zoom on every focus. `inputMode`/`autoComplete` decent; login OTP lacks `OtpBoxes` + `one-time-code`. |
| Touch targets | Drawer close ~28 px, password toggle ~24 px, cropper close ~24 px, lost-mode control `min-h-8`. |
| Cat profile | A long drawer — the worst container for the deepest content. |
| Camera | No camera-first capture on cat photo; forced `capture` on health docs (blocks choosing an existing photo/PDF — wrong way round). |
| QR scanning (vet) | `BarcodeDetector` only — dead on iOS Safari. |
| Performance | Fixed blend grain + blurs; 310 KB OTF; every page dynamically rendered. |

**Native vs web**

| Native (iOS app) | Web (stays, and must stay excellent) |
|---|---|
| Wallet pass, lock-screen/home widget of the cat | `/c/[token]` scan page (finders have no app) |
| Push: vaccine due, finder message, nearby lost alert, clinic request | L&F alert pages + OG (shared into WhatsApp) |
| Camera-first photo + document scan (VisionKit) | Adoption browse, community profiles (SEO + sharing) |
| QR/NFC scan, in-person handover | Registration funnel (no install wall before the first ID) |
| Lost-mode one-tap + location | Vet portal (desktop/iPad), admin |
| Face ID, Apple sign-in, Live Activity for an active lost alert | Checkout (avoid IAP ambiguity; physical goods are exempt but keep it simple) |

`apps/ios` already has the right 5 tabs. It is **uncommitted** — commit it.

---

## PART 15 — Accessibility

**Good foundations:** global `:focus-visible` ring, all 214 `outline-none` replaced, skip link, dialog/drawer focus traps, toast live regions, `Field` label/describedby/alert wiring, reduced-motion switch, only 4 `div onClick`.

**Critical / high failures**

| Sev | Failure | Evidence |
|---|---|---|
| 🔴 | Input rejects native-script digits (a11y *and* i18n failure) | `otp-boxes.tsx:45`, `phone-field.tsx:34` |
| 🔴 | Orange as text **2.78:1**; warning text **2.60:1**; `/60` opacity text 2.74–3.73 incl. 11 px on green | `portal/layout.tsx:165`, `vet/page.tsx:153`, `portal/page.tsx:376` |
| 🟠 | Cat ID microtype ~6–8 px | `cat-id-card.tsx:209-411` |
| 🟠 | 776 instances of ≤ 12 px text (661 `text-xs` + 115 smaller) — Arabic needs ~10–15% *more* size than Latin for equal legibility, not less | grep counts |
| 🟠 | Touch targets < 44 px on close/toggle controls | `drawer.tsx:49`, `field.tsx:57` |
| 🟠 | English aria-labels in the Arabic experience; no `lang` on mixed-language runs | `packages/ui` |
| 🟡 | `QueryError` lacks `role="alert"`; privacy page returns `null` while loading; 400 mapped to "too many messages" | `query-error.tsx:32`, `found-cat-form.tsx:36` |
| 🟡 | Marquee triplicates content for screen readers; infinite float/wiggle snap rather than stop under reduced motion | live DOM |
| 🟡 | Validation errors show raw English server strings to Arabic users | `photo-uploader.tsx:101`, `cat-manage-drawer.tsx:43` |

---

## PART 16 — UX writing

**Best lines in the product (keep, and write everything else to this standard):**
- "إحنا نعدّهم، قط قط."
- "إذا ضاع {name} يوماً، هذه البطاقة تعيده لك."
- "سعر العضو مثبّت لك — تقدير لعضويتك، مو قسيمة خصم."
- "ما ننبّه أحداً على تخمين: التطابق لازم يكون تاماً."
- "يا أهل {cat}" greeting fallback.

**Rewrite or delete:**

| Current | Problem | Replace with |
|---|---|---|
| "نبني مستقبل تربية القطط" | Generic startup | "مكان واحد لكل ما يخص قطك." |
| "عضوية واحدة، عالم من المزايا" | Telecom ad | delete |
| "المنصة الرائدة… منظومة واحدة راقية" | Self-praise | delete |
| "حالتان، وكلاهما مقصود… «غير مفعّلة»" | Tells a new member their free ID is *inactive* | delete the concept |
| "إرشاد تغذية ذكي" / "محرك التغذية الذكي" | AI-washing a calculator | "حاسبة أكل قطك" |
| "صار خطأ بسيط — ما قدرنا نكمل الطلب" for wrong OTP | Hides the fix | "الرمز مو صحيح — جرّب مرة ثانية." / "انتهت صلاحية الرمز — نرسل لك واحد جديد؟" |
| "أرسلنا لك رمز التأكيد" (when nothing was sent) | False | "أكّد بريدك أول — [أرسل الرمز]" |
| "مقابل رمزي" up to SAR 5,000 | Not رمزي | cap it or call it what it is |
| "يُقرأ فقط داخل تطبيق مرقط" | False | "أي جوال يقرأه — ويشوف اسم القط وصورته فقط." |
| "التالي: خطة {name}" after the ceremony | Sales after a gift | "شوف ملف {name}" |
| "لحظة…" full-page loader | Fine word, wrong pattern | skeleton |
| "أنت من الأعضاء المؤسّسين… لست في قائمة انتظار" vs "يحجز لك مكانك في قائمة الانتظار" | Direct contradiction | one definition |

**Voice rule to adopt:** *Najdi-leaning white dialect for everything the member reads in-product and in marketing; clean MSA only for legal, invoices, medical record labels and vet portal.* Write a 1-page glossary: **هوية مرقط** (never رسمية/بطاقة تعريف/رقمية), **خطة العناية**, **مرقط** (unvowelled, masculine), **عيادة موثّقة**, **عضو مؤسِّس**.

Verdict: Saudi ✔ (where Najdi) · Premium ✖ (where MSA-marketing) · Human ✔ · Warm ✔ · Intelligent ✔ in recovery copy · Confident ✖ — it over-explains its own business model to the visitor ("ما نبيع شي اليوم… نعدّ القطط أولاً… أول ما تفتح…").

---

## PART 17 — Trust & credibility

| Asset being entrusted | Present | Missing |
|---|---|---|
| Personal info | PDPL-aware architecture, honest cookie tone, anonymous-owner default | Cookie banner says "essential only" while `lib/track.ts` sets a persistent `anonId` and posts events. A plain "who sees what" page. Data-residency statement. |
| Cat's identity | Permanent number, certificate + verify page, provenance on transfer | Who is the issuer? "رسمية" with no authority behind it. QR re-issue after transfer/loss. |
| Medical info | Consent tiers, revoke, access log (concept) | Blank ledger; public document URLs; permanent break-glass grants; "your data is yours" never said in UI; no export. |
| Ownership | Typed-name confirm, 14-day expiry, audit log | Verified-email gate on accept; no undo window; no dispute path. |
| Contact details | Relay forms, masked ID on scan | Adopter email leak; phone printed on exported card; raw numbers on L&F. |
| Payments | Moyasar hosted fields, excellent return page | No rail logos, no CR/VAT/Maroof, no refund policy at point of payment, VAT 0% invoices. |
| **Company** | Legal entity, phone, IG | **CR number, VAT number, address, founder name/face, Maroof/SBC, a real named vet, any third-party validation.** A sole-establishment name in the footer under a "National Census" headline is the largest single credibility gap on the site. |

---

## PART 18 — Emotional experience

| Emotion | Where it succeeds | Where it fails |
|---|---|---|
| Pride | Ceremony stamp, founding ordinal, story export | Nothing to be proud of *again* after day 1 |
| Attachment | Name-first funnel; "يا أهل {cat}" | No timeline, no memories, no "year of {cat}" |
| Safety | The oath line | The product can't currently keep the oath (Part 11) — **the emotional peak writes a cheque the L&F flow can't cash** |
| Belonging | Founding class, community gallery | 70 cats under a "national" banner; likes only; no local layer |
| Status | Sequential number | Diluted by three definitions of "founding" |
| Convenience | — | Nothing yet saves time |
| Ownership | Certificate, transfer provenance | No profile page to "own" |
| Trust | Honest tone | Contradicted promises |

**"My cat has a place here"** is true for ninety seconds — the ceremony — and then the cat's "place" turns out to be a drawer. Build the place.

---

## PART 19 — Competitive benchmark (principles, not features)

| Reference | Pattern worth learning | How Moracat should differ |
|---|---|---|
| PetHub / Pawscout / Apple Find My | Lost mode is **one tap, instantly shareable, alerts a network**; the tag is a product | Relay privacy (already better than phone-on-tag); clinic-verified identity |
| Absher / Tawakkalna / Nafath | Saudis already trust **document-grade digital IDs with Wallet passes**; OTP-native auth | Borrow the *document* seriousness, never the state's words ("رسمية/وطني") |
| Butternut Box / Smalls / The Farmer's Dog | The plan is **computed for the named pet** and every screen says the pet's name | Already the stated intent — the mechanics must catch up |
| Petfolk / Modern Animal / Joii | Records the owner can actually read; membership = access | Moracat is clinic-agnostic — the record is the *owner's*, portable across clinics. Say so loudly. |
| Airbnb | Two-sided trust: verified badges, structured intros, masked messaging until commitment | Apply to adoption, precisely |
| Duolingo / Headspace | Value before signup wall; one question per screen; streak-free *care rhythm* | The ceremony is already better than most; extend that craft to day 7, 30, 180 |
| Strava / Letterboxd | The object (activity/film) is the shareable unit with great OG | The **cat page** should be that unit |
| Salla/Zid-era Saudi commerce | mada/Apple Pay/Tamara logos, National Address, WhatsApp support as table stakes | Meet table stakes; don't innovate here |

---

## PART 20 — Scores

| # | Dimension | Score | Why |
|---|---|---:|---|
| 1 | First Impression | 6.0 | Striking card + clear CTA; wrong headline, login-dominant header, inconsistent counter, thin proof |
| 2 | Brand Clarity | 5.0 | Census / membership / waitlist / inactive-ID; tagline absent; three founding definitions |
| 3 | UX | 5.5 | Excellent recovery surfaces and funnel entry; broken loops in L&F, consent, records |
| 4 | UI | 7.0 | Calm, consistent in portal/public; radius sprawl, generic chrome, drifting admin/vet |
| 5 | Information Architecture | 4.5 | Organised by module, not by cat; 14 flat items; no cat page |
| 6 | Navigation | 4.5 | Support in thumb zone, emergency under "More", empty destinations in top nav |
| 7 | Onboarding | 6.0 | Name-travel + no-cat door are excellent; 9 required inputs, password-first, digit rejection, dead ends |
| 8 | Cat Registration | 6.5 | Fast when it works; double-asked name, unverified phone, no kitten path, <1-month block |
| 9 | Cat ID | 6.0 | Card 8, product 4.5; no Wallet, no tag, scan shows vets nothing, contradictory privacy copy |
| 10 | Dashboard | 5.0 | Upsell-first, vanity tiles, overdue invisible, no lost state |
| 11 | E-commerce | 3.5 | Off in prod (right); on-path mischarges multi-cat, no recurring fulfilment, contradictory renewal copy |
| 12 | Veterinary | 3.5 | Strong model, broken ledger + consent loop, one-clinic directory, no discounts, iPad scan fails |
| 13 | Adoption | 5.0 | Real flow + transfer linkage; broken privacy promise, no moderation/screening |
| 14 | Lost & Found | 4.5 | Fast report; unshareable, un-alerted, split systems, orphaned finder messages |
| 15 | Mobile UX | 5.5 | Bottom nav + safe areas; iOS zoom, collisions, small targets, heavy compositing |
| 16 | Arabic/RTL | 6.0 | Layout 9; digits, dates, currency, voice, terminology, typography 4 |
| 17 | Accessibility | 5.5 | Good skeleton; contrast, tiny type, targets, English aria, script-hostile inputs |
| 18 | Trust | 4.0 | Honest tone; promises contradicted by code; no regulatory/company proof; "official/national" risk |
| 19 | UX Writing | 6.0 | Flashes of real voice; MSA-marketing filler, generic errors, false statements |
| 20 | Visual Identity | 7.5 | The card, tickets, paper — ownable. One-weight Arabic, three illustration tiers hold it under 8 |
| 21 | Emotional Design | 6.5 | One superb moment; nothing after it |
| 22 | Product Differentiation | 7.5 | Portable clinic-written identity + transfer provenance + relay privacy is a real, uncopied idea |
| 23 | Overall Cohesion | 4.5 | Many well-made parts that contradict each other in copy, IA and promise |
| 24 | Long-term Retention Potential | 4.0 | *As built.* (Potential of the concept is 8+.) Reminders starve without data; no timeline; no push on web |
| | **Overall (mean of 24)** | **5.4** | |

Trend vs. July (58/100): brand and engineering stayed strong; surface area roughly doubled (adoption, L&F, transfer, vet registration, iOS) while cohesion and loop-completeness fell. **Breadth has outrun depth.**

---

## PART 21 — Severity classification

**🔴 CRITICAL**
1. Arabic-Indic digits rejected in OTP/phone/age; ASCII-only password rules.
2. Adoption privacy promise broken (email disclosed).
3. Ownership transfer accept without verified email.
4. QR found-reports have no inbox; notification links to a page without them.
5. L&F alerts cannot be shared; no OG; no nearby alert.
6. Medical documents at public URLs.
7. Access ledger blank; clinic consent request 400s; no owner Approve.
8. Break-glass: unthrottled, any cat, unmasked phone, permanent grant.
9. Homepage positioning incoherent; "رسمية/وطني" claims; 70 vs #86.
10. "Free forever" vs "inactive until paid" ID; Founding Member ×3 definitions.
11. *(latent, commerce-on)* multi-cat pays ×N gets ×1; no month-2 fulfilment; renewal copy contradiction; VAT 0%.
12. Exported Cat ID prints owner phone; drawer copy about QR is false.

**🟠 HIGH**
13. No cat profile page. 14. 14-item flat nav; emergency under "More". 15. No Apple Wallet. 16. Scan shows vets nothing; no shareable health summary. 17. Owner health entries can't be edited/deleted; no weight log; overdue invisible. 18. 9 required onboarding inputs; phone unverified; owner name twice. 19. One Lyon weight / faux bold / tracking on Arabic / display face as body. 20. Contrast failures; ≤ 12 px text ×776. 21. 14 px inputs (iOS zoom). 22. `/benefits` in top nav with zero partners; directory of one self-named clinic; city search 400. 23. Ceremony exits to a sales/"قريباً" page. 24. Adoption: no report, no review, no photo requirement, SAR 5,000 "رمزي". 25. Cookie banner understates tracking and gates the CTA. 26. Feeding tool leaks pricing + subscribe CTA in Census mode. 27. No company trust signals (CR/VAT/Maroof/address/founder). 28. Vet scan dead on iPad/Safari.

**🟡 MEDIUM**
29. Hijri/Gregorian disagreement. 30. SAR/ر.س + Latin/Arabic digit mixing. 31. Najdi/MSA split; terminology drift; brand spelled 3 ways. 32. English title/meta on Arabic page; no hreflang. 33. Dashboard vanity tiles; savings tile will read 0. 34. Four empty-state patterns; skeleton/spinner without a rule. 35. Two lost systems. 36. Kitten path absent; clinic-claim skips ceremony. 37. Generic OTP error copy. 38. Touch targets; English aria labels; no `lang`. 39. Address form not prefilled, no National Address. 40. Stale launch date default; stale metadata.

**🟢 LOW**
41. Radius sprawl; duplicate button variant. 42. Marquee; mesh/gradient text. 43. Emoji headings on `/about`. 44. Hero preview ID not sequential. 45. RTL centring bug `home-view.tsx:183`; unmirrored hover/icons. 46. Grain blend-layer perf. 47. "CAT FOOD" text leak. 48. Orphaned `/portal/welcome`, orphaned cart/PDP API. 49. Entity name printed twice.

---

## PART 22 — What a great product would do

**W1 · Lost cat**
CURRENT: post in 3 taps → a row in a list, with advice to "share the link" and no way to. → PROBLEM: the emergency ends where it should begin. → WHY: this is the one moment a member judges whether the ID was real; it is also the only organically viral surface. → IDEAL: publish → WhatsApp share sheet + poster + nearby alert in the same breath. → **EXACT CHANGE:** server-render `lost-found/[id]` with `generateMetadata` + OG poster image; add Share/WhatsApp/Copy/Download-poster to the success state and every notice row; merge `LostModeCard` into the board flow (one system); single finder inbox under the cat's Safety tab; notification deep-links to it; Turnstile on relay; chip match on edit and on LOST-after-FOUND.

**W2 · The cat has no home**
CURRENT: drawer on a list page. → PROBLEM: the core object has no URL, no hierarchy, no room to grow. → WHY: every future feature (plan, records, timeline) needs a place to live; IA can't be fixed without it. → IDEAL: `/portal/cats/[id]` is the app's true home; single-cat members land there. → **EXACT CHANGE:** add `page.tsx` with header + Identity/Health/Safety/Visibility sections; move drawer modules into them; move lost mode out of Privacy; put transfer/adoption in an overflow menu; delete the drawer.

**W3 · Promises vs. behaviour**
CURRENT: four user-facing privacy statements are false. → WHY: one screenshot of a leaked email next to "ما نكشف بريدك" ends the brand. → **EXACT CHANGE:** remove `email` from the accepted-request payload unless the adopter ticks "شارك بريدي"; strip owner phone from the default export (opt-in "collar tag" variant only); correct the QR sentence; move health documents to signed, expiring URLs; make cookie copy match `track.ts` or stop setting `anonId` pre-consent.

**W4 · Arabic input**
CURRENT: `\D` strips ٠-٩. → **EXACT CHANGE:** one `normalizeDigits()` in `packages/core` (Arabic-Indic + Persian → ASCII) applied in `OtpBoxes`, `PhoneField`, age, every numeric field (switch `type="number"` → `inputMode="numeric"` text); password rule → "٨ أحرف على الأقل" only (length beats composition; NIST-aligned); e2e test typing `٠٥٥…`.

**W5 · Positioning**
CURRENT: census → membership → waitlist → inactive ID. → **EXACT CHANGE:** H1 to owner benefit; census demoted to proof; delete active/inactive ID concept from `/about` and `membership.tsx:38`; one Founding definition in one constant; rename to "هوية مرقط" / "تعداد مرقط"; fix counter to one source; Arabic `<title>`/description.

**W6 · Vet trust loop**
**EXACT CHANGE:** adapter for ledger (`clinic.ar/en`, localised surface names); remove `scope` from client request or add to DTO; inline Approve/Decline on the notification and on the cat's Health tab; break-glass → throttle, require prior relationship *or* second staff confirm, mask phone behind a logged "reveal", store as `EMERGENCY` with 24 h expiry; say "سجل قطك ملكك أنت" at the top of Health access; `BarcodeDetector` fallback (`zxing`/`jsQR`).

**W7 · Transfer safety**
**EXACT CHANGE:** `RequireEmailVerified` on accept; token-only acceptance (drop id-as-token); pre-flight panel listing exactly what the sender loses; 48 h undo; prompt QR re-issue; don't overwrite adopter's primary cat; pre-warn on active subscription.

**W8 · Onboarding weight**
**EXACT CHANGE:** passwordless OTP default; life-stage chips; contact step moved after the ceremony with OTP verify; ask owner name once; ceremony exits to the cat page with a 3-item checklist; kitten door seeds vaccine schedule.

**W9 · Retention engine**
**EXACT CHANGE:** on registration generate a care schedule from age (core vaccines, deworming, annual check) marked "estimated — confirm with your vet"; show overdue (remove `dueAt >= now` filter, add overdue state + T+3/T+14 nudges); owner weight log; edit/delete own entries; monthly digest email; move cron to an external scheduler so it can't sleep.

**W10 · Arabic typography**
**EXACT CHANGE:** license Lyon Arabic *Text* (or pair a text face e.g. IBM Plex Sans Arabic / Thmanyah Sans) for UI/body, Display for headings only; ship ≥ 2 real weights as subset WOFF2; `[dir=rtl]{letter-spacing:0!important}` on tracking utilities + remove tracking from the scale under RTL; RTL display line-height ≥ 1.25; min 12 px Arabic anywhere, 14 px body, 16 px inputs; add an Arabic-capable mono or stop using `font-mono` on Arabic card labels.

**W11 · Commerce (before flipping the flag)**
**EXACT CHANGE:** activation multiplies by `perCat`/cat modules; monthly fulfilment job creates orders and advances `nextDeliveryAt`; household price shown from the first recommendation; one renewal truth in all three places; VAT per FIN-002; first-delivery date at checkout; rail logos + CR/VAT + refund link; tracking UI; plan lives on the cat page.

---

## PART 23 — Redesign priority

### PHASE 1 — MUST FIX (usability · conversion · trust · comprehension)
1. Digit normalisation + password rule (W4).
2. Make every privacy statement true (W3).
3. Transfer accept: verified email + token-only (W7).
4. L&F: share/OG/poster, one system, finder inbox (W1).
5. Vet: ledger adapter, consent request/approve, break-glass hardening, directory search 400 (W6).
6. Homepage repositioning + single Founding definition + kill "inactive ID" + counter truth + Arabic metadata (W5).
7. Header: Register filled, Login text; un-gate mobile CTA from cookie banner; shrink banner.
8. Remove `/benefits` from nav; fix feeding-tool commerce leak; hide Addresses when commerce is off.
9. Contrast fixes (`text-accent`→`accent-ink`, warning, `/60` opacities); 16 px inputs; 44 px targets.
10. Coded OTP/verification errors; adopter verification dead end.
11. Company trust block: CR, VAT (if any), address, founder, PDPL line.

### PHASE 2 — SHOULD FIX (substantially better product)
12. Cat profile page + new IA + 4-tab mobile nav (W2, Part 3).
13. Dashboard hierarchy (Part 7).
14. Onboarding re-architecture (W8).
15. Retention engine: schedule, overdue, weight, edit/delete, digest, reliable cron (W9).
16. Apple Wallet pass; shareable vet health summary link; render vaccination standing on scan page.
17. Adoption safety: report button, photo required, verified-phone lister, fee cap, structured intro, consented contact reveal, adopter ceremony.
18. Arabic typography overhaul (W10); one calendar; one currency/digit formatter everywhere.
19. Voice glossary + rewrite `/about`, `/products`, `/contact`, membership copy.
20. Commerce blockers (W11) — only then flip the flag.
21. Commit `apps/ios`; align web IA with it.

### PHASE 3 — PREMIUM POLISH (good → distinctive)
22. Document-grade ID aesthetic system (guilloché, microtype done *legibly*, serial logic) extended to certificate, poster, Wallet pass, email.
23. One illustration tier per context; commission missing 3D finishes; replace Lucide empty states.
24. Life timeline + yearly "سنة {cat}" keepsake + birthday story.
25. Physical QR/NFC collar tag (first physical product; makes the oath true).
26. Radius/variant consolidation (3 radii, 5 buttons); retire marquee, mesh, gradient text, glass pill.
27. Reunion and adoption ceremonies as shareable moments.
28. Real photography of member cats in marketing (with consent) — replace stock-feeling abstraction with the actual community.

---

## PART 24 — Kill list

| Item | Action |
|---|---|
| "National Census" as the *hero* concept; "هوية رسمية"; "وطني" | **Remove** (rename, demote to proof) |
| Active / inactive Cat ID concept | **Remove** |
| `/benefits` in nav; 3-step partner redemption copy | **Hide** until ≥ 5 partners |
| "خدمات مستقبلية / مسابقات قادمة / وما بعدها" | **Remove** |
| Announcement bar | **Remove** |
| Marquee ribbon; footer chase marquee | **Remove** (keep one at most) |
| Dashboard vanity tiles, savings tally, community promo, referral card, "تعرّف على مرقط" | **Remove / move to Me** |
| Membership upsell as dashboard slot #1 | **Remove** while commerce is off; contextual after |
| Portal "About", duplicate Notifications, Addresses (commerce off), Hand-overs + Health access + Privacy as global items | **Consolidate** into the cat page / Me |
| `cat-manage-drawer` | **Replace** with the profile page |
| `LostModeCard` as a separate system | **Consolidate** into L&F |
| `/products` "قريباً" page + blog + feeding calculator in primary nav | **Hide** to footer |
| Forced subscribe quiz after ceremony; `/portal/welcome` (orphan) | **Remove** |
| Orphaned cart / PDP / à-la-carte API | **Delay** — delete or park; do not build a store |
| STC Pay/Tabby wiring, per-cat modules "Phase 2", prepay gifts | **Delay** |
| Hijri-by-default | **Simplify** → Gregorian default, Hijri opt-in |
| Password at signup | **Simplify** → OTP |
| Button `accent` variant; 15 of 18 radii; 3 of 4 empty-state patterns | **Consolidate** |
| Emoji in headings; gradient text; mesh gradients; "smart/ذكي" labels | **Remove** |
| Appointments, in-app chat threads, competitions, community feed features | **Do not build** |
| Adoption fees above token level | **Remove** |

---

## PART 25 — Ten biggest missed opportunities

1. **The lost-cat alert as the growth engine.** A beautiful poster unfurling in Saudi neighbourhood WhatsApp groups, with "مسجّل في مرقط" on it, is free, emotional, hyper-local distribution. It is currently a bare URL.
2. **The scan page as a storefront for non-members.** Every finder, vet, groomer and friend who scans a tag meets Moracat. Today that page shows a name and a relay form; it should show what the ID *is* in one line and convert.
3. **Clinic-written identity as the moat — via the non-partner door.** A shareable health-summary link puts Moracat in front of every vet in the Kingdom without a partnership. Clinics that see it three times ask to join.
4. **Kitten year.** The strategy names it; the product has no kitten path, no schedule, no "first year" narrative. A generated vaccine/deworming calendar is the single cheapest retention feature available.
5. **Adoption as the top of the funnel.** Every adoption mints a member at the most engaged moment of pet ownership — and it currently ends in a toast.
6. **Ownership provenance.** A cat whose identity, vaccines and history verifiably travel between owners is a new primitive in a market with informal breeding/selling. "اطلب هوية مرقط قبل ما تشتري أو تتبنى" is a category-defining sentence.
7. **Apple Wallet + physical tag.** Saudis live in Wallet (mada, Nafath-adjacent habits). A pass on the lock screen and a tag on the collar turn a web page into a possession — and the tag is a first, honest SKU.
8. **City classes & local belonging.** "دفعة جدة ٢٠٢٦", "قطط حي الملقا". Status + locality + the L&F alert radius are the same graph.
9. **The data nobody else has.** Breed, age, neuter, vaccine and geography of Saudi cats — useful to clinics, municipalities, welfare groups. The "census" is valuable as a *yearly report* ("تقرير قطط السعودية ٢٠٢٦"), which earns press and authority. It's a PR asset, not a hero headline.
10. **Commerce that needs no selling.** When the plan is a section of the cat's page computed from *his* record, the box stops being a product to market and becomes the obvious next line of the profile. That is how B beats A — and it's cheaper than a funnel.

---

## PART 26 — Final verdict

### CURRENT MORACAT — **5.4 / 10**

**What Moracat currently feels like.** A gorgeous membership card issued by a company that hasn't decided what the membership is. You arrive at a "national census" run by a sole establishment, receive a genuinely moving ninety-second ceremony, and are then walked to a page that says "soon". Behind the card is a drawer instead of a profile, a lost-cat system you can't share, a vet directory of one, a benefits page with no benefits, and a set of privacy sentences the code doesn't honour. It is wide, sincere, well-engineered, visually calm — and thin exactly where it claims to be deep. It feels like a very good *demo of a category* rather than a product someone relies on.

**What Moracat could become.** The place a Saudi cat officially *exists*: one permanent identity that any phone can read, any clinic can write to with the owner's permission, that turns red and mobilises a neighbourhood when he's lost, that moves with him — history intact — when he changes homes, and that quietly arranges what he eats based on what his record says. One object, one page per cat, four tabs, Arabic that reads like a person from Riyadh wrote it, and a document-grade aesthetic that makes owners want it in their Wallet. Commerce is simply the last section of the cat's page.

### The 10 changes that would move the product the most (ranked by impact)

1. Make Lost & Found shareable, alerting and single-inboxed — make the oath true.
2. Build the cat profile page and reorganise the entire IA around it.
3. Make every privacy/trust statement true (adoption email, exported phone, QR copy, public documents, cookie copy, transfer verification).
4. Accept Arabic digits everywhere; drop composition password rules; go OTP-first.
5. Reposition the homepage on owner benefit; kill "official/national/inactive ID"; one Founding definition; reconcile the counter.
6. Fix the vet trust loop (ledger, request/approve, break-glass) and ship the shareable health summary.
7. Build the retention engine: generated care schedule, overdue states, weight log, editable entries, digest, reliable cron.
8. Cut onboarding to 4 inputs before the ceremony; verify the phone after it; exit to the profile, never to sales.
9. Fix Arabic typography (text face, real weights, zero tracking, line-height, minimum sizes) and unify digits/dates/currency.
10. Apple Wallet pass + collar tag.

**THE SINGLE BIGGEST UX PROBLEM** — The cat has no home. The product's core object is a drawer, so everything about the cat is scattered across 14 global destinations and nothing accumulates.

**THE SINGLE BIGGEST UX OPPORTUNITY** — The lost-cat moment: one tap → poster in WhatsApp → neighbours alerted → finder relay → reunion. It's the proof of the ID, the trust-builder, and the growth loop in one flow.

**THE SINGLE BIGGEST BRAND/UI PROBLEM** — An Arabic-first premium brand whose Arabic is set in one synthesised-bold display weight with negative tracking at 10 px — and whose name is spelled three ways. The Arabic must become the *best*-typeset thing on the screen, not the fallback.

**THE SINGLE BIGGEST DIFFERENTIATOR** — A portable, consented, clinic-written identity that survives a change of owner. Nobody in the region — and almost nobody globally — has ownership provenance + medical record + lost-recovery on one permanent ID.

### "If Moracat launched tomorrow with the current UX…"

**What users would understand immediately:** that they can type their cat's name and get a beautiful free ID card in about two minutes; that it's Saudi and speaks like them; that nobody is asking for a bank card.

**What would confuse them:** whether this is a census, a membership, a waitlist or a future shop; what "official" means and who stands behind it; why 70 cats is "national"; why their free ID is described elsewhere as "inactive"; what "founding member" actually grants; why the benefits page has no benefits and the clinic directory has one clinic; where their cat's page is; why the "report lost" button is under Privacy; why the form won't accept the numbers their keyboard types.

**What would make them come back:** today — a birthday email, and the card if they saved it. That's all. After Phase 1–2 — a red/amber/green line about their cat every time they open it, a reminder that knew the vaccine was due before they did, a vet who says "أرسل لي رابط مرقط", and the quiet knowledge that if he slips out the door tonight, one tap puts his face in every WhatsApp group in the neighbourhood. **That** is "لِحياة قطّك كلّها" — and the distance between the two is about two focused quarters of depth over breadth.

---

## Implementation log — 2026-09-21 (same day)

Phase 1 was implemented against the working tree (uncommitted). Every audit claim was re-verified in source first; three were corrected on inspection.

**Shipped (verified: core 98 + web 51 unit tests, API + web type-check, web lint, e2e 481 checks across 4 suites):**
- Arabic-Indic/Persian digits accepted everywhere — `packages/core/src/digits.ts`, normalised in `Field`, `PhoneField`, `OtpBoxes` and 12 call sites; `type="number"` → numeric text input. Password rules script-agnostic (`\p{L}`/`\p{Nd}`), bcrypt limit measured in bytes. GCC 8-digit mobiles pass (`nationalNumberOk`).
- Transfer hijack closed — acting on an offer needs the emailed token **or** a verified email (`OwnershipService.assertRecipient`); unverified accounts are not shown offers. New e2e block.
- Lost & Found — server-rendered metadata + poster OG image, WhatsApp/share/copy on the notice page (owner and neighbours) and on every live row in the portal, post-publish nudge; QR found-reports now have an inbox (`GET /cats/:id/found-reports`, shown in `LostModeCard`), lost mode links to the board, tab renamed "الأمان والخصوصية", Lost & Found promoted to the mobile thumb bar.
- Notifications honour the server's deep link (`inAppPath`, same-site only, tested) — previously every cat notification opened `/portal/cats`.
- Vet — access ledger adapter (clinic names no longer blank; surfaces localised), consent request no longer 400s, owner gets an approve card via `/portal/health-access?cat=&org=&tier=` (clinic name resolved by id server-side), break-glass throttled and its audit grant expires after 24 h, directory city search works across both city systems.
- Honesty — adoption privacy copy now says exactly when the email is released; QR/export copy corrected; cookie notice + policy describe the anonymous measurement; feeding tool no longer sells a plan while commerce is off; `/about` no longer calls the free ID "inactive"; one Founding Member definition; `/benefits` leaves the nav until partners exist; Addresses hidden with commerce off.
- Positioning — hero leads with the owner benefit ("هوية لقطك، لحياته كلّها"), "الوطني/رسمية" removed from marketing claims, locale-aware root metadata, header: Register filled / Login quiet.
- Dashboard shows **overdue** vaccines (superseded doses excluded); scan page shows vaccination standing; health panel cache + forced-camera fixes; coded email-OTP errors; adopter verification dead end given a link; brand spelled "مرقط" everywhere.
- A11y/mobile — `warning-ink` token (6.3:1), accent-as-text fixed, 16 px controls on phones (no iOS zoom), 44 px password toggle with Arabic label, compact cookie notice.

**Audit claims corrected on inspection:**
1. *Adopter email "leak"* — deliberate and the only coordination channel (asserted by e2e). Fixed the **promise**, not the behaviour.
2. *OG poster in Arabic* — the image renderer cannot shape Arabic (throws on لا). Poster is Latin-only by design; Arabic lives in og:title/description.
3. *Exported card prints owner phone* — it is the card's Safety job for a physical tag; kept, and now disclosed plainly beside the export buttons.

**Deliberately NOT done (need a founder decision or are Phase 2+):** cat profile page + 4-tab IA; onboarding re-architecture / passwordless; Apple Wallet; shareable vet health summary; Arabic text typeface + real weights (licensing); "هوية رسمية" on the card face and ceremony (brand decision); medical documents on signed URLs (storage change); commerce blockers; census counter 70-vs-86 (needs prod data); CR/VAT numbers (set `NEXT_PUBLIC_CR_NUMBER` / `NEXT_PUBLIC_VAT_NUMBER`).
