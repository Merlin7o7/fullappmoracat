-- Plan.retailValue + PlanContent.labelAr/unitAr.
--
-- retailValue: what a plan's contents cost bought individually from our own
-- store. Persisted so the member-facing saving is a computed fact instead of a
-- marketing claim — previously nothing held the comparison and the UI showed
-- "0 SAR saved" permanently, while the box actually cost 19–35% MORE than
-- à-la-carte.
--
-- labelAr/unitAr: the Arabic checkout rendered its box contents in English
-- ("Wet food pouches ١٥pouch") on the screen where the member commits money.
-- The Arabic strings already existed in seed-catalog.ts and were dropped on
-- write because the columns did not exist.

-- AlterTable
ALTER TABLE "plan_contents" ADD COLUMN     "labelAr" TEXT,
ADD COLUMN     "unitAr" TEXT;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "retailValue" DECIMAL(10,2);

