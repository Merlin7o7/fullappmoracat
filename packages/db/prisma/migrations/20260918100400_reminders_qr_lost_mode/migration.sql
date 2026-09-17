-- Clinic-routed reminders (T5) and the scannable QR / lost mode (T6).
-- Additive: one nullable column, two new tables.

-- AlterTable
ALTER TABLE "cats" ADD COLUMN     "lostModeAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "cat_found_reports" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "finderPhone" TEXT,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_found_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_links" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "catId" TEXT,
    "orgId" TEXT,
    "branchId" TEXT,
    "userId" TEXT,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "lastClickedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracked_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cat_found_reports_catId_createdAt_idx" ON "cat_found_reports"("catId", "createdAt");

-- CreateIndex
CREATE INDEX "tracked_links_orgId_createdAt_idx" ON "tracked_links"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "cat_found_reports" ADD CONSTRAINT "cat_found_reports_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
