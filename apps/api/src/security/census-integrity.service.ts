import { ForbiddenException, Injectable, Logger } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Census integrity — the honesty of the number, defended at the input.
 *
 * The public census (census.service) is honest by construction: it reports what
 * the database says, never a floor or a projection (R006/R040). That honesty is
 * only worth something if the database itself is hard to poison. This service is
 * the counter-abuse layer around cat registration:
 *
 *   1. a per-account daily cap (a real household adds a few cats, not hundreds);
 *   2. a durable, privacy-preserving audit of every registration (hashed IP/UA,
 *      never the raw address — PDPL data-minimisation);
 *   3. threshold alerts to the logs when one IP spins up many accounts or one
 *      account registers unusually fast; and
 *   4. an admin report that surfaces those same signals for human review.
 *
 * It deliberately does NOT silently delete or hide suspected-fake cats: the
 * count must stay a mechanical restatement of the table. Suspicious rows are
 * surfaced for a human, not disappeared by a heuristic.
 */

const ACTION = "census.registration";
/** Static salt: we only need stable correlation within our own dataset, not a secret. */
const IP_SALT = process.env.SECURITY_SALT ?? "moracat-census-v1";

function envInt(key: string, fallback: number): number {
  const n = Number(process.env[key]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** A real multi-cat household is small; beyond this in a day is almost certainly a script. */
const MAX_CATS_PER_DAY = envInt("CENSUS_MAX_CATS_PER_DAY", 8);
/** Distinct accounts from one IP in a day past this is worth a human's eyes. */
const IP_ACCOUNTS_ALERT = envInt("CENSUS_IP_ACCOUNTS_ALERT", 5);
/** Registrations from one IP in an hour past this trips an alert. */
const IP_REGS_PER_HOUR_ALERT = envInt("CENSUS_IP_REGS_PER_HOUR_ALERT", 12);

interface RegistrationContext {
  userId: string;
  catId: string;
  catNumber: number;
  ip?: string | null;
  userAgent?: string | null;
  sourceCode?: string | null;
}

@Injectable()
export class CensusIntegrityService {
  private readonly logger = new Logger(CensusIntegrityService.name);

  constructor(private readonly prisma: PrismaService) {}

  private hash(value: string): string {
    return createHash("sha256").update(`${IP_SALT}:${value}`).digest("hex").slice(0, 32);
  }

  /**
   * Enforce the per-account daily cap. Called BEFORE the cat is created, so a
   * scripted account is stopped at the door rather than after the fact. Throws a
   * named 403 the client can explain calmly (R084); a genuine large household
   * that hits it can continue the next day or reach support.
   */
  async assertWithinDailyCap(userId: string): Promise<void> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await this.prisma.cat.count({
      where: { userId, createdAt: { gte: since } },
    });
    if (count >= MAX_CATS_PER_DAY) {
      this.logger.warn(`Daily cat-creation cap hit by user ${userId} (${count} in 24h)`);
      throw new ForbiddenException({
        code: "DAILY_REGISTRATION_LIMIT",
        message: `You can register up to ${MAX_CATS_PER_DAY} cats per day. Please continue tomorrow or contact support.`,
      });
    }
  }

  /**
   * Record a registration for integrity monitoring and run the velocity alerts.
   * Fire-and-forget from the caller's perspective — integrity bookkeeping must
   * never fail or slow a real member's Cat ID ceremony.
   */
  async recordRegistration(ctx: RegistrationContext): Promise<void> {
    const ipHash = ctx.ip ? this.hash(ctx.ip) : null;
    const uaHash = ctx.userAgent ? this.hash(ctx.userAgent).slice(0, 16) : null;

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: ctx.userId,
          action: ACTION,
          entityType: "Cat",
          entityId: ctx.catId,
          // Hashed, not raw — we can still correlate an IP with itself without
          // ever storing a member's address (PDPL minimisation).
          ipAddress: ipHash,
          metadata: { uaHash, sourceCode: ctx.sourceCode ?? null, catNumber: ctx.catNumber },
        },
      });
    } catch (err) {
      this.logger.error(`Failed to record census registration: ${(err as Error).message}`);
      return;
    }

    if (ipHash) void this.checkIpVelocity(ipHash);
  }

  /** Threshold alerts — write a WARN (shipped to logs/Sentry) when an IP looks scripted. */
  private async checkIpVelocity(ipHash: string): Promise<void> {
    try {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

      const [rows, hourCount] = await Promise.all([
        this.prisma.auditLog.findMany({
          where: { action: ACTION, ipAddress: ipHash, createdAt: { gte: dayAgo } },
          select: { userId: true },
        }),
        this.prisma.auditLog.count({
          where: { action: ACTION, ipAddress: ipHash, createdAt: { gte: hourAgo } },
        }),
      ]);

      const distinctAccounts = new Set(rows.map((r) => r.userId).filter(Boolean)).size;
      if (distinctAccounts >= IP_ACCOUNTS_ALERT) {
        this.logger.warn(
          `[census-integrity] IP ${ipHash} tied to ${distinctAccounts} accounts in 24h — possible inflation`
        );
      }
      if (hourCount >= IP_REGS_PER_HOUR_ALERT) {
        this.logger.warn(
          `[census-integrity] IP ${ipHash} produced ${hourCount} registrations in 1h — possible script`
        );
      }
    } catch (err) {
      this.logger.error(`census velocity check failed: ${(err as Error).message}`);
    }
  }

  /**
   * Admin review of suspicious registration patterns over a window (default 7d).
   * Returns aggregate integrity signals — never deletes or hides anything.
   */
  async abuseReport(windowDays = 7) {
    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.auditLog.findMany({
      where: { action: ACTION, createdAt: { gte: since } },
      select: { userId: true, ipAddress: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    const byIp = new Map<string, { registrations: number; accounts: Set<string> }>();
    const byAccount = new Map<string, number>();
    for (const r of rows) {
      if (r.ipAddress) {
        const e = byIp.get(r.ipAddress) ?? { registrations: 0, accounts: new Set<string>() };
        e.registrations += 1;
        if (r.userId) e.accounts.add(r.userId);
        byIp.set(r.ipAddress, e);
      }
      if (r.userId) byAccount.set(r.userId, (byAccount.get(r.userId) ?? 0) + 1);
    }

    const suspiciousIps = [...byIp.entries()]
      .map(([ipHash, e]) => ({ ipHash, registrations: e.registrations, accounts: e.accounts.size }))
      .filter((e) => e.accounts >= IP_ACCOUNTS_ALERT || e.registrations >= IP_REGS_PER_HOUR_ALERT)
      .sort((a, b) => b.accounts - a.accounts || b.registrations - a.registrations)
      .slice(0, 50);

    const highVelocityAccounts = [...byAccount.entries()]
      .map(([userId, registrations]) => ({ userId, registrations }))
      .filter((e) => e.registrations >= MAX_CATS_PER_DAY)
      .sort((a, b) => b.registrations - a.registrations)
      .slice(0, 50);

    return {
      windowDays,
      totalRegistrations: rows.length,
      distinctAccounts: byAccount.size,
      distinctIps: byIp.size,
      thresholds: {
        maxCatsPerDay: MAX_CATS_PER_DAY,
        ipAccountsAlert: IP_ACCOUNTS_ALERT,
        ipRegsPerHourAlert: IP_REGS_PER_HOUR_ALERT,
      },
      suspiciousIps,
      highVelocityAccounts,
    };
  }
}
