import { Controller, Get, Header, Param, StreamableFile } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../common/decorators/public.decorator";
import { FilesService } from "./files.service";

/**
 * Streams one private object against a signed, short-lived token. The token
 * IS the authorisation (minted only after an access check + ledger entry), so
 * this route is public by design — and never cached.
 */
@ApiTags("files")
@Controller("files")
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get(":token")
  @Header("Cache-Control", "private, no-store")
  @Header("X-Content-Type-Options", "nosniff")
  @ApiOperation({ summary: "Open a private file by signed token (5-minute links)" })
  async open(@Param("token") token: string) {
    const doc = await this.files.open(token);
    return new StreamableFile(doc.buffer, {
      type: doc.mime,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      length: doc.buffer.length,
    });
  }
}
