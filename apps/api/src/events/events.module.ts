import { Global, Module } from "@nestjs/common";
import { EventsController } from "./events.controller";
import { EventsService } from "./events.service";

/**
 * Global so any domain service can record the fact it owns without a module
 * import — measurement should be the easy default, not a wiring decision.
 */
@Global()
@Module({
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
