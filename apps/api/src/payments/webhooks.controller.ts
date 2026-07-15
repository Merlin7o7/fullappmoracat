import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
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
    @Query() query: Record<string, string | undefined>,
    @Body() body: Record<string, unknown>
  ) {
    switch (provider) {
      case "moyasar":
        return this.webhooks.settle(this.webhooks.parseMoyasar(body));
      case "tabby":
        return this.webhooks.settle(this.webhooks.parseTabby(headers, body));
      case "tamara": {
        // Tamara delivers the signing JWT as ?tamaraToken=… AND as an
        // `Authorization: Bearer <token>` header (docs: transaction-authorisation).
        // It is NOT a header literally named "tamaratoken". Read all three,
        // preferring the query param.
        const auth = headers["authorization"] ?? "";
        const bearer = /^bearer /i.test(auth) ? auth.slice(7).trim() : "";
        const token = query.tamaraToken || bearer || headers["tamaratoken"] || "";
        return this.webhooks.settle(this.webhooks.parseTamara(token, body));
      }
      case "mock":
        return this.webhooks.settle(this.webhooks.parseMock(headers, body));
      default:
        throw new BadRequestException(`Unknown payment provider: ${provider}`);
    }
  }
}
