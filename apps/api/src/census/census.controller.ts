import { Controller, Get, Header } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { CensusService } from "./census.service";
import { Public } from "../common/decorators/public.decorator";

/**
 * The public census count (MRC-GTM-001 §1).
 *
 * Deliberately NOT `@Commercial()`. This is the one number Phase 0 exists to
 * produce, and it must keep working precisely *because* commerce is off — it
 * is the front door while nothing is for sale. It exposes no price, no plan,
 * and no personal data beyond cats whose owners opted into the public
 * community.
 *
 * Cache header matches the service's own 30s memo so the CDN and the process
 * agree on how stale the number may be; `stale-while-revalidate` means a cold
 * edge never makes a visitor wait on a COUNT(*).
 */
@ApiTags("census")
@Public()
@Controller("census")
export class CensusController {
  constructor(private readonly census: CensusService) {}

  @Get()
  @Header("Cache-Control", "public, max-age=15, s-maxage=30, stale-while-revalidate=120")
  @ApiOperation({ summary: "How many cats are registered — the live census count" })
  snapshot() {
    return this.census.snapshot();
  }
}
