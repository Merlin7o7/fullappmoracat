# Moracat — Community Launch Checklist

Community Mode ships the identity + community product with **all payments disabled**.
Code is done and verified; the items below are the **operational steps only you can do**
(dashboard access / secrets). Do them once, in order.

## 1. Database (Neon) — REQUIRED before the API works
The schema gained new columns/tables (email verification, cat community + privacy,
gallery `CatPhoto`, `WaitlistEntry`). Push them to production **once**:

```bash
# with the production (pooled) Neon URL:
DATABASE_URL="postgresql://…-pooler.…/db?sslmode=require" pnpm --filter @moraqat/db push
```

- Use the **pooled** Neon connection string (host contains `-pooler`, add `?pgbouncer=true`)
  as `DATABASE_URL` on Render — prevents connection exhaustion.
- Enable Neon **PITR / backups** in the Neon dashboard (Settings → Backups).

## 2. Render (API) — set dashboard secrets
`render.yaml` wires the keys; paste values in the Render dashboard (kept secret):
- `DATABASE_URL` = pooled Neon URL
- `RESEND_API_KEY` = your Resend key
- `S3_ENDPOINT` = `https://454e9c2068708821fedd512c0d0a34c6.r2.cloudflarestorage.com`
- `S3_ACCESS_KEY`, `S3_SECRET_KEY` = R2 API token keys
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` are auto-generated (do not set to defaults)
- Leave `COMMERCE_ENABLED=false` and `PAYMENTS_MODE=mock` until payments launch.
- Verify your sending domain in Resend and set `EMAIL_FROM` to it (e.g. `Moracat <hello@moracat.co>`);
  until then test-mode only delivers to your own Resend account email.

## 3. Vercel (web) — environment variables
Set in the Vercel project → Settings → Environment Variables (Production):
- `NEXT_PUBLIC_API_BASE_URL` = your Render API URL (e.g. `https://moracat-api.onrender.com`)
- `NEXT_PUBLIC_SITE_URL` = `https://moracat.co`
- `NEXT_PUBLIC_COMMERCE_ENABLED` = `false` (or leave unset — defaults to Community Mode)

## 4. Observability (recommended)
- Add a Sentry project and set `SENTRY_DSN` (API) — wire `@sentry/nestjs` + `@sentry/nextjs`
  when ready (env placeholders exist).
- Add an uptime monitor pinging `GET /health` (also keeps the free Render instance warm).

## 5. Post-deploy smoke test
- Register a new account → receive the verification email → confirm.
- Create a cat → upload a profile photo (verify it appears from the R2 public URL).
- Toggle the cat public → open `/community` and the public `/community/<slug>` page.
- Press "Preview memberships" → confirm the "launching soon" waitlist page (no checkout).
- Admin → Community (hide/feature) and Waitlist (export CSV).

## What is intentionally OFF until payments launch
Checkout, paid subscriptions, membership activation, refunds, and all payment webhooks
are hard-blocked by the Community-Mode kill-switch (API returns
`403 { code: "MEMBERSHIPS_COMING_SOON" }`). Flip `COMMERCE_ENABLED=true` **and**
`PAYMENTS_MODE=live` (with real PSP keys) to enable them — the API refuses to boot if
one is set without the other.
