-- T8: cancel reason (asked once) + mid-term plan change applied at renewal.
-- Additive only.
CREATE TYPE "CancelReason" AS ENUM ('TOO_EXPENSIVE', 'MOVING', 'CAT_PASSED', 'NOT_USING', 'SERVICE_ISSUE', 'OTHER');

ALTER TABLE "subscriptions"
  ADD COLUMN "cancelReason" "CancelReason",
  ADD COLUMN "cancelNote" TEXT,
  ADD COLUMN "pendingPlanId" TEXT,
  ADD COLUMN "planChangeRequestedAt" TIMESTAMP(3);

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_pendingPlanId_fkey"
  FOREIGN KEY ("pendingPlanId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
