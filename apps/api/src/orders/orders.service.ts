import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const orders = await this.prisma.order.findMany({
      where: { userId },
      orderBy: { placedAt: "desc" },
      include: {
        items: { select: { id: true } },
        shipment: { select: { status: true, trackingNumber: true, estimatedAt: true } },
      },
    });
    return orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      source: o.source,
      grandTotal: Number(o.grandTotal),
      currency: o.currency,
      itemCount: o.items.length,
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
