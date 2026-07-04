import { Controller, Get, Headers, Param } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiHeader } from "@nestjs/swagger";
import { VerifyService } from "./verify.service";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("verify")
@Controller("verify")
export class VerifyController {
  constructor(private readonly verify: VerifyService) {}

  @Public()
  @Get("cat/:token")
  @ApiOperation({ summary: "Resolve a Cat ID QR token to identity + membership status" })
  @ApiHeader({ name: "x-moracat-key", description: "Authorized partner key", required: false })
  verifyCat(@Param("token") token: string, @Headers("x-moracat-key") key?: string) {
    return this.verify.verifyCat(token, key);
  }
}
