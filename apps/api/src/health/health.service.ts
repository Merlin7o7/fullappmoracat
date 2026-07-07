import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PrismaService } from "../prisma/prisma.service";

export type SchemaState = "ok" | "drift" | "unknown";

export interface HealthReport {
  status: "ok" | "degraded";
  service: "moraqat-api";
  db: "up" | "down";
  schema: SchemaState;
  /** Bundled migrations that the database has not applied (drift evidence). */
  pendingMigrations?: string[];
  timestamp: string;
}

/**
 * Liveness + *readiness*. Beyond "can we reach the database", this asserts the
 * database schema matches the code that is running, so a container can never
 * report healthy while silently serving on a stale schema (the drift the
 * best-effort boot migration used to hide). Two independent signals:
 *
 *  1. Migration head — every migration bundled in the image is applied in
 *     `_prisma_migrations` (catches "a new migration didn't run").
 *  2. Column probe — a zero-row query over the newest columns the code expects
 *     (catches drift introduced by `db push` that leaves no migration history).
 *
 * Either signal failing ⇒ schema:"drift" ⇒ status:"degraded" ⇒ the controller
 * answers 503, so orchestrators keep the previous healthy revision.
 */
@Injectable()
export class HealthService implements OnModuleInit {
  private readonly logger = new Logger("Health");
  private bundledMigrations: string[] | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.bundledMigrations = this.readBundledMigrations();
    if (!this.bundledMigrations) {
      this.logger.warn(
        "Could not locate bundled Prisma migrations — schema drift check falls back to the column probe only."
      );
    }
  }

  private readBundledMigrations(): string[] | null {
    const candidates = [
      join(process.cwd(), "prisma", "migrations"), // prod image (/app/prisma)
      join(process.cwd(), "..", "..", "packages", "db", "prisma", "migrations"), // apps/api in dev
      join(process.cwd(), "packages", "db", "prisma", "migrations"), // repo root in dev
    ];
    for (const dir of candidates) {
      if (!existsSync(dir)) continue;
      try {
        const names = readdirSync(dir, { withFileTypes: true })
          .filter((e) => e.isDirectory() && /^\d/.test(e.name))
          .map((e) => e.name)
          .sort();
        if (names.length) return names;
      } catch {
        /* keep trying other candidates */
      }
    }
    return null;
  }

  async check(): Promise<HealthReport> {
    let db: "up" | "down" = "down";
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = "up";
    } catch {
      db = "down";
    }

    let schema: SchemaState = "unknown";
    let pendingMigrations: string[] | undefined;

    if (db === "up") {
      const probeOk = await this.columnProbe();
      const pending = await this.pendingMigrations();

      if (probeOk === false || (pending && pending.length > 0)) {
        schema = "drift";
        if (pending && pending.length) pendingMigrations = pending;
      } else if (probeOk === true && pending !== null) {
        schema = "ok";
      } else {
        // Probe passed but migration history is unreadable (e.g. db-push dev DB).
        schema = probeOk === true ? "ok" : "unknown";
      }
    }

    const healthy = db === "up" && schema !== "drift";
    return {
      status: healthy ? "ok" : "degraded",
      service: "moraqat-api",
      db,
      schema,
      ...(pendingMigrations ? { pendingMigrations } : {}),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Query the newest columns the running code depends on. If the database is
   * missing any (schema behind the code), Prisma throws P2022 and we report
   * drift. Zero-row (`take: 0`) so it costs nothing.
   */
  private async columnProbe(): Promise<boolean | null> {
    try {
      await this.prisma.cat.findMany({
        take: 0,
        select: {
          coatColor: true,
          isNeutered: true,
          vaccinationStatus: true,
          currentMedications: true,
          emergencyNotes: true,
          likeCount: true,
          nameNormalized: true,
        },
      });
      await this.prisma.catLike.findMany({ take: 0, select: { id: true } });
      await this.prisma.waitlistEntry.findMany({ take: 0, select: { id: true } });
      return true;
    } catch (err) {
      this.logger.error(`Schema column probe failed: ${(err as Error).message}`);
      return false;
    }
  }

  /**
   * Bundled migrations not yet recorded as applied. Returns `null` when the
   * migration history is unavailable (no `_prisma_migrations` table, or bundle
   * not found) so the caller can distinguish "drift" from "unknown".
   */
  private async pendingMigrations(): Promise<string[] | null> {
    if (!this.bundledMigrations) return null;
    try {
      const rows = await this.prisma.$queryRaw<{ migration_name: string }[]>`
        SELECT migration_name FROM "_prisma_migrations"
        WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      `;
      const applied = new Set(rows.map((r) => r.migration_name));
      return this.bundledMigrations.filter((m) => !applied.has(m));
    } catch {
      return null; // table missing (db-push dev DB) — treat as unknown
    }
  }
}
