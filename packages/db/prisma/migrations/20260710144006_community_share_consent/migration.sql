-- PDPL photo-consent attestation (R106): stamped server-side the first time the
-- owner confirms that any people visible in the cat's photos agreed to their
-- publication. Null = never attested, so the web asks once before the profile
-- first goes public. Never written from a client-supplied timestamp.
-- AlterTable
ALTER TABLE "cats" ADD COLUMN     "shareConsentAt" TIMESTAMP(3);
