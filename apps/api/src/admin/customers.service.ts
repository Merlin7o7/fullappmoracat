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
        subscriptions: { include: { plan: { select: { nameEn: true } } } },
        cats: { where: { deletedAt: null }, select: { id: true, name: true, weightKg: true } },
        wallet: true,
        loyalty: true,
      },
    });
    if (!user) throw new NotFoundException("Customer not found");
    return {
      id: user.id,
      email: user.email,
      name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "—",
      phone: user.phone,
      status: user.status,
      createdAt: user.createdAt,
      walletBalance: user.wallet ? Number(user.wallet.balance) : 0,
      loyaltyPoints: user.loyalty?.points ?? 0,
      cats: user.cats,
      subscriptions: user.subscriptions.map((s) => ({
        id: s.id, status: s.status, price: Number(s.price), plan: s.plan?.nameEn,
      })),
      orders: user.orders.map((o) => ({
        orderNumber: o.orderNumber, status: o.status, grandTotal: Number(o.grandTotal), placedAt: o.placedAt,
      })),
    };
  }
}
