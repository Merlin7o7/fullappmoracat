import { Global, Module } from "@nestjs/common";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";

/** Signed links for private objects (medical attachments, certificates). */
@Global()
@Module({
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
