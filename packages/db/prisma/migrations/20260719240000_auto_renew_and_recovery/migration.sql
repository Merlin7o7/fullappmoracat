-- Auto-renewal + payment recovery.
--
-- Manual re-purchase every term means re-selling the entire member base four
-- times a year and roughly halves LTV; post-VAT LTV:CAC does not clear 3:1
-- without it. This adds opt-out auto-renewal WITHOUT reintroducing the silent
-- charge R025 forbids:
--
--   autoRenew              — opt-in flag, off for existing rows (no member is
--                            retroactively enrolled in charging).
--   autoRenewNoticeAt      — stamped when the T-7 notice is sent. The renewal
--                            pass REFUSES to charge a membership with no notice
--                            on record, so notice and charge cannot drift apart.
--   renewalPaymentMethodId — the exact stored credential a renewal may use.
--                            NULL means no reusable credential exists (a BNPL
--                            term cannot be charged off-session), and the
--                            membership falls back to an invitation instead of
--                            silently failing.
--
-- Also adds subscriptions(status, endsAt), which drives both the lapse pass and
-- the renewal pass — status alone is far too low-selectivity for either.

-- AlterTable
ALTER TABLE "subscriptions" ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "autoRenewNoticeAt" TIMESTAMP(3),
ADD COLUMN     "renewalPaymentMethodId" TEXT;

-- CreateIndex
CREATE INDEX "subscriptions_status_endsAt_idx" ON "subscriptions"("status", "endsAt");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_renewalPaymentMethodId_fkey" FOREIGN KEY ("renewalPaymentMethodId") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

