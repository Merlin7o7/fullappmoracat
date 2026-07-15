# Apple Wallet (PassKit) — Cost & Effort Brief

**For:** go / no-go decision · **Date:** 2026-07-12 · **Grounded in:** `apps/api/src/wallet/wallet.service.ts`

## TL;DR

Apple Wallet is a **~1 engineering-week v1 build**, ~**$99/year**, plus a one-time Apple enrollment you need to start *now* because Apple's approval has lead time. The codebase is already 70% ready — the wallet service models the exact pass fields and already anticipates Apple (`apple: false`, `WALLET_APPLE_*` envs, a note that `.pkpass` needs a real PKCS#7 signature). The only genuinely new work is the signed `.pkpass` builder and the pass artwork. **Recommendation: ship offline card-caching now (1 day, zero dependency), start the Apple org enrollment in parallel today, build the static pass when certs land, and defer live-update push to post-launch.**

## What's already done (reuse is high)

`googleSaveUrl()` already: queries the cat + owner, assembles the bilingual field set (Cat ID number, owner, emergency contact, vaccination status, member-since), embeds the secure `MRCV1:${qrToken}` QR (never a public URL), and fails closed when unconfigured. Apple Wallet reuses **all of it** — only the signing/packaging differs (Google = an RS256 JWT link; Apple = a signed `.pkpass` file).

## What's genuinely new

| Work | Owner | Effort |
|---|---|---|
| Apple Developer Program enrollment (**org**, not individual) | You | ~1–2 hrs active + **Apple approval lead time (days; longer if a D-U-N-S number isn't already registered)** |
| Create Pass Type ID + signing certificate, export `.p12` | You (once approved) → hand to eng as `WALLET_APPLE_*` envs | ~1 hr |
| `.pkpass` builder — signed zip (pass.json + images + manifest + PKCS#7 CMS signature via `passkit-generator` or `node:crypto`) | Eng | ~2–3 days |
| Pass artwork — icon + logo (+ optional strip) at @1x/@2x/@3x, on-brand deep-green | Design | ~0.5 day |
| Endpoint `GET /wallet/cats/:id/apple` (MIME `application/vnd.apple.pkpass`) + flip `availability().apple` to `!!appleCreds()` | Eng | folded into above |
| "Add to Apple Wallet" button (Apple badge) + iOS detection on the cat card | Eng | ~0.5 day |
| Device QA — add on a real iPhone, confirm partner-verify QR scans | Eng | ~1 day |
| **v1 total** | | **~4–5 eng days + 0.5 design day** |

## Deliberately deferred (v1 → post-launch)

**Live pass updates** (auto-refresh a pass when membership flips Inactive→Active, or vaccination status changes). This needs Apple's registration web service (4 REST endpoints) + APNs push — **~3–5 extra days**. A Cat ID changes rarely; for v1 a status change is reflected next time the member re-opens/re-adds. Not worth blocking launch.

## Risks & notes

- **Org enrollment lead time is the critical path**, not the code. If the legal entity has no D-U-N-S number yet, budget 1–2 weeks. Start today.
- **Individual vs org:** an individual account is faster but the pass issuer shows a personal name — wrong for a brand. Use the org (Abdulrahman Mansour Alghamdi Trading Establishment).
- **Cert rotation:** the Pass Type ID signing cert expires; needs a documented ~annual renewal runbook or passes silently stop issuing.
- The wallet service's fail-closed discipline means a half-configured Apple setup shows **no** button (never a dead control) — safe to deploy incrementally.

## Recommended sequence

1. **Now (no dependency):** offline Cat ID caching — render the primary card read-only from `localStorage` when offline, so the safety job (R036/R114) works without signal *regardless of wallet*. ~1 day. I can build this next.
2. **Now (parallel):** you kick off Apple org enrollment — this unblocks everything else and has the longest lead time.
3. **When certs land:** the static `.pkpass` v1 above. ~1 week.
4. **Post-launch:** live-update push service, only if status-change freshness proves worth it.

**My call if you greenlight:** yes on Apple Wallet — iPhone dominance in KSA makes it the single biggest mobile-trust upgrade available, and the marginal build cost is low because the data layer already exists. The only reason to hesitate is the enrollment lead time, which is exactly why step 2 should happen this week even if the build waits.
