import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { AdminCommunityService } from "./admin-community.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

class HideDto {
  @IsOptional() @IsString() @MaxLength(280) reason?: string;
}
class FeatureDto {
  @IsBoolean() featured!: boolean;
}

@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin")
export class AdminCommunityController {
  constructor(private readonly community: AdminCommunityService) {}

  @Get("community/cats")
  @RequirePermissions("cms.read")
  @ApiOperation({ summary: "List shared community cats for moderation" })
  listCats(@Query("page") page?: string, @Query("filter") filter?: "public" | "hidden" | "featured") {
    return this.community.listCats(page ? Number(page) : 1, filter);
  }

  @Patch("community/cats/:id/hide")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Hide a community cat (moderation)" })
  hide(@CurrentUser("id") actorId: string, @Param("id") id: string, @Body() dto: HideDto) {
    return this.community.hide(actorId, id, dto.reason);
  }

  @Patch("community/cats/:id/unhide")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Restore a hidden community cat" })
  unhide(@CurrentUser("id") actorId: string, @Param("id") id: string) {
    return this.community.unhide(actorId, id);
  }

  @Patch("community/cats/:id/feature")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Feature / unfeature a community cat" })
  feature(@CurrentUser("id") actorId: string, @Param("id") id: string, @Body() dto: FeatureDto) {
    return this.community.setFeatured(actorId, id, dto.featured);
  }

  @Get("waitlist")
  @RequirePermissions("customers.read")
  @ApiOperation({ summary: "List membership-waitlist entries" })
  waitlist(@Query("page") page?: string) {
    return this.community.listWaitlist(page ? Number(page) : 1);
  }
}
