import { Injectable, Logger } from "@nestjs/common";
import { sanitizeEventProps, type EventName } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";

export interface EventContext {
  userId?: string | null;
  catId?: string | null;
  orgId?: string | null;
  anonId?: string | null;
  /** Coarse dimensions only — PII keys are dropped by `sanitizeEventProps`. */
  props?: Record<string, unknown> | null;
  source?: "web" | "api" | "cron";
}

/**
 * First-party product events (MRC-PROD-001 T2). Writes are fire-and-forget:
 * measurement must never slow down or break the action it measures, so the
 * caller gets `void` and a failed insert is a log line, nothing more.
 */
@Injectable()
export class EventsService {
  private readonly logger = new Logger("Events");

  constructor(private readonly prisma: PrismaService) {}

  emit(name: EventName, ctx: EventContext = {}): void {
    void this.write(name, ctx).catch((err: Error) => {
      this.logger.warn(`event ${name} not recorded: ${err.message}`);
    });
  }

  /** Awaitable variant for tests and for the few places that need ordering. */
  async record(name: EventName, ctx: EventContext = {}): Promise<void> {
    await this.write(name, ctx);
  }

  private async write(name: EventName, ctx: EventContext): Promise<void> {
    await this.prisma.productEvent.create({
      data: {
        name,
        userId: ctx.userId ?? null,
        catId: ctx.catId ?? null,
        orgId: ctx.orgId ?? null,
        anonId: ctx.anonId ? ctx.anonId.slice(0, 64) : null,
        source: ctx.source ?? "api",
        props: sanitizeEventProps(ctx.props) ?? undefined,
      },
    });
  }
}
