-- Subscription terms (3-month minimum, prepaid term) + catalog/merchandising
-- fields for the 2026-07 supplier import. Fully ADDITIVE and idempotent: only
-- new enum values and new columns with safe defaults — no data is dropped or
-- rewritten, so it is safe to apply to production with live subscriptions.

-- New official plan tiers (legacy ESSENTIAL/COMPLETE_CARE/MULTI_CAT retained).
-- On PostgreSQL 12+ ADD VALUE may run in a transaction as long as the value is
-- not used before commit (it is not, here).
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'STARTER';
ALTER TYPE "PlanTier" ADD VALUE IF NOT EXISTS 'STANDARD';

-- Plan: minimum committed term (KSA policy = 3 months).
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "minTermMonths" INTEGER NOT NULL DEFAULT 3;

-- Subscription: committed term + term-end (renewal) date.
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "termMonths" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);

-- Product: catalog / merchandising fields (store stays unpublished for now).
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isStorePublished" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isStoreOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "isPremiumOnly" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "searchKeywords" TEXT;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "lowStockThreshold" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "supplierImageRef" TEXT;
