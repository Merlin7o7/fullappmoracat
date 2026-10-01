import { Controller, Headers, HttpCode, HttpStatus, Post, UnauthorizedException } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { timingSafeEqual } from "node:crypto";
import { Public } from "../common/decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { LifecycleService } from "../lifecycle/lifecycle.service";
import { FulfilmentService } from "../subscriptions/fulfilment.service";
import { CareJobsService } from "../care/care-jobs.service";

/**
 * The external wake-up (MRC-PROD-001 T1, W9 "reliable cron").
 *
 * Render's free plan sleeps the container when idle, and in-process @Cron
 * jobs sleep with it — reminders and boxes slipped silently. A scheduler
 * outside the box (.github/workflows/cron.yml, every 30 minutes) POSTs here
 * with CRON_SECRET: the request wakes the instance and runs whatever is due.
 * Every job is leased (withJobLock) and every side effect is claimed in the
 * idempotency ledger, so a tick that races the in-process cron is harmless.
 *
 * Unset CRON_SECRET = endpoint disabled (401), never open.
 */
@ApiExcludeController()
@Controller("jobs")
export class JobsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: LifecycleService,
    private readonly fulfilment: FulfilmentService,
    private readonly care: CareJobsService
  ) {}

  @Public()
  @Post("tick")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  async tick(@Headers("x-cron-secret") secret?: string) {
    const expected = process.env.CRON_SECRET ?? "";
    const a = Buffer.from(secret ?? "");
    const b = Buffer.from(expected);
    if (expected.length < 24 || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException();
    }

    const ran: string[] = [];
    if (await this.due("lifecycle", 55 * 60_000)) { await this.lifecycle.runNow(); ran.push("lifecycle"); }
    if (await this.due("fulfilment", 55 * 60_000)) { await this.fulfilment.run(); ran.push("fulfilment"); }
    if (await this.due("care", 55 * 60_000)) { await this.care.run(); ran.push("care"); }
    // The digest is weekly: Thursday from 18:00 Riyadh, once (the ledger
    // de-duplicates per member per week, so a late tick still sends it).
    const riyadh = new Date(Date.now() + 3 * 3_600_000);
    if (riyadh.getUTCDay() === 4 && riyadh.getUTCHours() >= 18 && (await this.due("digest", 6 * 24 * 3_600_000))) {
      await this.care.weekly();
      ran.push("digest");
    }
    return { ok: true, ran };
  }

  /** Has this job not finished within `everyMs`? (Reads the lease trail.) */
  private async due(name: string, everyMs: number): Promise<boolean> {
    const lease = await this.prisma.jobLease.findUnique({ where: { name }, select: { lastFinishedAt: true } });
    return !lease?.lastFinishedAt || Date.now() - lease.lastFinishedAt.getTime() >= everyMs;
  }
}
