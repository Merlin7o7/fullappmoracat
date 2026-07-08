-- The cat's character & keepsake layer (personality, favourites, fun answers,
-- and card personalisation: theme / accent / stickers / frame). One nullable
-- JSONB column keeps the fast Cat-ID issue path untouched while the invited
-- "complete the file" journey grows. Owner-authored, server-sanitised, and it
-- never gates membership or the card's safety/health jobs.
-- AlterTable
ALTER TABLE "cats" ADD COLUMN     "profile" JSONB;
