/**
 * Consent — both halves of it, side by side on purpose.
 *
 * `VetConsentController`      → the clinic. It may ASK, and read what it holds.
 * `VetOwnerConsentController` → the member. They GRANT, REVOKE, and READ THE
 *                               LEDGER of everyone who looked.
 *
 * The clinic controller is guarded by VetStaffGuard (clinic capability); the
 * owner controller runs on the ordinary member JWT, because these are the
 * member's own rights over their own cats and must never require a clinic
 * session to exercise.
 */
import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { VetStaffGuard } from "./guards/vet-staff.guard";
import { VetCapability } from "./decorators/vet-capability.decorator";
import { VetActorParam } from "./decorators/vet-actor.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { VetConsentService } from "./vet-consent.service";
import type { VetActor } from "./vet-patients.service";
import {
  AccessLogQueryDto,
  GrantConsentDto,
  OwnerGrantsQueryDto,
  RequestConsentDto,
  RevokeConsentDto,
} from "./dto/vet-consent.dto";

@ApiTags("vet-consent")
@ApiBearerAuth()
@UseGuards(VetStaffGuard)
@Controller("vet/consent")
export class VetConsentController {
  constructor(private readonly consent: VetConsentService) {}

  @Post("request")
  @VetCapability("patient.view")
  @ApiOperation({
    summary: "Ask the owner for record access",
    description:
      "Delivers a request to the OWNER naming this clinic, the tier asked for and the stated " +
      "reason, deep-linked to the screen where they decide. Nothing opens until they say yes — " +
      "silence is never consent. Returns `alreadyGranted` if the clinic already holds that depth.",
  })
  request(@VetActorParam() actor: VetActor, @Body() dto: RequestConsentDto) {
    return this.consent.request(actor, dto);
  }

  @Get(":catId")
  @VetCapability("patient.view")
  @ApiOperation({
    summary: "What this clinic may currently see about this cat",
    description:
      "Returns the effective tier, the live grant behind it, and the upgrade path if there is one.",
  })
  effectiveTier(@VetActorParam() actor: VetActor, @Param("catId") catId: string) {
    return this.consent.effectiveTier(actor, catId);
  }
}

@ApiTags("vet-owner-consent")
@ApiBearerAuth()
@Controller("vet/owner")
export class VetOwnerConsentController {
  constructor(private readonly consent: VetConsentService) {}

  @Get("consent/grants")
  @ApiOperation({
    summary: "Every clinic I've trusted, and with what",
    description: "Across all my cats, or one cat with `?catId=`. Includes expired and revoked grants.",
  })
  grants(@CurrentUser("id") userId: string, @Query() query: OwnerGrantsQueryDto) {
    return this.consent.listOwnerGrants(userId, query);
  }

  @Post("consent/grants")
  @ApiOperation({
    summary: "Give a clinic access to my cat's record",
    description:
      "T1 = the care summary · T2 = the full cross-clinic history. Pass `expiresAt` to time-box it " +
      "(\"share for 24 hours\"). Granting supersedes any previous live grant for that clinic, so " +
      "there is always exactly one answer to \"what can they see\".",
  })
  grant(@CurrentUser("id") userId: string, @Body() dto: GrantConsentDto) {
    return this.consent.grant(userId, dto);
  }

  @Post("consent/grants/:id/revoke")
  @ApiOperation({
    summary: "Withdraw a clinic's access — effective immediately",
    description:
      "One call, no retention flow, no reason required. Tier-0 safety alerts remain visible to any " +
      "treating clinic afterwards, because a hidden allergy can kill.",
  })
  revoke(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() dto: RevokeConsentDto) {
    return this.consent.revoke(userId, id, dto);
  }

  @Get("access-log")
  @ApiOperation({
    summary: "The access ledger — who looked at my cat's record",
    description:
      "Every profile, timeline, entry, attachment and emergency read, newest first, with the clinic " +
      "named, the tier, and whether it was break-glass. Privacy you can see, not privacy you're " +
      "asked to trust.",
  })
  accessLog(@CurrentUser("id") userId: string, @Query() query: AccessLogQueryDto) {
    return this.consent.accessLog(userId, query);
  }
}
