-- CreateEnum
CREATE TYPE "PartnerOrgStatus" AS ENUM ('APPLIED', 'IN_REVIEW', 'APPROVED', 'LIVE', 'SUSPENDED', 'OFFBOARDED');

-- CreateEnum
CREATE TYPE "PartnerApplicationStatus" AS ENUM ('SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "PartnerStaffRole" AS ENUM ('OWNER', 'MANAGER', 'VET_SENIOR', 'VET', 'VET_TECH', 'RECEPTION', 'FINANCE', 'INTERN');

-- CreateEnum
CREATE TYPE "PartnerStaffStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED');

-- CreateEnum
CREATE TYPE "BranchDocumentKind" AS ENUM ('MEWA_LICENCE', 'CR', 'VAT', 'INSURANCE', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitMode" AS ENUM ('QUICK', 'STANDARD', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "VisitState" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ClinicalEntryType" AS ENUM ('EXAM', 'DIAGNOSIS', 'VACCINATION', 'TREATMENT', 'PRESCRIPTION', 'LAB', 'IMAGING', 'SURGERY', 'DENTAL', 'HOSPITALIZATION', 'WEIGHT', 'NUTRITION', 'SUPPLEMENT', 'NOTE');

-- CreateEnum
CREATE TYPE "ClinicalEntryStatus" AS ENUM ('DRAFT', 'FINAL', 'AMENDED', 'RETRACTED');

-- CreateEnum
CREATE TYPE "ConsentTier" AS ENUM ('T1', 'T2');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('ISSUED', 'COLLECTED', 'REFILLED', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmergencyContactKind" AS ENUM ('OWNER', 'SECONDARY', 'CLINIC', 'OTHER');

-- CreateTable
CREATE TABLE "partner_applications" (
    "id" TEXT NOT NULL,
    "clinicName" TEXT NOT NULL,
    "crNumber" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "cityId" TEXT,
    "addressLine" TEXT,
    "licenceNo" TEXT,
    "notes" TEXT,
    "status" "PartnerApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "orgId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_orgs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "crNumber" TEXT,
    "vatNumber" TEXT,
    "logoUrl" TEXT,
    "status" "PartnerOrgStatus" NOT NULL DEFAULT 'APPLIED',
    "verifiedAt" TIMESTAMP(3),
    "tier" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspendReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_agreements" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "benefitRules" JSONB,
    "docUrl" TEXT,
    "signedAt" TIMESTAMP(3),
    "signedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_branches" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "cityId" TEXT,
    "addressLine" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "mapsUrl" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "hours" JSONB,
    "specialties" TEXT[],
    "services" TEXT[],
    "photos" TEXT[],
    "emergency24h" BOOLEAN NOT NULL DEFAULT false,
    "directoryVisible" BOOLEAN NOT NULL DEFAULT false,
    "licenceNo" TEXT,
    "licenceExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_branch_documents" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "kind" "BranchDocumentKind" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_branch_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_counter_devices" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "registeredById" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_counter_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_staff" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "PartnerStaffRole" NOT NULL,
    "status" "PartnerStaffStatus" NOT NULL DEFAULT 'INVITED',
    "title" TEXT,
    "licenceNo" TEXT,
    "pinHash" TEXT,
    "invitedById" TEXT,
    "joinedAt" TIMESTAMP(3),
    "offboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_invites" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "PartnerStaffRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_visits" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "branchId" TEXT,
    "mode" "VisitMode" NOT NULL DEFAULT 'STANDARD',
    "state" "VisitState" NOT NULL DEFAULT 'OPEN',
    "reason" TEXT,
    "presentingComplaint" TEXT,
    "openedById" TEXT,
    "closedById" TEXT,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "ownerSummary" TEXT,
    "summarySentAt" TIMESTAMP(3),
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_clinical_entries" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "visitId" TEXT,
    "orgId" TEXT NOT NULL,
    "type" "ClinicalEntryType" NOT NULL,
    "status" "ClinicalEntryStatus" NOT NULL DEFAULT 'FINAL',
    "payload" JSONB NOT NULL,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorId" TEXT,
    "coSignedById" TEXT,
    "coSignedAt" TIMESTAMP(3),
    "revisionOfId" TEXT,
    "retractedAt" TIMESTAMP(3),
    "retractReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_clinical_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_entry_attachments" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT,
    "mime" TEXT,
    "bytes" INTEGER,
    "kind" TEXT,
    "scanStatus" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_entry_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_prescriptions" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "entryId" TEXT,
    "orgId" TEXT NOT NULL,
    "prescriberId" TEXT,
    "medication" TEXT NOT NULL,
    "strength" TEXT,
    "form" TEXT,
    "dosage" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "durationDays" INTEGER,
    "quantity" TEXT,
    "instructions" TEXT,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'ISSUED',
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "refillsAllowed" INTEGER NOT NULL DEFAULT 0,
    "refillsUsed" INTEGER NOT NULL DEFAULT 0,
    "warnings" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vet_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_weight_records" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "entryId" TEXT,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "bcs" INTEGER,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'clinic',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_weight_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_consent_grants" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "tier" "ConsentTier" NOT NULL,
    "grantedById" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "emergency" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,

    CONSTRAINT "vet_consent_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_record_access_logs" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "staffId" TEXT,
    "tier" "ConsentTier" NOT NULL,
    "surface" TEXT NOT NULL,
    "emergency" BOOLEAN NOT NULL DEFAULT false,
    "ipAddress" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_record_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vet_offline_pass_keys" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "version" INTEGER NOT NULL,
    "publicKey" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'ed25519',
    "activeFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vet_offline_pass_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_emergency_contacts" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "kind" "EmergencyContactKind" NOT NULL DEFAULT 'SECONDARY',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relation" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_BranchToPartnerStaff" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "partner_applications_crNumber_key" ON "partner_applications"("crNumber");

-- CreateIndex
CREATE INDEX "partner_applications_status_createdAt_idx" ON "partner_applications"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "partner_orgs_slug_key" ON "partner_orgs"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "partner_orgs_crNumber_key" ON "partner_orgs"("crNumber");

-- CreateIndex
CREATE INDEX "partner_orgs_status_idx" ON "partner_orgs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "partner_agreements_orgId_version_key" ON "partner_agreements"("orgId", "version");

-- CreateIndex
CREATE INDEX "partner_branches_orgId_idx" ON "partner_branches"("orgId");

-- CreateIndex
CREATE INDEX "partner_branches_directoryVisible_isActive_idx" ON "partner_branches"("directoryVisible", "isActive");

-- CreateIndex
CREATE INDEX "partner_branch_documents_branchId_idx" ON "partner_branch_documents"("branchId");

-- CreateIndex
CREATE INDEX "partner_branch_documents_expiresAt_idx" ON "partner_branch_documents"("expiresAt");

-- CreateIndex
CREATE INDEX "partner_counter_devices_branchId_idx" ON "partner_counter_devices"("branchId");

-- CreateIndex
CREATE INDEX "partner_staff_orgId_status_idx" ON "partner_staff"("orgId", "status");

-- CreateIndex
CREATE INDEX "partner_staff_userId_idx" ON "partner_staff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_staff_orgId_userId_key" ON "partner_staff"("orgId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_invites_tokenHash_key" ON "partner_invites"("tokenHash");

-- CreateIndex
CREATE INDEX "partner_invites_orgId_idx" ON "partner_invites"("orgId");

-- CreateIndex
CREATE INDEX "partner_invites_email_idx" ON "partner_invites"("email");

-- CreateIndex
CREATE INDEX "vet_visits_catId_checkedInAt_idx" ON "vet_visits"("catId", "checkedInAt");

-- CreateIndex
CREATE INDEX "vet_visits_orgId_checkedInAt_idx" ON "vet_visits"("orgId", "checkedInAt");

-- CreateIndex
CREATE INDEX "vet_visits_branchId_state_idx" ON "vet_visits"("branchId", "state");

-- CreateIndex
CREATE INDEX "vet_visits_followUpAt_idx" ON "vet_visits"("followUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "vet_clinical_entries_revisionOfId_key" ON "vet_clinical_entries"("revisionOfId");

-- CreateIndex
CREATE INDEX "vet_clinical_entries_catId_occurredAt_idx" ON "vet_clinical_entries"("catId", "occurredAt");

-- CreateIndex
CREATE INDEX "vet_clinical_entries_catId_type_occurredAt_idx" ON "vet_clinical_entries"("catId", "type", "occurredAt");

-- CreateIndex
CREATE INDEX "vet_clinical_entries_visitId_idx" ON "vet_clinical_entries"("visitId");

-- CreateIndex
CREATE INDEX "vet_clinical_entries_orgId_createdAt_idx" ON "vet_clinical_entries"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "vet_clinical_entries_status_idx" ON "vet_clinical_entries"("status");

-- CreateIndex
CREATE INDEX "vet_entry_attachments_entryId_idx" ON "vet_entry_attachments"("entryId");

-- CreateIndex
CREATE INDEX "vet_prescriptions_catId_issuedAt_idx" ON "vet_prescriptions"("catId", "issuedAt");

-- CreateIndex
CREATE INDEX "vet_prescriptions_status_idx" ON "vet_prescriptions"("status");

-- CreateIndex
CREATE INDEX "vet_prescriptions_orgId_idx" ON "vet_prescriptions"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "cat_weight_records_entryId_key" ON "cat_weight_records"("entryId");

-- CreateIndex
CREATE INDEX "cat_weight_records_catId_measuredAt_idx" ON "cat_weight_records"("catId", "measuredAt");

-- CreateIndex
CREATE INDEX "vet_consent_grants_catId_orgId_idx" ON "vet_consent_grants"("catId", "orgId");

-- CreateIndex
CREATE INDEX "vet_consent_grants_orgId_idx" ON "vet_consent_grants"("orgId");

-- CreateIndex
CREATE INDEX "vet_consent_grants_expiresAt_idx" ON "vet_consent_grants"("expiresAt");

-- CreateIndex
CREATE INDEX "vet_record_access_logs_catId_at_idx" ON "vet_record_access_logs"("catId", "at");

-- CreateIndex
CREATE INDEX "vet_record_access_logs_orgId_at_idx" ON "vet_record_access_logs"("orgId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "vet_offline_pass_keys_orgId_version_key" ON "vet_offline_pass_keys"("orgId", "version");

-- CreateIndex
CREATE INDEX "cat_emergency_contacts_catId_idx" ON "cat_emergency_contacts"("catId");

-- CreateIndex
CREATE UNIQUE INDEX "_BranchToPartnerStaff_AB_unique" ON "_BranchToPartnerStaff"("A", "B");

-- CreateIndex
CREATE INDEX "_BranchToPartnerStaff_B_index" ON "_BranchToPartnerStaff"("B");

-- AddForeignKey
ALTER TABLE "partner_applications" ADD CONSTRAINT "partner_applications_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_agreements" ADD CONSTRAINT "partner_agreements_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_branches" ADD CONSTRAINT "partner_branches_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_branches" ADD CONSTRAINT "partner_branches_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_branch_documents" ADD CONSTRAINT "partner_branch_documents_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "partner_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_counter_devices" ADD CONSTRAINT "partner_counter_devices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "partner_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_counter_devices" ADD CONSTRAINT "partner_counter_devices_registeredById_fkey" FOREIGN KEY ("registeredById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_staff" ADD CONSTRAINT "partner_staff_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_staff" ADD CONSTRAINT "partner_staff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_invites" ADD CONSTRAINT "partner_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_visits" ADD CONSTRAINT "vet_visits_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_visits" ADD CONSTRAINT "vet_visits_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_visits" ADD CONSTRAINT "vet_visits_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "partner_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_visits" ADD CONSTRAINT "vet_visits_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "partner_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_visits" ADD CONSTRAINT "vet_visits_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "partner_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_clinical_entries" ADD CONSTRAINT "vet_clinical_entries_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_clinical_entries" ADD CONSTRAINT "vet_clinical_entries_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "vet_visits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_clinical_entries" ADD CONSTRAINT "vet_clinical_entries_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "partner_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_clinical_entries" ADD CONSTRAINT "vet_clinical_entries_coSignedById_fkey" FOREIGN KEY ("coSignedById") REFERENCES "partner_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_clinical_entries" ADD CONSTRAINT "vet_clinical_entries_revisionOfId_fkey" FOREIGN KEY ("revisionOfId") REFERENCES "vet_clinical_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_entry_attachments" ADD CONSTRAINT "vet_entry_attachments_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "vet_clinical_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_prescriptions" ADD CONSTRAINT "vet_prescriptions_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_prescriptions" ADD CONSTRAINT "vet_prescriptions_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "vet_clinical_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_prescriptions" ADD CONSTRAINT "vet_prescriptions_prescriberId_fkey" FOREIGN KEY ("prescriberId") REFERENCES "partner_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_weight_records" ADD CONSTRAINT "cat_weight_records_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_weight_records" ADD CONSTRAINT "cat_weight_records_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "vet_clinical_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_consent_grants" ADD CONSTRAINT "vet_consent_grants_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_consent_grants" ADD CONSTRAINT "vet_consent_grants_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_consent_grants" ADD CONSTRAINT "vet_consent_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_consent_grants" ADD CONSTRAINT "vet_consent_grants_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_record_access_logs" ADD CONSTRAINT "vet_record_access_logs_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_record_access_logs" ADD CONSTRAINT "vet_record_access_logs_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_record_access_logs" ADD CONSTRAINT "vet_record_access_logs_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "partner_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_offline_pass_keys" ADD CONSTRAINT "vet_offline_pass_keys_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_emergency_contacts" ADD CONSTRAINT "cat_emergency_contacts_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BranchToPartnerStaff" ADD CONSTRAINT "_BranchToPartnerStaff_A_fkey" FOREIGN KEY ("A") REFERENCES "partner_branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BranchToPartnerStaff" ADD CONSTRAINT "_BranchToPartnerStaff_B_fkey" FOREIGN KEY ("B") REFERENCES "partner_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
