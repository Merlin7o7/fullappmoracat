-- The census city (MRC-GTM-001 §1).
--
-- The founding class on the Cat ID card read "دفعة الرياض ٢٠٢٦ / Riyadh Class
-- of 2026" for every member while registration never asked where anyone lived.
-- For a Jeddah owner that was a false statement on their cat's identity card.
-- This column is where the true answer goes.
--
-- Deliberately a plain text code (packages/core SAUDI_CITIES), NOT a FK to
-- `cities`: that table is the *delivery* city list and holds only the two
-- cities we can ship to. The census must be answerable from anywhere in the
-- Kingdom on day one.
--
-- Nullable on purpose, and NOT backfilled: every cat registered before this
-- point has no city, and guessing one would recreate the exact bug being fixed.
-- Those cards fall back to a class name with no city in it.
ALTER TABLE "cats" ADD COLUMN "cityCode" TEXT;

-- Per-city census counts.
CREATE INDEX "cats_cityCode_idx" ON "cats"("cityCode");
