-- Shareable vet health summary (Wave 6). Additive only.
CREATE TABLE "health_share_links" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "includeContact" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "health_share_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "health_share_links_tokenHash_key" ON "health_share_links"("tokenHash");
CREATE INDEX "health_share_links_catId_idx" ON "health_share_links"("catId");
ALTER TABLE "health_share_links" ADD CONSTRAINT "health_share_links_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
