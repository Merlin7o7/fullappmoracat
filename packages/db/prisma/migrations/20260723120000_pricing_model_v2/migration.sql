-- Pricing Model v2 (MRC-FIN-002, 2026-07-23).
-- Additive only: new KITTEN tier, market-benchmark columns, multi-cat module
-- price, per-cat content flag. Existing rows keep working; seed-catalog
-- repopulates the live plans (STARTER/STANDARD/PREMIUM rows are renamed in
-- place — Essentials/Complete/Signature — and KITTEN is created).

-- New acquisition tier (PG12+ allows ADD VALUE in a transaction as long as the
-- new value is not used in the same transaction — it is not; seeding is a
-- separate step).
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'KITTEN';

-- Plan: market-benchmark basket value + per-additional-cat module price.
ALTER TABLE "plans" ADD COLUMN "marketValue" DECIMAL(10,2);
ALTER TABLE "plans" ADD COLUMN "modulePriceSar" DECIMAL(10,2);

-- PlanContent: per-cat vs per-household line (drives multi-cat modules).
ALTER TABLE "plan_contents" ADD COLUMN "perCat" BOOLEAN NOT NULL DEFAULT true;

-- Product: KSA market benchmark price (quarterly five-store sweep).
ALTER TABLE "products" ADD COLUMN "marketPrice" DECIMAL(10,2);
