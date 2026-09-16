import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiConsumes, ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { CLINIC_DOCUMENT_MAX_BYTES } from "@moraqat/core";
import { Public } from "../common/decorators/public.decorator";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { VetStaffGuard, VET_ORG_HEADER } from "./guards/vet-staff.guard";
import { VetCapability } from "./decorators/vet-capability.decorator";
import { VetActorParam, type VetActor } from "./decorators/vet-actor.decorator";
import { VetRegistrationService, type UploadedDocumentFile } from "./vet-registration.service";
import {
  AdminOrgListQueryDto,
  InviteClinicDto,
  RegistrationAccountDto,
  RegistrationBranchesDto,
  RegistrationClinicDto,
  RegistrationDocumentDto,
  RegistrationSubmitDto,
  RegistrationTeamDto,
  RegistrationTokenDto,
  RejectRegistrationDto,
  RequestChangesDto,
  ReviewNoteDto,
} from "./dto/vet-registration.dto";

function meta(req: Request) {
  return { ipAddress: req.ip, userAgent: req.headers["user-agent"] };
}

/** A private document, served inline and never cached. */
function documentResponse(doc: { buffer: Buffer; mimeType: string; fileName: string }) {
  return new StreamableFile(doc.buffer, {
    type: doc.mimeType,
    disposition: `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
    length: doc.buffer.length,
  });
}

const TOKEN_THROTTLE = { default: { limit: 20, ttl: 60_000 } } as const;
const UPLOAD_THROTTLE = { default: { limit: 30, ttl: 60_000 } } as const;

/**
 * Moracat-side clinic registration — MRC-VET-002 phases 1 and 3. Guarded by
 * staff RBAC (`partners.read` / `partners.write`), like the rest of vet/admin.
 */
@ApiTags("vet-admin")
@ApiBearerAuth()
@Controller("vet/admin/clinics")
export class VetRegistrationAdminController {
  constructor(private readonly registration: VetRegistrationService) {}

  @Get()
  @RequirePermissions("partners.read")
  @ApiOperation({ summary: "Every clinic across the pipeline, with status counts" })
  list(@Query() query: AdminOrgListQueryDto) {
    return this.registration.adminList(query);
  }

  @Post("invite")
  @RequirePermissions("partners.write")
  @ApiOperation({ summary: "Invite a clinic owner to register (the only way in)" })
  invite(@CurrentUser("id") actorId: string, @Body() dto: InviteClinicDto, @Req() req: Request) {
    return this.registration.inviteClinic(actorId, dto, meta(req));
  }

  @Get(":orgId")
  @RequirePermissions("partners.read")
  @ApiOperation({ summary: "The full registration, documents, team, agreement and checklist" })
  detail(@Param("orgId") orgId: string) {
    return this.registration.adminDetail(orgId);
  }

  @Post(":orgId/invite/resend")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  resend(@CurrentUser("id") actorId: string, @Param("orgId") orgId: string, @Req() req: Request) {
    return this.registration.resendRegistrationInvite(actorId, orgId, meta(req));
  }

  @Post(":orgId/invite/revoke")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  revoke(@CurrentUser("id") actorId: string, @Param("orgId") orgId: string, @Req() req: Request) {
    return this.registration.revokeRegistrationInvite(actorId, orgId, meta(req));
  }

  @Get(":orgId/documents/:documentId/file")
  @RequirePermissions("partners.read")
  @ApiOperation({ summary: "Read a private registration document" })
  async documentFile(@Param("orgId") orgId: string, @Param("documentId") documentId: string) {
    return documentResponse(await this.registration.adminDocumentFile(orgId, documentId));
  }

  @Post(":orgId/documents/:documentId/verify")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  verifyDocument(
    @CurrentUser("id") actorId: string,
    @Param("orgId") orgId: string,
    @Param("documentId") documentId: string,
    @Req() req: Request
  ) {
    return this.registration.setDocumentVerified(actorId, orgId, documentId, true, meta(req));
  }

  @Post(":orgId/documents/:documentId/unverify")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  unverifyDocument(
    @CurrentUser("id") actorId: string,
    @Param("orgId") orgId: string,
    @Param("documentId") documentId: string,
    @Req() req: Request
  ) {
    return this.registration.setDocumentVerified(actorId, orgId, documentId, false, meta(req));
  }

  @Post(":orgId/request-changes")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  requestChanges(
    @CurrentUser("id") actorId: string,
    @Param("orgId") orgId: string,
    @Body() dto: RequestChangesDto,
    @Req() req: Request
  ) {
    return this.registration.requestChanges(actorId, orgId, dto, meta(req));
  }

  @Post(":orgId/approve")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  approve(
    @CurrentUser("id") actorId: string,
    @Param("orgId") orgId: string,
    @Body() dto: ReviewNoteDto,
    @Req() req: Request
  ) {
    return this.registration.approve(actorId, orgId, dto, meta(req));
  }

  @Post(":orgId/reject")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("partners.write")
  reject(
    @CurrentUser("id") actorId: string,
    @Param("orgId") orgId: string,
    @Body() dto: RejectRegistrationDto,
    @Req() req: Request
  ) {
    return this.registration.reject(actorId, orgId, dto, meta(req));
  }
}

/**
 * The clinic owner's side — MRC-VET-002 phase 2. The invitation link is public
 * (preview + account creation); every wizard write needs the owner's session.
 */
@ApiTags("vet-registration")
@Controller("vet/registration")
export class VetRegistrationController {
  constructor(private readonly registration: VetRegistrationService) {}

  @Public()
  @Throttle(TOKEN_THROTTLE)
  @Post("invite/preview")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "What this registration link is for (public)" })
  preview(@Body() dto: RegistrationTokenDto) {
    return this.registration.previewInvite(dto.token);
  }

  @Public()
  @Throttle(TOKEN_THROTTLE)
  @Post("invite/account")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Create the owner account from the link and claim the clinic (returns a session)" })
  createAccount(@Body() dto: RegistrationAccountDto, @Req() req: Request) {
    return this.registration.createOwnerAccount(dto, meta(req));
  }

  @Throttle(TOKEN_THROTTLE)
  @Post("invite/claim")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Signed in with the invited email: claim the clinic" })
  claim(@CurrentUser() user: AuthUser, @Body() dto: RegistrationTokenDto, @Req() req: Request) {
    return this.registration.claim(user.id, user.email, dto.token, meta(req));
  }

  @Get()
  @ApiBearerAuth()
  @ApiOperation({ summary: "Registrations this person owns that aren't live yet" })
  mine(@CurrentUser("id") userId: string) {
    return this.registration.listMine(userId);
  }

  @Get(":orgId")
  @ApiBearerAuth()
  state(@CurrentUser("id") userId: string, @Param("orgId") orgId: string) {
    return this.registration.getState(userId, orgId);
  }

  @Put(":orgId/clinic")
  @ApiBearerAuth()
  clinic(
    @CurrentUser("id") userId: string,
    @Param("orgId") orgId: string,
    @Body() dto: RegistrationClinicDto,
    @Req() req: Request
  ) {
    return this.registration.updateClinic(userId, orgId, dto, meta(req));
  }

  @Put(":orgId/branches")
  @ApiBearerAuth()
  branches(
    @CurrentUser("id") userId: string,
    @Param("orgId") orgId: string,
    @Body() dto: RegistrationBranchesDto,
    @Req() req: Request
  ) {
    return this.registration.updateBranches(userId, orgId, dto, meta(req));
  }

  @Post(":orgId/documents")
  @ApiBearerAuth()
  @Throttle(UPLOAD_THROTTLE)
  @ApiConsumes("multipart/form-data")
  // Allow a little headroom so the service, not multer, answers "too large"
  // with a bilingual error code.
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: CLINIC_DOCUMENT_MAX_BYTES + 1024 } }))
  upload(
    @CurrentUser("id") userId: string,
    @Param("orgId") orgId: string,
    @Body() dto: RegistrationDocumentDto,
    @UploadedFile() file: UploadedDocumentFile | undefined,
    @Req() req: Request
  ) {
    return this.registration.uploadDocument(userId, orgId, dto, file, meta(req));
  }

  @Delete(":orgId/documents/:documentId")
  @ApiBearerAuth()
  deleteDocument(
    @CurrentUser("id") userId: string,
    @Param("orgId") orgId: string,
    @Param("documentId") documentId: string,
    @Req() req: Request
  ) {
    return this.registration.deleteDocument(userId, orgId, documentId, meta(req));
  }

  @Get(":orgId/documents/:documentId/file")
  @ApiBearerAuth()
  async documentFile(
    @CurrentUser("id") userId: string,
    @Param("orgId") orgId: string,
    @Param("documentId") documentId: string
  ) {
    return documentResponse(await this.registration.ownerDocumentFile(userId, orgId, documentId));
  }

  @Put(":orgId/team")
  @ApiBearerAuth()
  team(
    @CurrentUser("id") userId: string,
    @Param("orgId") orgId: string,
    @Body() dto: RegistrationTeamDto,
    @Req() req: Request
  ) {
    return this.registration.updateTeam(userId, orgId, dto, meta(req));
  }

  @Post(":orgId/submit")
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  submit(
    @CurrentUser("id") userId: string,
    @Param("orgId") orgId: string,
    @Body() dto: RegistrationSubmitDto,
    @Req() req: Request
  ) {
    return this.registration.submit(userId, orgId, dto, meta(req));
  }
}

/**
 * The go-live checklist, inside the clinic portal — MRC-VET-002 phase 5.
 * Reachable in the setup sandbox (APPROVED) as well as LIVE.
 */
@ApiTags("vet-org")
@ApiBearerAuth()
@ApiHeader({ name: VET_ORG_HEADER, description: "PartnerOrg id the caller is acting inside", required: true })
@UseGuards(VetStaffGuard)
@Controller("vet/org/onboarding")
export class VetOnboardingController {
  constructor(private readonly registration: VetRegistrationService) {}

  @Get()
  @ApiOperation({ summary: "Go-live checklist: branches, counter device, PINs, test scan" })
  get(@VetActorParam() actor: VetActor) {
    return this.registration.onboarding(actor.orgId);
  }

  @Post("confirm-branches")
  @HttpCode(HttpStatus.OK)
  @VetCapability("branch.manage")
  confirmBranches(@VetActorParam() actor: VetActor, @Req() req: Request) {
    return this.registration.confirmBranches(actor.orgId, actor.userId, meta(req));
  }

  @Post("request-go-live")
  @HttpCode(HttpStatus.OK)
  @VetCapability("settings.manage")
  requestGoLive(@VetActorParam() actor: VetActor, @Req() req: Request) {
    return this.registration.requestGoLive(actor.orgId, actor.userId, meta(req));
  }
}
