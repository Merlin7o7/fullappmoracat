import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import { AdminListingsService } from "./admin-listings.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

class HideDto {
  @IsOptional() @IsString() @MaxLength(280) reason?: string;
}

class ListQueryDto {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsIn(["live", "hidden", "settled"]) filter?: "live" | "hidden" | "settled";
}

/**
 * Staff moderation for the adoption board and Lost & Found.
 *
 * Same permissions as the community moderation console (`cms.read` /
 * `cms.write`), because it is the same job: keeping a public, member-authored
 * surface honest. See AdminListingsService for why hiding without telling the
 * owner is not an option here.
 */
@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin")
export class AdminListingsController {
  constructor(private readonly listings: AdminListingsService) {}

  /* ── Adoption ─────────────────────────────────────────────────────────*/

  @Get("adoption/listings")
  @RequirePermissions("cms.read")
  @ApiOperation({ summary: "Adoption listings, for moderation" })
  listAdoption(@Query() q: ListQueryDto) {
    return this.listings.listAdoption(q.page ? Number(q.page) : 1, q.filter);
  }

  @Patch("adoption/listings/:id/hide")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Take an adoption listing down (the owner is told why)" })
  hideAdoption(@CurrentUser("id") actorId: string, @Param("id") id: string, @Body() dto: HideDto) {
    return this.listings.hideAdoption(actorId, id, dto.reason);
  }

  @Patch("adoption/listings/:id/unhide")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Restore a hidden adoption listing" })
  unhideAdoption(@CurrentUser("id") actorId: string, @Param("id") id: string) {
    return this.listings.unhideAdoption(actorId, id);
  }

  /* ── Lost & Found ─────────────────────────────────────────────────────*/

  @Get("lost-found/posts")
  @RequirePermissions("cms.read")
  @ApiOperation({ summary: "Lost & Found notices, for moderation" })
  listLostFound(@Query() q: ListQueryDto) {
    return this.listings.listLostFound(q.page ? Number(q.page) : 1, q.filter);
  }

  @Patch("lost-found/posts/:id/hide")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Take a Lost & Found notice down (the reporter is told why)" })
  hideLostFound(@CurrentUser("id") actorId: string, @Param("id") id: string, @Body() dto: HideDto) {
    return this.listings.hideLostFound(actorId, id, dto.reason);
  }

  @Patch("lost-found/posts/:id/unhide")
  @RequirePermissions("cms.write")
  @ApiOperation({ summary: "Restore a hidden Lost & Found notice" })
  unhideLostFound(@CurrentUser("id") actorId: string, @Param("id") id: string) {
    return this.listings.unhideLostFound(actorId, id);
  }
}
