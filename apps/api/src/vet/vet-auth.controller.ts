import { Body, Controller, Headers, HttpCode, HttpStatus, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { VetAuthService } from "./vet-auth.service";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { VET_COUNTER_HEADER } from "./guards/vet-staff.guard";
import {
  AcceptInviteDto,
  CounterLockDto,
  CounterUnlockDto,
  InvitePreviewDto,
  SelectOrgDto,
} from "./dto/vet-auth.dto";

/** A PIN is a low-entropy secret; the endpoint that checks it must be tight. */
const PIN_THROTTLE = { default: { limit: 10, ttl: 60_000 } } as const;
/** Invitation tokens are high-entropy, but guessing attempts are still noise. */
const INVITE_THROTTLE = { default: { limit: 12, ttl: 60_000 } } as const;

function meta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

/**
 * Clinic-side identity — MRC-VET-001 §02.
 *
 * Staff authenticate through the ordinary Moracat auth surface (`/api/auth/*`).
 * Everything here is what happens *after*: which clinic am I acting inside, and
 * who is standing at the front desk right now.
 */
@ApiTags("vet-auth")
@Controller("vet/auth")
export class VetAuthController {
  constructor(private readonly auth: VetAuthService) {}

  @Post("context")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "The caller's clinic memberships (org, role, branches, status) for the org picker",
  })
  context(@CurrentUser("id") userId: string) {
    return this.auth.context(userId);
  }

  @Post("select-org")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      "Validate an org choice and return the context to send as x-moracat-org on later requests",
  })
  selectOrg(@CurrentUser("id") userId: string, @Body() dto: SelectOrgDto) {
    return this.auth.selectOrg(userId, dto.orgId);
  }

  @Public()
  @Throttle(INVITE_THROTTLE)
  @Post("invite/preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Preview an invitation before signing in (clinic, role, expiry)" })
  previewInvite(@Body() dto: InvitePreviewDto) {
    return this.auth.previewInvite(dto.token);
  }

  @Throttle(INVITE_THROTTLE)
  @Post("accept-invite")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Accept a staff invitation — activates the PartnerStaff membership" })
  acceptInvite(@CurrentUser() user: AuthUser, @Body() dto: AcceptInviteDto) {
    return this.auth.acceptInvite(user.id, user.email, dto.token);
  }

  @Throttle(PIN_THROTTLE)
  @Post("counter/unlock")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "PIN-switch the active identity on a registered terminal (reduced-scope session)",
  })
  counterUnlock(
    @CurrentUser("id") userId: string,
    @Body() dto: CounterUnlockDto,
    @Req() req: Request
  ) {
    return this.auth.counterUnlock(userId, dto, meta(req));
  }

  @Post("counter/lock")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "End the counter session immediately (idle auto-lock or shift change)" })
  counterLock(
    @Body() dto: CounterLockDto,
    @Headers(VET_COUNTER_HEADER) headerToken: string | undefined,
    @Req() req: Request
  ) {
    return this.auth.counterLock(dto.token ?? headerToken, meta(req));
  }
}
