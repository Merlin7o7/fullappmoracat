/**
 * Patient lookup + the read side of the clinical record — MRC-VET-001 §05/§06/§10.
 *
 * Every route here is capability-gated AND consent-resolved AND logged. Those
 * are three different questions and all three must be answered before a byte of
 * a cat's history leaves the building:
 *   • capability — may this ROLE do this at all? (a receptionist never reads records)
 *   • consent    — may this CLINIC see this depth? (the owner decides)
 *   • ledger     — the owner is told, every time.
 */
import { Body, Controller, Get, Ip, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { VetStaffGuard } from "./guards/vet-staff.guard";
import { VetCapability } from "./decorators/vet-capability.decorator";
import { VetActorParam } from "./decorators/vet-actor.decorator";
import { VetPatientsService, type VetActor } from "./vet-patients.service";
import { VetClaimsService } from "./vet-claims.service";
import {
  CreatePatientDto,
  PrescriptionListQueryDto,
  RefreshClaimDto,
  SearchPatientsQueryDto,
  TimelineQueryDto,
  WeightSeriesQueryDto,
  ListOwnPatientsQueryDto,
} from "./dto/vet-patient.dto";

@ApiTags("vet-patients")
@ApiBearerAuth()
@UseGuards(VetStaffGuard)
@Controller("vet/patients")
export class VetPatientsController {
  constructor(
    private readonly patients: VetPatientsService,
    private readonly claims: VetClaimsService
  ) {}

  // ── Walk-ins (MRC-PROD-001 T4) ─────────────────────────────────────────
  @Post()
  @VetCapability("patient.create")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: "Register a walk-in cat and hand the owner a claim link",
    description:
      "Creates the cat (owned by the system placeholder until claimed), opens an intake visit so " +
      "the clinic can write the record immediately, and mints a one-time claim link. Returns the " +
      "link once for the counter screen; SMS delivery is behind CLAIM_SMS_ENABLED. If a cat with " +
      "that microchip or (owner phone + name) already exists, returns it instead of a duplicate.",
  })
  createPatient(@VetActorParam() actor: VetActor, @Body() dto: CreatePatientDto) {
    return this.claims.createPatient(actor, dto);
  }

  // Declared BEFORE :catId — Nest matches in declaration order, so a literal
  // segment placed after a param route would be swallowed by it.
  @Get()
  @VetCapability("patient.view")
  @ApiOperation({
    summary: "The clinic's own patients",
    description:
      "Cats this clinic has actually treated, newest visit first. Scoped to cats with a visit at " +
      "this org — a clinic's patient list is its treatment history, never the whole member base.",
  })
  @ApiOkResponse({ description: "Cursor-paginated patient cards." })
  listOwn(@VetActorParam() actor: VetActor, @Query() query: ListOwnPatientsQueryDto) {
    return this.patients.listOwnPatients(actor, query);
  }

  @Get("search")
  @VetCapability("patient.search")
  @ApiOperation({
    summary: "Find a patient — one omnibox, every identifier",
    description:
      "Auto-detects Cat ID (MRC-XXXX-XXXX), QR token, microchip (15 digits), owner phone or email, " +
      "else treats the input as a name. Exact identifiers match ANY registered cat, because the " +
      "member is standing at the counter holding one. NAME queries are restricted to cats this " +
      "clinic has already seen — free browsing of the member base is not a feature, it is a leak. " +
      "The response always carries `scope.notice` so the UI can explain the boundary in words.",
  })
  @ApiOkResponse({ description: "Result cards + the scope the search actually ran under." })
  search(@VetActorParam() actor: VetActor, @Query() query: SearchPatientsQueryDto) {
    return this.patients.search(actor, query);
  }

  @Get(":catId/claim")
  @VetCapability("patient.search")
  @ApiOperation({ summary: "Claim state of a clinic-created cat (never the token)" })
  claimState(@VetActorParam() actor: VetActor, @Param("catId") catId: string) {
    return this.claims.getClaim(actor, catId);
  }

  @Post(":catId/claim/refresh")
  @VetCapability("patient.create")
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Mint a fresh claim link (revokes the previous) and optionally re-send the SMS" })
  refreshClaim(@VetActorParam() actor: VetActor, @Param("catId") catId: string, @Body() dto: RefreshClaimDto) {
    return this.claims.refreshClaim(actor, catId, dto ?? {});
  }

  @Get(":catId")
  @VetCapability("patient.view")
  @ApiOperation({
    summary: "Consent-resolved clinical profile",
    description:
      "Tier-0 content (identity, allergies, chronic conditions, current medications, emergency " +
      "contacts, handling notes) is always present — a hidden allergy can kill. T1 adds the care " +
      "summary and the owner's contact details; T2 adds other clinics' history. `access.hidden` " +
      "states exactly what is withheld and how to ask for it, so a restricted section is never a " +
      "silently empty one. Writes a RecordAccessLog row the owner can read.",
  })
  profile(@VetActorParam() actor: VetActor, @Param("catId") catId: string, @Ip() ip: string) {
    return this.patients.getProfile(actor, catId, ip);
  }

  @Get(":catId/timeline")
  @VetCapability("record.read")
  @ApiOperation({
    summary: "Medical timeline — paginated, filterable, tier-scoped",
    description:
      "Reverse-chronological clinical entries with their visit, author and attachment metadata, " +
      "each stamped with the clinic that created it. T1 (or no grant) returns this clinic's own " +
      "entries; T2 returns every clinic's. Retracted entries are returned AS retractions — reason " +
      "visible, payload withheld — because medical history is never deleted.",
  })
  timeline(
    @VetActorParam() actor: VetActor,
    @Param("catId") catId: string,
    @Query() query: TimelineQueryDto,
    @Ip() ip: string
  ) {
    return this.patients.getTimeline(actor, catId, query, ip);
  }

  @Get(":catId/weights")
  @VetCapability("record.read")
  @ApiOperation({
    summary: "Weight series, chart-ready, with a described (never diagnosed) trend",
    description:
      "Ordered ascending for direct charting. `trend` reports direction, absolute and percentage " +
      "change over the window and restates it in words — it never interprets the curve, because " +
      "that is the veterinarian's job.",
  })
  weights(
    @VetActorParam() actor: VetActor,
    @Param("catId") catId: string,
    @Query() query: WeightSeriesQueryDto,
    @Ip() ip: string
  ) {
    return this.patients.getWeights(actor, catId, query, ip);
  }

  @Get(":catId/prescriptions")
  @VetCapability("record.read")
  @ApiOperation({
    summary: "Prescriptions for this cat",
    description:
      "ACTIVE medication is visible whichever clinic issued it — safety, not history. Completed " +
      "and cancelled prescriptions from other clinics require T2. Only the issuing clinic may " +
      "advance a prescription's status (`canDispense`).",
  })
  prescriptions(
    @VetActorParam() actor: VetActor,
    @Param("catId") catId: string,
    @Query() query: PrescriptionListQueryDto,
    @Ip() ip: string
  ) {
    return this.patients.listPrescriptions(actor, catId, query, ip);
  }
}
