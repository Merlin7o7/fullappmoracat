-- Monthly box fulfilment (Wave 2). Additive only.
ALTER TABLE "subscriptions" ADD COLUMN "boxesPrepaid" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions" ADD COLUMN "boxesDelivered" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "cycleKey" TEXT;
ALTER TABLE "orders" ADD COLUMN "cycleIndex" INTEGER;
CREATE UNIQUE INDEX "orders_cycleKey_key" ON "orders"("cycleKey");

-- Existing paid terms: the term's payment order was its first box. Credit the
-- rest so the new fulfilment job ships them (commerce has been off in
-- production, so this is expected to touch no rows there).
UPDATE "subscriptions"
SET "boxesPrepaid" = COALESCE("termMonths", 1), "boxesDelivered" = 1
WHERE "status" IN ('ACTIVE', 'PAUSED') AND "endsAt" IS NOT NULL AND "boxesPrepaid" = 0;
