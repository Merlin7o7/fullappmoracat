import { Logger } from "@nestjs/common";
import * as Sentry from "@sentry/node";
import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type { PrismaService } from "../../prisma/prisma.service";
import { sentryEnabled } from "../../instrument";

const logger = new Logger("Jobs");
const HEARTBEAT_TIMEOUT_MS = 5_000;

/**
 * Run a scheduled job under a database lease so it executes at most once per
 * tick across every API instance, and leave a trail (`JobLease`) that /health
 * and an external heartbeat monitor can read.
 *
 * Why a lease row and not `pg_advisory_lock`: production reaches Postgres
 * through pgbouncer in transaction-pooling mode with `connection_limit=1`
 * (render.yaml). A session-level advisory lock sticks to whichever server
 * connection the pooler hands out, which is not the one the rest of the job
 * runs on — so it neither protects nor releases reliably. A compare-and-set
 * on a row works through any pooler and expires by itself if the holder dies.
 *
 * Heartbeat: when `HEARTBEAT_URL_<JOB>` is set, a successful run pings it and a
 * failed run pings `<url>/fail` (the Healthchecks.io convention). A missed
 * ping — the cron never fired because the dyno was asleep — is what the
 * monitor alerts on, which is the failure mode no in-process code can see.
 */
export async function withJobLock<T>(
  prisma: PrismaService,
  name: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<{ ran: boolean; result?: T; error?: string }> {
  const now = new Date();
  const holder = `${hostname()}:${process.pid}:${randomUUID().slice(0, 8)}`;

  // Make sure the row exists (idempotent), then try to take the lease.
  await prisma.jobLease.upsert({
    where: { name },
    create: { name, leaseUntil: new Date(0) },
    update: {},
  });
  const taken = await prisma.jobLease.updateMany({
    where: { name, leaseUntil: { lt: now } },
    data: { leaseUntil: new Date(now.getTime() + ttlMs), holder, lastStartedAt: now },
  });
  if (taken.count === 0) {
    logger.log(`${name}: lease held elsewhere — skipping this tick`);
    return { ran: false };
  }

  const started = Date.now();
  try {
    const result = await fn();
    await release(prisma, name, holder, { lastDurationMs: Date.now() - started, lastError: null });
    void pingHeartbeat(name, "ok");
    return { ran: true, result };
  } catch (err) {
    const message = (err as Error)?.message ?? String(err);
    logger.error(`${name} failed: ${message}`);
    if (sentryEnabled) Sentry.captureException(err, { tags: { job: name } });
    await release(prisma, name, holder, { lastDurationMs: Date.now() - started, lastError: message.slice(0, 500) });
    void pingHeartbeat(name, "fail");
    return { ran: true, error: message };
  }
}

async function release(
  prisma: PrismaService,
  name: string,
  holder: string,
  data: { lastDurationMs: number; lastError: string | null }
): Promise<void> {
  try {
    // Only the holder releases; a lease that expired mid-run and was re-taken
    // by another instance must not be clobbered by the slow first runner.
    await prisma.jobLease.updateMany({
      where: { name, holder },
      data: { ...data, leaseUntil: new Date(), lastFinishedAt: new Date() },
    });
  } catch (err) {
    logger.warn(`${name}: could not release lease — ${(err as Error).message}`);
  }
}

function heartbeatUrl(name: string): string | undefined {
  const key = `HEARTBEAT_URL_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  return process.env[key] || undefined;
}

async function pingHeartbeat(name: string, outcome: "ok" | "fail"): Promise<void> {
  const url = heartbeatUrl(name);
  if (!url) return;
  const target = outcome === "ok" ? url : `${url.replace(/\/$/, "")}/fail`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), HEARTBEAT_TIMEOUT_MS);
  try {
    await fetch(target, { method: "POST", signal: ctrl.signal });
  } catch (err) {
    logger.warn(`${name}: heartbeat ping failed — ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
}
