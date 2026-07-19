/**
 * The clinical half of the veterinary platform — MRC-VET-001.
 *
 * Self-contained on purpose: `VetModule` (the auth/org/staff half) imports this
 * one, so the two halves can be built, reviewed and reasoned about separately
 * while sharing exactly one contract — the `VetStaffGuard` + `@VetCapability` +
 * `@VetActorParam` triad that every clinical route is gated by.
 *
 * Services are exported because the org half legitimately needs to resolve a
 * consent tier or write an access-log row (e.g. when rendering a clinic's own
 * dashboard), and there must never be a second implementation of either.
 */
import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PrismaModule } from "../prisma/prisma.module";
import { VetPatientsController } from "./vet-patients.controller";
import { VetPatientsService } from "./vet-patients.service";
import { VetVisitsController } from "./vet-visits.controller";
import { VetVisitsService } from "./vet-visits.service";
import { VetRecordsController } from "./vet-records.controller";
import { VetRecordsService } from "./vet-records.service";
import { VetConsentController, VetOwnerConsentController } from "./vet-consent.controller";
import { VetConsentService } from "./vet-consent.service";
import { VetEmergencyController } from "./vet-emergency.controller";
import { VetEmergencyService } from "./vet-emergency.service";

@Module({
  // Every clinical controller is gated by VetStaffGuard, which Nest therefore
  // instantiates in THIS module's context — so the guard's own dependency
  // (JwtService, used to validate Counter-Mode terminal sessions) must resolve
  // here too. Without this the app compiles cleanly and then fails to boot.
  imports: [PrismaModule, JwtModule.register({})],
  controllers: [
    VetPatientsController,
    VetVisitsController,
    VetRecordsController,
    VetConsentController,
    VetOwnerConsentController,
    VetEmergencyController,
  ],
  providers: [
    VetPatientsService,
    VetVisitsService,
    VetRecordsService,
    VetConsentService,
    VetEmergencyService,
  ],
  exports: [VetPatientsService, VetVisitsService, VetRecordsService, VetConsentService],
})
export class VetClinicalModule {}
