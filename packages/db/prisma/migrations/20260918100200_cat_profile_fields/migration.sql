-- Owner health page (MRC-PROD-001 T3) + clinic attribution on vaccinations
-- (T5). Additive: one enum, nullable columns, one nullable FK, indexes.

-- CreateEnum
CREATE TYPE "CatAcquisitionSource" AS ENUM ('ADOPTED', 'PURCHASED_BREEDER', 'PURCHASED_SHOP', 'RESCUED_STRAY', 'GIFT', 'BORN_AT_HOME', 'OTHER');

-- AlterTable
ALTER TABLE "cats" ADD COLUMN     "currentFood" TEXT,
ADD COLUMN     "acquisitionSource" "CatAcquisitionSource",
ADD COLUMN     "district" TEXT,
ADD COLUMN     "homeBranchId" TEXT;

-- AlterTable
ALTER TABLE "cat_vaccinations" ADD COLUMN     "orgId" TEXT,
ADD COLUMN     "branchId" TEXT;

-- CreateIndex
CREATE INDEX "cats_homeBranchId_idx" ON "cats"("homeBranchId");

-- CreateIndex
CREATE INDEX "cat_vaccinations_orgId_dueAt_idx" ON "cat_vaccinations"("orgId", "dueAt");

-- AddForeignKey
ALTER TABLE "cats" ADD CONSTRAINT "cats_homeBranchId_fkey" FOREIGN KEY ("homeBranchId") REFERENCES "partner_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
