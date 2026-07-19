-- Phase 0 "The Census" (MRC-GTM-001 §1) — give every registration a real,
-- monotonic place in the national count, record where it came from, and record
-- consent to contact.
--
-- Three additions, all derived-or-captured facts, none of them settable status:
--   cats.catNumber   — the census ordinal (Founding Member == catNumber <= 1000)
--   cats.sourceCode  — the ?src= acquisition code (per-stand yield, §2)
--   waitlist.consentAt — server-stamped PDPL consent (R106)

-- ── 1. The census ordinal ────────────────────────────────────────────────
ALTER TABLE "cats" ADD COLUMN "catNumber" INTEGER;

-- Backfill in TRUE registration order. If we let Postgres assign values during
-- an `ADD COLUMN ... SERIAL` it would number rows in physical heap order, which
-- would hand Founding Member status to whichever row happened to land on an
-- early page. These people registered in a real order and that order is the
-- only honest basis for the badge (R006 — no fake scarcity, and no fake
-- seniority either).
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      ORDER BY COALESCE("idIssuedAt", "createdAt") ASC, "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "cats"
)
UPDATE "cats" c
   SET "catNumber" = o.rn
  FROM ordered o
 WHERE c."id" = o."id";

-- Attach a sequence that continues from the highest backfilled value.
CREATE SEQUENCE "cats_catNumber_seq" AS INTEGER OWNED BY "cats"."catNumber";
SELECT setval(
  '"cats_catNumber_seq"',
  COALESCE((SELECT MAX("catNumber") FROM "cats"), 0) + 1,
  false
);
ALTER TABLE "cats" ALTER COLUMN "catNumber" SET DEFAULT nextval('"cats_catNumber_seq"');
ALTER TABLE "cats" ALTER COLUMN "catNumber" SET NOT NULL;

CREATE UNIQUE INDEX "cats_catNumber_key" ON "cats"("catNumber");

-- ── 2. Acquisition attribution ───────────────────────────────────────────
-- Per-stand yield decides the Year-1 channel strategy and cannot be
-- reconstructed after the fact, so it is captured at registration.
ALTER TABLE "cats" ADD COLUMN "sourceCode" TEXT;
CREATE INDEX "cats_sourceCode_idx" ON "cats"("sourceCode");

-- The census counter filters on deletedAt; without this it seq-scans.
CREATE INDEX "cats_deletedAt_idx" ON "cats"("deletedAt");

-- ── 3. Waitlist consent (PDPL, R106) ─────────────────────────────────────
ALTER TABLE "waitlist_entries" ADD COLUMN "consentAt" TIMESTAMP(3);
