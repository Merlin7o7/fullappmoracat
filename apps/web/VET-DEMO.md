# Vet portal — self-contained live demo

A shareable, always-on demo of the clinic portal that runs **without an API, a
database, or any secrets**. Set one environment variable and the whole portal
runs against a fictional clinic held entirely in the browser.

## What it is

When `NEXT_PUBLIC_VET_DEMO=1`, the web app installs a browser-side stand-in for
the vet API (`apps/web/lib/vet-demo/`). It intercepts every `/api/*` call and
answers from canned data shaped exactly like the real NestJS responses, so the
real portal code runs unchanged. A demo staff session is seeded automatically,
so opening `/vet` lands straight in a working clinic.

Nothing here touches production data — there is none in a static demo. Every
record is obviously fictional and the clinic is named "(DEMO)".

## What's inside

- **One LIVE clinic** — Al-Noor Veterinary Clinic (DEMO), two branches.
- **Five staff, every real role.** Sign out and back in to watch the portal
  reshape itself per role (a receptionist never sees the clinical record).
- **Four cats at four consent tiers** — so the consent boundary is
  *demonstrated*, not described:
  - `مشمش` / Mishmish · `MRC-7H2K-94QF` — **T2, full history**: SOAP exam, two
    vaccinations, a four-point weight trend, a chronic diagnosis, a lab panel
    with a flagged result, an active prescription, a closed visit with an owner
    summary, and one visit **open right now**.
  - `لوزة` / Loza · `MRC-3F8M-21XA` — T1 care summary.
  - `سمسم` / Simsim · `MRC-9K4P-55RT` — T1, owner-restricted.
  - `بسبس` / Basbas · `MRC-2M6N-08LB` — **T0, no consent**: the record is
    withheld, yet the life-critical allergy still shows (tier 0 is a safety
    floor, not a permission level).

## Sign-in

Auto-signed-in as the senior veterinarian. To try other roles, use the demo
bar's **Accounts** button, sign out, and sign back in:

| Email | Role |
|---|---|
| `demo.owner@moracat.co` | Clinic owner — everything |
| `demo.vet@moracat.co` | Senior vet — full clinical (default) |
| `demo.vet2@moracat.co` | Veterinarian |
| `demo.tech@moracat.co` | Technician — no prescribing |
| `demo.reception@moracat.co` | Reception — no clinical record |

Password `DemoVet!2026` for all. Counter-mode PIN `2468`.

## Run it locally

```bash
pnpm --filter @moraqat/core build
NEXT_PUBLIC_VET_DEMO=1 pnpm --filter @moraqat/web dev
# open http://localhost:3000/vet
```

## Deploy it live (Vercel)

The app reads `cookies()` for locale, so it deploys as a normal Next.js server
(not a static export) — no backend to keep warm, and Vercel's serverless
functions never sleep like a free API instance would.

1. In Vercel → **Add New → Project**, import `merlin7o7/fullappmoracat`.
2. Set **Root Directory** to `apps/web`.
3. Add one environment variable: `NEXT_PUBLIC_VET_DEMO` = `1`.
   (Optional: leave `NEXT_PUBLIC_API_BASE_URL` unset — the demo never uses it.)
4. Deploy. Share the `*.vercel.app` URL — `/vet` opens the clinic.

Keep this env var **only** on the demo project. A production build of the member
site must never set `NEXT_PUBLIC_VET_DEMO`.
