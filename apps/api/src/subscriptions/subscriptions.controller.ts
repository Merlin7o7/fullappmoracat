import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SubscriptionsService } from "./subscriptions.service";
import { CreateSubscriptionDto, PauseDto } from "./dto/subscription.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("subscriptions")
@ApiBearerAuth()
@Controller("subscriptions")
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Post()
  @ApiOperation({ summary: "Build a subscription (plan + cats + custom items)" })
  create(@CurrentUser("id") userId: string, @Body() dto: CreateSubscriptionDto) {
    return this.subs.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the user's subscriptions" })
  findAll(@CurrentUser("id") userId: string) {
    return this.subs.findAll(userId);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get one subscription" })
  findOne(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.subs.findOne(userId, id);
  }

  @Post(":id/pause")
  @ApiOperation({ summary: "Pause a subscription" })
  pause(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() dto: PauseDto) {
    return this.subs.pause(userId, id, dto.until);
  }

  @Post(":id/resume")
  @ApiOperation({ summary: "Resume a paused subscription" })
  resume(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.subs.resume(userId, id);
  }

  @Post(":id/skip")
  @ApiOperation({ summary: "Skip the next delivery" })
  skip(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.subs.skip(userId, id);
  }

  @Post(":id/cancel")
  @ApiOperation({ summary: "Cancel a subscription" })
  cancel(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.subs.cancel(userId, id);
  }
}
