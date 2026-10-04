import { describe, expect, it } from "vitest";
import { AdminReadinessService } from "./readiness.service";

/** The cron-health check behind /admin/readiness (audit 2026-10-04 Problem 7). */
function svc(rows: Array<{ name: string; lastFinishedAt: Date | null; lastError?: string | null }>) {
  const prisma = {
    jobLease: {
      findMany: async () =>
        rows.map((r) => ({ lastStartedAt: r.lastFinishedAt, lastDurationMs: 10, lastError: null, ...r })),
    },
  };
  return new AdminReadinessService(prisma as never);
}

const now = new Date("2026-10-04T12:00:00Z");
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("AdminReadinessService.jobHealth", () => {
  it("is healthy when hourly jobs finished cleanly within two hours", async () => {
    const jobs = await svc([
      { name: "care", lastFinishedAt: ago(0.5) },
      { name: "lifecycle", lastFinishedAt: ago(1.5) },
      { name: "digest", lastFinishedAt: ago(48) },
    ]).jobHealth(now);
    expect(jobs.filter((j) => j.status !== "ok")).toEqual([]);
  });

  it("goes stale past two hours, and never/failed are unhealthy too", async () => {
    const jobs = await svc([
      { name: "care", lastFinishedAt: ago(2.5) },
      { name: "lifecycle", lastFinishedAt: ago(0.2), lastError: "boom" },
    ]).jobHealth(now);
    const by = Object.fromEntries(jobs.map((j) => [j.name, j.status]));
    expect(by.care).toBe("stale");
    expect(by.lifecycle).toBe("failed");
    expect(by.digest).toBe("never");
  });
});
