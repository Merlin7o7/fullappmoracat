# Moracat — Working Rules

## Design Authority (non-negotiable)

This repo has a permanent design authority:

- **`design/DESIGN-AUTHORITY.md`** — the distilled constitution (read this first)
- **`design/moracat-membership-dossier.html`** — the full strategy dossier (MRC-UX-001)

**Before modifying ANY page, component, flow, copy, API, animation, or interaction:**
1. Read the relevant sections of `design/DESIGN-AUTHORITY.md`.
2. Extract the principles that apply; compare the current implementation against them.
3. Implement so the change *reinforces* the intended experience — never merely "works."
4. Cite rule IDs (R001–R120) in commit messages and code review notes.
5. After finishing, run the Review Checklist at the bottom of DESIGN-AUTHORITY.md,
   critique the result, and improve until no meaningful gap remains.

If an implementation conflicts with the authority, **the authority wins** — refactor
while preserving business logic. Never sacrifice the intended experience for
implementation convenience. Quality bar: Apple / Airbnb / Stripe / Linear.

Core reframe to hold in mind everywhere: *Moracat is a membership identity —
the Cat ID is the soul of the product, savings are proof of value, belonging is
the product. The cat is always the hero.*

## Engineering conventions

- pnpm + Turborepo monorepo: `apps/web` (Next.js 14), `apps/api` (NestJS 10),
  `packages/db` (Prisma), `packages/core` (pure engine), `packages/ui` (design system).
- Local dev DB: `pnpm db:local` (embedded Postgres, UTF-8; no Docker needed).
- Verify with `pnpm e2e` (smoke harness) before committing feature work; keep the
  suite growing with each feature.
- Next.js page files may only export the default component — shared components go
  in `apps/web/components/`.
- `NEXT_STANDALONE=1` gates Next standalone output (Windows dev boxes can't symlink).
- All money in SAR; prices VAT-inclusive with 15% broken out on invoices.
- Bilingual ar/en everywhere; Arabic is the default experience, RTL-native (R101).
