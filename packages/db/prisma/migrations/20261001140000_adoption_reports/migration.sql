-- Adoption safety: listing reports (Wave 6). Additive only.
CREATE TABLE "adoption_reports" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "adoption_reports_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "adoption_reports_listingId_reporterId_key" ON "adoption_reports"("listingId", "reporterId");
CREATE INDEX "adoption_reports_status_idx" ON "adoption_reports"("status");
ALTER TABLE "adoption_reports" ADD CONSTRAINT "adoption_reports_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "adoption_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
