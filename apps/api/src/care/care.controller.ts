import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CareService } from "./care.service";
import { CareStatusDto, CreateCareTaskDto, UpdateWeightDto, WeightDto } from "./care.dto";

/** The care engine (W9) — the agenda, per-cat care, and the owner's weight log. */
@ApiTags("care")
@ApiBearerAuth()
@Controller()
export class CareController {
  constructor(private readonly care: CareService) {}

  @Get("care")
  @ApiOperation({ summary: "Open care tasks across the member's cats (the «العناية» agenda)" })
  agenda(@CurrentUser("id") userId: string) {
    return this.care.agenda(userId);
  }

  @Get("cats/:id/care")
  @ApiOperation({ summary: "One cat's care schedule (synced on read)" })
  list(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.care.listForCat(userId, id);
  }

  @Post("cats/:id/care")
  @ApiOperation({ summary: "Add the owner's own care task (deworming, a dental check…)" })
  create(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() dto: CreateCareTaskDto) {
    return this.care.createOwnerTask(userId, id, dto);
  }

  @Post("care/:taskId/status")
  @ApiOperation({ summary: "Mark a care task done, skipped, or open again" })
  status(@CurrentUser("id") userId: string, @Param("taskId") taskId: string, @Body() dto: CareStatusDto) {
    return this.care.setStatus(userId, taskId, dto.status);
  }

  @Delete("care/:taskId")
  @ApiOperation({ summary: "Remove a task the owner added" })
  remove(@CurrentUser("id") userId: string, @Param("taskId") taskId: string) {
    return this.care.deleteOwnerTask(userId, taskId);
  }

  @Get("cats/:id/weights")
  @ApiOperation({ summary: "The cat's weight log (clinic + owner entries)" })
  weights(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.care.listWeights(userId, id);
  }

  @Post("cats/:id/weights")
  @ApiOperation({ summary: "Log a weight (closes the open weigh-in)" })
  addWeight(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() dto: WeightDto) {
    return this.care.addWeight(userId, id, dto);
  }

  @Patch("cats/:id/weights/:weightId")
  @ApiOperation({ summary: "Correct an owner weight entry" })
  updateWeight(@CurrentUser("id") userId: string, @Param("id") id: string, @Param("weightId") weightId: string, @Body() dto: UpdateWeightDto) {
    return this.care.updateWeight(userId, id, weightId, dto);
  }

  @Delete("cats/:id/weights/:weightId")
  @ApiOperation({ summary: "Remove an owner weight entry (clinic weights are immutable)" })
  deleteWeight(@CurrentUser("id") userId: string, @Param("id") id: string, @Param("weightId") weightId: string) {
    return this.care.deleteWeight(userId, id, weightId);
  }
}
