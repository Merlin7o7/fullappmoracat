import {
  Body,
  Controller,
  Delete,
  Get,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from "@nestjs/swagger";
import { CatsService, type UploadedImage } from "./cats.service";
import { UpdateVisibilityDto } from "./dto/cat-visibility.dto";
import { TurnstileGuard } from "../security/turnstile.guard";

/** 8 MB hard cap at the multer layer (the service re-validates type + size). */
const IMAGE_UPLOAD = { limits: { fileSize: 8 * 1024 * 1024 } };

// Per-route registration rate limit, well below the 120/min global default.
// Env-overridable ONLY so the E2E suite (hundreds of requests from one IP) isn't
// fighting the limiter; a missing/typo'd value falls back to a safe 4/min, never
// to "unlimited".
const CREATE_LIMIT = Number(process.env.CENSUS_CREATE_THROTTLE) || 4;
import {
  CreateCatDto,
  ListCatsQueryDto,
  MarkDeceasedDto,
  UpdateCatDto,
} from "./dto/cat.dto";
import {
  CreateDocumentDto,
  CreateVaccinationDto,
  CreateVetVisitDto,
} from "./dto/cat-health.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RequireEmailVerified } from "../common/decorators/email-verified.decorator";

@ApiTags("cats")
@ApiBearerAuth()
// Creating and tending your OWN private cat must not wait on email deliverability
// — the Cat ID ceremony is first value and the <2-minute north star depends on
// reaching it without an inbox round-trip (fire #7). Email verification gates
// only the one action that publishes outward — making a cat public to the
// community (see `updateVisibility`) — where throwaway-account UGC is the real
// risk (R006). Everything else here is private to the member.
@Controller("cats")
export class CatsController {
  constructor(private readonly cats: CatsService) {}

  // Census integrity (R006/R040): the count is only honest if the input is hard
  // to poison. Three layers stack here — a tight per-route rate limit (4/min/IP,
  // far below the 120 global default), a proof-of-humanity challenge (no-op
  // until Turnstile is configured), and a per-account daily cap enforced inside
  // the service. A real multi-cat household clears all three; a script does not.
  @Post()
  @Throttle({ default: { limit: CREATE_LIMIT, ttl: 60_000 } })
  @UseGuards(TurnstileGuard)
  @ApiOperation({ summary: "Register a cat + issue its Cat ID (rate-limited, bot-protected)" })
  create(
    @CurrentUser("id") userId: string,
    @Body() dto: CreateCatDto,
    @Ip() ip: string,
    @Req() req: Request
  ) {
    return this.cats.create(userId, dto, {
      ip,
      userAgent: req.headers["user-agent"] ?? null,
    });
  }

  @Get()
  @ApiOperation({ summary: "List cats — supports search + status filter" })
  findAll(@CurrentUser("id") userId: string, @Query() query: ListCatsQueryDto) {
    return this.cats.findAll(userId, query);
  }

  @Get("meta/breeds")
  @ApiOperation({ summary: "List breeds for the registration wizard" })
  listBreeds() {
    return this.cats.listBreeds();
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one cat with full health record" })
  findOne(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.findOne(userId, id);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit cat information" })
  update(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateCatDto
  ) {
    return this.cats.update(userId, id, dto);
  }

  @Post(":id/primary")
  @ApiOperation({ summary: "Set this cat as the household's primary cat" })
  setPrimary(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.setPrimary(userId, id);
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Archive a cat (kept in history)" })
  archive(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.archive(userId, id);
  }

  @Post(":id/deceased")
  @ApiOperation({ summary: "Archive a deceased cat with dignity (record preserved)" })
  markDeceased(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: MarkDeceasedDto
  ) {
    return this.cats.markDeceased(userId, id, dto.deceasedAt);
  }

  @Post(":id/restore")
  @ApiOperation({ summary: "Restore an archived/deceased cat to active" })
  restore(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.restore(userId, id);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Remove a cat (soft delete)" })
  remove(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.remove(userId, id);
  }

  // ── Health record ────────────────────────────────────────────────────────
  @Get(":id/vaccinations")
  @ApiOperation({ summary: "List a cat's vaccination history" })
  listVaccinations(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.listVaccinations(userId, id);
  }

  @Post(":id/vaccinations")
  @ApiOperation({ summary: "Record a vaccination" })
  addVaccination(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: CreateVaccinationDto
  ) {
    return this.cats.addVaccination(userId, id, dto);
  }

  @Delete(":id/vaccinations/:vaxId")
  @ApiOperation({ summary: "Delete a vaccination record" })
  removeVaccination(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Param("vaxId") vaxId: string
  ) {
    return this.cats.removeVaccination(userId, id, vaxId);
  }

  @Get(":id/vet-visits")
  @ApiOperation({ summary: "List a cat's vet-visit history" })
  listVetVisits(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.listVetVisits(userId, id);
  }

  @Post(":id/vet-visits")
  @ApiOperation({ summary: "Record a vet visit" })
  addVetVisit(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: CreateVetVisitDto
  ) {
    return this.cats.addVetVisit(userId, id, dto);
  }

  @Get(":id/documents")
  @ApiOperation({ summary: "List a cat's documents" })
  listDocuments(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.listDocuments(userId, id);
  }

  @Post(":id/documents")
  @ApiOperation({ summary: "Attach a document to a cat" })
  addDocument(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: CreateDocumentDto
  ) {
    return this.cats.addDocument(userId, id, dto);
  }

  @Delete(":id/documents/:docId")
  @ApiOperation({ summary: "Delete a document" })
  removeDocument(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Param("docId") docId: string
  ) {
    return this.cats.removeDocument(userId, id, docId);
  }

  // ── Photos (multipart/form-data, field name "file") ────────────────────
  @Post(":id/photo")
  @UseInterceptors(FileInterceptor("file", IMAGE_UPLOAD))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload/replace a cat's profile photo" })
  uploadPhoto(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @UploadedFile() file: UploadedImage
  ) {
    return this.cats.setProfilePhoto(userId, id, file);
  }

  @Post(":id/cover")
  @UseInterceptors(FileInterceptor("file", IMAGE_UPLOAD))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Upload/replace a cat's cover image" })
  uploadCover(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @UploadedFile() file: UploadedImage
  ) {
    return this.cats.setCoverPhoto(userId, id, file);
  }

  @Get(":id/gallery")
  @ApiOperation({ summary: "List a cat's gallery photos" })
  listGallery(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.listGallery(userId, id);
  }

  @Post(":id/gallery")
  @UseInterceptors(FileInterceptor("file", IMAGE_UPLOAD))
  @ApiConsumes("multipart/form-data")
  @ApiOperation({ summary: "Add a gallery photo" })
  addGalleryPhoto(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @UploadedFile() file: UploadedImage
  ) {
    return this.cats.addGalleryPhoto(userId, id, file);
  }

  @Delete(":id/gallery/:photoId")
  @ApiOperation({ summary: "Remove a gallery photo" })
  removeGalleryPhoto(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Param("photoId") photoId: string
  ) {
    return this.cats.removeGalleryPhoto(userId, id, photoId);
  }

  // ── Community visibility & privacy ──────────────────────────────────────
  @Get(":id/visibility")
  @ApiOperation({ summary: "Get a cat's community visibility + privacy settings" })
  getVisibility(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.cats.getVisibility(userId, id);
  }

  @Patch(":id/visibility")
  // Publishing a cat outward to the community is the one action that needs a
  // verified email — no throwaway-account public UGC (R006). Private cat
  // management above is deliberately ungated so first value isn't held hostage.
  @RequireEmailVerified()
  @ApiOperation({ summary: "Update sharing + per-field privacy (opt-in)" })
  updateVisibility(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateVisibilityDto
  ) {
    return this.cats.updateVisibility(userId, id, dto);
  }
}
