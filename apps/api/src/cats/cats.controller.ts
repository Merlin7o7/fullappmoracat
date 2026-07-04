import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CatsService } from "./cats.service";
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

@ApiTags("cats")
@ApiBearerAuth()
@Controller("cats")
export class CatsController {
  constructor(private readonly cats: CatsService) {}

  @Post()
  @ApiOperation({ summary: "Add a cat to the current user (unlimited)" })
  create(@CurrentUser("id") userId: string, @Body() dto: CreateCatDto) {
    return this.cats.create(userId, dto);
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
}
