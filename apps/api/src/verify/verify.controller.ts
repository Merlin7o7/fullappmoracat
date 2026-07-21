import { Controller, Get, Headers, Param } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiHeader } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { VerifyService } from "./verify.service";
import { Public } from "../common/decorators/public.decorator";

// Public QR-resolution rate limit. The token is high-entropy (brute-force is
// infeasible), but a leaked partner key shouldn't be enumerable at 120/min
// either. Generous enough for a busy clinic counter; env-tunable for a big event.
const VERIFY_LIMIT = Number(process.env.VERIFY_THROTTLE) || 60;

@ApiTags("verify")
@Controller("verify")
export class VerifyController {
  constructor(private readonly verify: VerifyService) {}

  @Public()
  @Throttle({ default: { limit: VERIFY_LIMIT, ttl: 60_000 } })
  @Get("cat/:token")
  @ApiOperation({ summary: "Resolve a Cat ID QR token to identity + membership status" })
  @ApiHeader({ name: "x-moracat-key", description: "Authorized partner key", required: false })
  verifyCat(@Param("token") token: string, @Headers("x-moracat-key") key?: string) {
    return this.verify.verifyCat(token, key);
  }
}
