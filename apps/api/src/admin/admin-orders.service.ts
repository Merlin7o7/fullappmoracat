import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";

const ORDER_STATUSES = [
  "PENDING", "CONFIRMED", "PROCESSING", "PACKED", "SHIPPED",
  "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "RETURNED", "FAILED",
] as const;

/**
 * Sensible forward transitions per status. Mirrored client-side in the orders
 * UI; enforced here so no tool can teleport a DELIVERED order back to PENDING.
 * Terminal states (CANCELLED / RETURNED) have no exits — money movements out of
 * them go through the refund flow, never a status dropdown.
 */
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "FAILED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED", "FAILED"],
  OUT_FOR_DELIVERY: ["DELIVERED", "FAILED"],
  DELIVERED: ["RETURNED"],
  CANCELLED: [],
  RETURNED: [],
  FAILED: ["CONFIRMED", "CANCELLED"],
};

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
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
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
        customerId: o.user.id,
        placedAt: o.placedAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * The full order file for support: items (incl. the member's box picks),
   * payments with refund history + what's still refundable, VAT breakdown,
   * delivery address, shipment state and the owning subscription — everything
   * needed to answer "where is my box / where is my money" in one screen.
   */
  async detail(orderNumber: string) {
    const order = await this.prisma.order.findUnique({
      where: { orderNumber },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, memberIdNumber: true } },
        items: {
          select: {
            id: true, nameEn: true, nameAr: true, quantity: true,
            unitPrice: true, lineTotal: true, productId: true,
          },
        },
        address: { include: { city: { select: { nameEn: true, nameAr: true } } } },
        payments: {
          orderBy: { createdAt: "asc" },
          include: { refunds: { orderBy: { createdAt: "asc" } } },
        },
        invoice: true,
        shipment: { select: { status: true, trackingNumber: true, carrier: true, estimatedAt: true, deliveredAt: true } },
        subscription: {
          select: {
            id: true,
            status: true,
            termMonths: true,
            endsAt: true,
            plan: { select: { nameEn: true, nameAr: true, tier: true } },
            cats: { select: { cat: { select: { id: true, name: true } } } },
            // The member's brand/flavor picks recorded on the subscription —
            // what the box must actually ship (guided premium picker).
            items: {
              where: { planContentId: { not: null } },
              select: {
                quantity: true,
                planContent: { select: { label: true } },
                product: { select: { nameEn: true, nameAr: true } },
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException("Order not found");

    const payments = order.payments.map((p) => {
      const refunded = p.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
      const captured = p.status === "CAPTURED" || p.status === "PARTIALLY_REFUNDED" || p.status === "REFUNDED";
      return {
        id: p.id,
        provider: p.provider,
        status: p.status,
        amount: Number(p.amount),
        currency: p.currency,
        providerRef: p.providerRef,
        failureReason: p.failureReason,
        capturedAt: p.capturedAt,
        createdAt: p.createdAt,
        refundedTotal: round(refunded),
        refundable: captured ? Math.max(0, round(Number(p.amount) - refunded)) : 0,
        refunds: p.refunds.map((r) => ({
          id: r.id,
          amount: Number(r.amount),
          reason: r.reason,
          providerRef: r.providerRef,
          createdAt: r.createdAt,
        })),
      };
    });

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      source: order.source,
      placedAt: order.placedAt,
      updatedAt: order.updatedAt,
      currency: order.currency,
      subtotal: Number(order.subtotal),
      discountTotal: Number(order.discountTotal),
      shippingTotal: Number(order.shippingTotal),
      taxTotal: Number(order.taxTotal),
      grandTotal: Number(order.grandTotal),
      couponCode: order.couponCode,
      allowedTransitions: ALLOWED_TRANSITIONS[order.status] ?? [],
      customer: {
        id: order.user.id,
        email: order.user.email,
        name: [order.user.firstName, order.user.lastName].filter(Boolean).join(" ") || order.user.email,
        memberIdNumber: order.user.memberIdNumber,
      },
      items: order.items.map((i) => ({
        id: i.id,
        nameEn: i.nameEn,
        nameAr: i.nameAr,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
      boxSelections:
        order.subscription?.items.map((s) => ({
          line: s.planContent?.label ?? "",
          productEn: s.product.nameEn,
          productAr: s.product.nameAr,
          quantity: s.quantity,
        })) ?? [],
      address: order.address
        ? {
            recipient: order.address.recipient,
            phone: order.address.phone,
            cityEn: order.address.city.nameEn,
            cityAr: order.address.city.nameAr,
            district: order.address.district,
            street: order.address.street,
            building: order.address.building,
            apartment: order.address.apartment,
            instructions: order.address.instructions,
          }
        : null,
      payments,
      invoice: order.invoice
        ? {
            invoiceNumber: order.invoice.invoiceNumber,
            status: order.invoice.status,
            subtotal: Number(order.invoice.subtotal),
            taxTotal: Number(order.invoice.taxTotal),
            grandTotal: Number(order.invoice.grandTotal),
            vatNumber: order.invoice.vatNumber,
            issuedAt: order.invoice.issuedAt,
            paidAt: order.invoice.paidAt,
          }
        : null,
      shipment: order.shipment,
      subscription: order.subscription
        ? {
            id: order.subscription.id,
            status: order.subscription.status,
            termMonths: order.subscription.termMonths,
            endsAt: order.subscription.endsAt,
            planEn: order.subscription.plan?.nameEn ?? null,
            planAr: order.subscription.plan?.nameAr ?? null,
            cats: order.subscription.cats.map((c) => ({ id: c.cat.id, name: c.cat.name })),
          }
        : null,
    };
  }

  async updateStatus(actorId: string, orderNumber: string, status: string, reason?: string) {
    if (!ORDER_STATUSES.includes(status as never)) {
      throw new BadRequestException("Invalid order status");
    }
    const order = await this.prisma.order.findUnique({ where: { orderNumber } });
    if (!order) throw new NotFoundException("Order not found");
    if (order.status === status) {
      return { orderNumber: order.orderNumber, status: order.status };
    }
    // No teleporting through the lifecycle — DELIVERED never becomes PENDING.
    const allowed = ALLOWED_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(status)) {
      throw new BadRequestException(
        `Can't move an order from ${order.status} to ${status}. Allowed: ${allowed.join(", ") || "none"}`
      );
    }

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
        metadata: { from: order.status, to: status, reason: reason ?? null },
      },
    });
    return { orderNumber: updated.orderNumber, status: updated.status };
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
