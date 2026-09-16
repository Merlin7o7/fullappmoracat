-- Vet clinic registration (MRC-VET-002).
--
-- Admin-invite-only clinic onboarding: a Moracat-issued registration invite,
-- a bilingual wizard (legal identity, branches, private documents, team, terms),
-- review with request-changes, and the go-live checklist. Purely additive:
-- new enum values, nullable columns, and two new tables. No backfill needed —
-- existing orgs keep their status and simply have no registration data.

-- AlterEnum
ALTER TYPE "BranchDocumentKind" ADD VALUE 'PRACTITIONER_LICENCE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PartnerOrgStatus" ADD VALUE 'INVITED';
ALTER TYPE "PartnerOrgStatus" ADD VALUE 'REGISTERING';
ALTER TYPE "PartnerOrgStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "PartnerOrgStatus" ADD VALUE 'CHANGES_REQUESTED';
ALTER TYPE "PartnerOrgStatus" ADD VALUE 'REJECTED';

-- AlterTable
ALTER TABLE "partner_agreements" ADD COLUMN     "acceptedByUserId" TEXT,
ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "signedByTitle" TEXT,
ADD COLUMN     "termsVersion" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "partner_branch_documents" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "number" TEXT,
ADD COLUMN     "sizeBytes" INTEGER,
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable
ALTER TABLE "partner_branches" ADD COLUMN     "cityCode" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "nationalAddressCode" TEXT;

-- AlterTable
ALTER TABLE "partner_invites" ADD COLUMN     "branchIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fullName" TEXT,
ADD COLUMN     "licenceExpiresAt" TIMESTAMP(3),
ADD COLUMN     "licenceNo" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "title" TEXT;

-- AlterTable
ALTER TABLE "partner_orgs" ADD COLUMN     "branchesConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "changesRequestedNote" TEXT,
ADD COLUMN     "changesRequestedSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "contactEmail" TEXT,
ADD COLUMN     "contactName" TEXT,
ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "crExpiresAt" TIMESTAMP(3),
ADD COLUMN     "goLiveRequestedAt" TIMESTAMP(3),
ADD COLUMN     "inviteNote" TEXT,
ADD COLUMN     "invitedById" TEXT,
ADD COLUMN     "legalNameAr" TEXT,
ADD COLUMN     "legalNameEn" TEXT,
ADD COLUMN     "registrationTeam" JSONB,
ADD COLUMN     "rejectedReason" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "submittedAt" TIMESTAMP(3),
ADD COLUMN     "testScanAt" TIMESTAMP(3),
ADD COLUMN     "unifiedNumber" TEXT;

-- AlterTable
ALTER TABLE "partner_staff" ADD COLUMN     "confidentialityAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "confidentialityVersion" TEXT,
ADD COLUMN     "licenceExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "partner_org_documents" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "kind" "BranchDocumentKind" NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "number" TEXT,
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_org_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_registration_invites" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "claimedAt" TIMESTAMP(3),
    "claimedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_registration_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "partner_org_documents_orgId_idx" ON "partner_org_documents"("orgId");

-- CreateIndex
CREATE INDEX "partner_org_documents_expiresAt_idx" ON "partner_org_documents"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "partner_registration_invites_tokenHash_key" ON "partner_registration_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "partner_registration_invites_orgId_idx" ON "partner_registration_invites"("orgId");

-- CreateIndex
CREATE INDEX "partner_registration_invites_email_idx" ON "partner_registration_invites"("email");

-- AddForeignKey
ALTER TABLE "partner_org_documents" ADD CONSTRAINT "partner_org_documents_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_registration_invites" ADD CONSTRAINT "partner_registration_invites_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

