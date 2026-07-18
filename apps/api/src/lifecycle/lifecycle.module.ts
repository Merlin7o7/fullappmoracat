import { Module } from "@nestjs/common";
import { LifecycleService } from "./lifecycle.service";

/**
 * The lifecycle engine (see LifecycleService). Prisma, Notifications and Mail are
 * provided globally; this module just registers the scheduled worker. ScheduleModule
 * is initialised once in AppModule.
 */
@Module({
  providers: [LifecycleService],
})
export class LifecycleModule {}
