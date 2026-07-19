# MRC-GTM-003 — Claude Code Prompt: Pre-Launch (Census) Mode

> Companion to `MRC-GTM-001-go-to-market.md` §1 Phase 0 and `MRC-GTM-002` (social prompts).
> Purpose: take the site from "commerce-ready" to "Census pre-launch", where the only
> thing a visitor can do is give their cat an identity — for free.

**Read before running:** the commerce kill-switch already exists (built during the
2026-07-05 Community Mode pivot). This prompt is an *audit + reframe*, not a build.
Do not let the agent rebuild what's there.

---

## The prompt (copy from here)

```
CONTEXT

Moracat is entering Phase 0 of its go-to-market plan — "The Census"
(design/marketing/MRC-GTM-001-go-to-market.md, §1). For the next ~6 weeks the site
has exactly one job: register free Cat IDs. Nothing is for sale. The goal is 1,000
Cat IDs before the first box ever ships, with the first 1,000 permanently marked
"Founding Member — Riyadh Class of 2026" using their real sequential ID numbers.

A commerce kill-switch already exists from the 2026-07-05 Community Mode pivot:
- apps/api/src/common/config/features.ts — commerceEnabled() reads COMMERCE_ENABLED,
  defaults false (fails closed)
- apps/web/lib/features.ts — mirrors it via NEXT_PUBLIC_COMMERCE_ENABLED
- apps/api/src/common/guards/commerce.guard.ts + common/decorators/commercial.decorator.ts
  — @Commercial() routes return 403 { code: "MEMBERSHIPS_COMING_SOON" }
- render.yaml pins COMMERCE_ENABLED=false, PAYMENTS_MODE=mock

DO NOT rebuild any of this. Audit it, close the gaps, and reframe the front door.

KNOWN PRODUCTION STATE (confirmed with the owner, 2026-07-20):
- COMMERCE_ENABLED=true is currently set on BOTH Render (API) and Vercel (web).
  The repo defaults to false; production overrides it. Commerce is live right now.
- No real money has moved: there are no live paying subscribers and no completed
  real orders. Only test/mock activity. This is why a cold flip is safe — see below.

WEBHOOK HAZARD (understand this before changing anything):
apps/api/src/payments/webhooks.controller.ts is decorated @Commercial() at the
CONTROLLER level, so disabling commerce makes the PSP webhook endpoint 403 every
incoming event. With no real transactions in flight that is harmless today. It would
NOT be harmless later: once real payments exist, flipping commerce off strands
in-flight captures, and PSPs drop events permanently after their retry budget.
Do not "fix" this by ungating webhooks now — just leave a clear comment at the
controller recording the constraint for whoever flips the switch at launch.

---

TASK A — Audit the kill-switch for leakage (highest priority)

Find every path by which a visitor could reach a price, a checkout, a payment, or a
membership activation while COMMERCE_ENABLED=false. For each, confirm it is gated or
fix it. Be exhaustive and adversarial — assume the switch has drifted since it was built.

Check at minimum:
1. API — every controller/route touching checkout, subscriptions, orders, payments,
   webhooks, invoices, refunds, plans, and the supplier catalog. Verify @Commercial()
   coverage; verify the defense-in-depth !commerceEnabled() throws inside the services
   still exist. A route that merely READS plan prices still leaks pricing — decide
   deliberately whether it should be gated and say why.
2. Web — every page, component, and CTA that renders a price, a plan card, a
   "Subscribe"/"Activate"/"Buy" action, a cart, or a checkout step. Search for hardcoded
   SAR amounts and the plan prices (249/349/529) leaking into copy, metadata,
   JSON-LD, or OG tags.
3. Navigation and sitemap — apps/web/app/portal/nav.ts, footer links, sitemap.xml,
   robots.txt. A gated page that is still linked or indexed is a leak.
4. Email — apps/api/src/mail/: confirm the commerce templates (order confirm, receipt,
   subscription confirmed) cannot fire while commerce is off.
5. Deep links — hitting /portal/checkout or /portal/subscribe directly, with a crafted
   query string, or via a stale bookmark must land somewhere honest, never a broken
   or half-rendered checkout.
6. Admin — the admin console may retain commerce surfaces for internal readiness, but
   it must not be able to charge a real card while the switch is off. Verify.

Report findings as a table: surface | file:line | leaks? | fix applied.

---

TASK B — Environment and deploy state

Production currently has commerce ON (see KNOWN PRODUCTION STATE above). It must go OFF.

1. Verify render.yaml and any Vercel config still pin COMMERCE_ENABLED=false,
   NEXT_PUBLIC_COMMERCE_ENABLED unset-or-false, PAYMENTS_MODE=mock — so that a fresh
   deploy from a clean checkout fails closed.
2. Confirm the boot-time invariant still holds: the API must refuse to start if
   commerce is enabled while the PSP is in mock mode. If that assertion has been
   weakened or removed, restore it. Note the ordering consequence: when the owner
   flips production, COMMERCE_ENABLED must go false BEFORE PAYMENTS_MODE goes back to
   mock, or the API will refuse to boot in between.
3. Do NOT attempt to change production environment variables yourself — they live in
   the Render and Vercel dashboards. Instead, output an explicit, ordered checklist of
   the exact variables the owner must set in each dashboard, with required values, and
   note that each side needs a redeploy to take effect.
4. Confirm the two sides can be briefly inconsistent during the rollout (API off, web
   still on, or vice versa) and that neither ordering produces a broken or dishonest
   page — the web must degrade to "coming soon", never to an error.

---

TASK C — Reframe the front door as the Census

The site currently sells memberships. It should now count cats. Rework the public
surfaces so a first-time visitor understands: my cat can have an official identity,
it is free, it takes two minutes, and I am early.

1. Home page (apps/web/app/page.tsx) — the hero's single action becomes registering a
   cat, not viewing plans. The census framing («التعداد الوطني للقطط») leads. Keep the
   existing cat-first onboarding funnel intact: the cat name typed in the hero must
   still travel via sessionStorage to register and on to the ID ceremony.
2. Live census counter — surface the real registered-cat count as a first-class element
   (hero and/or a dedicated strip). It MUST read from the database. If no endpoint
   exists, add one; cache it sensibly. Never hardcode, estimate, or round up a number.
   If the count is genuinely small, show it anyway — honesty is the campaign.
3. Founding Member status — the first 1,000 Cat IDs are Founding Members. Verify this
   is derived from the real sequential ID number, not a flag someone can set. Surface
   it on the Cat ID card and the cat's profile. Do not display any "only N spots left"
   countdown; state the true number registered so far and let the reader do the math.
4. Waitlist — registering a Cat ID means joining the membership waitlist. Make sure
   that is stated plainly at registration (consent-clean, PDPL-safe, R106) and that the
   waitlist position is honest if shown.
5. Stand source attribution — the physical stands (GTM §2) open the register flow with
   ?src=stand-004. Confirm that source code is captured, persisted against the Cat ID,
   and visible in admin. If it is not implemented, implement it — per-stand yield data
   decides the entire Year-1 channel strategy and cannot be backfilled.
6. Copy — remove or rewrite any public copy that promises a box, a delivery, or a
   member rate as if available today. Anything that describes a future capability must
   read as forthcoming, in both Arabic and English.

EXPLICIT EXCEPTION — do not touch: apps/web/app/portal/subscribe/page.tsx keeps its
"Coming Soon" language exactly as written. The owner chose that wording deliberately
on 2026-07-06. Leave it alone.

---

CONSTRAINTS (non-negotiable)

- design/DESIGN-AUTHORITY.md wins over convenience. Read the relevant sections before
  touching any page, and cite rule IDs (R001–R120) in your commit messages.
- Especially: R006 no fake scarcity · R040 never claim what the product doesn't do ·
  R082 name the cat · R085 no coupon shouting · R101 Arabic-first, RTL-native.
- Bilingual ar/en for every string you add or change. Arabic is the default experience.
- Compose from existing tokens and components (packages/ui, apps/web/components/
  illustrations.tsx) — do not invent new visual primitives.
- Next.js page files export only the default component; shared components go in
  apps/web/components/.
- Preserve business logic. Commerce code is disabled, never deleted — it must switch
  back on cleanly by flipping one variable.

---

VERIFICATION (do this, don't assume)

1. Run pnpm e2e and make it pass. Extend the suite with cases that assert commerce is
   unreachable while the switch is off: gated API routes return the documented 403,
   and no public page renders a price.
2. Run the app and walk the real funnel in the browser: home → type cat name →
   register → Cat ID ceremony → the card shows Founding Member status. Screenshot it.
3. Deliberately attack your own gate: hit every commerce deep link directly and confirm
   each lands somewhere honest.
4. Report results truthfully. If something fails or you skipped it, say so plainly with
   the output — do not describe an unverified change as working.

DELIVERABLES

1. The leakage audit table from Task A.
2. The dashboard env-var checklist from Task B.
3. The code changes, committed on a branch (not main), with R-rule citations.
4. A short "what a visitor can and cannot do right now" summary — the honest state of
   the site after your changes.
5. Anything you found that worries you but was out of scope.
```

*— MRC-GTM-003, 2026-07-19.*
