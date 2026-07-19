import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { VetStaffService } from "./vet-staff.service";
import { VetStaffGuard, VET_ORG_HEADER } from "./guards/vet-staff.guard";
import { VetCapability } from "./decorators/vet-capability.decorator";
import { VetActorParam, type VetActor } from "./decorators/vet-actor.decorator";
import {
  ChangeStaffRoleDto,
  InviteStaffDto,
  SetOwnPinDto,
  StaffListQueryDto,
  StaffReasonDto,
} from "./dto/vet-staff.dto";

function meta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

/**
 * The clinic's team — MRC-VET-001 §02/§14.
 *
 * Everything except your own PIN needs `staff.manage`, and no action here can
 * hand out a role the caller does not already outrank (`assignableRoles`).
 */
@ApiTags("vet-staff")
@ApiBearerAuth()
@ApiHeader({ name: VET_ORG_HEADER, description: "PartnerOrg id the caller is acting inside", required: true })
@UseGuards(VetStaffGuard)
@Controller("vet/staff")
export class VetStaffController {
  constructor(private readonly staff: VetStaffService) {}

  @Get()
  @VetCapability("staff.manage")
  @ApiOperation({ summary: "List the clinic's team" })
  list(@VetActorParam() actor: VetActor, @Query() query: StaffListQueryDto) {
    return this.staff.list(actor, query);
  }

  @Get("assignable-roles")
  @ApiOperation({ summary: "Roles the caller may assign, with each role's capabilities" })
  assignable(@VetActorParam() actor: VetActor) {
    return this.staff.assignable(actor);
  }

  // ── Own counter PIN (no staff.manage — it is your own secret) ─────────────

  @Put("me/pin")
  @ApiOperation({ summary: "Set or change your own Counter Mode PIN (personal sessions only)" })
  setOwnPin(@VetActorParam() actor: VetActor, @Body() dto: SetOwnPinDto, @Req() req: Request) {
    return this.staff.setOwnPin(actor, dto, meta(req));
  }

  // ── Invitations ───────────────────────────────────────────────────────────

  @Get("invites")
  @VetCapability("staff.manage")
  @ApiOperation({ summary: "Outstanding invitations" })
  listInvites(@VetActorParam() actor: VetActor) {
    return this.staff.listInvites(actor);
  }

  @Post("invites")
  @VetCapability("staff.manage")
  @ApiOperation({ summary: "Invite a colleague by email and role" })
  invite(@VetActorParam() actor: VetActor, @Body() dto: InviteStaffDto, @Req() req: Request) {
    return this.staff.invite(actor, dto, meta(req));
  }

  @Post("invites/:inviteId/resend")
  @HttpCode(HttpStatus.OK)
  @VetCapability("staff.manage")
  @ApiOperation({ summary: "Re-issue an invitation (the previous token stops working)" })
  resendInvite(
    @VetActorParam() actor: VetActor,
    @Param("inviteId") inviteId: string,
    @Req() req: Request
  ) {
    return this.staff.resendInvite(actor, inviteId, meta(req));
  }

  @Post("invites/:inviteId/revoke")
  @HttpCode(HttpStatus.OK)
  @VetCapability("staff.manage")
  @ApiOperation({ summary: "Revoke an invitation" })
  revokeInvite(
    @VetActorParam() actor: VetActor,
    @Param("inviteId") inviteId: string,
    @Req() req: Request
  ) {
    return this.staff.revokeInvite(actor, inviteId, meta(req));
  }

  // ── Membership ────────────────────────────────────────────────────────────

  @Patch(":staffId/role")
  @VetCapability("staff.manage")
  @ApiOperation({ summary: "Change a colleague's role, branch scope or title" })
  changeRole(
    @VetActorParam() actor: VetActor,
    @Param("staffId") staffId: string,
    @Body() dto: ChangeStaffRoleDto,
    @Req() req: Request
  ) {
    return this.staff.changeRole(actor, staffId, dto, meta(req));
  }

  @Post(":staffId/suspend")
  @HttpCode(HttpStatus.OK)
  @VetCapability("staff.manage")
  @ApiOperation({ summary: "Suspend access (reversible; ends their counter sessions)" })
  suspend(
    @VetActorParam() actor: VetActor,
    @Param("staffId") staffId: string,
    @Body() dto: StaffReasonDto,
    @Req() req: Request
  ) {
    return this.staff.suspend(actor, staffId, dto, meta(req));
  }

  @Post(":staffId/reactivate")
  @HttpCode(HttpStatus.OK)
  @VetCapability("staff.manage")
  @ApiOperation({ summary: "Lift a suspension" })
  reactivate(
    @VetActorParam() actor: VetActor,
    @Param("staffId") staffId: string,
    @Req() req: Request
  ) {
    return this.staff.reactivate(actor, staffId, meta(req));
  }

  @Post(":staffId/offboard")
  @HttpCode(HttpStatus.OK)
  @VetCapability("staff.manage")
  @ApiOperation({
    summary: "Offboard — closes every door, keeps their name on the records they authored",
  })
  offboard(
    @VetActorParam() actor: VetActor,
    @Param("staffId") staffId: string,
    @Body() dto: StaffReasonDto,
    @Req() req: Request
  ) {
    return this.staff.offboard(actor, staffId, dto, meta(req));
  }

  @Post(":staffId/pin/reset")
  @HttpCode(HttpStatus.OK)
  @VetCapability("staff.manage")
  @ApiOperation({
    summary: "Clear a colleague's counter PIN (a manager can only remove one, never set one)",
  })
  resetPin(
    @VetActorParam() actor: VetActor,
    @Param("staffId") staffId: string,
    @Req() req: Request
  ) {
    return this.staff.resetPin(actor, staffId, meta(req));
  }
}
