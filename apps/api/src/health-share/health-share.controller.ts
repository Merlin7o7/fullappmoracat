import { Body, Controller, Delete, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiPropertyOptional, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { IsBoolean, IsIn, IsOptional } from "class-validator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { HealthShareService } from "./health-share.service";

class CreateShareLinkDto {
  @ApiPropertyOptional({ enum: [1, 7, 30, 90], default: 7 })
  @IsOptional()
  @IsIn([1, 7, 30, 90])
  days?: number;

  @ApiPropertyOptional({ description: "Show the owner's phone on the summary" })
  @IsOptional()
  @IsBoolean()
  includeContact?: boolean;
}

@ApiTags("health-share")
@Controller()
export class HealthShareController {
  constructor(private readonly share: HealthShareService) {}

  @ApiBearerAuth()
  @Post("cats/:id/share-links")
  @ApiOperation({ summary: "Create an expiring vet health-summary link (URL returned once)" })
  create(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() dto: CreateShareLinkDto) {
    return this.share.create(userId, id, dto);
  }

  @ApiBearerAuth()
  @Get("cats/:id/share-links")
  @ApiOperation({ summary: "The owner's summary links — views, expiry, state (no tokens)" })
  list(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.share.list(userId, id);
  }

  @ApiBearerAuth()
  @Delete("cats/:id/share-links/:linkId")
  @ApiOperation({ summary: "Revoke a summary link now" })
  revoke(@CurrentUser("id") userId: string, @Param("id") id: string, @Param("linkId") linkId: string) {
    return this.share.revoke(userId, id, linkId);
  }

  @Public()
  @Get("public/health/:token")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "The health summary a vet opens from the owner's link" })
  view(@Param("token") token: string) {
    return this.share.view(token);
  }
}
