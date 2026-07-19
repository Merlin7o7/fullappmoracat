import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { VetAdminService } from "./vet-admin.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import {
  AccessLogQueryDto,
  ApplicationListQueryDto,
  ApproveApplicationDto,
  OrgListQueryDto,
  RejectApplicationDto,
  ReviewApplicationDto,
  SuspendOrgDto,
} from "./dto/vet-admin.dto";

function meta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

/**
 * Moracat-side administration of the partner network — MRC-VET-001 §01.
 *
 * Guarded by the existing staff RBAC (`partners.read` / `partners.write`), not
 * by the clinic capability matrix: this is Moracat looking at clinics, not a
 * clinic looking at itself. Every mutation writes an AuditLog row.
 */
@ApiTags("vet-admin")
@ApiBearerAuth()
@Controller("vet/admin")
export class VetAdminController {
  constructor(private readonly admin: VetAdminService) {}

  // ── Applications ──────────────────────────────────────────────────────────

  @Get("applications")
  @RequirePermissions("partners.read")
  @ApiOperation({ summary: "Review queue — clinic applications with filters and counts" })
  listApplications(@Query() query: ApplicationListQueryDto) {
    return this.admin.listApplications(query);
  }

  @Get("applications/:id")
  @RequirePermissions("partners.read")
  @ApiOperation({ summary: "One application, plus whether the contact already has an account" })
  getApplication(@Param("id") id: string) {
    return this.admin.getApplication(id);
  }

  @Post("applications/:id/review")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  @ApiOperation({ summary: "Claim an application for review" })
  review(
    @CurrentUser("id") actorId: string,
    @Param("id") id: string,
    @Body() dto: ReviewApplicationDto,
    @Req() req: Request
  ) {
    return this.admin.markInReview(actorId, id, dto, meta(req));
  }

  @Post("applications/:id/approve")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  @ApiOperation({
    summary:
      "Approve — creates the org, its first branch and the contact's OWNER seat, then emails an invitation",
  })
  approve(
    @CurrentUser("id") actorId: string,
    @Param("id") id: string,
    @Body() dto: ApproveApplicationDto,
    @Req() req: Request
  ) {
    return this.admin.approve(actorId, id, dto, meta(req));
  }

  @Post("applications/:id/reject")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  @ApiOperation({ summary: "Reject an application with a reason" })
  reject(
    @CurrentUser("id") actorId: string,
    @Param("id") id: string,
    @Body() dto: RejectApplicationDto,
    @Req() req: Request
  ) {
    return this.admin.reject(actorId, id, dto, meta(req));
  }

  // ── Orgs ──────────────────────────────────────────────────────────────────

  @Get("orgs")
  @RequirePermissions("partners.read")
  @ApiOperation({ summary: "Partner organisations with status / verification filters" })
  listOrgs(@Query() query: OrgListQueryDto) {
    return this.admin.listOrgs(query);
  }

  @Get("orgs/:id")
  @RequirePermissions("partners.read")
  @ApiOperation({ summary: "One org with its branches, documents and staff" })
  getOrg(@Param("id") id: string) {
    return this.admin.getOrg(id);
  }

  @Post("orgs/:id/verify")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  @ApiOperation({ summary: "Mark documents checked — unlocks the directory badge" })
  verify(@CurrentUser("id") actorId: string, @Param("id") id: string, @Req() req: Request) {
    return this.admin.verifyOrg(actorId, id, meta(req));
  }

  @Post("orgs/:id/unverify")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  @ApiOperation({ summary: "Withdraw verification and pull every branch from the directory" })
  unverify(@CurrentUser("id") actorId: string, @Param("id") id: string, @Req() req: Request) {
    return this.admin.unverifyOrg(actorId, id, meta(req));
  }

  @Post("orgs/:id/go-live")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  @ApiOperation({ summary: "Switch an approved clinic to LIVE" })
  goLive(@CurrentUser("id") actorId: string, @Param("id") id: string, @Req() req: Request) {
    return this.admin.goLive(actorId, id, meta(req));
  }

  @Post("orgs/:id/suspend")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  @ApiOperation({
    summary: "Suspend a clinic — leaves the directory and every counter session ends",
  })
  suspend(
    @CurrentUser("id") actorId: string,
    @Param("id") id: string,
    @Body() dto: SuspendOrgDto,
    @Req() req: Request
  ) {
    return this.admin.suspendOrg(actorId, id, dto, meta(req));
  }

  @Post("orgs/:id/unsuspend")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  @ApiOperation({ summary: "Lift a suspension (returns to APPROVED — going live is a second act)" })
  unsuspend(@CurrentUser("id") actorId: string, @Param("id") id: string, @Req() req: Request) {
    return this.admin.unsuspendOrg(actorId, id, meta(req));
  }

  @Get("orgs/:id/access-logs")
  @RequirePermissions("partners.read")
  @ApiOperation({
    summary: "The org's record-access ledger — who read which cat's record, and when",
  })
  accessLogs(@Param("id") id: string, @Query() query: AccessLogQueryDto) {
    return this.admin.orgAccessLogs(id, query);
  }
}
