-- Passwordless email sign-in codes (Wave 8). Additive only.
CREATE TABLE "email_sign_ins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_sign_ins_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "email_sign_ins_email_createdAt_idx" ON "email_sign_ins"("email", "createdAt");
