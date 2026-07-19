import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { randomBytes, timingSafeEqual } from "node:crypto";
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

/**
 * Who is asking. A cart is reachable either by its owner (authenticated) or by
 * a guest holding the capability token minted at creation. The cart id alone is
 * NEVER sufficient — it is a routing identifier, not a credential.
 */
export interface CartActor {
  userId?: string | null;
  token?: string | null;
}

function tokensMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a cart. An authenticated shopper owns it outright; an anonymous one
   * receives a single-use capability token that must accompany every later
   * request. The token is returned exactly once, here.
   */
  async create(actor: CartActor = {}) {
    const guestToken = actor.userId ? null : randomBytes(32).toString("base64url");
    const cart = await this.prisma.cart.create({
      data: { userId: actor.userId ?? null, guestToken },
    });
    const view = await this.get(cart.id, { userId: actor.userId, token: guestToken });
    return { ...view, guestToken };
  }

  /**
   * Load a cart the actor is entitled to, claiming an unowned guest cart for a
   * signed-in user in the process. Every read and mutation funnels through here.
   */
  private async requireAccess(cartId: string, actor: CartActor, opts: { mutating?: boolean } = {}) {
    const cart = await this.prisma.cart.findUnique({
      where: { id: cartId },
      select: { id: true, userId: true, guestToken: true, status: true, couponId: true, currency: true },
    });
    // Same shape for "no such cart" and "not yours" — no existence oracle.
    if (!cart) throw new NotFoundException("Cart not found");

    if (cart.userId) {
      if (!actor.userId || cart.userId !== actor.userId) throw new NotFoundException("Cart not found");
    } else if (!tokensMatch(cart.guestToken, actor.token)) {
      throw new NotFoundException("Cart not found");
    } else if (actor.userId) {
      // A signed-in shopper presenting a valid guest token adopts the basket.
      // The token is cleared so it can never be replayed against the now-owned
      // cart (e.g. from a shared device the guest previously used).
      await this.prisma.cart.update({
        where: { id: cart.id },
        data: { userId: actor.userId, guestToken: null },
      });
      cart.userId = actor.userId;
      cart.guestToken = null;
    }

    if (opts.mutating && cart.status !== "ACTIVE") {
      throw new ForbiddenException(
        cart.status === "CHECKING_OUT"
          ? "This cart is being checked out and cannot be changed."
          : "This cart is no longer active."
      );
    }
    return cart;
  }

  async get(cartId: string, actor: CartActor) {
    await this.requireAccess(cartId, actor);
    return this.view(cartId);
  }

  /** Render a cart that access has already been established for. */
  private async view(cartId: string) {
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

    // Re-validate the attached coupon on every read. Validity was previously
    // only checked at apply-time, so a coupon that expired or was deactivated
    // afterwards kept discounting the basket indefinitely.
    const coupon = cart.couponId ? await this.loadValidCoupon(cart.couponId) : null;
    if (cart.couponId && !coupon) {
      await this.prisma.cart.update({ where: { id: cart.id }, data: { couponId: null } });
    }

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
      status: cart.status,
      coupon: coupon ? { code: coupon.code, type: coupon.type, value: Number(coupon.value) } : null,
      items,
      totals,
    };
  }

  async addItem(cartId: string, actor: CartActor, productId: string, quantity: number) {
    await this.requireAccess(cartId, actor, { mutating: true });
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
        // Re-snapshot the price so a basket cannot hold a stale unit price
        // indefinitely after a repricing.
        data: { quantity: existing.quantity + quantity, unitPrice: product.price },
      });
    } else {
      await this.prisma.cartItem.create({
        data: { cartId, productId, quantity, unitPrice: product.price },
      });
    }
    return this.view(cartId);
  }

  async updateItem(cartId: string, actor: CartActor, itemId: string, quantity: number) {
    await this.requireAccess(cartId, actor, { mutating: true });
    await this.assertItem(cartId, itemId);
    if (quantity === 0) {
      await this.prisma.cartItem.delete({ where: { id: itemId } });
    } else {
      await this.prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
    }
    return this.view(cartId);
  }

  async removeItem(cartId: string, actor: CartActor, itemId: string) {
    await this.requireAccess(cartId, actor, { mutating: true });
    await this.assertItem(cartId, itemId);
    await this.prisma.cartItem.delete({ where: { id: itemId } });
    return this.view(cartId);
  }

  async applyCoupon(cartId: string, actor: CartActor, code: string) {
    await this.requireAccess(cartId, actor, { mutating: true });
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !this.isCouponValid(coupon)) {
      throw new BadRequestException("Coupon is invalid or expired");
    }
    await this.prisma.cart.update({ where: { id: cartId }, data: { couponId: coupon.id } });
    return this.view(cartId);
  }

  async removeCoupon(cartId: string, actor: CartActor) {
    await this.requireAccess(cartId, actor, { mutating: true });
    await this.prisma.cart.update({ where: { id: cartId }, data: { couponId: null } });
    return this.view(cartId);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private isCouponValid(c: {
    isActive: boolean;
    startsAt: Date | null;
    expiresAt: Date | null;
    maxRedemptions: number | null;
    redeemedCount: number;
  }): boolean {
    const now = new Date();
    return (
      c.isActive &&
      (!c.startsAt || c.startsAt <= now) &&
      (!c.expiresAt || c.expiresAt >= now) &&
      (!c.maxRedemptions || c.redeemedCount < c.maxRedemptions)
    );
  }

  private async loadValidCoupon(couponId: string) {
    const c = await this.prisma.coupon.findUnique({ where: { id: couponId } });
    return c && this.isCouponValid(c) ? c : null;
  }

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

  private async assertItem(cartId: string, itemId: string) {
    const item = await this.prisma.cartItem.findFirst({ where: { id: itemId, cartId } });
    if (!item) throw new NotFoundException("Cart item not found");
  }
}

const round = (n: number) => Math.round(n * 100) / 100;
