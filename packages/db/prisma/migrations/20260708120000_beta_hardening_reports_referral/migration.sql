-- CreateEnum
CREATE TYPE "CatReportReason" AS ENUM ('INAPPROPRIATE', 'SPAM', 'FAKE', 'HARASSMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredByCode" TEXT;

-- CreateTable
CREATE TABLE "cat_reports" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "reporterId" TEXT,
    "reason" "CatReportReason" NOT NULL,
    "detail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedById" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cat_reports_status_createdAt_idx" ON "cat_reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "cat_reports_catId_idx" ON "cat_reports"("catId");

-- CreateIndex
CREATE UNIQUE INDEX "cat_reports_catId_reporterId_key" ON "cat_reports"("catId", "reporterId");

-- CreateIndex
CREATE UNIQUE INDEX "users_referralCode_key" ON "users"("referralCode");

-- AddForeignKey
ALTER TABLE "cat_reports" ADD CONSTRAINT "cat_reports_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_reports" ADD CONSTRAINT "cat_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_reports" ADD CONSTRAINT "cat_reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
