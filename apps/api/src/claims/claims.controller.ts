import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ClaimsService } from "./claims.service";
import { AcceptClaimDto } from "./dto/claim.dto";

const TOKEN_THROTTLE = { default: { limit: 30, ttl: 60_000 } };
const OTP_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags("claims")
@Controller("claim")
export class ClaimsController {
  constructor(private readonly claims: ClaimsService) {}

  @Get(":token")
  @Public()
  @Throttle(TOKEN_THROTTLE)
  @ApiOperation({ summary: "What this claim link is for — cat, clinic, last four digits, expiry" })
  preview(@Param("token") token: string) {
    return this.claims.preview(token);
  }

  @Post(":token/otp")
  @Public()
  @HttpCode(200)
  @Throttle(OTP_THROTTLE)
  @ApiOperation({ summary: "Send a one-time code to the invited number" })
  sendOtp(@Param("token") token: string) {
    return this.claims.sendOtp(token);
  }

  @Post(":token/accept")
  @ApiBearerAuth()
  @HttpCode(200)
  @Throttle(TOKEN_THROTTLE)
  @ApiOperation({ summary: "Claim the cat: prove the number, take ownership, receive the Cat ID" })
  accept(@CurrentUser("id") userId: string, @Param("token") token: string, @Body() dto: AcceptClaimDto) {
    return this.claims.accept(userId, token, dto ?? {});
  }
}
