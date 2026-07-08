import { Body, Controller, Get, Param, Patch } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";
import { Type } from "class-transformer";
import { PrismaService } from "../prisma/prisma.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

class UpdateFlagDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) rollout?: number;
}

/**
 * Runtime feature-flag control — a kill-switch surface for ops. The FeatureFlag
 * rows were seeded but had no API, so toggling anything meant a redeploy/re-seed.
 * Every change is audited. NOTE: `COMMERCE_ENABLED` remains an ENV switch by
 * design (it must fail closed at boot), so it is intentionally not togglable here.
 */
@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin/feature-flags")
export class FeatureFlagsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions("settings.read")
  @ApiOperation({ summary: "List runtime feature flags" })
  list() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: "asc" } });
  }

  @Patch(":key")
  @RequirePermissions("settings.write")
  @ApiOperation({ summary: "Toggle / adjust a feature flag" })
  async update(@CurrentUser("id") actorId: string, @Param("key") key: string, @Body() dto: UpdateFlagDto) {
    const flag = await this.prisma.featureFlag.update({
      where: { key },
      data: { enabled: dto.enabled, rollout: dto.rollout },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: "settings.feature_flag.update",
        entityType: "FeatureFlag",
        entityId: flag.id,
        metadata: { key, enabled: flag.enabled, rollout: flag.rollout },
      },
    });
    return flag;
  }
}
