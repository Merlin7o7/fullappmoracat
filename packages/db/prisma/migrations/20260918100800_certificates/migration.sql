-- T9: Cat ID certificates — a frozen, numbered, verifiable snapshot of the record.
-- Additive only.
CREATE TYPE "CertificateKind" AS ENUM ('CAT_ID', 'VACCINATION');

CREATE TABLE "cat_certificates" (
  "id" TEXT NOT NULL,
  "catId" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "verifyToken" TEXT NOT NULL,
  "kind" "CertificateKind" NOT NULL DEFAULT 'CAT_ID',
  "snapshot" JSONB NOT NULL,
  "pdfKey" TEXT,
  "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "issuedByOrgId" TEXT,
  "issuedByUserId" TEXT,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "cat_certificates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cat_certificates_number_key" ON "cat_certificates"("number");
CREATE UNIQUE INDEX "cat_certificates_verifyToken_key" ON "cat_certificates"("verifyToken");
CREATE INDEX "cat_certificates_catId_issuedAt_idx" ON "cat_certificates"("catId", "issuedAt");

ALTER TABLE "cat_certificates" ADD CONSTRAINT "cat_certificates_catId_fkey"
  FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cat_certificates" ADD CONSTRAINT "cat_certificates_issuedByOrgId_fkey"
  FOREIGN KEY ("issuedByOrgId") REFERENCES "partner_orgs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "cat_certificates" ADD CONSTRAINT "cat_certificates_issuedByUserId_fkey"
  FOREIGN KEY ("issuedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
