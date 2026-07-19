-- Vet lookup indexes.
--
-- microchipNo was the ONLY identifier that works for a stray or a non-member
-- cat — the single most important lookup a clinic performs — and it was the one
-- identifier with no index at all, so every microchip search seq-scanned the
-- whole cats table. catIdNumber, qrToken and User.phone were all already unique.
--
-- (status, deletedAt) serves the lifecycle passes and the new clinic patient
-- list, neither of which any existing index covered.

-- CreateIndex
CREATE INDEX "cats_microchipNo_idx" ON "cats"("microchipNo");

-- CreateIndex
CREATE INDEX "cats_status_deletedAt_idx" ON "cats"("status", "deletedAt");

