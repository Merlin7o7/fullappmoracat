import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { CommunityService } from "./community.service";
import { CommunityQueryDto } from "./dto/community-query.dto";

@ApiTags("community")
@Public() // The community is public by design — only opted-in cats appear.
@Controller("community")
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get("cats")
  @ApiOperation({ summary: "Browse public cats (filters: breed, city, gender, stage, sort, search)" })
  list(@Query() query: CommunityQueryDto) {
    return this.community.list(query);
  }

  @Get("facets")
  @ApiOperation({ summary: "Available filter options (breeds + cities with public cats)" })
  facets() {
    return this.community.facets();
  }

  @Get("cats/:slug")
  @ApiOperation({ summary: "A public cat profile (only owner-approved fields)" })
  detail(@Param("slug") slug: string) {
    return this.community.detail(slug);
  }
}
