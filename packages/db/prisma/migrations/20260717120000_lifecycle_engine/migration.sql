-- Lifecycle engine (2026-07-17): honest cancel/pause economics + the term-end
-- machinery that makes "we never charge silently" mechanically true (R025).
-- Fully ADDITIVE and idempotent: new columns with safe defaults + one new
-- ledger table — no data is dropped or rewritten, safe against live rows.

-- Subscription: won't-renew flag (cancel during a paid term keeps servicing
-- until endsAt) + pause bookkeeping (resume extends endsAt by paused duration).
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancelAtTermEnd" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pausedAt" TIMESTAMP(3);

-- Payment: provider session context (hosted checkout URL) so an abandoned
-- redirect flow can be resumed instead of dead-ending the cat (fire #4).
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Idempotency + "reminders honoured" ledger for the lifecycle scheduler.
CREATE TABLE IF NOT EXISTS "lifecycle_events" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "catId" TEXT,
    "subjectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "lifecycle_events_key_key" ON "lifecycle_events"("key");
CREATE INDEX IF NOT EXISTS "lifecycle_events_userId_type_idx" ON "lifecycle_events"("userId", "type");
CREATE INDEX IF NOT EXISTS "lifecycle_events_catId_type_idx" ON "lifecycle_events"("catId", "type");
