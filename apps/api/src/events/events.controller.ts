import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { OptionalAuth } from "../common/decorators/optional-auth.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { EventsService } from "./events.service";
import { TrackEventDto } from "./dto/track-event.dto";

/**
 * The one public write for browser-originated events. The allow-list in the
 * DTO is the whole security model: a visitor can only record that they landed
 * or opened a page, never that a cat was issued or a payment succeeded — those
 * facts are written by the services that produce them.
 */
@ApiTags("events")
@Controller("events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  @OptionalAuth()
  @HttpCode(202)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: "Record a client-side product event (allow-listed names only)" })
  track(@Body() dto: TrackEventDto, @CurrentUser("id") userId?: string) {
    this.events.emit(dto.name, { userId: userId ?? null, anonId: dto.anonId, props: dto.props, source: "web" });
    return { accepted: true };
  }
}
