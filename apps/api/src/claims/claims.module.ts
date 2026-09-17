import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CatsModule } from "../cats/cats.module";
import { ClaimsController } from "./claims.controller";
import { ClaimsService } from "./claims.service";

/** /claim/:token — the owner's door into a clinic-created record (T4). */
@Module({
  imports: [AuthModule, CatsModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
})
export class ClaimsModule {}
