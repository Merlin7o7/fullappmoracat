-- Reliability + measurement (MRC-PROD-001 T1/T2), plus the cat origin/claim
-- columns the metrics roll-up reads (used by the clinic-created-patient flow,
-- T4). Purely additive: new enums, defaulted/nullable columns, three new
-- tables. Existing cats become origin=OWNER, claimStatus=CLAIMED.

-- CreateEnum
CREATE TYPE "CatOrigin" AS ENUM ('OWNER', 'CLINIC', 'ADMIN_IMPORT');

-- CreateEnum
CREATE TYPE "CatClaimStatus" AS ENUM ('CLAIMED', 'PENDING_CLAIM');

-- AlterTable
ALTER TABLE "cats" ADD COLUMN     "origin" "CatOrigin" NOT NULL DEFAULT 'OWNER',
ADD COLUMN     "claimStatus" "CatClaimStatus" NOT NULL DEFAULT 'CLAIMED',
ADD COLUMN     "claimedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "firstTouch" JSONB;

-- CreateTable
CREATE TABLE "job_leases" (
    "name" TEXT NOT NULL,
    "leaseUntil" TIMESTAMP(3) NOT NULL,
    "holder" TEXT,
    "lastStartedAt" TIMESTAMP(3),
    "lastFinishedAt" TIMESTAMP(3),
    "lastDurationMs" INTEGER,
    "lastError" TEXT,

    CONSTRAINT "job_leases_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "product_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "catId" TEXT,
    "orgId" TEXT,
    "anonId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'api',
    "props" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_snapshots" (
    "id" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "data" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cats_claimStatus_idx" ON "cats"("claimStatus");

-- CreateIndex
CREATE INDEX "cats_origin_createdAt_idx" ON "cats"("origin", "createdAt");

-- CreateIndex
CREATE INDEX "product_events_name_createdAt_idx" ON "product_events"("name", "createdAt");

-- CreateIndex
CREATE INDEX "product_events_userId_createdAt_idx" ON "product_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "product_events_orgId_name_createdAt_idx" ON "product_events"("orgId", "name", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "metric_snapshots_day_key" ON "metric_snapshots"("day");
