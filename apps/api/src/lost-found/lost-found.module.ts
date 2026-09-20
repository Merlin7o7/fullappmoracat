import { Module } from "@nestjs/common";
import { LostFoundController } from "./lost-found.controller";
import { LostFoundService } from "./lost-found.service";

/** The reunion board — the Cat ID's safety job, made a place. */
@Module({
  controllers: [LostFoundController],
  providers: [LostFoundService],
  exports: [LostFoundService],
})
export class LostFoundModule {}
