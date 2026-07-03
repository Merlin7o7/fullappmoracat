import { Body, Controller, Get, Param, Post, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { FeedingService } from "./feeding.service";
import { FeedingCalcDto } from "./dto/feeding.dto";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("feeding")
@Controller("feeding")
export class FeedingController {
  constructor(private readonly feeding: FeedingService) {}

  @Public()
  @Post("calculate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Smart Feeding: calculate quantities from a profile (no login)" })
  calculate(@Body() dto: FeedingCalcDto) {
    return this.feeding.calculate(dto);
  }

  @ApiBearerAuth()
  @Post("cats/:catId")
  @ApiOperation({ summary: "Calculate for a saved cat and store the recommendation" })
  calculateForCat(@CurrentUser("id") userId: string, @Param("catId") catId: string) {
    return this.feeding.calculateForCat(userId, catId);
  }

  @ApiBearerAuth()
  @Get("cats/:catId/history")
  @ApiOperation({ summary: "Recommendation history for a cat" })
  history(@CurrentUser("id") userId: string, @Param("catId") catId: string) {
    return this.feeding.history(userId, catId);
  }
}
