import { Module } from "@nestjs/common";
import { PublicCatsController } from "./public-cats.controller";
import { PublicCatsService } from "./public-cats.service";

/** /public/cats/:token — what a phone camera reaches from the collar tag (T6). */
@Module({
  controllers: [PublicCatsController],
  providers: [PublicCatsService],
})
export class PublicCatsModule {}
