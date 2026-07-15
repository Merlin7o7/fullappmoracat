import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SubscriptionsService } from "./subscriptions.service";
import { ActivateSubscriptionDto, CreateSubscriptionDto, PauseDto } from "./dto/subscription.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Commercial } from "../common/decorators/commercial.decorator";

@ApiTags("subscriptions")
@ApiBearerAuth()
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Post()
  @Commercial() // Community Mode: paid activation is disabled — no new subscriptions.
  @ApiOperation({ summary: "Build a subscription (plan + cats + custom items)" })
  create(@CurrentUser("id") userId: string, @Body() dto: CreateSubscriptionDto) {
    return this.subs.create(userId, dto);
  }

  @Post("activate")
  @Commercial() // Money moves here — hard-blocked in Community Mode.
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Activate a membership: charge the first month, then create the subscription + order + invoice" })
  activate(@CurrentUser("id") userId: string, @Body() dto: ActivateSubscriptionDto) {
    return this.subs.activate(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the user's subscriptions" })
  findAll(@CurrentUser("id") userId: string) {
    return this.subs.findAll(userId);
  }

  // Polled by the PSP-return ceremony while the webhook settles. A GET, so it
  // stays reachable (not @Commercial-frozen) and is scoped to the member.
  @Get("order-status/:ref")
  @ApiOperation({ summary: "Poll a membership activation's settlement state (PSP return page)" })
  orderStatus(@CurrentUser("id") userId: string, @Param("ref") ref: string) {
    return this.subs.getActivationStatus(userId, ref);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one subscription" })
  findOne(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.subs.findOne(userId, id);
  }

  // Lifecycle transitions mutate membership state (resume/cancel flip a cat's
  // membershipStatus), so they're frozen in Community Mode too — not just
  // create. GETs stay open so the "coming soon" page can still read state.
  @Post(":id/pause")
  @Commercial()
  @ApiOperation({ summary: "Pause a subscription" })
  pause(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() dto: PauseDto) {
    return this.subs.pause(userId, id, dto.until);
  }

  @Post(":id/resume")
  @Commercial()
  @ApiOperation({ summary: "Resume a paused subscription" })
  resume(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.subs.resume(userId, id);
  }

  @Post(":id/skip")
  @Commercial()
  @ApiOperation({ summary: "Skip the next delivery" })
  skip(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.subs.skip(userId, id);
  }

  @Post(":id/cancel")
  @Commercial()
  @ApiOperation({ summary: "Cancel a subscription" })
  cancel(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.subs.cancel(userId, id);
  }
}
