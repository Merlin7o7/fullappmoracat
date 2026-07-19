-- AddForeignKey
ALTER TABLE "vet_clinical_entries" ADD CONSTRAINT "vet_clinical_entries_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vet_prescriptions" ADD CONSTRAINT "vet_prescriptions_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "partner_orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
