-- Per-cat switch for showing personality / favourites / fun facts publicly.
ALTER TABLE "cats" ADD COLUMN "showCharacter" BOOLEAN NOT NULL DEFAULT true;
