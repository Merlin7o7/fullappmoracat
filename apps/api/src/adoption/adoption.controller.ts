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
import { AdoptionService } from "./adoption.service";
import {
  AdoptionQueryDto,
  CreateAdoptionRequestDto,
  CreateListingDto,
  DecideAdoptionRequestDto,
  HandoverDto,
  UpdateListingDto,
} from "./dto/adoption.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { OptionalAuth } from "../common/decorators/optional-auth.decorator";
import { RequireEmailVerified } from "../common/decorators/email-verified.decorator";

/** The board is anonymous and identical for everyone — let the edge serve it. */
const BOARD_CACHE = "public, max-age=15, s-maxage=30, stale-while-revalidate=60";
const VIEW_THROTTLE = { default: { limit: 20, ttl: 60_000 } } as const;
/** Enquiries reach a real person's inbox, so they get a tighter budget. */
const ENQUIRY_THROTTLE = { default: { limit: 8, ttl: 3_600_000 } } as const;

/**
 * Adoption. The browse surface is public (the cats are the point); everything
 * that writes is authenticated, and everything that reaches another member's
 * inbox additionally requires a verified email — the same bar the community's
 * interactions use, for the same reason.
 */
@ApiTags("adoption")
@Controller("adoption")
export class AdoptionController {
  constructor(private readonly adoption: AdoptionService) {}

  /* ── Public board ─────────────────────────────────────────────────────*/

  @Get("listings")
  @Public()
  @Header("Cache-Control", BOARD_CACHE)
  @ApiOperation({ summary: "Browse cats waiting for a home" })
  list(@Query() query: AdoptionQueryDto) {
    return this.adoption.list(query);
  }

  @Get("facets")
  @Public()
  @Header("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600")
  @ApiOperation({ summary: "Cities that actually have a cat waiting" })
  facets() {
    return this.adoption.facets();
  }

  /* ── The member's own adoption page ───────────────────────────────────*/
  // Declared before `listings/:id` so "mine" is never parsed as an id.

  @Get("mine")
  @ApiBearerAuth()
  @ApiOperation({ summary: "My listings and my enquiries" })
  mine(@CurrentUser("id") userId: string) {
    return this.adoption.mine(userId);
  }

  @Get("listings/:id")
  @OptionalAuth()
  @ApiOperation({ summary: "One listing — the owner stays private unless they accepted you" })
  detail(@Param("id") id: string, @CurrentUser("id") viewerId?: string) {
    return this.adoption.detail(id, viewerId ?? null);
  }

  @Post("listings/:id/view")
  @Public()
  @Throttle(VIEW_THROTTLE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Count a listing visit (deduped per visitor)" })
  async view(@Param("id") id: string, @Req() req: Request) {
    await this.adoption.recordView(id, req.ip).catch(() => undefined);
  }

  /* ── Listing lifecycle (owner) ────────────────────────────────────────*/

  @Post("listings")
  @ApiBearerAuth()
  @RequireEmailVerified()
  @ApiOperation({ summary: "List one of my cats for adoption" })
  create(@CurrentUser("id") userId: string, @Body() dto: CreateListingDto) {
    return this.adoption.create(userId, dto);
  }

  @Patch("listings/:id")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Edit my listing (a withdrawn one goes back up)" })
  update(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() dto: UpdateListingDto) {
    return this.adoption.update(userId, id, dto);
  }

  @Post("listings/:id/withdraw")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Take my listing down — one tap, no reason needed" })
  withdraw(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.adoption.withdraw(userId, id);
  }

  @Get("listings/:id/requests")
  @ApiBearerAuth()
  @ApiOperation({ summary: "The enquiries on my listing" })
  requests(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.adoption.requestsFor(userId, id);
  }

  /* ── Enquiries ────────────────────────────────────────────────────────*/

  @Post("listings/:id/requests")
  @ApiBearerAuth()
  @RequireEmailVerified()
  @Throttle(ENQUIRY_THROTTLE)
  @ApiOperation({ summary: "Ask to adopt this cat" })
  requestAdoption(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: CreateAdoptionRequestDto
  ) {
    return this.adoption.request(userId, id, dto);
  }

  @Post("requests/:id/withdraw")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Withdraw my enquiry" })
  withdrawRequest(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.adoption.withdrawRequest(userId, id);
  }

  @Post("requests/:id/accept")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Choose this adopter — reserves the cat and introduces you" })
  accept(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: DecideAdoptionRequestDto
  ) {
    return this.adoption.acceptRequest(userId, id, dto);
  }

  @Post("requests/:id/decline")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Say no — kindly, and they hear back" })
  decline(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: DecideAdoptionRequestDto
  ) {
    return this.adoption.declineRequest(userId, id, dto);
  }

  @Post("requests/:id/handover")
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send the Cat ID transfer to the adopter you accepted" })
  handover(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: HandoverDto
  ) {
    return this.adoption.handover(userId, id, dto.confirmCatName);
  }
}
