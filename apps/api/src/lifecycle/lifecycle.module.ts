import { Module } from "@nestjs/common";
import { LifecycleService } from "./lifecycle.service";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

/**
 * The lifecycle engine (see LifecycleService). Prisma, Notifications, Mail and
 * the payment provider factory are provided globally; SubscriptionsModule is
 * imported for the renewal + capture-recovery logic, which deliberately lives
 * with the rest of subscription behaviour rather than being duplicated here.
 */
@Module({
  imports: [SubscriptionsModule],
  providers: [LifecycleService],
})
export class LifecycleModule {}
