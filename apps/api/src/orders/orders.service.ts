import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Upper bound on a single history fetch — see `list`. */
const MAX_ORDERS = 100;

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A member's order history, newest first.
   *
   * `_count` rather than loading every OrderItem: the list only needs a count,
   * and hydrating the rows meant a 60-order member pulled ~480 item rows to
   * render 60 numbers. Bounded by MAX_ORDERS so the query cannot grow without
   * limit as an account ages.
   */
  async list(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { placedAt: "desc" },
      take: MAX_ORDERS,
      select: {
        orderNumber: true,
        status: true,
        source: true,
        grandTotal: true,
        currency: true,
        placedAt: true,
        couponCode: true,
        _count: { select: { items: true } },
        shipment: { select: { status: true, trackingNumber: true, estimatedAt: true } },
      },
    });
    return orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      source: o.source,
      grandTotal: Number(o.grandTotal),
      currency: o.currency,
      itemCount: o._count.items,
      couponCode: o.couponCode,
      placedAt: o.placedAt,
      shipment: o.shipment,
    }));
  }

  async detail(userId: string, orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber, userId },
      include: {
        items: true,
        payments: { select: { provider: true, status: true, amount: true, capturedAt: true } },
        invoice: true,
        shipment: { include: { events: { orderBy: { createdAt: "desc" } } } },
        address: { include: { city: { select: { nameEn: true, nameAr: true } } } },
      },
    });
    if (!order) throw new NotFoundException("Order not found");

    return {
      orderNumber: order.orderNumber,
      status: order.status,
      source: order.source,
      subtotal: Number(order.subtotal),
      discountTotal: Number(order.discountTotal),
      shippingTotal: Number(order.shippingTotal),
      taxTotal: Number(order.taxTotal),
      grandTotal: Number(order.grandTotal),
      currency: order.currency,
      couponCode: order.couponCode,
      placedAt: order.placedAt,
      items: order.items.map((i) => ({
        nameEn: i.nameEn,
        nameAr: i.nameAr,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
      payment: order.payments[0]
        ? {
            provider: order.payments[0].provider,
            status: order.payments[0].status,
            amount: Number(order.payments[0].amount),
            capturedAt: order.payments[0].capturedAt,
          }
        : null,
      invoice: order.invoice
        ? {
            invoiceNumber: order.invoice.invoiceNumber,
            status: order.invoice.status,
            grandTotal: Number(order.invoice.grandTotal),
            issuedAt: order.invoice.issuedAt,
          }
        : null,
      shipment: order.shipment,
      address: order.address,
    };
  }

  async invoices(userId: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      include: { order: { select: { orderNumber: true } } },
    });
    return invoices.map((inv) => ({
      invoiceNumber: inv.invoiceNumber,
      orderNumber: inv.order.orderNumber,
      status: inv.status,
      subtotal: Number(inv.subtotal),
      taxTotal: Number(inv.taxTotal),
      grandTotal: Number(inv.grandTotal),
      issuedAt: inv.issuedAt,
      paidAt: inv.paidAt,
    }));
  }
}
