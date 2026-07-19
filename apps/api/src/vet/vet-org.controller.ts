import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { VetOrgService } from "./vet-org.service";
import { Public } from "../common/decorators/public.decorator";
import { VetStaffGuard, VET_ORG_HEADER } from "./guards/vet-staff.guard";
import { VetCapability } from "./decorators/vet-capability.decorator";
import { VetActorParam, type VetActor } from "./decorators/vet-actor.decorator";
import {
  ApplyDto,
  CreateBranchDocumentDto,
  CreateBranchDto,
  DirectoryQueryDto,
  RegisterDeviceDto,
  UpdateBranchDto,
  UpdateOrgDto,
} from "./dto/vet-org.dto";

/** Applying is a once-in-a-lifetime act per clinic — 3 an hour is generous. */
const APPLY_THROTTLE = { default: { limit: 3, ttl: 3_600_000 } } as const;

function meta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

/**
 * The two outward-facing veterinary surfaces: a clinic asking to join, and a
 * member looking for one. Both public, both deliberately free of any staff data.
 */
@ApiTags("vet-public")
@Controller("vet")
export class VetPublicController {
  constructor(private readonly org: VetOrgService) {}

  @Public()
  @Throttle(APPLY_THROTTLE)
  @Post("apply")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Apply to join the Moracat veterinary network (public)" })
  apply(@Body() dto: ApplyDto, @Req() req: Request) {
    return this.org.apply(dto, meta(req));
  }

  @Public()
  @Get("directory")
  @ApiOperation({
    summary: "Public clinic directory — verified, live, published branches only",
  })
  directory(@Query() query: DirectoryQueryDto) {
    return this.org.directory(query);
  }
}

/**
 * Clinic settings, branches, documents and terminals — MRC-VET-001 §15/§16.
 * Every route resolves the caller's membership from `x-moracat-org`.
 */
@ApiTags("vet-org")
@ApiBearerAuth()
@ApiHeader({ name: VET_ORG_HEADER, description: "PartnerOrg id the caller is acting inside", required: true })
@UseGuards(VetStaffGuard)
@Controller("vet/org")
export class VetOrgController {
  constructor(private readonly org: VetOrgService) {}

  // ── Org profile ───────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: "The caller's clinic profile" })
  getOrg(@VetActorParam() actor: VetActor) {
    return this.org.getOrg(actor);
  }

  @Patch()
  @VetCapability("settings.manage")
  @ApiOperation({ summary: "Update clinic profile (names ar/en, VAT, logo)" })
  updateOrg(@VetActorParam() actor: VetActor, @Body() dto: UpdateOrgDto, @Req() req: Request) {
    return this.org.updateOrg(actor, dto, meta(req));
  }

  // ── Branches ──────────────────────────────────────────────────────────────

  @Get("branches")
  @ApiOperation({ summary: "Branches, narrowed to the caller's branch scope" })
  listBranches(@VetActorParam() actor: VetActor) {
    return this.org.listBranches(actor);
  }

  @Get("branches/:branchId")
  @ApiOperation({ summary: "One branch" })
  getBranch(@VetActorParam() actor: VetActor, @Param("branchId") branchId: string) {
    return this.org.getBranch(actor, branchId);
  }

  @Post("branches")
  @VetCapability("branch.manage")
  @ApiOperation({ summary: "Open a new branch" })
  createBranch(
    @VetActorParam() actor: VetActor,
    @Body() dto: CreateBranchDto,
    @Req() req: Request
  ) {
    return this.org.createBranch(actor, dto, meta(req));
  }

  @Patch("branches/:branchId")
  @VetCapability("branch.manage")
  @ApiOperation({ summary: "Update a branch (location, hours, services, directory visibility)" })
  updateBranch(
    @VetActorParam() actor: VetActor,
    @Param("branchId") branchId: string,
    @Body() dto: UpdateBranchDto,
    @Req() req: Request
  ) {
    return this.org.updateBranch(actor, branchId, dto, meta(req));
  }

  @Delete("branches/:branchId")
  @VetCapability("branch.manage")
  @ApiOperation({ summary: "Close a branch (deactivates — clinical history is never deleted)" })
  deactivateBranch(
    @VetActorParam() actor: VetActor,
    @Param("branchId") branchId: string,
    @Req() req: Request
  ) {
    return this.org.deactivateBranch(actor, branchId, meta(req));
  }

  // ── Branch documents ──────────────────────────────────────────────────────

  @Get("branches/:branchId/documents")
  @VetCapability("branch.manage")
  @ApiOperation({ summary: "Licence and registration documents for a branch" })
  listDocuments(@VetActorParam() actor: VetActor, @Param("branchId") branchId: string) {
    return this.org.listBranchDocuments(actor, branchId);
  }

  @Post("branches/:branchId/documents")
  @VetCapability("branch.manage")
  @ApiOperation({ summary: "Attach a licence / CR / VAT / insurance document" })
  addDocument(
    @VetActorParam() actor: VetActor,
    @Param("branchId") branchId: string,
    @Body() dto: CreateBranchDocumentDto,
    @Req() req: Request
  ) {
    return this.org.addBranchDocument(actor, branchId, dto, meta(req));
  }

  @Delete("branches/:branchId/documents/:documentId")
  @VetCapability("branch.manage")
  @ApiOperation({ summary: "Remove a branch document" })
  removeDocument(
    @VetActorParam() actor: VetActor,
    @Param("branchId") branchId: string,
    @Param("documentId") documentId: string,
    @Req() req: Request
  ) {
    return this.org.removeBranchDocument(actor, branchId, documentId, meta(req));
  }

  // ── Counter devices ───────────────────────────────────────────────────────

  @Get("devices")
  @VetCapability("device.manage")
  @ApiOperation({ summary: "Registered counter terminals" })
  listDevices(@VetActorParam() actor: VetActor) {
    return this.org.listDevices(actor);
  }

  @Post("branches/:branchId/devices")
  @VetCapability("device.manage")
  @ApiOperation({ summary: "Register a shared terminal for Counter Mode" })
  registerDevice(
    @VetActorParam() actor: VetActor,
    @Param("branchId") branchId: string,
    @Body() dto: RegisterDeviceDto,
    @Req() req: Request
  ) {
    return this.org.registerDevice(actor, branchId, dto, meta(req));
  }

  @Post("devices/:deviceId/revoke")
  @HttpCode(HttpStatus.OK)
  @VetCapability("device.manage")
  @ApiOperation({ summary: "Revoke a terminal and end every counter session on it" })
  revokeDevice(
    @VetActorParam() actor: VetActor,
    @Param("deviceId") deviceId: string,
    @Req() req: Request
  ) {
    return this.org.revokeDevice(actor, deviceId, meta(req));
  }
}
