import { Body, Controller, Post, HttpCode, HttpStatus } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CheckoutService } from "./checkout.service";
import { CheckoutDto } from "./dto/checkout.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Commercial } from "../common/decorators/commercial.decorator";

@ApiTags("checkout")
@ApiBearerAuth()
@Commercial() // Community Mode: entire checkout surface is disabled.
@Controller("checkout")
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Pay for a cart and create an order + invoice" })
  create(@CurrentUser("id") userId: string, @Body() dto: CheckoutDto) {
    return this.checkout.checkout(userId, dto);
  }
}
