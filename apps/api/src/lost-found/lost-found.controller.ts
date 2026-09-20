import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { LostFoundService } from "./lost-found.service";
import {
  CreateLostFoundDto,
  LostFoundMessageDto,
  LostFoundQueryDto,
  SetLostFoundStatusDto,
  UpdateLostFoundDto,
} from "./dto/lost-found.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { OptionalAuth } from "../common/decorators/optional-auth.decorator";

const BOARD_CACHE = "public, max-age=15, s-maxage=30, stale-while-revalidate=60";
const VIEW_THROTTLE = { default: { limit: 20, ttl: 60_000 } } as const;
/**
 * The relay is open to signed-out visitors, so it carries the tightest budget
 * on this surface — generous enough for a real neighbour, useless for a script.
 */
const RELAY_THROTTLE = { default: { limit: 5, ttl: 3_600_000 } } as const;

/**
 * Lost & Found. Browsing and writing to a reporter are deliberately public:
 * the person holding a found cat is usually not a member, and making them sign
 * up first would cost cats their way home. Filing and tending a notice is
 * authenticated, so every notice has someone accountable behind it.
 */
@ApiTags("lost-found")
@Controller("lost-found")
export class LostFoundController {
  constructor(private readonly lostFound: LostFoundService) {}

  /* ── The board ────────────────────────────────────────────────────────*/

  @Get("posts")
  @Public()
  @Header("Cache-Control", BOARD_CACHE)
  @ApiOperation({ summary: "Browse lost and found cats" })
  list(@Query() query: LostFoundQueryDto) {
    return this.lostFound.list(query);
  }

  @Get("facets")
  @Public()
  @Header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600")
  @ApiOperation({ summary: "Live counts and the cities with notices" })
  facets() {
    return this.lostFound.facets();
  }

  /* ── Mine (declared before :id so it is never read as one) ────────────*/

  @Get("mine")
  @ApiBearerAuth()
  @ApiOperation({ summary: "My notices" })
  mine(@CurrentUser("id") userId: string) {
    return this.lostFound.mine(userId);
  }

  @Get("posts/:id")
  @OptionalAuth()
  @ApiOperation({ summary: "One notice — the reporter stays private unless they chose otherwise" })
  detail(@Param("id") id: string, @CurrentUser("id") viewerId?: string) {
    return this.lostFound.detail(id, viewerId ?? null);
  }

  @Post("posts/:id/view")
  @Public()
  @Throttle(VIEW_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Count a visit (deduped per visitor)" })
  async view(@Param("id") id: string, @Req() req: Request) {
    await this.lostFound.recordView(id, req.ip).catch(() => undefined);
  }

  /* ── Filing and tending ───────────────────────────────────────────────*/

  @Post("posts")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Report a cat lost, or report one you found" })
  create(@CurrentUser("id") userId: string, @Body() dto: CreateLostFoundDto) {
    return this.lostFound.create(userId, dto);
  }

  @Patch("posts/:id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update my notice" })
  update(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() dto: UpdateLostFoundDto) {
    return this.lostFound.update(userId, id, dto);
  }

  @Post("posts/:id/status")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Mark reunited, close, or re-open" })
  setStatus(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: SetLostFoundStatusDto
  ) {
    return this.lostFound.setStatus(userId, id, dto);
  }

  @Get("posts/:id/messages")
  @ApiBearerAuth()
  @ApiOperation({ summary: "The messages people have sent about this cat" })
  messages(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.lostFound.messages(userId, id);
  }

  /* ── The relay ────────────────────────────────────────────────────────*/

  @Post("posts/:id/messages")
  @OptionalAuth()
  @Throttle(RELAY_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "I think I've seen this cat — reaches the reporter, reveals nothing" })
  sendMessage(
    @Param("id") id: string,
    @Body() dto: LostFoundMessageDto,
    @Req() req: Request,
    @CurrentUser("id") userId?: string
  ) {
    return this.lostFound.sendMessage(id, dto, { userId: userId ?? null, ip: req.ip });
  }
}
