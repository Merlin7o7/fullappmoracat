import { Inject, Injectable, Logger } from "@nestjs/common";
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
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { commerceEnabled } from "../common/config/features";
import { termTotal as termUpfrontTotal } from "../common/config/pricing";
import {
  PAYMENT_PROVIDER_FACTORY,
  type IPaymentProviderFactory,
  type PaymentProviderKey,
} from "../payments/payment-provider.interface";

const DAY_MS = 86_400_000;
const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

/**
 * Per-task row cap for one pass.
 *
 * Every task here used to be an unbounded findMany. The birthday pass loaded
 * EVERY active cat into Node memory each hour, which OOMs a 512MB instance
 * around 50k cats and becomes a full-table scan long before 10M. Batching keeps
 * a pass bounded; the hourly cadence plus the idempotency ledger means anything
 * not reached this hour is picked up next hour, with no double-sends.
 */
const BATCH = 500;

/**
 * How long a payment may sit in AUTHORIZED before we re-query the provider.
 * Long enough that a normal capture completes, short enough that a member is
 * not left charged-without-membership for hours.
 */
const STUCK_PAYMENT_MS = 10 * 60_000;

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

  /** Last commerce-mode value we announced. Steady state is not news: logging
   *  the skip every hour would bury the task failures worth reading. */
  private loggedCommerceMode: boolean | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly subscriptions: SubscriptionsService,
    @Inject(PAYMENT_PROVIDER_FACTORY) private readonly payments: IPaymentProviderFactory
  ) {}

  /**
   * One hourly pass. Hourly (not daily) so term-end and vaccination windows are
   * caught promptly and a deploy mid-day doesn't skip a day's reminders; the
   * idempotency ledger makes re-runs free.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: "lifecycle" })
  async run() {
    const started = Date.now();
    // The kill-switch has to be read HERE as well as inside the services: this
    // cron runs in-process, and CommerceGuard is an APP_GUARD that only ever
    // sees HTTP requests. Care continues in Community Mode — a cat's vaccination
    // is due whether or not anything is for sale (R049/P8); money, membership
    // state, and renewal money-copy do not (R040: never say "your membership
    // renews" while memberships aren't sold).
    const commerce = commerceEnabled();
    this.logCommerceMode(commerce);
    const results = await Promise.allSettled([
      ...(commerce
        ? [
            this.termEndInvitations(),
            // Runs BEFORE gracefulLapse so a renewable membership is charged
            // rather than lapsed in the same pass.
            this.autoRenewals(),
            this.gracefulLapse(),
            // Commercial too: a DRAFT is half of a payment in flight. Expiring
            // it while reconcileStuckPayments is frozen would cancel the
            // membership of someone the PSP may still have charged — exactly the
            // charged-with-no-membership outcome that sweep exists to prevent.
            this.expireStaleDrafts(),
            this.reconcileStuckPayments(),
          ]
        : []),
      this.vaccinationReminders(),
      this.birthdaysAndAnniversaries(),
    ]);
    const failures = results.filter((r) => r.status === "rejected");
    for (const f of failures) if (f.status === "rejected") this.logger.error(`lifecycle task failed: ${String(f.reason)}`);
    this.logger.log(`lifecycle pass done in ${Date.now() - started}ms (${failures.length} task failures)`);
  }

  /** Announce the commerce mode on the first pass, and again only when it flips —
   *  so the day someone sets COMMERCE_ENABLED there is one unambiguous line in
   *  the log saying which half of the engine just woke up. */
  private logCommerceMode(commerce: boolean) {
    if (this.loggedCommerceMode === commerce) return;
    this.loggedCommerceMode = commerce;
    this.logger.log(
      commerce
        ? "commerce ON — running commercial lifecycle tasks (renewal invitations, auto-renewal, lapse, draft expiry, payment reconciliation)"
        : "Community Mode (COMMERCE_ENABLED!=true) — skipping commercial lifecycle tasks; care tasks (vaccination reminders, birthdays) still run"
    );
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
      take: BATCH,
      select: {
        id: true,
        endsAt: true,
        price: true,
        termMonths: true,
        userId: true,
        autoRenew: true,
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
      // Same deterministic prepay-discount math as activation — the invited
      // renewal quotes exactly what the charge will be (R021/R025).
      const termTotal = termUpfrontTotal(Number(s.price), s.termMonths ?? 1);
      const renewUrl = `${SITE()}/portal/subscribe?cat=${cat?.id ?? ""}&renew=1`;

      await this.once(`term_end_${milestone}:${s.id}`, "term_ending", { userId: s.userId, subjectId: s.id, catId: cat?.id }, async () => {
        // R025's actual requirement is that a charge is never a surprise, not
        // that it never happens. Stamping autoRenewNoticeAt here is what LICENSES
        // the renewal: autoRenewals() refuses to charge a membership that has no
        // notice on record, so the notice and the charge cannot drift apart.
        if (s.autoRenew) {
          await this.prisma.subscription.update({
            where: { id: s.id },
            data: { autoRenewNoticeAt: new Date() },
          });
        }
        this.notifications.emit(s.userId, {
          category: "BILLING",
          type: s.autoRenew ? "renewal_upcoming" : "term_ending",
          params: { name: catName, endsAt: endsStr, total: termTotal, currency: "SAR" },
          data: { subscriptionId: s.id, renewUrl, manageUrl: `${SITE()}/portal/subscriptions` },
        });
        if (s.user.email) {
          const planName = loc === "ar" ? s.plan?.nameAr : s.plan?.nameEn;
          const mail = termEndInvitationTemplate(loc, s.user.firstName, catName, planName ?? "Moracat", endsStr, termTotal, renewUrl);
          await this.mail.send({ to: s.user.email, subject: mail.subject, html: mail.html, text: mail.text });
        }
      });
    }
  }

  // ── auto-renewal ───────────────────────────────────────────────────────────
  /**
   * Renew memberships that opted in, at term end.
   *
   * The honesty rules R025 demands are enforced as preconditions, not as copy:
   *
   *   * `autoRenewNoticeAt` must be set and in the past — a renewal cannot run
   *     unless the member was told it was coming.
   *   * `cancelAtTermEnd` short-circuits everything.
   *   * A stored credential on a recurring-capable rail is required. BNPL
   *     cannot be charged off-session, so those memberships fall through to an
   *     invitation instead of failing, and the member is never left believing
   *     something renewed when it could not.
   *
   * A failed charge does NOT lapse the membership immediately — it enters
   * dunning, so a transient decline does not cost a member their cat's record.
   */
  private async autoRenewals() {
    const now = new Date();
    const due = await this.prisma.subscription.findMany({
      where: {
        status: "ACTIVE",
        autoRenew: true,
        cancelAtTermEnd: false,
        endsAt: { lte: now },
        autoRenewNoticeAt: { not: null, lte: now },
      },
      take: BATCH,
      select: {
        id: true,
        userId: true,
        price: true,
        termMonths: true,
        currency: true,
        endsAt: true,
        addressId: true,
        planId: true,
        plan: { select: { nameEn: true, nameAr: true } },
        cats: { select: { catId: true, cat: { select: { name: true } } } },
        renewalPaymentMethod: { select: { id: true, provider: true, token: true, last4: true } },
        user: { select: { email: true, firstName: true, locale: true } },
      },
    });

    for (const sub of due) {
      const pm = sub.renewalPaymentMethod;
      const adapter = pm ? this.payments.resolve(pm.provider as PaymentProviderKey) : null;

      // No reusable credential (BNPL term, or the card was removed). Invite
      // instead of pretending — and stop claiming this membership auto-renews.
      if (!pm?.token || !adapter?.supportsRecurring || !adapter.chargeStored) {
        await this.once(
          `autorenew_uncharged:${sub.id}`,
          "autorenew_uncharged",
          { userId: sub.userId, subjectId: sub.id },
          async () => {
            await this.prisma.subscription.update({
              where: { id: sub.id },
              data: { autoRenew: false },
            });
            this.notifications.emit(sub.userId, {
              category: "BILLING",
              type: "term_ending",
              params: {
                name: sub.cats[0]?.cat?.name ?? "your cat",
                endsAt: fmtDate(sub.endsAt ?? now, sub.user.locale === "en" ? "en" : "ar"),
              },
              data: { subscriptionId: sub.id, renewUrl: `${SITE()}/portal/subscribe?renew=1` },
            });
          },
          { releaseOnFailure: true }
        );
        continue;
      }

      const termTotal = termUpfrontTotal(Number(sub.price), sub.termMonths ?? 1);
      await this.once(
        `autorenew:${sub.id}:${sub.endsAt?.toISOString() ?? ""}`,
        "autorenew",
        { userId: sub.userId, subjectId: sub.id },
        async () => {
          const result = await this.subscriptions.renewWithStoredMethod({
            subscriptionId: sub.id,
            amount: termTotal,
            token: pm.token,
            provider: pm.provider as PaymentProviderKey,
          });

          const loc = sub.user.locale === "en" ? "en" : "ar";
          if (result.ok) {
            this.notifications.emit(sub.userId, {
              category: "BILLING",
              type: "membership_renewed",
              params: {
                name: sub.cats[0]?.cat?.name ?? "your cat",
                total: termTotal,
                currency: sub.currency,
                endsAt: fmtDate(result.endsAt, loc),
              },
              data: { subscriptionId: sub.id },
            });
          } else {
            // Dunning, not death. The member keeps their records and their Cat
            // ID while we retry; only a definitively failed ladder lapses.
            this.notifications.emit(sub.userId, {
              category: "BILLING",
              type: "renewal_payment_failed",
              params: {
                name: sub.cats[0]?.cat?.name ?? "your cat",
                total: termTotal,
                currency: sub.currency,
                last4: pm.last4 ?? "",
              },
              data: { subscriptionId: sub.id, updateUrl: `${SITE()}/portal/settings` },
            });
          }
        },
        // A renewal is a state transition: if it throws we must be able to try
        // again rather than silently never charging.
        { releaseOnFailure: true }
      );
    }
  }

  // ── payment recovery ───────────────────────────────────────────────────────
  /**
   * Re-query the PSP for payments stuck mid-settlement.
   *
   * The capture path claims PENDING → AUTHORIZED before calling the provider.
   * If the process died after the provider collected but before we persisted,
   * every retry then hit "already settling" and no-oped FOREVER, and 24h later
   * expireStaleDrafts cancelled the subscription — member charged, no
   * membership, invoice unpaid. Nothing revisited AUTHORIZED payments at all.
   *
   * This sweep is that missing revisit.
   */
  private async reconcileStuckPayments() {
    const cutoff = new Date(Date.now() - STUCK_PAYMENT_MS);
    const stuck = await this.prisma.payment.findMany({
      where: { status: "AUTHORIZED", createdAt: { lte: cutoff } },
      take: BATCH,
      select: {
        id: true,
        provider: true,
        providerRef: true,
        amount: true,
        currency: true,
        order: { select: { id: true, orderNumber: true, subscriptionId: true } },
      },
    });
    if (!stuck.length) return;
    this.logger.warn(`reconciling ${stuck.length} payment(s) stuck in AUTHORIZED`);

    for (const p of stuck) {
      if (!p.providerRef) continue;
      const adapter = this.payments.resolve(p.provider as PaymentProviderKey);
      if (!adapter.capture) continue;
      await this.once(
        `payment_reconcile:${p.id}`,
        "payment_reconcile",
        { subjectId: p.order.id },
        async () => {
          const res = await adapter.capture!(
            p.providerRef!,
            Number(p.amount),
            p.currency,
            p.order.orderNumber
          );
          if (!res.success) {
            this.logger.error(
              `reconcile: capture still failing for ${p.order.orderNumber} — ${res.failureReason ?? "unknown"}`
            );
            return;
          }
          await this.subscriptions.completeCapturedOrder(p.id, res.providerRef ?? p.providerRef!);
          this.logger.log(`reconciled stuck payment for ${p.order.orderNumber}`);
        },
        { releaseOnFailure: true }
      );
    }
  }

  // ── graceful lapse (R064/R068) ─────────────────────────────────────────────
  /** A term that ended (renewed or not) lapses gently: records kept, no guilt. */
  private async gracefulLapse() {
    const now = new Date();
    const subs = await this.prisma.subscription.findMany({
      where: { status: "ACTIVE", endsAt: { lte: now } },
      take: BATCH,
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
      take: BATCH,
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
    // Match the day in SQL rather than pulling every cat into Node.
    //
    // This previously loaded EVERY active cat with a birth date on every hourly
    // pass and compared dates in JS — an OOM on a 512MB instance around 50k
    // cats, and a full table scan long before 10M. EXTRACT against the Riyadh
    // wall clock keeps the semantics identical (a birthday is a local-calendar
    // event, not a UTC instant) while returning only today's handful of rows.
    const { month: todayMonth, day: todayDay } = today;
    const cats = await this.prisma.$queryRaw<
      { id: string; name: string; userId: string; birthDate: Date | null; idIssuedAt: Date | null }[]
    >`
      SELECT id, name, "userId", "birthDate", "idIssuedAt"
      FROM cats
      WHERE status = 'ACTIVE'
        AND "deletedAt" IS NULL
        AND (
          (
            "birthDate" IS NOT NULL
            AND EXTRACT(MONTH FROM ("birthDate" AT TIME ZONE 'Asia/Riyadh')) = ${todayMonth}
            AND EXTRACT(DAY   FROM ("birthDate" AT TIME ZONE 'Asia/Riyadh')) = ${todayDay}
          )
          OR (
            "idIssuedAt" IS NOT NULL
            AND EXTRACT(MONTH FROM ("idIssuedAt" AT TIME ZONE 'Asia/Riyadh')) = ${todayMonth}
            AND EXTRACT(DAY   FROM ("idIssuedAt" AT TIME ZONE 'Asia/Riyadh')) = ${todayDay}
          )
        )
      LIMIT ${BATCH}
    `;
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
      take: BATCH,
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
    fn: () => Promise<void>,
    opts: { releaseOnFailure?: boolean } = {}
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
      this.logger.error(`lifecycle side-effect failed for ${key}: ${String(e)}`);
      // Two different failure semantics, and conflating them was a real bug:
      //
      //   Notifications (default) — keep the claim. Re-running would re-send,
      //   and spamming a member is worse than one missed reminder.
      //
      //   State transitions (releaseOnFailure) — MUST retry. A lapse or renewal
      //   that failed on a connection blip previously kept its claim and was
      //   never revisited, leaving the subscription ACTIVE past endsAt forever.
      if (opts.releaseOnFailure) {
        await this.prisma.lifecycleEvent
          .delete({ where: { key } })
          .catch((err) => this.logger.error(`failed releasing lifecycle claim ${key}: ${String(err)}`));
      }
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
