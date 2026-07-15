-- CreateEnum
CREATE TYPE "SourcingStatus" AS ENUM ('IN_STOCK', 'TO_SOURCE');

-- AlterTable
ALTER TABLE "plan_contents" ADD COLUMN     "selectableType" "ProductType";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "flavorAr" TEXT,
ADD COLUMN     "flavorEn" TEXT,
ADD COLUMN     "sourcing" "SourcingStatus" NOT NULL DEFAULT 'IN_STOCK';

-- AlterTable
ALTER TABLE "subscription_items" ADD COLUMN     "planContentId" TEXT;

-- AddForeignKey
ALTER TABLE "subscription_items" ADD CONSTRAINT "subscription_items_planContentId_fkey" FOREIGN KEY ("planContentId") REFERENCES "plan_contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
