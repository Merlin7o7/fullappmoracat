import { Global, Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";

/** Global so any domain module can emit notifications without imports. */
@Global()
@Module({
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
