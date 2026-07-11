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
import { randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { NotificationsService } from "../notifications/notifications.service";
import {
  paymentReceiptTemplate,
  subscriptionConfirmedTemplate,
} from "../mail/mail.templates";
import {
  PAYMENT_PROVIDER_FACTORY,
  type IPaymentProviderFactory,
  type PaymentProviderKey,
} from "../payments/payment-provider.interface";
import { commerceEnabled } from "../common/config/features";
import type { ActivateSubscriptionDto, CreateSubscriptionDto } from "./dto/subscription.dto";

const INTERVAL_DAYS: Record<string, number> = {
  MONTHLY: 30,
  BIMONTHLY: 60,
  QUARTERLY: 90,
};

/** KSA standard VAT — prices are VAT-inclusive; the invoice breaks it out. */
const VAT_RATE = 0.15;

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly notifications: NotificationsService,
    @Inject(PAYMENT_PROVIDER_FACTORY) private readonly payments: IPaymentProviderFactory
  ) {}

  async create(userId: string, dto: CreateSubscriptionDto) {
    // Community Mode: paid activation is disabled. Membership must never flip to
    // ACTIVE without a captured payment, so subscription creation is refused
    // outright until commerce goes live. (Defense-in-depth behind @Commercial.)
    if (!commerceEnabled()) {
      throw new ForbiddenException({
        code: "MEMBERSHIPS_COMING_SOON",
        message: "Memberships are launching soon.",
      });
    }

    // Validate cats belong to the user.
    const cats = await this.prisma.cat.findMany({
      where: { id: { in: dto.catIds }, userId, deletedAt: null },
      select: { id: true },
    });
    if (cats.length !== dto.catIds.length) {
      throw new BadRequestException("One or more cats were not found");
    }

    const intervalDays = this.resolveIntervalDays(dto.interval, dto.intervalDays);

    // Price = plan base + à-la-carte items.
    let price = 0;
    let plan = null;
    if (dto.planId) {
      plan = await this.prisma.plan.findFirst({ where: { id: dto.planId, isActive: true } });
      if (!plan) throw new BadRequestException("Plan not found");
      price += Number(plan.basePrice);
    }

    const items = dto.items ?? [];
    if (items.length) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: items.map((i) => i.productId) }, isActive: true, deletedAt: null },
      });
      const priceById = new Map(products.map((p) => [p.id, Number(p.price)]));
      for (const it of items) {
        const unit = priceById.get(it.productId);
        if (unit === undefined) throw new BadRequestException(`Product ${it.productId} unavailable`);
        price += unit * it.quantity;
      }
    }

    if (!dto.planId && items.length === 0) {
      throw new BadRequestException("A subscription needs a plan or at least one item");
    }

    const now = new Date();
    const next = addDays(now, intervalDays);

    const sub = await this.prisma.subscription.create({
      data: {
        userId,
        planId: dto.planId,
        addressId: dto.addressId,
        status: "ACTIVE",
        interval: dto.interval,
        intervalDays: dto.interval === "CUSTOM" ? intervalDays : null,
        price: new Prisma.Decimal(round(price)),
        isGift: dto.isGift ?? false,
        giftRecipient: dto.giftRecipient,
        startedAt: now,
        nextBillingAt: next,
        nextDeliveryAt: next,
        cats: { create: dto.catIds.map((catId) => ({ catId })) },
        items: items.length
          ? {
              create: items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unitPrice: new Prisma.Decimal(0), // snapshot set below
              })),
            }
          : undefined,
        events: { create: { type: "created", metadata: { intervalDays } } },
      },
      include: subInclude,
    });

    // Snapshot item prices (kept simple & explicit).
    for (const it of items) {
      const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
      if (product) {
        await this.prisma.subscriptionItem.updateMany({
          where: { subscriptionId: sub.id, productId: it.productId },
          data: { unitPrice: product.price },
        });
      }
    }

    // Activate membership for the covered cats (#9).
    await this.syncCatsMembership(dto.catIds);

    // Welcome to the plan — membership is the moment value goes live (R041).
    const buyer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, firstName: true, locale: true },
    });
    if (buyer?.email && sub.plan) {
      const loc = buyer.locale === "en" ? "en" : "ar";
      const planName = loc === "ar" ? sub.plan.nameAr : sub.plan.nameEn;
      const nextAt = next.toLocaleDateString(loc === "ar" ? "ar-SA" : "en-GB", { day: "numeric", month: "long", year: "numeric" });
      const tpl = subscriptionConfirmedTemplate(loc, buyer.firstName, planName, nextAt);
      void this.mail.send({ to: buyer.email, subject: tpl.subject, html: tpl.html, text: tpl.text });
    }

    return this.serialize(await this.reload(sub.id));
  }

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
    const alreadyCovered = await this.prisma.subscriptionCat.findFirst({
      where: {
        catId: { in: dto.catIds },
        subscription: { userId, status: { in: ["ACTIVE", "PAUSED", "DRAFT"] } },
      },
      include: { cat: { select: { name: true } } },
    });
    if (alreadyCovered) {
      throw new BadRequestException({
        code: "CAT_ALREADY_COVERED",
        message: `${alreadyCovered.cat.name} already has a membership — manage it from your subscriptions page.`,
      });
    }

    const plan = await this.prisma.plan.findFirst({
      where: { id: dto.planId, isActive: true },
    });
    if (!plan) throw new BadRequestException("Plan not found");

    const address = await this.prisma.address.findFirst({
      where: { id: dto.addressId, userId },
      select: { id: true },
    });
    if (!address) throw new BadRequestException("Address does not belong to you");

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, firstName: true, lastName: true, phone: true, locale: true },
    });

    // The exact number the member saw on the commitment line (R021):
    // VAT-inclusive plan price; the invoice breaks the 15% out.
    const grandTotal = round(Number(plan.basePrice));
    const netSubtotal = round(grandTotal / (1 + VAT_RATE));
    const taxTotal = round(grandTotal - netSubtotal);
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
      returnUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/portal/subscriptions`,
    });

    if (!charge.success) {
      throw new HttpException(
        charge.failureReason ?? "Payment failed",
        HttpStatus.PAYMENT_REQUIRED
      );
    }

    const isPending = charge.status === "PENDING" || charge.status === "AUTHORIZED";
    const now = new Date();
    // First renewal exactly one month from today — the date the member was
    // shown before paying is the date we bill (R021/R025).
    const next = addMonths(now, 1);

    // 2) Persist subscription + first order + payment + invoice atomically.
    const sub = await this.prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          userId,
          planId: plan.id,
          addressId: dto.addressId,
          status: isPending ? "DRAFT" : "ACTIVE",
          interval: "MONTHLY",
          price: new Prisma.Decimal(grandTotal),
          startedAt: isPending ? null : now,
          nextBillingAt: isPending ? null : next,
          nextDeliveryAt: isPending ? null : next,
          cats: { create: dto.catIds.map((catId) => ({ catId })) },
          events: {
            create: {
              type: isPending ? "activation_pending" : "activated",
              metadata: { orderNumber, provider: dto.provider },
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
        const nextAt = next.toLocaleDateString(loc === "ar" ? "ar-SA" : "en-GB", {
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
      currency: plan.currency,
      nextBillingAt: isPending ? null : next.toISOString(),
      // Redirect flows: the client sends the member here to complete payment.
      redirectUrl: charge.redirectUrl ?? null,
      payment: { provider: dto.provider, status: isPending ? "PENDING" : "CAPTURED" },
      plan: { tier: plan.tier, nameEn: plan.nameEn, nameAr: plan.nameAr },
      cats: cats.map((c) => ({ id: c.id, name: c.name })),
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

  async pause(userId: string, id: string, until?: string) {
    const sub = await this.owned(userId, id);
    if (sub.status !== "ACTIVE") throw new BadRequestException("Only active subscriptions can be paused");
    await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "PAUSED",
        pausedUntil: until ? new Date(until) : null,
        events: { create: { type: "paused", metadata: { until: until ?? null } } },
      },
    });
    await this.syncCatsMembership(sub.cats.map((c) => c.cat.id));
    return this.serialize(await this.reload(id));
  }

  async resume(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    if (sub.status !== "PAUSED") throw new BadRequestException("Only paused subscriptions can be resumed");
    const next = addDays(new Date(), this.resolveIntervalDays(sub.interval, sub.intervalDays));
    await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "ACTIVE",
        pausedUntil: null,
        nextBillingAt: next,
        nextDeliveryAt: next,
        events: { create: { type: "resumed" } },
      },
    });
    await this.syncCatsMembership(sub.cats.map((c) => c.cat.id));
    return this.serialize(await this.reload(id));
  }

  async skip(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    if (sub.status !== "ACTIVE") throw new BadRequestException("Only active subscriptions can skip");
    const days = this.resolveIntervalDays(sub.interval, sub.intervalDays);
    const base = sub.nextBillingAt ?? new Date();
    const next = addDays(base, days);
    await this.prisma.subscription.update({
      where: { id },
      data: {
        nextBillingAt: next,
        nextDeliveryAt: next,
        events: { create: { type: "skipped", metadata: { skippedTo: next.toISOString() } } },
      },
    });
    return this.serialize(await this.reload(id));
  }

  async cancel(userId: string, id: string) {
    const sub = await this.owned(userId, id);
    if (sub.status === "CANCELLED") throw new BadRequestException("Already cancelled");
    await this.prisma.subscription.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        events: { create: { type: "cancelled" } },
      },
    });
    await this.syncCatsMembership(sub.cats.map((c) => c.cat.id));
    return this.serialize(await this.reload(id));
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
    return {
      id: sub.id,
      status: sub.status,
      interval: sub.interval,
      intervalDays: sub.intervalDays,
      price: Number(sub.price),
      currency: sub.currency,
      isGift: sub.isGift,
      startedAt: sub.startedAt,
      nextBillingAt: sub.nextBillingAt,
      nextDeliveryAt: sub.nextDeliveryAt,
      pausedUntil: sub.pausedUntil,
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
  events: { orderBy: { createdAt: "desc" as const }, take: 5 },
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

function makeNumber(prefix: string): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${prefix}-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

const round = (n: number) => Math.round(n * 100) / 100;
