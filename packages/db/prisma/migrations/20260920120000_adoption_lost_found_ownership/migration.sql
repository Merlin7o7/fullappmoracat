-- The cat's life beyond one household: adoption, Cat ID ownership transfer,
-- and lost & found. Additive only -- no column or table is dropped or narrowed.

-- CreateEnum
CREATE TYPE "ContactPreference" AS ENUM ('IN_APP', 'PHONE', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "AdoptionStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'ADOPTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "AdoptionRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'WITHDRAWN', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OwnershipTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OwnershipTransferReason" AS ENUM ('ADOPTION', 'GIFT', 'REHOME', 'OTHER');

-- CreateEnum
CREATE TYPE "LostFoundKind" AS ENUM ('LOST', 'FOUND');

-- CreateEnum
CREATE TYPE "LostFoundStatus" AS ENUM ('ACTIVE', 'REUNITED', 'CLOSED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "noCatYetAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "adoption_listings" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "AdoptionStatus" NOT NULL DEFAULT 'AVAILABLE',
    "cityCode" TEXT,
    "district" TEXT,
    "story" TEXT NOT NULL,
    "reason" TEXT,
    "feeSar" INTEGER NOT NULL DEFAULT 0,
    "goodWithKids" BOOLEAN,
    "goodWithCats" BOOLEAN,
    "goodWithDogs" BOOLEAN,
    "contactPref" "ContactPreference" NOT NULL DEFAULT 'IN_APP',
    "contactPhone" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reservedAt" TIMESTAMP(3),
    "adoptedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "adoptedByUserId" TEXT,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "adoption_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "adoption_requests" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "AdoptionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "ownerNote" TEXT,
    "contactSharedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "adoption_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_ownership_transfers" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "toUserId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "status" "OwnershipTransferStatus" NOT NULL DEFAULT 'PENDING',
    "reason" "OwnershipTransferReason" NOT NULL DEFAULT 'REHOME',
    "note" TEXT,
    "listingId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cat_ownership_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cat_ownership_records" (
    "id" TEXT NOT NULL,
    "catId" TEXT NOT NULL,
    "fromUserId" TEXT,
    "toUserId" TEXT NOT NULL,
    "reason" "OwnershipTransferReason" NOT NULL DEFAULT 'REHOME',
    "transferId" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cat_ownership_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_found_posts" (
    "id" TEXT NOT NULL,
    "kind" "LostFoundKind" NOT NULL,
    "status" "LostFoundStatus" NOT NULL DEFAULT 'ACTIVE',
    "catId" TEXT,
    "reporterId" TEXT NOT NULL,
    "catName" TEXT,
    "description" TEXT NOT NULL,
    "cityCode" TEXT,
    "district" TEXT,
    "areaNote" TEXT,
    "gender" "CatGender" NOT NULL DEFAULT 'UNKNOWN',
    "colorNote" TEXT,
    "hasCollar" BOOLEAN,
    "microchipNo" TEXT,
    "photoUrl" TEXT,
    "extraPhotos" TEXT[],
    "happenedAt" TIMESTAMP(3) NOT NULL,
    "contactPref" "ContactPreference" NOT NULL DEFAULT 'IN_APP',
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "reunitedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "hiddenAt" TIMESTAMP(3),
    "hiddenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lost_found_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lost_found_messages" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "senderId" TEXT,
    "senderName" TEXT,
    "senderPhone" TEXT,
    "message" TEXT NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lost_found_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "adoption_listings_status_publishedAt_idx" ON "adoption_listings"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "adoption_listings_cityCode_status_idx" ON "adoption_listings"("cityCode", "status");

-- CreateIndex
CREATE INDEX "adoption_listings_ownerId_idx" ON "adoption_listings"("ownerId");

-- CreateIndex
CREATE INDEX "adoption_listings_catId_idx" ON "adoption_listings"("catId");

-- CreateIndex
CREATE INDEX "adoption_requests_requesterId_status_idx" ON "adoption_requests"("requesterId", "status");

-- CreateIndex
CREATE INDEX "adoption_requests_listingId_status_idx" ON "adoption_requests"("listingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "adoption_requests_listingId_requesterId_key" ON "adoption_requests"("listingId", "requesterId");

-- CreateIndex
CREATE UNIQUE INDEX "cat_ownership_transfers_tokenHash_key" ON "cat_ownership_transfers"("tokenHash");

-- CreateIndex
CREATE INDEX "cat_ownership_transfers_catId_status_idx" ON "cat_ownership_transfers"("catId", "status");

-- CreateIndex
CREATE INDEX "cat_ownership_transfers_fromUserId_status_idx" ON "cat_ownership_transfers"("fromUserId", "status");

-- CreateIndex
CREATE INDEX "cat_ownership_transfers_toUserId_status_idx" ON "cat_ownership_transfers"("toUserId", "status");

-- CreateIndex
CREATE INDEX "cat_ownership_transfers_toEmail_status_idx" ON "cat_ownership_transfers"("toEmail", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cat_ownership_records_transferId_key" ON "cat_ownership_records"("transferId");

-- CreateIndex
CREATE INDEX "cat_ownership_records_catId_at_idx" ON "cat_ownership_records"("catId", "at");

-- CreateIndex
CREATE INDEX "cat_ownership_records_toUserId_idx" ON "cat_ownership_records"("toUserId");

-- CreateIndex
CREATE INDEX "lost_found_posts_kind_status_happenedAt_idx" ON "lost_found_posts"("kind", "status", "happenedAt");

-- CreateIndex
CREATE INDEX "lost_found_posts_cityCode_status_idx" ON "lost_found_posts"("cityCode", "status");

-- CreateIndex
CREATE INDEX "lost_found_posts_reporterId_idx" ON "lost_found_posts"("reporterId");

-- CreateIndex
CREATE INDEX "lost_found_posts_catId_idx" ON "lost_found_posts"("catId");

-- CreateIndex
CREATE INDEX "lost_found_posts_microchipNo_idx" ON "lost_found_posts"("microchipNo");

-- CreateIndex
CREATE INDEX "lost_found_messages_postId_createdAt_idx" ON "lost_found_messages"("postId", "createdAt");

-- AddForeignKey
ALTER TABLE "adoption_listings" ADD CONSTRAINT "adoption_listings_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoption_listings" ADD CONSTRAINT "adoption_listings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoption_listings" ADD CONSTRAINT "adoption_listings_adoptedByUserId_fkey" FOREIGN KEY ("adoptedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "adoption_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "adoption_requests" ADD CONSTRAINT "adoption_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_ownership_transfers" ADD CONSTRAINT "cat_ownership_transfers_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_ownership_transfers" ADD CONSTRAINT "cat_ownership_transfers_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_ownership_transfers" ADD CONSTRAINT "cat_ownership_transfers_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_ownership_transfers" ADD CONSTRAINT "cat_ownership_transfers_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "adoption_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_ownership_records" ADD CONSTRAINT "cat_ownership_records_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_ownership_records" ADD CONSTRAINT "cat_ownership_records_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_ownership_records" ADD CONSTRAINT "cat_ownership_records_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cat_ownership_records" ADD CONSTRAINT "cat_ownership_records_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "cat_ownership_transfers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_found_posts" ADD CONSTRAINT "lost_found_posts_catId_fkey" FOREIGN KEY ("catId") REFERENCES "cats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_found_posts" ADD CONSTRAINT "lost_found_posts_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_found_messages" ADD CONSTRAINT "lost_found_messages_postId_fkey" FOREIGN KEY ("postId") REFERENCES "lost_found_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lost_found_messages" ADD CONSTRAINT "lost_found_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

