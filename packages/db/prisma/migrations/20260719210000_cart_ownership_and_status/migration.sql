-- Cart ownership model.
--
-- A cart id was previously sufficient to read, mutate and check out any basket:
-- carts carried no ownership data at all (`create()` never set userId, and the
-- `sessionId` column was never written). This introduces:
--
--   * guestToken — a capability secret for anonymous carts, minted once at
--     creation and cleared when a signed-in user claims the cart.
--   * status     — claimed via a status-guarded update before the PSP is called,
--     so a double-tapped checkout cannot charge twice.
--
-- `sessionId` is dropped because it was always NULL (no code path ever wrote it)
-- and its presence implied an ownership model that did not exist.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CartStatus" AS ENUM ('ACTIVE', 'CHECKING_OUT', 'CONVERTED', 'ABANDONED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "guestToken" TEXT;
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "status" "CartStatus" NOT NULL DEFAULT 'ACTIVE';

-- DropIndex (paired with the dropped column below)
DROP INDEX IF EXISTS "carts_sessionId_idx";

-- DropColumn — always NULL in every environment; see header.
ALTER TABLE "carts" DROP COLUMN IF EXISTS "sessionId";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "carts_guestToken_key" ON "carts"("guestToken");
CREATE INDEX IF NOT EXISTS "carts_status_updatedAt_idx" ON "carts"("status", "updatedAt");
