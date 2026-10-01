import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@moraqat/db";
import { careState, formatDate, formatWeight } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import { weeklyDigestTemplate } from "../mail/mail.templates";
import { withJobLock } from "../common/jobs/job-lock";
import { CareService } from "./care.service";

const DAY = 86_400_000;
const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

/** Riyadh calendar day, e.g. "2026-10-01" — the de-duplication bucket for daily work. */
function riyadhDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(d);
}
/** ISO-ish week bucket in Riyadh time: "2026-W40". */
function riyadhWeek(d: Date): string {
  const day = new Date(riyadhDay(d) + "T00:00:00Z");
  const thursday = new Date(day.getTime() + (3 - ((day.getUTCDay() + 6) % 7)) * DAY);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / DAY + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * The care engine's clock (W9). Care runs in Community Mode too — a cat's
 * check-up is due whether or not anything is for sale (R049).
 *
 *   care (hourly)  · once a day: re-sync every active cat's schedule
 *                  · routine/owner tasks entering their due window → one nudge
 *                  · anything a day overdue → one nudge (vaccines included:
 *                    the lifecycle job already reminds BEFORE a dose)
 *   digest (Thu 18:00 Riyadh) · «هذا الأسبوع مع قططك», only when there is
 *                    something to say; respects the member's email setting.
 *
 * Every side effect is claimed in the LifecycleEvent ledger first, so a
 * re-run, a second container or the external /jobs/tick can never double-send.
 */
@Injectable()
export class CareJobsService {
  private readonly logger = new Logger("CareJobs");

  constructor(
    private readonly prisma: PrismaService,
    private readonly care: CareService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService
  ) {}

  @Cron(CronExpression.EVERY_HOUR, { name: "care" })
  async run() {
    return withJobLock(this.prisma, "care", 50 * 60_000, () => this.pass());
  }

  @Cron("0 18 * * 4", { name: "digest", timeZone: "Asia/Riyadh" })
  async weekly() {
    return withJobLock(this.prisma, "digest", 50 * 60_000, () => this.digestPass());
  }

  private async claim(key: string, type: string, subject: { userId?: string; catId?: string; subjectId?: string }): Promise<boolean> {
    try {
      await this.prisma.lifecycleEvent.create({
        data: { key, type, userId: subject.userId ?? null, catId: subject.catId ?? null, subjectId: subject.subjectId ?? null },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
      throw e;
    }
  }

  async pass(now: Date = new Date()): Promise<{ synced: number; nudged: number }> {
    let synced = 0;
    if (await this.claim(`care_sync:${riyadhDay(now)}`, "care_sync", {})) {
      const cats = await this.prisma.cat.findMany({
        where: { status: "ACTIVE", deletedAt: null, claimStatus: "CLAIMED", isDemo: false },
        select: { id: true },
      });
      for (const c of cats) {
        try {
          await this.care.syncCat(c.id, now);
          synced++;
        } catch (err) {
          this.logger.warn(`care sync failed for ${c.id}: ${(err as Error).message}`);
        }
      }
    }

    const tasks = await this.prisma.careTask.findMany({
      where: {
        status: "OPEN",
        dueAt: { lte: new Date(now.getTime() + 7 * DAY), gte: new Date(now.getTime() - 60 * DAY) },
        cat: { status: "ACTIVE", deletedAt: null, claimStatus: "CLAIMED" },
      },
      take: 1000,
      select: {
        id: true, kind: true, titleAr: true, titleEn: true, dueAt: true, status: true, catId: true,
        cat: { select: { name: true, userId: true, user: { select: { locale: true } } } },
      },
    });

    let nudged = 0;
    for (const t of tasks) {
      const state = careState(t, now);
      const loc = t.cat.user.locale === "en" ? "en" : "ar";
      const task = loc === "ar" ? t.titleAr : t.titleEn;
      const dueAt = formatDate(t.dueAt, loc, { day: "numeric", month: "long", timeZone: "Asia/Riyadh" });
      const data = { catId: t.catId, link: `/portal/cats/${t.catId}`, taskId: t.id };

      if (state === "due" && t.kind !== "VACCINE") {
        // Vaccines already get T-7/T-1 reminders from the lifecycle job.
        if (await this.claim(`care_due:${t.id}`, "care_due", { userId: t.cat.userId, catId: t.catId, subjectId: t.id })) {
          this.notifications.emit(t.cat.userId, { category: "SYSTEM", type: "care_due", params: { name: t.cat.name, task, dueAt }, data });
          nudged++;
        }
      } else if (state === "overdue" && now.getTime() - t.dueAt.getTime() >= DAY) {
        if (await this.claim(`care_overdue:${t.id}`, "care_overdue", { userId: t.cat.userId, catId: t.catId, subjectId: t.id })) {
          this.notifications.emit(t.cat.userId, { category: "SYSTEM", type: "care_overdue", params: { name: t.cat.name, task, dueAt }, data });
          nudged++;
        }
      }
    }
    if (synced || nudged) this.logger.log(`care pass: ${synced} cats synced, ${nudged} nudges`);
    return { synced, nudged };
  }

  async digestPass(now: Date = new Date()): Promise<{ sent: number }> {
    const week = riyadhWeek(now);
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, status: "ACTIVE", cats: { some: { status: "ACTIVE", deletedAt: null, claimStatus: "CLAIMED" } } },
      select: {
        id: true, email: true, firstName: true, locale: true,
        cats: {
          where: { status: "ACTIVE", deletedAt: null, claimStatus: "CLAIMED" },
          select: {
            id: true, name: true,
            careTasks: { where: { status: "OPEN", dueAt: { lte: new Date(now.getTime() + 7 * DAY) } }, orderBy: { dueAt: "asc" }, take: 5 },
            weightRecords: {
              where: { deletedAt: null, measuredAt: { gte: new Date(now.getTime() - 45 * DAY) } },
              orderBy: { measuredAt: "asc" },
              select: { weightKg: true },
            },
          },
        },
      },
      take: 2000,
    });

    let sent = 0;
    for (const u of users) {
      const loc = u.locale === "en" ? "en" : "ar";
      const cats = u.cats
        .map((c) => {
          const lines = c.careTasks.map((t) => {
            const st = careState(t, now);
            const title = loc === "ar" ? t.titleAr : t.titleEn;
            const when = formatDate(t.dueAt, loc, { day: "numeric", month: "long", timeZone: "Asia/Riyadh" });
            return st === "overdue"
              ? loc === "ar" ? `${title} — متأخر (كان ${when})` : `${title} — overdue (was ${when})`
              : loc === "ar" ? `${title} — ${when}` : `${title} — ${when}`;
          });
          const w = c.weightRecords;
          if (w.length >= 2) {
            const delta = Math.round((w[w.length - 1]!.weightKg - w[0]!.weightKg) * 10) / 10;
            if (Math.abs(delta) >= 0.2) {
              const d = formatWeight(Math.abs(delta), loc);
              lines.push(loc === "ar" ? `الوزن ${delta > 0 ? "زاد" : "نقص"} ${d} خلال الأسابيع الماضية` : `Weight ${delta > 0 ? "up" : "down"} ${d} over recent weeks`);
            }
          }
          return { name: c.name, lines };
        })
        .filter((c) => c.lines.length > 0);
      if (!cats.length) continue; // nothing to say → no email
      if (!(await this.claim(`digest:${u.id}:${week}`, "weekly_digest", { userId: u.id }))) continue;

      const count = cats.reduce((n, c) => n + c.lines.length, 0);
      this.notifications.emit(u.id, {
        category: "SYSTEM",
        type: "weekly_digest",
        params: {
          summaryAr: `${count} ${count === 1 ? "أمر" : "أمور"} لقططك هالأسبوع — افتح العناية.`,
          summaryEn: `${count} thing${count === 1 ? "" : "s"} for your cats this week — open Care.`,
        },
        data: { link: "/portal/care" },
      });
      if (u.email && (await this.notifications.emailAllowed(u.id, "SYSTEM"))) {
        const mail = weeklyDigestTemplate(loc, u.firstName, cats, `${SITE()}/portal/care`);
        try {
          await this.mail.send({ to: u.email, subject: mail.subject, html: mail.html, text: mail.text });
        } catch (err) {
          this.logger.warn(`digest email failed: ${(err as Error).message}`);
        }
      }
      sent++;
    }
    if (sent) this.logger.log(`weekly digest: ${sent} member(s)`);
    return { sent };
  }
}
