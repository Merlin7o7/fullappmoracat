import { Module } from "@nestjs/common";
import { CareController } from "./care.controller";
import { CareService } from "./care.service";
import { CareJobsService } from "./care-jobs.service";

@Module({
  controllers: [CareController],
  providers: [CareService, CareJobsService],
  exports: [CareService, CareJobsService],
})
export class CareModule {}
