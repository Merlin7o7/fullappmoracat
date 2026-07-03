import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";

const ORDER_STATUSES = [
  "PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "FAILED",
] as const;

@Injectable()
export class AdminOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, limit = 20, status?: string) {
    const where: Prisma.OrderWhereInput = status ? { status: status as never } : {};
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          user: { select: { email: true, firstName: true, lastName: true } },
          items: { select: { id: true } },
        },
      }),
    ]);
    return {
      items: rows.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        source: o.source,
        grandTotal: Number(o.grandTotal),
        currency: o.currency,
        itemCount: o.items.length,
        customer: [o.user.firstName, o.user.lastName].filter(Boolean).join(" ") || o.user.email,
        placedAt: o.placedAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateStatus(actorId: string, orderNumber: string, status: string) {
    if (!ORDER_STATUSES.includes(status as never)) {
      throw new BadRequestException("Invalid order status");
    }
    const order = await this.prisma.order.findUnique({ where: { orderNumber } });
    if (!order) throw new NotFoundException("Order not found");

    const updated = await this.prisma.order.update({
      where: { orderNumber },
      data: { status: status as never },
    });
    await this.prisma.auditLog.create({
      data: {
        userId: actorId,
        action: "order.status_update",
        entityType: "Order",
        entityId: order.id,
        metadata: { from: order.status, to: status },
      },
    });
    return { orderNumber: updated.orderNumber, status: updated.status };
  }
}
