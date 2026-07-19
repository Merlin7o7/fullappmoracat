import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import type { ProductType } from "@moraqat/db";
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  paymentReceiptTemplate,
  subscriptionConfirmedTemplate,
  refundRequestedTemplate,
} from "../mail/mail.templates";
import {
  PAYMENT_PROVIDER_FACTORY,
  type IPaymentProviderFactory,
  type PaymentProviderKey,
} from "../payments/payment-provider.interface";
import { commerceEnabled } from "../common/config/features";
import { splitVat, MIN_TERM_MONTHS, TERM_OPTIONS } from "../common/config/pricing";
import type { ActivateSubscriptionDto } from "./dto/subscription.dto";

const INTERVAL_DAYS: Record<string, number> = {
  MONTHLY: 30,
  BIMONTHLY: 60,
  QUARTERLY: 90,
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_PROVIDER_FACTORY) private readonly payments: IPaymentProviderFactory
  ) {}

  /**
   * D3 — activate a membership: charge the first month FIRST, then persist
   * subscription + order + payment + invoice atomically (the same
   * charge-first-then-persist discipline as checkout.service.ts). A membership
   * must never exist without at least an initiated collection.
   *
   * Direct captures activate immediately (R024: receipt + confirmation email).
   * Redirect/PSP-session flows persist the subscription as DRAFT with a PENDING
   * order; the PSP webhook settles the order — the DRAFT flips to ACTIVE on
   * capture reconciliation (see webhooks settle flow).
   */
  async activate(userId: string, dto: ActivateSubscriptionDto) {
    // Kill-switch double-check — defense-in-depth behind the route's @Commercial
    // guard. Money must be unmovable while Community Mode is on.
    if (!commerceEnabled()) {
      throw new ForbiddenException({
        code: "MEMBERSHIPS_COMING_SOON",
        message: "Memberships are launching soon.",
      });
    }

    // Everything the member is committing to must be validated BEFORE we charge.
    const cats = await this.prisma.cat.findMany({
      where: { id: { in: dto.catIds }, userId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true },
    });
    if (cats.length !== dto.catIds.length) {
      throw new BadRequestException("One or more cats were not found");
    }

    // A cat can only be covered once — prevent the double-charge before it
    // exists, never apologise after (R115). DRAFT counts: a redirect flow in
    // flight must not be re-purchasable while the PSP decides.
    const coveringRows = await this.prisma.subscriptionCat.findMany({
      where: {
        catId: { in: dto.catIds },
        subscription: { userId, status: { in: ["ACTIVE", "PAUSED", "DRAFT"] } },
      },
      include: {
        cat: { select: { name: true } },
        subscription: {
          select: {
            id: true,
            status: true,
            endsAt: true,
            cancelAtTermEnd: true,
            orders: {
              orderBy: { placedAt: "desc" },
              take: 1,
              select: { payments: { orderBy: { createdAt: "desc" }, take: 1, select: { metadata: true } } },
            },
          },
        },
      },
    });

    // The new term stacks from here. For a fresh membership it's "now"; for an
    // invited renewal (see below) it's the current term's end — an early renewer
    // must never lose a single prepaid day.
    const now = new Date();
    let termBase = now;

    if (coveringRows.length) {
      // Idempotency + resume (fire #4): a DRAFT is an in-flight redirect the
      // member abandoned, not a wall. Instead of dead-ending them, hand back the
      // existing checkout URL so a second tap resumes payment — never a new
      // session, never a duplicate charge.
      const draft = coveringRows.find((r) => r.subscription.status === "DRAFT");
      if (draft) {
        const meta = draft.subscription.orders[0]?.payments[0]?.metadata as
          | { redirectUrl?: string }
          | null
          | undefined;
        return {
          subscriptionId: draft.subscription.id,
          status: "DRAFT" as const,
          resumed: true,
          redirectUrl: meta?.redirectUrl ?? null,
        };
      }

      // Invited renewal (R025's last mile): the term-end invitations deep-link
      // here at T-7/T-1 — an ACTIVE sub inside the renewal window (or one the
      // member set to won't-renew) must be RENEWABLE, not a wall. The new term
      // stacks from the latest current endsAt, so renewing early costs nothing.
      const RENEWAL_WINDOW_MS = 30 * 86_400_000;
      const renewable = coveringRows.every((r) => {
        const s = r.subscription;
        if (!s.endsAt) return false;
        return s.cancelAtTermEnd || s.endsAt.getTime() - now.getTime() <= RENEWAL_WINDOW_MS;
      });
      if (!renewable) {
        const first = coveringRows[0]!;
        throw new BadRequestException({
          code: "CAT_ALREADY_COVERED",
          message: `${first.cat.name} already has a membership — manage it from your subscriptions page.`,
        });
      }
      const latestEnd = Math.max(...coveringRows.map((r) => r.subscription.endsAt!.getTime()));
      termBase = new Date(Math.max(latestEnd, now.getTime()));
    }

    const plan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, isActive: true },
      include: { contents: true },
    });
    if (!plan) throw new BadRequestException("Plan not found");

    // Resolve the member's brand/flavor picks (or fall back to each line's
    // recommended default) BEFORE charging — an invalid choice must fail the
    // box, never the payment (R115). Flat pricing: choices don't change the total.
    const boxItems = await this.resolveBoxSelections(plan.contents, dto.selections);

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
      select: { id: true },
    });
    if (!address) throw new BadRequestException("Address does not belong to you");

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, phone: true, locale: true },
    });

    // Term commitment: the member commits to a minimum of `minTerm` months and
    // pays the FULL term upfront (Tamara collects; delivered monthly across the
    // term). This is how recurring works without card tokenization.
    const monthlyPrice = round(Number(plan.basePrice));
    const minTerm = Math.max(MIN_TERM_MONTHS, plan.minTermMonths ?? MIN_TERM_MONTHS);
    const termMonths = dto.termMonths ?? minTerm;
    if (!(TERM_OPTIONS as readonly number[]).includes(termMonths) || termMonths < minTerm) {
      throw new BadRequestException({
        code: "INVALID_TERM",
        message: `Choose a term of ${TERM_OPTIONS.filter((t) => t >= minTerm).join(", ")} months (minimum ${minTerm}).`,
      });
    }
    // The exact number the member pays now = monthly price × committed months.
    // splitVat honours the VAT toggle (currently 0% → tax 0, net == gross).
    const grandTotal = round(monthlyPrice * termMonths);
    const { net: netSubtotal, tax: taxTotal } = splitVat(grandTotal);
    const orderNumber = makeNumber("MRQ");

    // 1) Charge (or open a PSP session) first — never persist a membership we
    //    didn't at least initiate collection for.
    const adapter = this.payments.resolve(dto.provider as PaymentProviderKey);
    const charge = await adapter.charge({
      amount: grandTotal,
      currency: plan.currency,
      provider: dto.provider as PaymentProviderKey,
      reference: orderNumber,
      description: `Moracat membership — ${plan.nameEn}`,
      customer: {
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined,
        phone: user.phone ?? undefined,
      },
      // The PSP sends the member back to the activation ceremony, which polls
      // the order until the webhook settles and then reveals the active Cat ID.
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal/checkout/return?ref=${orderNumber}`,
    });

    if (!charge.success) {
      throw new HttpException(
        charge.failureReason ?? "Payment failed",
        HttpStatus.PAYMENT_REQUIRED
      );
    }

    const isPending = charge.status === "PENDING" || charge.status === "AUTHORIZED";
    const isRenewal = termBase.getTime() > now.getTime();
    // The committed term is paid upfront, so the NEXT charge (renewal) is due
    // when the term ends, not next month. Deliveries stay monthly. For an
    // invited renewal, everything stacks from the CURRENT term's end (termBase)
    // so an early renewer keeps every day already paid for.
    const termEnd = addMonths(termBase, termMonths);
    const firstDelivery = addMonths(termBase, 1);

    // 2) Persist subscription + first order + payment + invoice atomically.
    const sub = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          addressId: dto.addressId,
          status: isPending ? "DRAFT" : "ACTIVE",
          interval: "MONTHLY",
          price: new Prisma.Decimal(monthlyPrice), // monthly rate snapshot
          termMonths,
          endsAt: isPending ? null : termEnd,
          // A pending RENEWAL stores its future base here so the webhook can
          // stack the term from the current term's end, not from settle-time.
          startedAt: isPending ? (isRenewal ? termBase : null) : termBase,
          // Renewal is due at term end (whole term prepaid); deliveries monthly.
          nextBillingAt: isPending ? null : termEnd,
          nextDeliveryAt: isPending ? null : firstDelivery,
          cats: { create: dto.catIds.map((catId) => ({ catId })) },
          // The member's chosen brands/flavors, recorded on the subscription so
          // the box ships what they picked (flat pricing → unitPrice 0).
          items: boxItems.length
            ? {
                create: boxItems.map((b) => ({
                  productId: b.productId,
                  quantity: b.quantity,
                  unitPrice: new Prisma.Decimal(0),
                  planContentId: b.planContentId,
                })),
              }
            : undefined,
          events: {
            create: {
              type: isPending ? "activation_pending" : "activated",
              metadata: { orderNumber, provider: dto.provider, termMonths, grandTotal },
            },
          },
        },
      });

      await tx.order.create({
        data: {
          orderNumber,
          userId,
          subscriptionId: created.id,
          addressId: dto.addressId,
          source: "SUBSCRIPTION",
          status: isPending ? "PENDING" : "CONFIRMED",
          subtotal: new Prisma.Decimal(grandTotal),
          taxTotal: new Prisma.Decimal(taxTotal),
          grandTotal: new Prisma.Decimal(grandTotal),
          currency: plan.currency,
          payments: {
            create: {
              provider: dto.provider as PaymentProviderKey,
              status: isPending ? "PENDING" : "CAPTURED",
              amount: new Prisma.Decimal(grandTotal),
              currency: plan.currency,
              providerRef: charge.providerRef,
              capturedAt: isPending ? null : new Date(),
              // Persist the hosted checkout URL so an abandoned redirect can be
              // resumed (fire #4) — an in-flight payment is never a dead end.
              metadata: charge.redirectUrl ? { redirectUrl: charge.redirectUrl } : undefined,
            },
          },
          invoice: {
            create: {
              invoiceNumber: makeNumber("INV"),
              userId,
              status: isPending ? "ISSUED" : "PAID",
              subtotal: new Prisma.Decimal(netSubtotal),
              taxTotal: new Prisma.Decimal(taxTotal),
              grandTotal: new Prisma.Decimal(grandTotal),
              paidAt: isPending ? null : new Date(),
            },
          },
        },
      });

      return created;
    });

    if (!isPending) {
      // Membership goes live for the covered cats the moment payment captures.
      await this.syncCatsMembership(dto.catIds);

      this.notifications.emit(userId, {
        category: "ORDER",
        type: "order_confirmed",
        params: { orderNumber, total: grandTotal, currency: plan.currency },
        data: { orderNumber },
      });

      // Receipt lands instantly (R024), plus the warm "your membership is
      // active" confirmation the checkout page promises.
      if (user.email) {
        const loc = user.locale === "en" ? "en" : "ar";
        const planName = loc === "ar" ? plan.nameAr : plan.nameEn;
        const nextAt = termEnd.toLocaleDateString(loc === "ar" ? "ar-SA" : "en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        const conf = subscriptionConfirmedTemplate(loc, user.firstName, planName, nextAt);
        const rcpt = paymentReceiptTemplate(loc, user.firstName, orderNumber, grandTotal, taxTotal, dto.provider);
        void this.mail.send({ to: user.email, subject: conf.subject, html: conf.html, text: conf.text });
        void this.mail.send({ to: user.email, subject: rcpt.subject, html: rcpt.html, text: rcpt.text });
      }
    } else {
      this.notifications.emit(userId, {
        category: "ORDER",
        type: "order_pending",
        params: { orderNumber, total: grandTotal, currency: plan.currency },
        data: { orderNumber },
      });
    }

    return {
      subscriptionId: sub.id,
      status: sub.status,
      orderNumber,
      grandTotal,
      taxTotal,
      monthlyPrice,
      termMonths,
      currency: plan.currency,
      nextBillingAt: isPending ? null : termEnd.toISOString(),
      // Redirect flows: the client sends the member here to complete payment.
      redirectUrl: charge.redirectUrl ?? null,
      payment: { provider: dto.provider, status: isPending ? "PENDING" : "CAPTURED" },
      plan: { tier: plan.tier, nameEn: plan.nameEn, nameAr: plan.nameAr },
      cats: cats.map((c) => ({ id: c.id, name: c.name })),
    };
  }

  /**
   * The PSP-return ceremony polls this until settlement resolves. A redirect
   * flow lands here PENDING; the webhook then flips it to `active` (membership
   * live) or `failed` (payment declined / capture failed). Scoped to the member
   * so one member can never read another's order.
   */
  async getActivationStatus(userId: string, orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      select: {
        orderNumber: true,
        status: true,
        grandTotal: true,
        taxTotal: true,
        currency: true,
        subscription: {
          select: {
            id: true,
            status: true,
            nextBillingAt: true,
            plan: { select: { tier: true, nameEn: true, nameAr: true } },
            cats: { select: { cat: { select: { id: true, name: true } } } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException("Order not found");

    const sub = order.subscription;
    const state: "active" | "failed" | "pending" =
      sub?.status === "ACTIVE"
        ? "active"
        : order.status === "FAILED" || sub?.status === "CANCELLED"
          ? "failed"
          : "pending";

    return {
      orderNumber: order.orderNumber,
      state,
      grandTotal: Number(order.grandTotal),
      taxTotal: Number(order.taxTotal),
      currency: order.currency,
      nextBillingAt: sub?.nextBillingAt?.toISOString() ?? null,
      plan: sub?.plan ?? null,
      cats: sub?.cats.map((c) => ({ id: c.cat.id, name: c.cat.name })) ?? [],
    };
  }

  async findAll(userId: string) {
    const subs = await this.prisma.subscription.findMany({
      where: { userId },
      include: subInclude,
      orderBy: { createdAt: "desc" },
    });
    return subs.map((s) => this.serialize(s));
  }

  async findOne(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    return this.serialize(sub);
  }

  /**
   * Pause (R062) — the member paid for this term, so pausing NEVER strips the
   * benefit they already own: the Cat ID stays ACTIVE. We only record when the
   * pause began; resume() gives back every paused day by extending the term.
   */
  async pause(userId: string, id: string, until?: string) {
    const sub = await this.owned(userId, id);
    if (sub.status === "PAUSED") throw new BadRequestException({ code: "ALREADY_PAUSED", message: "This membership is already paused." });
    if (sub.status !== "ACTIVE") throw new BadRequestException({ code: "NOT_ACTIVE", message: "Only active memberships can be paused." });
    await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "PAUSED",
        pausedAt: new Date(),
        pausedUntil: until ? new Date(until) : null,
        events: { create: { type: "paused", metadata: { until: until ?? null } } },
      },
    });
    // Deliberately DO NOT deactivate the cats — paid benefit is theirs while
    // paused (R062). The Cat ID stays active; only deliveries pause.
    return this.serialize(await this.reload(id));
  }

  /**
   * Resume — give the paused days back. endsAt and the next delivery both slide
   * forward by exactly the paused duration, so no prepaid month is ever lost.
   */
  async resume(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    if (sub.status !== "PAUSED") throw new BadRequestException({ code: "NOT_PAUSED", message: "Only paused memberships can be resumed." });
    const now = new Date();
    const pausedMs = sub.pausedAt ? now.getTime() - sub.pausedAt.getTime() : 0;
    const pausedDays = Math.max(0, Math.round(pausedMs / 86_400_000));
    // Slide the term end and the next delivery forward by the paused duration.
    const newEndsAt = sub.endsAt ? addDays(sub.endsAt, pausedDays) : null;
    const nextDelivery = addDays(now, this.resolveIntervalDays(sub.interval, sub.intervalDays));
    await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "ACTIVE",
        pausedAt: null,
        pausedUntil: null,
        endsAt: newEndsAt,
        // Renewal is still due at (the now-extended) term end — never "+30 days".
        nextBillingAt: newEndsAt,
        nextDeliveryAt: nextDelivery,
        events: { create: { type: "resumed", metadata: { pausedDays } } },
      },
    });
    await this.syncCatsMembership(sub.cats.map((c) => c.cat.id));
    return this.serialize(await this.reload(id));
  }

  /**
   * Skip the next delivery only. On a prepaid term this moves the DELIVERY date
   * forward — never the renewal/billing date (which is fixed at term end).
   */
  async skip(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    if (sub.status !== "ACTIVE") throw new BadRequestException({ code: "NOT_ACTIVE", message: "Only active memberships can skip a delivery." });
    const days = this.resolveIntervalDays(sub.interval, sub.intervalDays);
    const base = sub.nextDeliveryAt ?? new Date();
    const next = addDays(base, days);
    await this.prisma.subscription.update({
      where: { id },
      data: {
        // Only the delivery moves; nextBillingAt (term end) is untouched.
        nextDeliveryAt: next,
        events: { create: { type: "skipped", metadata: { skippedTo: next.toISOString() } } },
      },
    });
    return this.serialize(await this.reload(id));
  }

  /**
   * Honest cancel (R063/R064) — never confiscates a prepaid term. If the member
   * still has time on the clock, cancelling simply means "don't renew": the
   * subscription keeps servicing (Cat ID active, boxes arriving) until endsAt,
   * where the lifecycle job lapses it gracefully. Only a term with nothing left
   * to serve cancels immediately.
   */
  async cancel(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    if (sub.status === "CANCELLED" || sub.status === "EXPIRED") {
      throw new BadRequestException({ code: "ALREADY_CANCELLED", message: "This membership is already cancelled." });
    }
    const now = new Date();
    const hasRemainingTerm = sub.endsAt != null && sub.endsAt.getTime() > now.getTime();

    if (hasRemainingTerm) {
      // "Won't renew" — keep everything the member paid for until the term ends.
      await this.prisma.subscription.update({
        where: { id },
        data: {
          cancelAtTermEnd: true,
          events: { create: { type: "cancel_scheduled", metadata: { endsAt: sub.endsAt?.toISOString() } } },
        },
      });
      return this.serialize(await this.reload(id));
    }

    // No paid term remaining → cancel now and lapse the benefit.
    await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        events: { create: { type: "cancelled" } },
      },
    });
    await this.syncCatsMembership(sub.cats.map((c) => c.cat.id));
    return this.serialize(await this.reload(id));
  }

  /**
   * Resume an abandoned redirect payment (fire #4). Returns the stored hosted
   * checkout URL so the member can complete a DRAFT membership instead of being
   * locked out of their own cat.
   */
  async resumePayment(userId: string, id: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, userId },
      select: {
        status: true,
        orders: {
          orderBy: { placedAt: "desc" },
          take: 1,
          select: { orderNumber: true, payments: { orderBy: { createdAt: "desc" }, take: 1, select: { metadata: true } } },
        },
      },
    });
    if (!sub) throw new NotFoundException({ code: "SUBSCRIPTION_NOT_FOUND", message: "Subscription not found." });
    if (sub.status !== "DRAFT") {
      throw new BadRequestException({ code: "NOT_RESUMABLE", message: "This membership isn't awaiting payment." });
    }
    const meta = sub.orders[0]?.payments[0]?.metadata as { redirectUrl?: string } | null | undefined;
    if (!meta?.redirectUrl) {
      // The stored session is gone/stale — tell the UI to start a fresh checkout.
      throw new BadRequestException({ code: "DRAFT_EXPIRED", message: "This payment session expired — start a fresh checkout." });
    }
    return { redirectUrl: meta.redirectUrl, orderNumber: sub.orders[0]?.orderNumber ?? null };
  }

  /**
   * Member-initiated remainder refund request (R030) — raising a refund must
   * feel safe. Records the request, acknowledges the member instantly, and
   * flags it for the care team. Idempotent: a second request is a no-op ack.
   */
  async requestRefund(userId: string, id: string, reason?: string) {
    const sub = await this.owned(userId, id);
    // Targeted lookup, not the serializer's capped recent-events window — a
    // busy subscription must never "forget" a refund request and allow a dupe.
    const already = await this.prisma.subscriptionEvent.findFirst({
      where: { subscriptionId: id, type: "refund_requested" },
      select: { id: true },
    });
    if (already) {
      throw new BadRequestException({ code: "REFUND_ALREADY_REQUESTED", message: "We've already received a refund request for this membership." });
    }
    await this.prisma.subscription.update({
      where: { id },
      data: { events: { create: { type: "refund_requested", metadata: { reason: reason ?? null, at: new Date().toISOString() } } } },
    });

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, firstName: true, locale: true },
    });
    const loc = user.locale === "en" ? "en" : "ar";
    const planName = loc === "ar" ? sub.plan?.nameAr : sub.plan?.nameEn;

    this.notifications.emit(userId, {
      category: "BILLING",
      type: "refund_requested",
      data: { subscriptionId: id },
    });
    if (user.email) {
      const mail = refundRequestedTemplate(loc, user.firstName, planName ?? "Moracat");
      void this.mail.send({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });
    }
    // Surface to staff so the care team can action it (they resolve via the
    // admin refund tooling). Best-effort — never blocks the member's ack.
    void this.notifyStaffOfRefund(id, user.firstName ?? user.email, reason);

    return { ok: true, status: "requested" as const };
  }

  /** Notify staff of a refund request so the care team can action it. */
  private async notifyStaffOfRefund(subscriptionId: string, who: string, reason?: string) {
    try {
      const staff = await this.prisma.user.findMany({
        where: { isStaff: true },
        select: { id: true },
        take: 25,
      });
      for (const s of staff) {
        this.notifications.emit(s.id, {
          category: "SYSTEM",
          // Staff-voiced type — "Member X requested a refund", never the
          // member's own acknowledgement copy in a staff inbox.
          type: "refund_requested_staff",
          params: { who, reason: reason ?? "" },
          data: { subscriptionId, adminLink: `/admin/customers` },
        });
      }
    } catch {
      /* best-effort staff ping — the member ack is what matters */
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  /**
   * Recompute membership for the given cats (#9): a cat's membership is ACTIVE
   * iff it's covered by at least one ACTIVE subscription; otherwise INACTIVE.
   * The Cat ID itself never changes — only the membership status gates.
   */
  private async syncCatsMembership(catIds: string[]) {
    for (const catId of catIds) {
      const activeCount = await this.prisma.subscriptionCat.count({
        where: { catId, subscription: { status: "ACTIVE" } },
      });
      await this.prisma.cat.updateMany({
        where: { id: catId, status: "ACTIVE" },
        data: { membershipStatus: activeCount > 0 ? "ACTIVE" : "INACTIVE" },
      });
    }
  }

  /**
   * Turn the member's box-builder picks into concrete SubscriptionItems,
   * validated against the plan's choosable lines. A line with no explicit pick
   * falls back to its recommended default, so the box is always complete.
   * Invalid picks (foreign line, wrong product type, unavailable product) are
   * rejected up front — the box fails, never the payment (R115).
   */
  private async resolveBoxSelections(
    contents: {
      id: string;
      productId: string | null;
      selectableType: ProductType | null;
      quantity: number;
    }[],
    selections?: { contentId: string; productId: string }[]
  ): Promise<{ productId: string; quantity: number; planContentId: string }[]> {
    const selectable = contents.filter((c) => c.selectableType);
    if (!selectable.length) return [];
    const byId = new Map(selectable.map((c) => [c.id, c]));
    const chosen = new Map<string, string>(); // contentId -> productId

    const sels = selections ?? [];
    if (sels.length) {
      const ids = [...new Set(sels.map((s) => s.productId))];
      const prods = await this.prisma.product.findMany({
        where: { id: { in: ids }, isActive: true, isSubscribable: true, deletedAt: null },
        select: { id: true, type: true },
      });
      const prodById = new Map(prods.map((p) => [p.id, p]));
      for (const s of sels) {
        const content = byId.get(s.contentId);
        if (!content) {
          throw new BadRequestException({
            code: "INVALID_SELECTION",
            message: "A chosen item doesn't belong to this plan.",
          });
        }
        const prod = prodById.get(s.productId);
        if (!prod || prod.type !== content.selectableType) {
          throw new BadRequestException({
            code: "INVALID_SELECTION",
            message: "A chosen brand or flavor isn't available for that item.",
          });
        }
        chosen.set(content.id, s.productId);
      }
    }

    const items: { productId: string; quantity: number; planContentId: string }[] = [];
    for (const c of selectable) {
      const productId = chosen.get(c.id) ?? c.productId ?? undefined;
      if (productId) {
        items.push({ productId, quantity: Math.max(1, Math.round(c.quantity)), planContentId: c.id });
      }
    }
    return items;
  }

  private resolveIntervalDays(interval: string, custom?: number | null): number {
    if (interval === "CUSTOM") {
      if (!custom) throw new BadRequestException("intervalDays is required for CUSTOM interval");
      return custom;
    }
    return INTERVAL_DAYS[interval] ?? 30;
  }

  private async owned(userId: string, id: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id, userId },
      include: subInclude,
    });
    if (!sub) throw new NotFoundException("Subscription not found");
    return sub;
  }

  private reload(id: string) {
    return this.prisma.subscription.findUniqueOrThrow({ where: { id }, include: subInclude });
  }

  private serialize(sub: SubWithIncludes) {
    const termMonths = sub.termMonths ?? 0;
    // Boxes remaining count FORWARD from endsAt (months still to serve), not
    // from startedAt — pause extends endsAt, and a paused member must never see
    // their remaining boxes shrink under copy that says "your days are saved"
    // (R062). Fallback to elapsed-from-start only when endsAt is unset (DRAFT).
    const now = new Date();
    const boxesRemaining = sub.endsAt
      ? Math.min(termMonths, Math.max(0, monthsBetween(now, sub.endsAt) + (hasPartialMonth(now, sub.endsAt) ? 1 : 0)))
      : sub.startedAt
        ? Math.max(0, termMonths - Math.min(monthsBetween(sub.startedAt, now), termMonths))
        : termMonths;
    const monthsElapsed = Math.max(0, termMonths - boxesRemaining);
    const resumeUrl =
      sub.status === "DRAFT"
        ? ((sub.orders[0]?.payments[0]?.metadata as { redirectUrl?: string } | null | undefined)?.redirectUrl ?? null)
        : null;

    return {
      id: sub.id,
      status: sub.status,
      interval: sub.interval,
      intervalDays: sub.intervalDays,
      price: Number(sub.price), // monthly rate
      termMonths,
      endsAt: sub.endsAt,
      termTotal: Number(sub.price) * termMonths,
      // Term economics the manage page must show truthfully (fire, R021 post-purchase).
      boxesRemaining,
      monthsElapsed,
      currency: sub.currency,
      isGift: sub.isGift,
      startedAt: sub.startedAt,
      nextBillingAt: sub.nextBillingAt,
      nextDeliveryAt: sub.nextDeliveryAt,
      pausedUntil: sub.pausedUntil,
      pausedAt: sub.pausedAt,
      // "Won't renew" state (honest cancel): still servicing until endsAt.
      cancelAtTermEnd: sub.cancelAtTermEnd,
      refundRequested: sub.events.some((e) => e.type === "refund_requested"),
      // For a DRAFT (abandoned redirect), the URL that resumes payment.
      resumeUrl,
      plan: sub.plan ? { tier: sub.plan.tier, nameEn: sub.plan.nameEn, nameAr: sub.plan.nameAr } : null,
      cats: sub.cats.map((c) => ({ id: c.cat.id, name: c.cat.name })),
      items: sub.items.map((i) => ({
        productId: i.productId,
        nameEn: i.product.nameEn,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
      recentEvents: sub.events.slice(0, 5).map((e) => ({ type: e.type, at: e.createdAt })),
    };
  }
}

const subInclude = {
  plan: true,
  cats: { include: { cat: { select: { id: true, name: true } } } },
  items: { include: { product: { select: { nameEn: true } } } },
  events: { orderBy: { createdAt: "desc" as const }, take: 10 },
  // Latest order's latest payment carries the resume URL for DRAFT memberships.
  orders: {
    orderBy: { placedAt: "desc" as const },
    take: 1,
    select: { payments: { orderBy: { createdAt: "desc" as const }, take: 1, select: { metadata: true } } },
  },
} satisfies Prisma.SubscriptionInclude;

type SubWithIncludes = Prisma.SubscriptionGetPayload<{ include: typeof subInclude }>;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** One calendar month ahead, clamped to the last day of shorter months. */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Jan 31 + 1mo must be Feb 28/29 — never a silent roll into March (R021).
  if (d.getDate() < day) d.setDate(0);
  return d;
}

/** True when b sits past a whole-month boundary from a (a partial month remains). */
function hasPartialMonth(a: Date, b: Date): boolean {
  if (b.getTime() <= a.getTime()) return false;
  const whole = monthsBetween(a, b);
  const atWhole = new Date(a);
  atWhole.setMonth(atWhole.getMonth() + whole);
  if (atWhole.getDate() < a.getDate()) atWhole.setDate(0); // month-end clamp
  return b.getTime() > atWhole.getTime();
}

/** Whole calendar months between two dates (a ≤ b). */
function monthsBetween(a: Date, b: Date): number {
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) months -= 1; // not a full month yet
  return Math.max(0, months);
}

function makeNumber(prefix: string): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

const round = (n: number) => Math.round(n * 100) / 100;
