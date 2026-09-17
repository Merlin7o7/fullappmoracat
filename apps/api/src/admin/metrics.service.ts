import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import {
  CVAC_OWNER_ACTIVE_DAYS,
  CVAC_RECORD_WINDOW_DAYS,
  EMPTY_METRICS,
  riyadhDayBounds,
  type MetricSnapshotData,
} from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { withJobLock } from "../common/jobs/job-lock";

const DAY_MS = 86_400_000;

/**
 * The nightly roll-up behind the admin metrics page (MRC-STRAT-001 §F).
 *
 * Each snapshot is one Riyadh calendar day, recomputed from the source tables
 * every night so a late-arriving event or a merge corrects yesterday instead
 * of drifting. Reads are always from snapshots except `latest()`, which
 * computes today live so the dashboard is never empty on the first day.
 */
@Injectable()
export class AdminMetricsService {
  private readonly logger = new Logger("Metrics");

  constructor(private readonly prisma: PrismaService) {}

  /** 02:00 Riyadh, after the day is over and before anyone reads the dashboard. */
  @Cron("0 2 * * *", { name: "metrics", timeZone: "Asia/Riyadh" })
  async nightly() {
    await withJobLock(this.prisma, "metrics", 30 * 60_000, async () => {
      // Yesterday (Riyadh) and, for safety, the day before — covers a missed run.
      const now = new Date();
      for (const back of [2, 1]) {
        await this.snapshotDay(new Date(now.getTime() - back * DAY_MS));
      }
    });
  }

  async snapshotDay(at: Date): Promise<MetricSnapshotData> {
    const { start, end, day } = riyadhDayBounds(at);
    const data = await this.compute(start, end);
    await this.prisma.metricSnapshot.upsert({
      where: { day: new Date(`${day}T00:00:00.000Z`) },
      create: { day: new Date(`${day}T00:00:00.000Z`), data: data as object },
      update: { data: data as object, computedAt: new Date() },
    });
    return data;
  }

  /** Snapshot series for the last `days` days plus today computed live. */
  async series(days: number) {
    const clamped = Math.min(Math.max(1, Math.floor(days)), 180);
    const since = new Date(Date.now() - clamped * DAY_MS);
    const rows = await this.prisma.metricSnapshot.findMany({
      where: { day: { gte: since } },
      orderBy: { day: "asc" },
      select: { day: true, data: true, computedAt: true },
    });
    const today = riyadhDayBounds(new Date());
    const live = await this.compute(today.start, today.end);
    return {
      days: clamped,
      today: { day: today.day, data: live },
      series: rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), data: r.data as unknown as MetricSnapshotData })),
    };
  }

  /**
   * One day's numbers. "That day" counts use [start, end); cumulative counts
   * are as of `end`. Pending-claim cats (clinic-created, not yet claimed) are
   * excluded from "registered" — they are not yet anyone's Cat ID.
   */
  private async compute(start: Date, end: Date): Promise<MetricSnapshotData> {
    const recordSince = new Date(end.getTime() - CVAC_RECORD_WINDOW_DAYS * DAY_MS);
    const ownerSince = new Date(end.getTime() - CVAC_OWNER_ACTIVE_DAYS * DAY_MS);
    const inDay = { gte: start, lt: end };
    const claimed = { deletedAt: null, claimStatus: "CLAIMED" as const, isDemo: false };

    try {
      const [
        registrations,
        catIdsIssued,
        catsRegisteredTotal,
        byOrigin,
        cvac,
        clinicPatientsCreated,
        claimsAccepted,
        clinicsLive,
        clinicalEntries,
        remindersSent,
        reminderClicks,
        activeMemberships,
      ] = await Promise.all([
        this.prisma.user.count({ where: { createdAt: inDay, isStaff: false } }),
        this.prisma.cat.count({ where: { ...claimed, idIssuedAt: inDay } }),
        this.prisma.cat.count({ where: { ...claimed, createdAt: { lt: end } } }),
        this.prisma.cat.groupBy({ by: ["origin"], where: { ...claimed, createdAt: { lt: end } }, _count: { _all: true } }),
        this.prisma.cat.count({
          where: {
            ...claimed,
            status: "ACTIVE",
            clinicalEntries: { some: { status: "FINAL", retractedAt: null, occurredAt: { gte: recordSince, lt: end } } },
            user: { lastLoginAt: { gte: ownerSince } },
          },
        }),
        this.prisma.cat.count({ where: { origin: "CLINIC", isDemo: false, createdAt: inDay } }),
        this.prisma.cat.count({ where: { origin: "CLINIC", isDemo: false, claimedAt: inDay } }),
        this.prisma.partnerOrg.count({ where: { status: "LIVE", isDemo: false, OR: [{ verifiedAt: { lt: end } }, { verifiedAt: null }] } }),
        this.prisma.clinicalEntry.count({ where: { status: "FINAL", createdAt: inDay, org: { isDemo: false } } }),
        this.prisma.productEvent.count({ where: { name: "reminder_sent", createdAt: inDay } }),
        this.prisma.productEvent.count({ where: { name: "reminder_link_clicked", createdAt: inDay } }),
        this.prisma.subscription.count({ where: { status: "ACTIVE", createdAt: { lt: end } } }),
      ]);

      const origin = { ...EMPTY_METRICS.catsByOrigin };
      for (const row of byOrigin) origin[row.origin] = row._count._all;

      return {
        registrations,
        catIdsIssued,
        catsRegisteredTotal,
        catsByOrigin: origin,
        cvac,
        clinicPatientsCreated,
        claimsAccepted,
        clinicsLive,
        clinicalEntries,
        remindersSent,
        reminderClicks,
        activeMemberships,
      };
    } catch (err) {
      this.logger.error(`metrics compute failed: ${(err as Error).message}`);
      return { ...EMPTY_METRICS };
    }
  }
}
