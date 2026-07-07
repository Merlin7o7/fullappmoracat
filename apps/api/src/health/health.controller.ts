import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ApiTags, ApiOkResponse } from "@nestjs/swagger";
import { HealthService } from "./health.service";
import { Public } from "../common/decorators/public.decorator";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Public()
  @Get()
  @ApiOkResponse({ description: "Liveness + database connectivity + schema-compatibility probe" })
  async check() {
    const report = await this.health.check();
    // Answer 503 when degraded (DB down or schema drift) so health-gated deploys
    // and uptime monitors keep the previous healthy revision instead of serving
    // on a stale schema.
    if (report.status !== "ok") throw new ServiceUnavailableException(report);
    return report;
  }
}
