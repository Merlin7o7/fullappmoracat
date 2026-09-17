import { Body, Controller, Get, HttpCode, Ip, Param, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import { PublicCatsService } from "./public-cats.service";
import { FoundReportDto } from "./dto/found-report.dto";

@ApiTags("public-cats")
@Controller("public/cats")
export class PublicCatsController {
  constructor(private readonly cats: PublicCatsService) {}

  @Get(":token")
  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: "The public card behind a collar QR — name, photo, registered, lost?" })
  card(@Param("token") token: string) {
    return this.cats.card(token);
  }

  @Post(":token/found")
  @Public()
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @ApiOperation({ summary: "I found this cat — relay a message to the owner without revealing them" })
  found(@Param("token") token: string, @Body() dto: FoundReportDto, @Ip() ip: string) {
    return this.cats.found(token, dto, ip);
  }
}
