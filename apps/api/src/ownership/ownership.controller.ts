import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { OwnershipService } from "./ownership.service";
import { StartTransferDto, TransferTokenDto } from "./dto/ownership.dto";
import { CurrentUser, type AuthUser } from "../common/decorators/current-user.decorator";
import { Public } from "../common/decorators/public.decorator";

/** Guessing a 256-bit token is hopeless; this just keeps the noise down. */
const TOKEN_THROTTLE = { default: { limit: 20, ttl: 60_000 } } as const;

/**
 * Handing a Cat ID to its next person (see OwnershipService for the promise
 * this surface keeps). Every route here is owner-authenticated except the
 * preview, which a recipient needs to be able to open from an email before
 * they have signed in — and which deliberately discloses nothing about the
 * household behind the cat.
 */
@ApiTags("ownership")
@ApiBearerAuth()
@Controller()
export class OwnershipController {
  constructor(private readonly ownership: OwnershipService) {}

  @Post("cats/:id/transfer")
  @ApiOperation({ summary: "Offer this cat — and its Cat ID and record — to another member" })
  start(@CurrentUser("id") userId: string, @Param("id") catId: string, @Body() dto: StartTransferDto) {
    return this.ownership.start(userId, catId, dto);
  }

  @Get("cats/:id/ownership-history")
  @ApiOperation({ summary: "The cat's provenance chain — every household that has held them" })
  history(@CurrentUser("id") userId: string, @Param("id") catId: string) {
    return this.ownership.history(userId, catId);
  }

  @Get("transfers")
  @ApiOperation({ summary: "My transfers, incoming and outgoing" })
  mine(@CurrentUser("id") userId: string) {
    return this.ownership.mine(userId);
  }

  @Get("transfers/preview")
  @Public()
  @Throttle(TOKEN_THROTTLE)
  @ApiOperation({ summary: "What a transfer link offers — readable before signing in" })
  preview(@Query("token") token: string) {
    return this.ownership.preview(token ?? "");
  }

  @Get("transfers/:id")
  @ApiOperation({ summary: "An offer addressed to me, by id — for the portal when the email is gone" })
  previewMine(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.ownership.previewForRecipient(user.id, user.email, id);
  }

  @Post("transfers/accept")
  @HttpCode(HttpStatus.OK)
  @Throttle(TOKEN_THROTTLE)
  @ApiOperation({
    summary: "Accept the cat — the Cat ID and the whole record become yours (token or transfer id)",
  })
  accept(@CurrentUser() user: AuthUser, @Body() dto: TransferTokenDto) {
    return this.ownership.accept(user.id, user.email, dto.token);
  }

  @Post("transfers/decline")
  @HttpCode(HttpStatus.OK)
  @Throttle(TOKEN_THROTTLE)
  @ApiOperation({ summary: "Decline — the cat stays exactly where they are" })
  decline(@CurrentUser() user: AuthUser, @Body() dto: TransferTokenDto) {
    return this.ownership.decline(user.id, user.email, dto.token);
  }

  @Post("transfers/:id/cancel")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Take the offer back (sender only, while it is pending)" })
  cancel(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.ownership.cancel(userId, id);
  }
}
