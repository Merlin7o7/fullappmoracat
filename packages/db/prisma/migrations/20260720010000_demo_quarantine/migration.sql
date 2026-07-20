-- Demo quarantine.
--
-- Makes it safe to host a sales demo clinic on the SAME database as real
-- members. Without this, handing demo credentials to a visiting vet would hand
-- them a lookup tool over the real member base: patient search deliberately
-- matches ANY registered cat by exact identifier (Cat ID, microchip, owner
-- phone), which is correct for a real clinic and unacceptable for a demo.
--
-- The quarantine is two-way and applied at the query base, not per call site:
--   * a demo clinic resolves ONLY demo cats
--   * a real clinic NEVER resolves a demo cat
--   * demo cats are excluded from the census count (the founding-member
--     ordinal is a public claim — a fictional cat inside it is a false one)
--   * demo cats are excluded from the community feed
--   * demo clinics are excluded from the public vet directory

-- AlterTable
ALTER TABLE "cats" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "partner_orgs" ADD COLUMN     "isDemo" BOOLEAN NOT NULL DEFAULT false;

