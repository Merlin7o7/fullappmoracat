import { Module } from "@nestjs/common";
import { SubscriptionsController } from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";

@Module({
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService],
  // The lifecycle engine drives auto-renewals and stuck-payment recovery
  // through this service, so renewal logic lives in exactly one place rather
  // than being reimplemented inside the scheduler.
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
