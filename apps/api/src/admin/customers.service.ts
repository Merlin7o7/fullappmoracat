import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminCustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, search?: string) {
    const where: Prisma.UserWhereInput = {
      isStaff: false,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, email: true, firstName: true, lastName: true, phone: true,
          status: true, createdAt: true,
          _count: { select: { orders: true, subscriptions: true, cats: true } },
        },
      }),
    ]);

    return {
      items: rows.map((u) => ({
        id: u.id,
        email: u.email,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || "—",
        phone: u.phone,
        status: u.status,
        orders: u._count.orders,
        subscriptions: u._count.subscriptions,
        cats: u._count.cats,
        createdAt: u.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async detail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        orders: { orderBy: { placedAt: "desc" }, take: 10 },
        subscriptions: {
          orderBy: { createdAt: "desc" },
          include: {
            plan: { select: { nameEn: true, nameAr: true } },
            cats: { select: { cat: { select: { id: true, name: true } } } },
          },
        },
        cats: {
          where: { deletedAt: null },
          select: {
            id: true, name: true, weightKg: true, isPublic: true, hiddenAt: true,
            catIdNumber: true, membershipStatus: true,
          },
        },
        addresses: {
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          include: { city: { select: { nameEn: true, nameAr: true } } },
        },
        tickets: {
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: { ticketNumber: true, subject: true, status: true, priority: true, updatedAt: true },
        },
        wallet: true,
        loyalty: true,
      },
    });
    if (!user) throw new NotFoundException("Customer not found");

    // Recent money movements across the customer's orders (incl. failures —
    // support needs to see the decline, not just the capture).
    const payments = await this.prisma.payment.findMany({
      where: { order: { userId: id } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true, provider: true, status: true, amount: true, currency: true,
        providerRef: true, createdAt: true,
        order: { select: { orderNumber: true } },
        refunds: { select: { amount: true } },
      },
    });

    return {
      id: user.id,
      memberIdNumber: user.memberIdNumber,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "—",
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      walletBalance: user.wallet ? Number(user.wallet.balance) : 0,
      loyaltyPoints: user.loyalty?.points ?? 0,
      cats: user.cats,
      subscriptions: user.subscriptions.map((s) => ({
        id: s.id,
        status: s.status,
        price: Number(s.price),
        plan: s.plan?.nameEn,
        planAr: s.plan?.nameAr,
        termMonths: s.termMonths,
        endsAt: s.endsAt,
        cancelAtTermEnd: s.cancelAtTermEnd,
        pausedAt: s.pausedAt,
        nextDeliveryAt: s.nextDeliveryAt,
        cats: s.cats.map((c) => c.cat.name),
      })),
      orders: user.orders.map((o) => ({
        orderNumber: o.orderNumber, status: o.status, grandTotal: Number(o.grandTotal), placedAt: o.placedAt,
      })),
      addresses: user.addresses.map((a) => ({
        id: a.id,
        label: a.label,
        recipient: a.recipient,
        phone: a.phone,
        cityEn: a.city.nameEn,
        cityAr: a.city.nameAr,
        district: a.district,
        street: a.street,
        building: a.building,
        apartment: a.apartment,
        isDefault: a.isDefault,
      })),
      tickets: user.tickets,
      payments: payments.map((p) => ({
        id: p.id,
        orderNumber: p.order.orderNumber,
        provider: p.provider,
        status: p.status,
        amount: Number(p.amount),
        currency: p.currency,
        refundedTotal: p.refunds.reduce((sum, r) => sum + Number(r.amount), 0),
        createdAt: p.createdAt,
      })),
    };
  }

  /**
   * Suspend or reactivate a customer — the abuse/safety lever. Suspending also
   * revokes every device session (immediate logout; the JWT strategy re-checks
   * status on each request too) and withdraws their public cats from the
   * community so abusive content disappears at once. Reactivating restores
   * access but leaves cats hidden for a moderator to review individually.
   */
  async setStatus(actorId: string, id: string, action: "suspend" | "reactivate", reason?: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, isStaff: true, status: true },
    });
    if (!target) throw new NotFoundException("Customer not found");
    if (target.isStaff) {
      // Staff accounts aren't managed through the customer surface.
      throw new NotFoundException("Customer not found");
    }
    const status = action === "suspend" ? "SUSPENDED" : "ACTIVE";

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id }, data: { status } }),
      this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: `customer.${action}`,
          entityType: "User",
          entityId: id,
          metadata: { reason: reason ?? null },
        },
      }),
      ...(action === "suspend"
        ? [
            this.prisma.deviceSession.deleteMany({ where: { userId: id } }),
            this.prisma.cat.updateMany({
              where: { userId: id, isPublic: true, hiddenAt: null },
              data: { hiddenAt: new Date(), hiddenReason: "Account suspended" },
            }),
          ]
        : []),
    ]);

    return { id, status };
  }
}
