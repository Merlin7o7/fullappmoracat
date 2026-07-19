/**
 * Visits — the clinic's day-book and the episode of care — MRC-VET-001 §09.
 */
import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { VetStaffGuard } from "./guards/vet-staff.guard";
import { VetCapability } from "./decorators/vet-capability.decorator";
import { VetActorParam } from "./decorators/vet-actor.decorator";
import { VetVisitsService } from "./vet-visits.service";
import type { VetActor } from "./vet-patients.service";
import {
  CloseVisitDto,
  ListVisitsQueryDto,
  OpenVisitDto,
  OwnerSummaryDto,
  UpdateVisitDto,
} from "./dto/vet-visit.dto";

@ApiTags("vet-visits")
@ApiBearerAuth()
@UseGuards(VetStaffGuard)
@Controller("vet/visits")
export class VetVisitsController {
  constructor(private readonly visits: VetVisitsService) {}

  @Post()
  @VetCapability("visit.open")
  @ApiOperation({
    summary: "Open a visit",
    description:
      "QUICK (counter moment), STANDARD (full chart) or EMERGENCY. If the cat already has an open " +
      "visit at this clinic the call returns 409 VET_VISIT_OPEN_EXISTS with that visit's id — pass " +
      "`resumeExisting: true` to continue it. Never fork a second chart for one consultation.",
  })
  open(@VetActorParam() actor: VetActor, @Body() dto: OpenVisitDto) {
    return this.visits.open(actor, dto);
  }

  @Get()
  @VetCapability("visit.open")
  @ApiOperation({
    summary: "The clinic day-book",
    description:
      "Defaults to today's visits when no date, range, state or cat filter is supplied. Scoped to " +
      "the org, and further narrowed to the staff member's branches when their scope is limited.",
  })
  list(@VetActorParam() actor: VetActor, @Query() query: ListVisitsQueryDto) {
    return this.visits.list(actor, query);
  }

  @Get(":id")
  @VetCapability("visit.open")
  @ApiOperation({ summary: "One visit with its clinical entries and pending co-signs" })
  get(@VetActorParam() actor: VetActor, @Param("id") id: string) {
    return this.visits.get(actor, id);
  }

  @Patch(":id")
  @VetCapability("visit.open")
  @ApiOperation({ summary: "Update the presenting complaint, reason, or follow-up date" })
  update(@VetActorParam() actor: VetActor, @Param("id") id: string, @Body() dto: UpdateVisitDto) {
    return this.visits.update(actor, id, dto);
  }

  @Post(":id/close")
  @VetCapability("visit.close")
  @ApiOperation({
    summary: "Close the visit",
    description:
      "Requires at least one clinical entry, or an explicit reason when there is none. Reports any " +
      "intern drafts still awaiting a co-signature rather than silently finalising them.",
  })
  close(@VetActorParam() actor: VetActor, @Param("id") id: string, @Body() dto: CloseVisitDto) {
    return this.visits.close(actor, id, dto);
  }

  @Post(":id/owner-summary")
  @VetCapability("record.write")
  @ApiOperation({
    summary: "Send the owner a plain-language summary",
    description:
      "Saves `ownerSummary` on the visit and delivers it to the OWNER as an in-app notification in " +
      "both Arabic and English. This is the moment a clinical act becomes member communication.",
  })
  ownerSummary(@VetActorParam() actor: VetActor, @Param("id") id: string, @Body() dto: OwnerSummaryDto) {
    return this.visits.sendOwnerSummary(actor, id, dto);
  }
}
