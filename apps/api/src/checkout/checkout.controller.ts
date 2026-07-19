import { Body, Controller, Post, HttpCode, HttpStatus, Headers } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth, ApiHeader } from "@nestjs/swagger";
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
  @ApiHeader({
    name: "idempotency-key",
    required: false,
    description:
      "Client-generated key making the charge replay-safe. Strongly recommended: without it a retried or double-tapped request can charge twice.",
  })
  create(
    @CurrentUser("id") userId: string,
    @Body() dto: CheckoutDto,
    @Headers("idempotency-key") idempotencyKey?: string
  ) {
    return this.checkout.checkout(userId, dto, idempotencyKey);
  }
}
