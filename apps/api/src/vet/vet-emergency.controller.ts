/**
 * Break-glass — one red button, tier-0 only, always disclosed.
 */
import { Body, Controller, Ip, Param, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { VetStaffGuard } from "./guards/vet-staff.guard";
import { VetCapability } from "./decorators/vet-capability.decorator";
import { VetActorParam } from "./decorators/vet-actor.decorator";
import { VetEmergencyService } from "./vet-emergency.service";
import type { VetActor } from "./vet-patients.service";
import { EmergencyAccessDto } from "./dto/vet-consent.dto";

@ApiTags("vet-emergency")
@ApiBearerAuth()
@UseGuards(VetStaffGuard)
@Controller("vet/emergency")
export class VetEmergencyController {
  constructor(private readonly emergency: VetEmergencyService) {}

  @Post(":catId")
  @VetCapability("emergency.access")
  @ApiOperation({
    summary: "Emergency access — tier-0 safety information only",
    description:
      "Returns allergies, chronic conditions, current medications, emergency contacts, the cat's " +
      "primary clinic and the owner's phone — and nothing else. It does not unlock the medical " +
      "record: everything returned is the tier-0 floor that needs no consent, because a hidden " +
      "allergy can kill. Every call writes an emergency-flagged ConsentGrant with the stated " +
      "reason, an emergency-flagged access-log row, and notifies the owner immediately. " +
      "Instant access, total transparency — never silent.",
  })
  breakGlass(
    @VetActorParam() actor: VetActor,
    @Param("catId") catId: string,
    @Body() dto: EmergencyAccessDto,
    @Ip() ip: string
  ) {
    return this.emergency.breakGlass(actor, catId, dto, ip);
  }
}
