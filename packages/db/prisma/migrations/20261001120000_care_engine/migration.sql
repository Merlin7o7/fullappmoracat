-- Care engine (Wave 5). Additive only.
ALTER TABLE "cat_weight_records" ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "care_tasks" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "seriesKey" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "titleEn" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "source" TEXT NOT NULL DEFAULT 'GENERATED',
    "proposed" BOOLEAN NOT NULL DEFAULT false,
    "linkedVaccinationId" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "care_tasks_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "care_tasks_catId_seriesKey_key" ON "care_tasks"("catId", "seriesKey");
CREATE INDEX "care_tasks_dueAt_status_idx" ON "care_tasks"("dueAt", "status");
ALTER TABLE "care_tasks" ADD CONSTRAINT "care_tasks_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
