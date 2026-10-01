-- The cat's life album (Wave 9). Additive only.
CREATE TABLE "cat_moments" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "happenedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cat_moments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cat_moments_catId_happenedAt_idx" ON "cat_moments"("catId", "happenedAt");
ALTER TABLE "cat_moments" ADD CONSTRAINT "cat_moments_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
