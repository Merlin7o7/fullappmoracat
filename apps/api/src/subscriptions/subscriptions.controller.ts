import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SubscriptionsService } from "./subscriptions.service";
import { ActivateSubscriptionDto, PauseDto, RefundRequestDto, SetAutoRenewDto } from "./dto/subscription.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Commercial } from "../common/decorators/commercial.decorator";

@ApiTags("subscriptions")
@ApiBearerAuth()
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  // NOTE: there is deliberately no bare `POST /subscriptions`. A membership may
  // only come into existence through `activate()`, which charges (or opens a PSP
  // session) FIRST and never flips a cat's membership live without a captured
  // payment. An unpaid "build" route would mint free ACTIVE memberships the day
  // Community Mode lifts — money must be unmovable except through activation.

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
  @ApiOperation({ summary: "Cancel a subscription (won't-renew during a paid term; never confiscates it)" })
  cancel(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.subs.cancel(userId, id);
  }

  // Auto-renewal is opt-out by design, so turning it OFF must be as cheap as a
  // single tap — anything harder would make the default a trap rather than a
  // convenience (R025/R063).
  @Post(":id/auto-renew")
  @Commercial()
  @ApiOperation({ summary: "Turn auto-renewal on or off for a membership" })
  setAutoRenew(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: SetAutoRenewDto
  ) {
    return this.subs.setAutoRenew(userId, id, dto.enabled, dto.paymentMethodId);
  }

  // Resume an abandoned redirect payment — returns the stored checkout URL so a
  // DRAFT membership can be completed instead of dead-ending the cat (fire #4).
  @Post(":id/resume-payment")
  @Commercial()
  @ApiOperation({ summary: "Get the checkout URL to complete an awaiting-payment membership" })
  resumePayment(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.subs.resumePayment(userId, id);
  }

  // Member-initiated remainder refund (R030) — opens a request the care team
  // actions via admin refund tooling. Acknowledged instantly to the member.
  @Post(":id/refund-request")
  @Commercial()
  @ApiOperation({ summary: "Request a refund of the remaining prepaid term" })
  requestRefund(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body() dto: RefundRequestDto
  ) {
    return this.subs.requestRefund(userId, id, dto.reason);
  }
}
