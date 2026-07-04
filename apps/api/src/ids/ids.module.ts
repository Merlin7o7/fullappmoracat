import { Global, Module } from "@nestjs/common";
import { IdsService } from "./ids.service";

/** Global so auth + cats (and future modules) can mint IDs without imports. */
@Global()
@Module({
  providers: [IdsService],
  exports: [IdsService],
})
export class IdsModule {}
