import { Module } from "@nestjs/common";
import { CensusController } from "./census.controller";
import { CensusService } from "./census.service";

@Module({
  controllers: [CensusController],
  providers: [CensusService],
  exports: [CensusService],
})
export class CensusModule {}
