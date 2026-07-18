import { Controller, Get, Header, HttpCode, HttpStatus, Param, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { Public } from "../common/decorators/public.decorator";
import { CommunityService } from "./community.service";
import { CommunityQueryDto } from "./dto/community-query.dto";

// The public feed is anonymous and identical for all visitors — let the CDN/edge
// serve it and revalidate in the background. Short TTL keeps it fresh while
// absorbing traffic spikes off the database (the hottest public read path).
const FEED_CACHE = "public, max-age=15, s-maxage=30, stale-while-revalidate=60";

/**
 * The view beacon is the one anonymous WRITE on this surface, so it gets a
 * tight per-IP budget well below the global 120/min default (the service also
 * dedupes per-IP-per-hour — this limit just blunts scripted floods).
 */
const VIEW_THROTTLE = { default: { limit: 20, ttl: 60_000 } } as const;

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

  @Post("cats/:slug/view")
  @Throttle(VIEW_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Count a profile visit (deduped per visitor; fired by a page beacon)" })
  async view(@Param("slug") slug: string, @Req() req: Request) {
    // Fire-and-forget semantics for the caller (sendBeacon ignores the body);
    // still awaited here so throttling + errors resolve before the 204.
    await this.community.recordView(slug, req.ip).catch(() => undefined);
  }
}
