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

/**
 * ⚠️ READ BEFORE FLIPPING COMMERCE_ENABLED — this controller is the one place
 * where the kill-switch is NOT symmetric.
 *
 * @Commercial() here 403s every INCOMING PSP event. That is safe today and only
 * today: nothing is for sale during the census, so no transaction is in flight
 * and no event is lost. It stops being safe the moment real money moves.
 *
 * Once live, turning commerce OFF does not pause payments — it strands the ones
 * already mid-flight. The PSP keeps retrying a 403 for its retry budget
 * (hours, not days) and then drops the event PERMANENTLY. The member is charged,
 * the capture never settles, and no later re-enable brings the event back;
 * recovery is manual reconciliation against the provider, member by member.
 *
 * So: after launch, the kill-switch must stop new CHECKOUTS, never inbound
 * webhooks. Ungate this controller as part of the go-live change (settlement of
 * an already-authorised charge is finishing an obligation, not making a sale) —
 * or accept the outage window knowingly and drain in-flight payments first.
 * Do NOT ungate it before then: it is the last door into completeCapturedOrder().
 */
@ApiTags("payments")
@Commercial() // Community Mode: no payment webhook is processable. See the hazard note above.
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
