/**
 * Clinical entries, attachments, and the prescription lifecycle — MRC-VET-001 §10.
 *
 * Note what is missing from this controller and always will be: there is no
 * PUT/PATCH on an entry and no DELETE. Correction is `POST :id/revise`
 * (a new row), withdrawal is `POST :id/retract` (a reason, never a removal).
 */
import { Body, Controller, Get, Ip, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { VetStaffGuard } from "./guards/vet-staff.guard";
import { VetCapability } from "./decorators/vet-capability.decorator";
import { VetActorParam } from "./decorators/vet-actor.decorator";
import { VetRecordsService } from "./vet-records.service";
import type { VetActor } from "./vet-patients.service";
import {
  CoSignClinicalEntryDto,
  CreateAttachmentDto,
  CreateClinicalEntryDto,
  RetractClinicalEntryDto,
  ReviseClinicalEntryDto,
  UpdatePrescriptionStatusDto,
} from "./dto/vet-record.dto";

@ApiTags("vet-records")
@ApiBearerAuth()
@UseGuards(VetStaffGuard)
@Controller("vet")
export class VetRecordsController {
  constructor(private readonly records: VetRecordsService) {}

  @Post("records")
  @VetCapability("record.write")
  @ApiOperation({
    summary: "Author a clinical entry",
    description:
      "`payload` is validated against the typed schema for `type` (EXAM · DIAGNOSIS · VACCINATION · " +
      "TREATMENT · PRESCRIPTION · LAB · IMAGING · SURGERY · DENTAL · HOSPITALIZATION · WEIGHT · " +
      "NUTRITION · SUPPLEMENT · NOTE). An INTERN's entry is saved as DRAFT and fires no side " +
      "effects until co-signed. A finalised VACCINATION also writes CatVaccination (so the " +
      "lifecycle engine reminds the owner), WEIGHT also writes CatWeightRecord and updates the " +
      "cat, and PRESCRIPTION also issues a Prescription with allergy/duplicate warnings attached.",
  })
  create(@VetActorParam() actor: VetActor, @Body() dto: CreateClinicalEntryDto) {
    return this.records.create(actor, dto);
  }

  @Get("records/:id")
  @VetCapability("record.read")
  @ApiOperation({ summary: "Read one clinical entry (writes an access-log row)" })
  getOne(@VetActorParam() actor: VetActor, @Param("id") id: string, @Ip() ip: string) {
    return this.records.getOne(actor, id, ip);
  }

  @Post("records/:id/cosign")
  @VetCapability("record.cosign")
  @ApiOperation({
    summary: "Co-sign a trainee's draft — it becomes FINAL",
    description:
      "Adds a signature rather than altering what was written, and releases the entry's side " +
      "effects. A clinician cannot co-sign their own draft.",
  })
  coSign(@VetActorParam() actor: VetActor, @Param("id") id: string, @Body() dto: CoSignClinicalEntryDto) {
    return this.records.coSign(actor, id, dto);
  }

  @Post("records/:id/revise")
  @VetCapability("record.write")
  @ApiOperation({
    summary: "Correct an entry — creates a NEW row, marks the original AMENDED",
    description:
      "The only way to change a clinical record. The predecessor stays fully readable and the " +
      "chain is walkable via `revisionOf`. Owner-facing projections of the old version are retired " +
      "so a corrected weight or vaccination leaves no stale reminder behind.",
  })
  revise(@VetActorParam() actor: VetActor, @Param("id") id: string, @Body() dto: ReviseClinicalEntryDto) {
    return this.records.revise(actor, id, dto);
  }

  @Post("records/:id/retract")
  @VetCapability("record.retract")
  @ApiOperation({
    summary: "Withdraw an entry — reason required, nothing is deleted",
    description:
      "Stamps retractedAt + reason. The entry stays in the timeline marked as retracted, with its " +
      "payload withheld; its prescription is cancelled and its weight/vaccination projections are " +
      "removed so a withdrawn record stops acting on the owner's life.",
  })
  retract(@VetActorParam() actor: VetActor, @Param("id") id: string, @Body() dto: RetractClinicalEntryDto) {
    return this.records.retract(actor, id, dto);
  }

  @Post("records/:id/attachments")
  @VetCapability("attachment.upload")
  @ApiOperation({
    summary: "Attach a stored object (X-ray, lab PDF, photo) to an entry",
    description:
      "Upload the bytes first via POST /api/uploads/image (which sniffs the real file type), then " +
      "send the returned URL here. Only http(s) URLs are accepted. List responses return metadata " +
      "only — the object URL comes from the attachment endpoint, which logs the read.",
  })
  addAttachment(@VetActorParam() actor: VetActor, @Param("id") id: string, @Body() dto: CreateAttachmentDto) {
    return this.records.addAttachment(actor, id, dto);
  }

  @Get("records/:id/attachments/:attachmentId")
  @VetCapability("record.read")
  @ApiOperation({
    summary: "Open one attachment's object URL — and log that somebody looked",
  })
  getAttachment(
    @VetActorParam() actor: VetActor,
    @Param("id") id: string,
    @Param("attachmentId") attachmentId: string,
    @Ip() ip: string
  ) {
    return this.records.getAttachment(actor, id, attachmentId, ip);
  }

  @Post("prescriptions/:id/status")
  @VetCapability("prescription.dispense")
  @ApiOperation({
    summary: "Advance a prescription — dispense · refill · complete · cancel",
    description:
      "Enforces the lifecycle graph (ISSUED → COLLECTED → REFILLED* → COMPLETED, with CANCELLED / " +
      "EXPIRED as terminal states). Only the issuing clinic may act. Cancelling requires a reason. " +
      "Set `notifyOwner` to tell the member their medication is ready or their course is done.",
  })
  updatePrescription(
    @VetActorParam() actor: VetActor,
    @Param("id") id: string,
    @Body() dto: UpdatePrescriptionStatusDto
  ) {
    return this.records.updatePrescriptionStatus(actor, id, dto);
  }
}
