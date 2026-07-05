import { Body, Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { Throttle } from "@nestjs/throttler";
import { WaitlistService } from "./waitlist.service";
import { JoinWaitlistDto } from "./dto/waitlist.dto";

@ApiTags("waitlist")
@Controller("waitlist")
export class WaitlistController {
  constructor(private readonly waitlist: WaitlistService) {}

  @Public()
  @Post()
  @HttpCode(HttpStatus.OK)
  // Tighter than the global limit — this is an unauthenticated write endpoint.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Join the membership launch waitlist" })
  join(@Body() dto: JoinWaitlistDto) {
    return this.waitlist.join(dto);
  }
}
