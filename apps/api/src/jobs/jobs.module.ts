import { Module } from "@nestjs/common";
import { JobsController } from "./jobs.controller";
import { LifecycleModule } from "../lifecycle/lifecycle.module";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { CareModule } from "../care/care.module";

@Module({
  imports: [LifecycleModule, SubscriptionsModule, CareModule],
  controllers: [JobsController],
})
export class JobsModule {}
