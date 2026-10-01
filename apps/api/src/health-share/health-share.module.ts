import { Module } from "@nestjs/common";
import { CatsModule } from "../cats/cats.module";
import { HealthShareController } from "./health-share.controller";
import { HealthShareService } from "./health-share.service";

@Module({
  imports: [CatsModule],
  controllers: [HealthShareController],
  providers: [HealthShareService],
})
export class HealthShareModule {}
