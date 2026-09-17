-- T7: opt-in auto-renew request + dunning ladder; stored card audit fields.
-- Additive only.
ALTER TABLE "subscriptions"
  ADD COLUMN "autoRenewRequestedAt" TIMESTAMP(3),
  ADD COLUMN "dunningAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "dunningStartedAt" TIMESTAMP(3),
  ADD COLUMN "nextDunningAt" TIMESTAMP(3),
  ADD COLUMN "graceUntil" TIMESTAMP(3);

CREATE INDEX "subscriptions_nextDunningAt_idx" ON "subscriptions"("nextDunningAt");

ALTER TABLE "payment_methods"
  ADD COLUMN "providerRef" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3);
