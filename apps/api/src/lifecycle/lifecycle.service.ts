import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import {
  termEndInvitationTemplate,
  membershipLapsedTemplate,
  vaccinationReminderTemplate,
} from "../mail/mail.templates";

const DAY_MS = 86_400_000;
const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * The lifecycle engine — the machinery that makes Moracat's promises mechanically
 * true. Before this, the app *stored* dates (endsAt, dueAt, birthDate) and never
 * acted on them; the UI promised reminders that nothing sent. This scheduler
 * turns every stored date into an act of care:
 *
 *  • term-end INVITATIONS (T-7, T-1) — never a silent charge (R025)
 *  • graceful lapse when a term ends unrenewed — records kept, no guilt (R064/R068)
 *  • vaccination reminders — the first proactive act of care (R049/P8)
 *  • cat birthdays + membership anniversaries — sparing, real delight (R073)
 *  • DRAFT expiry — free an abandoned cat for re-purchase (fire #4)
 *
 * Every send is claimed through `once()` against the `LifecycleEvent` unique key
 * BEFORE it fires, so a restart or a second worker can never double-send. That
 * same ledger is what the dashboard counts as "reminders honoured" (R049) — every
 * row is a promise kept.
 */
@Injectable()
export class LifecycleService {
  private readonly logger = new Logger("Lifecycle");

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService
  ) {}

  /**
   * One hourly pass. Hourly (not daily) so term-end and vaccination windows are
   * caught promptly and a deploy mid-day doesn't skip a day's reminders; the
   * idempotency ledger makes re-runs free.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: "lifecycle" })
  async run() {
    const started = Date.now();
    const results = await Promise.allSettled([
      this.termEndInvitations(),
      this.gracefulLapse(),
      this.vaccinationReminders(),
      this.birthdaysAndAnniversaries(),
      this.expireStaleDrafts(),
    ]);
    const failures = results.filter((r) => r.status === "rejected");
    for (const f of failures) if (f.status === "rejected") this.logger.error(`lifecycle task failed: ${String(f.reason)}`);
    this.logger.log(`lifecycle pass done in ${Date.now() - started}ms (${failures.length} task failures)`);
  }

  // ── term-end invitations (R025) ────────────────────────────────────────────
  /** Invite renewal at T-7 and T-1 days. An invitation, never a charge warning. */
  private async termEndInvitations() {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * DAY_MS);
    const subs = await this.prisma.subscription.findMany({
      // A member who chose "won't renew" (cancelAtTermEnd) must NOT be invited
      // to renew — respecting a stated decision is the whole point (R068).
      where: { status: "ACTIVE", endsAt: { gt: now, lte: in7 }, cancelAtTermEnd: false },
      select: {
        id: true,
        endsAt: true,
        price: true,
        termMonths: true,
        userId: true,
        plan: { select: { nameEn: true, nameAr: true } },
        cats: { take: 1, select: { cat: { select: { id: true, name: true } } } },
        user: { select: { email: true, firstName: true, locale: true } },
      },
    });
    for (const s of subs) {
      if (!s.endsAt) continue;
      const cat = s.cats[0]?.cat;
      // Already renewed? A stacked renewal covers the same cat with a LATER
      // endsAt — inviting them again would nag someone who already said yes.
      if (cat) {
        const renewedAhead = await this.prisma.subscriptionCat.count({
          where: {
            catId: cat.id,
            subscription: { status: { in: ["ACTIVE", "DRAFT"] }, endsAt: { gt: s.endsAt }, NOT: { id: s.id } },
          },
        });
        if (renewedAhead > 0) continue;
      }
      const days = Math.ceil((s.endsAt.getTime() - now.getTime()) / DAY_MS);
      const milestone = days <= 1 ? "t1" : "t7";
      const catName = cat?.name ?? "your cat";
      const loc = s.user.locale === "en" ? "en" : "ar";
      const endsStr = fmtDate(s.endsAt, loc);
      const termTotal = Number(s.price) * (s.termMonths ?? 1);
      const renewUrl = `${SITE()}/portal/subscribe?cat=${cat?.id ?? ""}&renew=1`;

      await this.once(`term_end_${milestone}:${s.id}`, "term_ending", { userId: s.userId, subjectId: s.id, catId: cat?.id }, async () => {
        this.notifications.emit(s.userId, {
          category: "BILLING",
          type: "term_ending",
          params: { name: catName, endsAt: endsStr },
          data: { subscriptionId: s.id, renewUrl },
        });
        if (s.user.email) {
          const planName = loc === "ar" ? s.plan?.nameAr : s.plan?.nameEn;
          const mail = termEndInvitationTemplate(loc, s.user.firstName, catName, planName ?? "Moracat", endsStr, termTotal, renewUrl);
          await this.mail.send({ to: s.user.email, subject: mail.subject, html: mail.html, text: mail.text });
        }
      });
    }
  }

  // ── graceful lapse (R064/R068) ─────────────────────────────────────────────
  /** A term that ended (renewed or not) lapses gently: records kept, no guilt. */
  private async gracefulLapse() {
    const now = new Date();
    const subs = await this.prisma.subscription.findMany({
      where: { status: "ACTIVE", endsAt: { lte: now } },
      select: {
        id: true,
        userId: true,
        cats: { select: { cat: { select: { id: true, name: true } } } },
        user: { select: { email: true, firstName: true, locale: true } },
      },
    });
    for (const s of subs) {
      const cat = s.cats[0]?.cat;
      const catName = cat?.name ?? "your cat";
      const loc = s.user.locale === "en" ? "en" : "ar";
      const renewUrl = `${SITE()}/portal/subscribe?cat=${cat?.id ?? ""}&renew=1`;

      await this.once(`membership_lapsed:${s.id}`, "membership_lapsed", { userId: s.userId, subjectId: s.id, catId: cat?.id }, async () => {
        await this.prisma.subscription.update({
          where: { id: s.id },
          data: { status: "EXPIRED", events: { create: { type: "expired" } } },
        });
        // Coverage-aware recompute — an invited renewal STACKS a second ACTIVE
        // subscription before the old one lapses; a renewed cat must never be
        // deactivated by its old term expiring.
        let anyStillCovered = false;
        for (const c of s.cats) {
          const stillCovered = await this.prisma.subscriptionCat.count({
            where: { catId: c.cat.id, subscription: { status: "ACTIVE" } },
          });
          if (stillCovered > 0) anyStillCovered = true;
          await this.prisma.cat.updateMany({
            where: { id: c.cat.id, status: "ACTIVE" },
            data: { membershipStatus: stillCovered > 0 ? "ACTIVE" : "INACTIVE" },
          });
        }
        // The farewell is only for members who actually lapsed. A renewed
        // member's old term expiring is seamless continuity — saying "your
        // membership ended" to them would be a false (and alarming) claim.
        if (!anyStillCovered) {
          this.notifications.emit(s.userId, {
            category: "BILLING",
            type: "membership_lapsed",
            params: { name: catName },
            data: { renewUrl },
          });
          if (s.user.email) {
            const mail = membershipLapsedTemplate(loc, s.user.firstName, catName, renewUrl);
            await this.mail.send({ to: s.user.email, subject: mail.subject, html: mail.html, text: mail.text });
          }
        }
      });
    }
  }

  // ── vaccination reminders (R049/P8) ────────────────────────────────────────
  /** The first proactive act of care: remind before a vaccination is due. */
  private async vaccinationReminders() {
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * DAY_MS);
    const vaccs = await this.prisma.catVaccination.findMany({
      where: { dueAt: { gt: now, lte: in7 }, cat: { status: "ACTIVE", deletedAt: null } },
      select: {
        id: true,
        name: true,
        dueAt: true,
        cat: { select: { id: true, name: true, userId: true, user: { select: { email: true, firstName: true, locale: true } } } },
      },
    });
    for (const v of vaccs) {
      if (!v.dueAt) continue;
      const days = Math.ceil((v.dueAt.getTime() - now.getTime()) / DAY_MS);
      const milestone = days <= 1 ? "t1" : "t7";
      const loc = v.cat.user.locale === "en" ? "en" : "ar";
      const dueStr = fmtDate(v.dueAt, loc);
      const url = `${SITE()}/portal/cats?cat=${v.cat.id}&panel=health`;

      await this.once(`vacc_${milestone}:${v.id}`, "vaccination_due", { userId: v.cat.userId, subjectId: v.id, catId: v.cat.id }, async () => {
        this.notifications.emit(v.cat.userId, {
          category: "SYSTEM",
          type: "vaccination_due",
          params: { name: v.cat.name, vaccine: v.name, dueAt: dueStr },
          data: { catId: v.cat.id, url },
        });
        if (v.cat.user.email) {
          const mail = vaccinationReminderTemplate(loc, v.cat.user.firstName, v.cat.name, v.name, dueStr, url);
          await this.mail.send({ to: v.cat.user.email, subject: mail.subject, html: mail.html, text: mail.text });
        }
      });
    }
  }

  // ── birthdays + anniversaries (R073 — sparing, real delight) ────────────────
  private async birthdaysAndAnniversaries() {
    const today = riyadhParts(new Date());
    // Cats with a birthday or an ID-issue anniversary landing today (Riyadh).
    const cats = await this.prisma.cat.findMany({
      where: { status: "ACTIVE", deletedAt: null, OR: [{ birthDate: { not: null } }, { idIssuedAt: { not: null } }] },
      select: { id: true, name: true, userId: true, birthDate: true, idIssuedAt: true },
    });
    for (const c of cats) {
      if (c.birthDate) {
        const b = riyadhParts(c.birthDate);
        if (b.month === today.month && b.day === today.day && today.year > b.year) {
          const age = today.year - b.year;
          await this.once(`cat_birthday:${c.id}:${today.year}`, "cat_birthday", { userId: c.userId, catId: c.id }, async () => {
            this.notifications.emit(c.userId, {
              category: "SYSTEM",
              type: "cat_birthday",
              params: { name: c.name, age: String(age) },
              data: { catId: c.id },
            });
          });
        }
      }
      if (c.idIssuedAt) {
        const i = riyadhParts(c.idIssuedAt);
        if (i.month === today.month && i.day === today.day && today.year > i.year) {
          const years = today.year - i.year;
          await this.once(`member_anniversary:${c.id}:${today.year}`, "member_anniversary", { userId: c.userId, catId: c.id }, async () => {
            this.notifications.emit(c.userId, {
              category: "SYSTEM",
              type: "member_anniversary",
              params: { name: c.name, years: String(years) },
              data: { catId: c.id },
            });
          });
        }
      }
    }
  }

  // ── DRAFT expiry (fire #4) ──────────────────────────────────────────────────
  /** Free a cat locked behind an abandoned redirect: void DRAFTs older than 24h. */
  private async expireStaleDrafts() {
    const cutoff = new Date(Date.now() - DAY_MS);
    const drafts = await this.prisma.subscription.findMany({
      where: { status: "DRAFT", createdAt: { lt: cutoff } },
      select: { id: true, userId: true, orders: { where: { status: "PENDING" }, select: { id: true } } },
    });
    for (const d of drafts) {
      await this.once(`draft_expired:${d.id}`, "draft_expired", { userId: d.userId, subjectId: d.id }, async () => {
        await this.prisma.$transaction([
          this.prisma.subscription.update({
            where: { id: d.id },
            data: { status: "CANCELLED", cancelledAt: new Date(), events: { create: { type: "draft_expired" } } },
          }),
          ...(d.orders.length
            ? [this.prisma.order.updateMany({ where: { id: { in: d.orders.map((o) => o.id) } }, data: { status: "FAILED" } })]
            : []),
        ]);
      });
    }
  }

  // ── idempotency ─────────────────────────────────────────────────────────────
  /**
   * Claim-then-act: insert the unique `key` FIRST (a P2002 means already done →
   * skip), then run the side effect. A restart or concurrent worker can never
   * double-send. The ledger row doubles as "a reminder honoured" (R049).
   */
  private async once(
    key: string,
    type: string,
    subject: { userId?: string | null; catId?: string | null; subjectId?: string | null },
    fn: () => Promise<void>
  ): Promise<boolean> {
    try {
      await this.prisma.lifecycleEvent.create({
        data: { key, type, userId: subject.userId ?? null, catId: subject.catId ?? null, subjectId: subject.subjectId ?? null },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false; // already processed
      throw e;
    }
    try {
      await fn();
    } catch (e) {
      // The claim stands (we won't retry and spam), but surface the failure.
      this.logger.error(`lifecycle side-effect failed for ${key}: ${String(e)}`);
    }
    return true;
  }
}

/** Localized long date, e.g. "١٧ يوليو ٢٠٢٦" / "17 July 2026". Gregorian is
 *  forced explicitly — bare "ar-SA" defaults to Umm-al-Qura (Hijri) in ICU,
 *  which would date money events in a calendar the invoice doesn't use. */
function fmtDate(d: Date, loc: "ar" | "en"): string {
  return d.toLocaleDateString(loc === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Riyadh",
  });
}

/** Riyadh-local Y/M/D parts, so birthdays don't fire a day early at UTC midnight. */
function riyadhParts(d: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Riyadh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}
