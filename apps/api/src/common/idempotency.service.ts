import { ConflictException, Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Replay protection for money-moving requests.
 *
 * A double-tapped checkout previously produced two orders, two PSP charges and
 * two invoices. The client sends an `Idempotency-Key`; the first request claims
 * it via a unique constraint, and any later request carrying the same key
 * replays the stored response instead of charging again.
 *
 * `requestHash` binds the key to the body it was first used with, so a client
 * that reuses a key for a different basket gets a loud 409 rather than someone
 * else's order back.
 */
@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger("Idempotency");

  constructor(private readonly prisma: PrismaService) {}

  static hash(body: unknown): string {
    return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
  }

  /**
   * Run `work` at most once per (scope, key).
   *
   * Without a key the operation still runs — callers decide whether a key is
   * mandatory. This keeps the helper usable for flows where the client cannot
   * yet supply one, without silently pretending they are protected.
   */
  async run<T>(
    opts: { scope: string; key?: string | null; userId?: string | null; request: unknown },
    work: () => Promise<T>
  ): Promise<T> {
    const { scope, key, userId } = opts;
    if (!key) return work();

    const requestHash = IdempotencyService.hash(opts.request);

    // Claim. The unique constraint is the concurrency primitive: exactly one
    // caller wins, everybody else lands in the catch below.
    try {
      await this.prisma.idempotencyKey.create({
        data: { scope, key, userId: userId ?? null, requestHash, status: "IN_PROGRESS" },
      });
    } catch {
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: { scope_key: { scope, key } },
      });
      if (!existing) throw new ConflictException("Idempotency conflict — retry.");

      if (existing.requestHash !== requestHash) {
        throw new ConflictException(
          "This Idempotency-Key was already used for a different request."
        );
      }
      if (existing.status === "COMPLETED" && existing.responseJson) {
        return existing.responseJson as T;
      }
      // A concurrent attempt is still in flight. Telling the client to retry is
      // safer than running the work twice.
      throw new ConflictException("A matching request is already in progress.");
    }

    try {
      const result = await work();
      await this.prisma.idempotencyKey.update({
        where: { scope_key: { scope, key } },
        data: {
          status: "COMPLETED",
          responseJson: result as never,
          completedAt: new Date(),
        },
      });
      return result;
    } catch (err) {
      // Release the claim so a genuine retry can proceed. Leaving it would wedge
      // the key forever on a transient failure.
      await this.prisma.idempotencyKey
        .delete({ where: { scope_key: { scope, key } } })
        .catch((e) => this.logger.error(`failed releasing idempotency key ${scope}/${key}: ${e}`));
      throw err;
    }
  }
}
