import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { CommunityService } from "./community.service";
import { CommunityQueryDto } from "./dto/community-query.dto";

// The public feed is anonymous and identical for all visitors — let the CDN/edge
// serve it and revalidate in the background. Short TTL keeps it fresh while
// absorbing traffic spikes off the database (the hottest public read path).
const FEED_CACHE = "public, max-age=15, s-maxage=30, stale-while-revalidate=60";

@ApiTags("community")
@Public() // The community is public by design — only opted-in cats appear.
@Controller("community")
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get("cats")
  @Header("Cache-Control", FEED_CACHE)
  @ApiOperation({ summary: "Browse public cats (filters: breed, city, gender, stage, sort, search)" })
  list(@Query() query: CommunityQueryDto) {
    return this.community.list(query);
  }

  @Get("facets")
  @Header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600")
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
