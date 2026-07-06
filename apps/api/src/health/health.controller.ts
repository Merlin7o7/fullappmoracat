import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags, ApiOkResponse } from "@nestjs/swagger";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService
  ) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: "Liveness + database connectivity probe" })
  async check(@Query("selftest") selftest?: string) {
    let db = "down";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }
    return {
      status: db === "up" ? "ok" : "degraded",
      service: "moraqat-api",
      db,
      // TEMP diagnostic: non-secret storage config for debugging prod uploads.
      storage: this.storage.configSummary(),
      // TEMP: ?selftest=1 does a write→read-back→public-fetch round trip.
      ...(selftest === "1" ? { selfTest: await this.storage.selfTest() } : {}),
      timestamp: new Date().toISOString(),
    };
  }
}
