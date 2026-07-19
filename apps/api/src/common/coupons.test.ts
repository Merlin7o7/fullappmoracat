import { describe, expect, it, vi } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { claimCoupon } from "./coupons";

/**
 * `maxRedemptions` was advisory (checked at cart-attach, incremented
 * unconditionally at checkout) and `perUserLimit` was entirely unenforceable —
 * no ledger existed to count against. These cover both caps and the atomicity
 * of the claim.
 */
type Coupon = {
  id: string;
  isActive: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  maxRedemptions: number | null;
  redeemedCount: number;
  perUserLimit: number | null;
};

function makeTx(coupon: Coupon | null, opts: { userRedemptions?: number; claimWins?: boolean } = {}) {
  const created: unknown[] = [];
  const updateMany = vi.fn(async () => ({ count: opts.claimWins === false ? 0 : 1 }));
  return {
    created,
    updateMany,
    tx: {
      coupon: {
        findUnique: vi.fn(async () => coupon),
        updateMany,
      },
      couponRedemption: {
        count: vi.fn(async () => opts.userRedemptions ?? 0),
        create: vi.fn(async ({ data }: { data: unknown }) => {
          created.push(data);
          return data;
        }),
      },
    } as never,
  };
}

const base: Coupon = {
  id: "c1",
  isActive: true,
  startsAt: null,
  expiresAt: null,
  maxRedemptions: null,
  redeemedCount: 0,
  perUserLimit: null,
};

const args = { code: "SAVE10", userId: "u1", orderId: "o1" };

describe("claimCoupon", () => {
  it("claims a valid coupon and writes a ledger row", async () => {
    const { tx, created } = makeTx(base);
    await expect(claimCoupon(tx, args)).resolves.toEqual({ couponId: "c1" });
    expect(created).toEqual([{ couponId: "c1", userId: "u1", orderId: "o1" }]);
  });

  it("rejects an unknown code", async () => {
    const { tx } = makeTx(null);
    await expect(claimCoupon(tx, args)).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a deactivated coupon even if it is still attached to the cart", async () => {
    const { tx } = makeTx({ ...base, isActive: false });
    await expect(claimCoupon(tx, args)).rejects.toThrow(/invalid or expired/i);
  });

  it("rejects an expired coupon", async () => {
    const { tx } = makeTx({ ...base, expiresAt: new Date(Date.now() - 1000) });
    await expect(claimCoupon(tx, args)).rejects.toThrow(/invalid or expired/i);
  });

  it("rejects a coupon whose window has not opened", async () => {
    const { tx } = makeTx({ ...base, startsAt: new Date(Date.now() + 60_000) });
    await expect(claimCoupon(tx, args)).rejects.toThrow(/invalid or expired/i);
  });

  it("enforces perUserLimit against the ledger", async () => {
    const { tx } = makeTx({ ...base, perUserLimit: 1 }, { userRedemptions: 1 });
    await expect(claimCoupon(tx, args)).rejects.toThrow(/already used/i);
  });

  it("allows a repeat use below perUserLimit", async () => {
    const { tx } = makeTx({ ...base, perUserLimit: 2 }, { userRedemptions: 1 });
    await expect(claimCoupon(tx, args)).resolves.toEqual({ couponId: "c1" });
  });

  it("guards the global cap in the WHERE clause, not in JS", async () => {
    const { tx, updateMany } = makeTx({ ...base, maxRedemptions: 100, redeemedCount: 40 });
    await claimCoupon(tx, args);
    // The cap must be part of the conditional update so concurrent checkouts
    // cannot both pass a read-then-write check and overshoot.
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ redeemedCount: { lt: 100 } }),
      })
    );
  });

  it("fails when the conditional claim matches no rows (cap exhausted under race)", async () => {
    const { tx } = makeTx({ ...base, maxRedemptions: 100, redeemedCount: 99 }, { claimWins: false });
    await expect(claimCoupon(tx, args)).rejects.toThrow(/redemption limit/i);
  });
});
