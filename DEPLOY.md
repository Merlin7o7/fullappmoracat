# Deploying Moracat to your own domain

Two supported paths. **Path A** (a server you control + Docker) is the best fit for
"host it on my own domain" — one command brings up web + API + Postgres + Redis
behind Caddy with automatic HTTPS. **Path B** is the fully-managed free trio.

Throughout, replace `example.com` with your real domain.

---

## Path A — One VPS + Docker (recommended, full control)

**What you need:** a small Linux server with a public IP and SSH access.
- Truly free option: **Oracle Cloud Always Free** (ARM VM, 24 GB RAM free forever).
- Cheap & simple: **Hetzner** (~€4/mo) or **DigitalOcean** (~$6/mo).

### 1. Point DNS at the server
In your domain's DNS panel, add two records → your server's IP:

| Type | Name  | Value            |
|------|-------|------------------|
| A    | `@`   | `YOUR_SERVER_IP` |
| A    | `api` | `YOUR_SERVER_IP` |

(`@` = root `example.com`; `api` = `api.example.com`.) DNS can take a few minutes.

### 2. On the server: install Docker + clone
```bash
curl -fsSL https://get.docker.com | sh
git clone https://github.com/Merlin7o7/fullappmoracat.git moracat
cd moracat
```

### 3. Configure env
```bash
cp .env.production.example .env
nano .env   # set SITE_DOMAIN/API_DOMAIN/…_URL to your domain,
            # generate secrets:  openssl rand -base64 48
```

### 4. Launch (web + API + Postgres + Redis + Caddy/HTTPS)
```bash
docker compose -f docker-compose.prod.yml -f deploy/docker-compose.caddy.yml up -d --build
```
Caddy fetches Let's Encrypt certs automatically once DNS resolves.

### 5. Create the schema + seed once
```bash
docker compose exec api node -e "process.exit(0)"   # confirm api is up
docker compose exec api npx prisma db push --schema=prisma/schema.prisma
docker compose exec api node -e "require('child_process')"  # (seed: see note below)
```
> Seeding runs from the repo, not the pruned image. Simplest: from a checkout
> with Node, `DATABASE_URL=<your db> pnpm --filter @moraqat/db push && pnpm db:seed`,
> pointing `DATABASE_URL` at the server's Postgres (temporarily exposed) — or add a
> one-off seed service. The app also works empty; you can register and add cats.

Your site is now live at **https://example.com** with the API at
**https://api.example.com**. To update: `git pull && docker compose … up -d --build`.

---

## Path B — Managed, $0 (Vercel + Render + Neon)

Stable 24/7 on free tiers. Custom domain is free on Vercel. Trade-off: the free
Render API cold-starts after ~15 min idle (first request takes ~30–50s).

### 1. Database — Neon (free)
Create a project at neon.tech → copy the `postgresql://…?sslmode=require` string.

### 2. API — Render (free web service)
- New → **Web Service** → connect this GitHub repo.
- Runtime **Docker**, Dockerfile path `apps/api/Dockerfile`, context = repo root.
- Env vars: `DATABASE_URL` (Neon), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`,
  `NEXT_PUBLIC_SITE_URL=https://example.com`, `PAYMENTS_MODE=mock`, `NODE_ENV=production`.
- After first deploy, add a **custom domain** `api.example.com` → Render shows a
  CNAME target; add it in your DNS.
- One-off: run `npx prisma db push` against the Neon URL to create tables.

### 3. Web — Vercel (free)
- New Project → import the repo. Root stays the monorepo.
- Build command `pnpm --filter @moraqat/core build && pnpm --filter @moraqat/web build`,
  output `apps/web/.next`, install `pnpm install`.
- Env: `NEXT_PUBLIC_API_BASE_URL=https://api.example.com`,
  `NEXT_PUBLIC_SITE_URL=https://example.com`,
  `NEXT_PUBLIC_CAT_ID_BASE=https://example.com/c`.
- Add domain `example.com` in Vercel → it gives you the DNS records to set.

### DNS summary (Path B)
| Type  | Name  | Value                         |
|-------|-------|-------------------------------|
| A/ALIAS | `@` | (Vercel's value)              |
| CNAME | `api` | (Render's target)             |

---

## Going fully live (both paths)
- **Google sign-in:** create an OAuth Client ID, set `GOOGLE_CLIENT_ID` (API) and
  `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (web) with `https://example.com` as an authorized origin.
- **SMS OTP:** wire a provider (Unifonic/Twilio) in `AuthService.sendSms`; until then
  codes are logged server-side and returned only in non-production.
- **Payments:** set `PAYMENTS_MODE=live` + Moyasar/Tabby/Tamara keys.
