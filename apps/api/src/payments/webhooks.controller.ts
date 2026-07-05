import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Public } from "../common/decorators/public.decorator";
import { Commercial } from "../common/decorators/commercial.decorator";
import { WebhooksService } from "./webhooks.service";

@ApiTags("payments")
@Commercial() // Community Mode: no payment webhook is processable.
@Controller("payments/webhooks")
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Public()
  @Post(":provider")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "PSP webhook receiver (moyasar | tabby | tamara)" })
  async receive(
    @Param("provider") provider: string,
    @Headers() headers: Record<string, string | undefined>,
    @Body() body: Record<string, unknown>
  ) {
    switch (provider) {
      case "moyasar":
        return this.webhooks.settle(this.webhooks.parseMoyasar(body));
      case "tabby":
        return this.webhooks.settle(this.webhooks.parseTabby(headers, body));
      case "tamara":
        return this.webhooks.settle(this.webhooks.parseTamara(headers, body));
      case "mock":
        return this.webhooks.settle(this.webhooks.parseMock(headers, body));
      default:
        throw new BadRequestException(`Unknown payment provider: ${provider}`);
    }
  }
}
