import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Flat delivery fee (SAR); waived above the free-shipping threshold. */
const SHIPPING_FEE = 25;
const FREE_SHIPPING_OVER = 200;

export interface CartTotals {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  grandTotal: number;
  itemCount: number;
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId?: string) {
    const cart = await this.prisma.cart.create({ data: { userId: userId ?? null } });
    return this.get(cart.id);
  }

  async get(cartId: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true, slug: true, nameEn: true, nameAr: true, price: true,
                images: { where: { isPrimary: true }, take: 1 },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!cart) throw new NotFoundException("Cart not found");

    const coupon = cart.couponId
      ? await this.prisma.coupon.findUnique({ where: { id: cart.couponId } })
      : null;

    const items = cart.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      slug: i.product.slug,
      nameEn: i.product.nameEn,
      nameAr: i.product.nameAr,
      image: i.product.images[0]?.url ?? null,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.unitPrice) * i.quantity,
    }));

    const totals = this.computeTotals(items, coupon);
    return {
      id: cart.id,
      currency: cart.currency,
      coupon: coupon ? { code: coupon.code, type: coupon.type, value: Number(coupon.value) } : null,
      items,
      totals,
    };
  }

  async addItem(cartId: string, productId: string, quantity: number) {
    await this.assertCart(cartId);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, isActive: true, deletedAt: null },
    });
    if (!product) throw new NotFoundException("Product not available");

    const existing = await this.prisma.cartItem.findUnique({
      where: { cartId_productId: { cartId, productId } },
    });

    if (existing) {
      await this.prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId, productId, quantity, unitPrice: product.price },
      });
    }
    return this.get(cartId);
  }

  async updateItem(cartId: string, itemId: string, quantity: number) {
    await this.assertItem(cartId, itemId);
    if (quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    }
    return this.get(cartId);
  }

  async removeItem(cartId: string, itemId: string) {
    await this.assertItem(cartId, itemId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.get(cartId);
  }

  async applyCoupon(cartId: string, code: string) {
    await this.assertCart(cartId);
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    const now = new Date();
    const valid =
      coupon &&
      coupon.isActive &&
      (!coupon.startsAt || coupon.startsAt <= now) &&
      (!coupon.expiresAt || coupon.expiresAt >= now) &&
      (!coupon.maxRedemptions || coupon.redeemedCount < coupon.maxRedemptions);
    if (!valid) throw new BadRequestException("Coupon is invalid or expired");

    await this.prisma.cart.update({ where: { id: cartId }, data: { couponId: coupon.id } });
    return this.get(cartId);
  }

  async removeCoupon(cartId: string) {
    await this.assertCart(cartId);
    await this.prisma.cart.update({ where: { id: cartId }, data: { couponId: null } });
    return this.get(cartId);
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  private computeTotals(
    items: { lineTotal: number; quantity: number }[],
    coupon: { type: string; value: unknown; minSubtotal: unknown } | null
  ): CartTotals {
    const subtotal = round(items.reduce((s, i) => s + i.lineTotal, 0));
    const itemCount = items.reduce((s, i) => s + i.quantity, 0);

    let discountTotal = 0;
    let freeShipping = false;
    if (coupon) {
      const min = coupon.minSubtotal ? Number(coupon.minSubtotal) : 0;
      if (subtotal >= min) {
        if (coupon.type === "PERCENTAGE") discountTotal = round(subtotal * (Number(coupon.value) / 100));
        else if (coupon.type === "FIXED") discountTotal = Math.min(subtotal, Number(coupon.value));
        else if (coupon.type === "FREE_SHIPPING") freeShipping = true;
      }
    }

    const discountedSubtotal = subtotal - discountTotal;
    const shippingTotal =
      itemCount === 0 || freeShipping || discountedSubtotal >= FREE_SHIPPING_OVER
        ? 0
        : SHIPPING_FEE;

    return {
      subtotal,
      discountTotal,
      shippingTotal,
      grandTotal: round(discountedSubtotal + shippingTotal),
      itemCount,
    };
  }

  private async assertCart(cartId: string) {
    const c = await this.prisma.cart.findUnique({ where: { id: cartId }, select: { id: true } });
    if (!c) throw new NotFoundException("Cart not found");
  }

  private async assertItem(cartId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
    if (!item) throw new NotFoundException("Cart item not found");
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
