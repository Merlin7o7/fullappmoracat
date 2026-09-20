import { Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { VetDemoService } from "./vet-demo.service";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";

/**
 * Entering rebuilds a small amount of history, so it is deliberately not a
 * button anyone can hammer.
 */
const ENTER_THROTTLE = { default: { limit: 6, ttl: 60_000 } } as const;

/**
 * The admin door into the vet portal demo (see VetDemoService).
 *
 * Gated by the same `partners.*` permissions as the rest of the veterinary
 * network console: someone who may approve clinics may also show one. It
 * grants a real PartnerStaff membership at a quarantined demo clinic rather
 * than a bypass — the vet portal's own authorisation is never weakened.
 */
@ApiTags("admin")
@ApiBearerAuth()
@Controller("admin/vet-demo")
export class AdminVetDemoController {
  constructor(private readonly demo: VetDemoService) {}

  @Get()
  @RequirePermissions("partners.read")
  @ApiOperation({ summary: "Whether the demo clinic exists, and whether I'm currently inside it" })
  status(@CurrentUser("id") userId: string) {
    return this.demo.status(userId);
  }

  @Post("enter")
  @RequirePermissions("partners.read")
  @Throttle(ENTER_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Provision/refresh the demo clinic and join its team as an owner" })
  enter(@CurrentUser("id") userId: string) {
    return this.demo.enter(userId);
  }

  @Post("leave")
  @RequirePermissions("partners.read")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Leave the demo clinic (offboards my demo membership)" })
  leave(@CurrentUser("id") userId: string) {
    return this.demo.leave(userId);
  }
}
