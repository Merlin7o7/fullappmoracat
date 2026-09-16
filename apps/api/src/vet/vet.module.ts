import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AuthModule } from "../auth/auth.module";
import { VetAuthController } from "./vet-auth.controller";
import { VetAuthService } from "./vet-auth.service";
import { VetOrgController, VetPublicController } from "./vet-org.controller";
import { VetOrgService } from "./vet-org.service";
import { VetStaffController } from "./vet-staff.controller";
import { VetStaffService } from "./vet-staff.service";
import { VetAdminController } from "./vet-admin.controller";
import { VetAdminService } from "./vet-admin.service";
import { VetStaffGuard } from "./guards/vet-staff.guard";
import { VetClinicalModule } from "./vet-clinical.module";
import {
  VetOnboardingController,
  VetRegistrationAdminController,
  VetRegistrationController,
} from "./vet-registration.controller";
import { VetRegistrationService } from "./vet-registration.service";
import { VetComplianceService } from "./vet-compliance.service";

/**
 * The veterinary platform's identity & organisation half — MRC-VET-001.
 *
 * Owns: the public application + directory, clinic-side identity (org context,
 * invitations, Counter Mode), org/branch/device management, staff
 * administration, and Moracat-side partner administration.
 *
 * `VetStaffGuard` is exported (not registered globally) so the clinical half —
 * patients, visits, records, consent, emergency — protects its own controllers
 * with the same one guard and reads the same `VetActor`.
 */
@Module({
  // The clinical half (patients, visits, records, consent, emergency) mounts
  // here so the whole veterinary surface is reachable from one module in
  // app.module — and so both halves share exactly one guard implementation.
  imports: [JwtModule.register({}), AuthModule, VetClinicalModule],
  controllers: [
    VetPublicController,
    VetAuthController,
    VetOrgController,
    VetStaffController,
    VetAdminController,
    VetRegistrationAdminController,
    VetRegistrationController,
    VetOnboardingController,
  ],
  providers: [
    VetAuthService,
    VetOrgService,
    VetStaffService,
    VetAdminService,
    VetRegistrationService,
    VetComplianceService,
    VetStaffGuard,
  ],
  exports: [VetStaffGuard, VetAuthService, VetStaffService],
})
export class VetModule {}
