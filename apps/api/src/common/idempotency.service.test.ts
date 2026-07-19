import { describe, expect, it, vi } from "vitest";
import { ConflictException } from "@nestjs/common";
import { IdempotencyService } from "./idempotency.service";

/**
 * A double-tapped checkout used to create two orders, two PSP charges and two
 * invoices. These pin the replay semantics that prevent it.
 */
type Row = {
  scope: string;
  key: string;
  requestHash: string;
  status: string;
  responseJson: unknown;
};

/** In-memory stand-in for the unique-constrained idempotency_keys table. */
function makePrisma(seed: Row[] = []) {
  const rows = new Map(seed.map((r) => [`${r.scope}:${r.key}`, r]));
  return {
    rows,
    prisma: {
      idempotencyKey: {
        create: vi.fn(async ({ data }: { data: Row }) => {
          const k = `${data.scope}:${data.key}`;
          if (rows.has(k)) throw new Error("unique constraint violation");
          rows.set(k, { ...data });
          return data;
        }),
        findUnique: vi.fn(async ({ where }: { where: { scope_key: { scope: string; key: string } } }) => {
          return rows.get(`${where.scope_key.scope}:${where.scope_key.key}`) ?? null;
        }),
        update: vi.fn(async ({ where, data }: { where: { scope_key: { scope: string; key: string } }; data: Partial<Row> }) => {
          const k = `${where.scope_key.scope}:${where.scope_key.key}`;
          rows.set(k, { ...(rows.get(k) as Row), ...data });
          return rows.get(k);
        }),
        delete: vi.fn(async ({ where }: { where: { scope_key: { scope: string; key: string } } }) => {
          rows.delete(`${where.scope_key.scope}:${where.scope_key.key}`);
          return {};
        }),
      },
    } as never,
  };
}

describe("IdempotencyService", () => {
  it("runs the work when no key is supplied", async () => {
    const { prisma } = makePrisma();
    const svc = new IdempotencyService(prisma);
    const work = vi.fn(async () => ({ orderNumber: "A" }));
    await expect(svc.run({ scope: "checkout", request: {} }, work)).resolves.toEqual({ orderNumber: "A" });
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("executes once and replays the stored response for the same key", async () => {
    const { prisma } = makePrisma();
    const svc = new IdempotencyService(prisma);
    const work = vi.fn(async () => ({ orderNumber: "MRQ-1" }));
    const req = { cartId: "c1", provider: "MADA" };

    const first = await svc.run({ scope: "checkout", key: "k1", request: req }, work);
    const second = await svc.run({ scope: "checkout", key: "k1", request: req }, work);

    expect(first).toEqual({ orderNumber: "MRQ-1" });
    expect(second).toEqual({ orderNumber: "MRQ-1" });
    // The critical assertion: the charge ran exactly once.
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("rejects the same key used for a different request body", async () => {
    const { prisma } = makePrisma();
    const svc = new IdempotencyService(prisma);
    const work = vi.fn(async () => ({ ok: true }));
    await svc.run({ scope: "checkout", key: "k1", request: { cartId: "c1" } }, work);
    await expect(
      svc.run({ scope: "checkout", key: "k1", request: { cartId: "DIFFERENT" } }, work)
    ).rejects.toBeInstanceOf(ConflictException);
    expect(work).toHaveBeenCalledTimes(1);
  });

  it("releases the claim when the work throws, so a genuine retry can proceed", async () => {
    const { prisma, rows } = makePrisma();
    const svc = new IdempotencyService(prisma);
    const boom = vi.fn(async () => {
      throw new Error("psp down");
    });
    await expect(svc.run({ scope: "checkout", key: "k1", request: {} }, boom)).rejects.toThrow("psp down");
    expect(rows.size).toBe(0);

    const ok = vi.fn(async () => ({ orderNumber: "retry" }));
    await expect(svc.run({ scope: "checkout", key: "k1", request: {} }, ok)).resolves.toEqual({
      orderNumber: "retry",
    });
  });

  it("rejects a concurrent in-flight attempt rather than running twice", async () => {
    const { prisma } = makePrisma([
      { scope: "checkout", key: "k1", requestHash: IdempotencyService.hash({ a: 1 }), status: "IN_PROGRESS", responseJson: null },
    ]);
    const svc = new IdempotencyService(prisma);
    const work = vi.fn(async () => ({ ok: true }));
    await expect(svc.run({ scope: "checkout", key: "k1", request: { a: 1 } }, work)).rejects.toThrow(
      /already in progress/i
    );
    expect(work).not.toHaveBeenCalled();
  });

  it("scopes keys, so the same key in another flow is independent", async () => {
    const { prisma } = makePrisma();
    const svc = new IdempotencyService(prisma);
    const a = vi.fn(async () => ({ from: "checkout" }));
    const b = vi.fn(async () => ({ from: "subscription" }));
    await svc.run({ scope: "checkout", key: "shared", request: {} }, a);
    await expect(svc.run({ scope: "subscription", key: "shared", request: {} }, b)).resolves.toEqual({
      from: "subscription",
    });
  });
});
