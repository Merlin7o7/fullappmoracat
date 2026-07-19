import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@moraqat/db";

/**
 * Atomically claim one redemption of a coupon, inside the caller's transaction.
 *
 * Previously validity was checked when the coupon was attached to the cart and
 * the counter was incremented unconditionally at checkout. Two consequences:
 *
 *   * `maxRedemptions` was advisory — N shoppers who attached a code before the
 *     cap was reached all redeemed it afterwards, overshooting without limit.
 *   * `perUserLimit` was unenforceable: nothing counted a user's redemptions.
 *
 * The conditional `updateMany` below is the concurrency primitive — it only
 * matches while the cap still has room, so concurrent checkouts cannot overshoot.
 * The `CouponRedemption` row is unique per (coupon, order), which makes the
 * whole claim safe to retry.
 */
export async function claimCoupon(
  tx: Prisma.TransactionClient,
  input: { code: string; userId: string; orderId: string }
): Promise<{ couponId: string } | null> {
  const coupon = await tx.coupon.findUnique({ where: { code: input.code } });
  if (!coupon) throw new BadRequestException("Coupon is invalid or expired");

  const now = new Date();
  const windowOpen =
    coupon.isActive &&
    (!coupon.startsAt || coupon.startsAt <= now) &&
    (!coupon.expiresAt || coupon.expiresAt >= now);
  if (!windowOpen) throw new BadRequestException("Coupon is invalid or expired");

  if (coupon.perUserLimit != null) {
    const used = await tx.couponRedemption.count({
      where: { couponId: coupon.id, userId: input.userId },
    });
    if (used >= coupon.perUserLimit) {
      throw new BadRequestException("You've already used this coupon.");
    }
  }

  // Conditional increment: matches zero rows once the global cap is reached, so
  // the race between two concurrent checkouts resolves in the database.
  const claimed = await tx.coupon.updateMany({
    where:
      coupon.maxRedemptions == null
        ? { id: coupon.id, isActive: true }
        : { id: coupon.id, isActive: true, redeemedCount: { lt: coupon.maxRedemptions } },
    data: { redeemedCount: { increment: 1 } },
  });
  if (claimed.count === 0) {
    throw new BadRequestException("This coupon has reached its redemption limit.");
  }

  await tx.couponRedemption.create({
    data: { couponId: coupon.id, userId: input.userId, orderId: input.orderId },
  });

  return { couponId: coupon.id };
}
