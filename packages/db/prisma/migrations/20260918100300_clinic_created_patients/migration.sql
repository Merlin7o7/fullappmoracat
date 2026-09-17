-- Clinic-created patients + claim links (MRC-PROD-001 T4). Additive: three
-- nullable columns on cats, one new table, indexes.

-- AlterTable
ALTER TABLE "cats" ADD COLUMN     "createdByOrgId" TEXT,
ADD COLUMN     "createdByStaffId" TEXT,
ADD COLUMN     "mergedIntoCatId" TEXT;

-- CreateTable
CREATE TABLE "cat_claim_invites" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "phone" TEXT NOT NULL,
    "phoneHash" TEXT NOT NULL,
    "phoneLast4" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "claimedByUserId" TEXT,
    "revokedAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3),
    "attestedByStaffId" TEXT,
    "attestedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_claim_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cat_claim_invites_tokenHash_key" ON "cat_claim_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "cat_claim_invites_catId_idx" ON "cat_claim_invites"("catId");

-- CreateIndex
CREATE INDEX "cat_claim_invites_orgId_createdAt_idx" ON "cat_claim_invites"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "cat_claim_invites_phoneHash_idx" ON "cat_claim_invites"("phoneHash");

-- CreateIndex
CREATE INDEX "cats_createdByOrgId_idx" ON "cats"("createdByOrgId");

-- AddForeignKey
ALTER TABLE "cat_claim_invites" ADD CONSTRAINT "cat_claim_invites_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
