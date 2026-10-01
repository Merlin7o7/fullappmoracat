import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TimelineService } from "./timeline.service";

class CreateMomentDto {
  @ApiProperty({ example: "First day home" })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(600)
  note?: string;

  @ApiPropertyOptional({ description: "A photo URL from POST /uploads/image" })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  photoUrl?: string;

  @ApiPropertyOptional({ example: "2026-03-14" })
  @IsOptional()
  @IsDateString()
  happenedAt?: string;
}

/** The cat's life album (W9) and the yearly keepsake (W10). */
@ApiTags("timeline")
@ApiBearerAuth()
@Controller("cats/:id")
export class TimelineController {
  constructor(private readonly timeline: TimelineService) {}

  @Get("timeline")
  @ApiOperation({ summary: "The cat's life, newest first: record events + owner moments" })
  list(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.timeline.timeline(userId, id);
  }

  @Post("moments")
  @ApiOperation({ summary: "Add a moment to the cat's album" })
  add(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() dto: CreateMomentDto) {
    return this.timeline.addMoment(userId, id, dto);
  }

  @Delete("moments/:momentId")
  @ApiOperation({ summary: "Remove a moment the owner added" })
  remove(@CurrentUser("id") userId: string, @Param("id") id: string, @Param("momentId") momentId: string) {
    return this.timeline.deleteMoment(userId, id, momentId);
  }

  @Get("year/:year")
  @ApiOperation({ summary: "The yearly keepsake: one year of the cat's life" })
  year(@CurrentUser("id") userId: string, @Param("id") id: string, @Param("year", ParseIntPipe) year: number) {
    return this.timeline.year(userId, id, year);
  }
}
