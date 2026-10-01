import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { careState, generateCareTasks, type CareState } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";

const DAY = 86_400_000;

export interface CareTaskView {
  id: string;
  catId: string;
  kind: string;
  title: { ar: string; en: string };
  dueAt: Date;
  state: CareState;
  source: string;
  proposed: boolean;
  completedAt: Date | null;
}

/** The protocol switch — a veterinarian has signed off the kitten series. */
export function careProtocolApproved(): boolean {
  return process.env.CARE_PROTOCOL_APPROVED === "1";
}

/**
 * The care engine (retention, W9). Materialises the pure schedule from
 * @moraqat/core into CareTask rows and lets the owner act on them.
 *
 * Sync is idempotent (catId + seriesKey) and runs on every read, so the list
 * the owner sees is never stale; the hourly job runs it too, so reminders go
 * out for cats nobody opened. Only the owner's decisions are stored (DONE,
 * SKIPPED); upcoming / due / overdue are derived from the date.
 */
@Injectable()
export class CareService {

  constructor(private readonly prisma: PrismaService) {}

  // ── Sync ────────────────────────────────────────────────────────────────

  async syncCat(catId: string, now: Date = new Date()): Promise<void> {
    const cat = await this.prisma.cat.findUnique({
      where: { id: catId },
      select: {
        id: true,
        birthDate: true,
        createdAt: true,
        idIssuedAt: true,
        status: true,
        deletedAt: true,
        vaccinations: { select: { id: true, name: true, administeredAt: true, dueAt: true } },
        weightRecords: { where: { deletedAt: null }, orderBy: { measuredAt: "desc" }, take: 1, select: { measuredAt: true } },
        vetVisits: { orderBy: { visitedAt: "desc" }, take: 1, select: { visitedAt: true } },
        visits: { orderBy: { checkedInAt: "desc" }, take: 1, select: { checkedInAt: true } },
      },
    });
    if (!cat || cat.deletedAt || cat.status !== "ACTIVE") return;

    const lastVisit = [cat.vetVisits[0]?.visitedAt, cat.visits[0]?.checkedInAt]
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const drafts = generateCareTasks({
      now,
      birthDate: cat.birthDate,
      joinedAt: cat.idIssuedAt ?? cat.createdAt,
      vaccinations: cat.vaccinations,
      lastWeighInAt: cat.weightRecords[0]?.measuredAt ?? null,
      lastCheckupAt: lastVisit,
      protocolApproved: careProtocolApproved(),
    });

    const existing = await this.prisma.careTask.findMany({
      where: { catId },
      select: { id: true, seriesKey: true, status: true, source: true },
    });
    const byKey = new Map(existing.map((e) => [e.seriesKey, e]));
    const wanted = new Set(drafts.map((d) => d.seriesKey));

    for (const d of drafts) {
      const hit = byKey.get(d.seriesKey);
      if (hit && hit.status !== "OPEN") continue; // the owner's decision stands
      const data = {
        kind: d.kind,
        titleAr: d.title.ar,
        titleEn: d.title.en,
        dueAt: d.dueAt,
        proposed: d.proposed,
        linkedVaccinationId: d.linkedVaccinationId ?? null,
      };
      if (hit) {
        await this.prisma.careTask.update({ where: { id: hit.id }, data });
      } else {
        await this.prisma.careTask
          .create({ data: { ...data, catId, seriesKey: d.seriesKey, source: "GENERATED" } })
          .catch((e) => {
            // A concurrent sync made it first — same row, nothing to do.
            if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
          });
      }
    }

    // A generated task the record no longer implies (a newer dose arrived, a
    // weigh-in happened) is superseded — removed while still open. Owner
    // tasks and decided tasks are never touched.
    const stale = existing.filter((e) => e.source === "GENERATED" && e.status === "OPEN" && !wanted.has(e.seriesKey));
    if (stale.length) await this.prisma.careTask.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }

  // ── Reads ───────────────────────────────────────────────────────────────

  private view(t: {
    id: string; catId: string; kind: string; titleAr: string; titleEn: string; dueAt: Date;
    status: string; source: string; proposed: boolean; completedAt: Date | null;
  }, now: Date): CareTaskView {
    return {
      id: t.id,
      catId: t.catId,
      kind: t.kind,
      title: { ar: t.titleAr, en: t.titleEn },
      dueAt: t.dueAt,
      state: careState(t, now),
      source: t.source,
      proposed: t.proposed,
      completedAt: t.completedAt,
    };
  }

  async listForCat(userId: string, catId: string) {
    await this.ownedCat(userId, catId);
    const now = new Date();
    await this.syncCat(catId, now);
    const tasks = await this.prisma.careTask.findMany({
      where: {
        catId,
        OR: [{ status: "OPEN" }, { completedAt: { gte: new Date(now.getTime() - 60 * DAY) } }],
      },
      orderBy: { dueAt: "asc" },
    });
    return { protocolApproved: careProtocolApproved(), tasks: tasks.map((t) => this.view(t, now)) };
  }

  /** Every open task across the member's active cats — the «العناية» agenda. */
  async agenda(userId: string) {
    const now = new Date();
    const cats = await this.prisma.cat.findMany({
      where: { userId, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true, photoUrl: true },
    });
    for (const c of cats) await this.syncCat(c.id, now);
    const tasks = await this.prisma.careTask.findMany({
      where: { catId: { in: cats.map((c) => c.id) }, status: "OPEN" },
      orderBy: { dueAt: "asc" },
    });
    const byId = new Map(cats.map((c) => [c.id, c]));
    return {
      protocolApproved: careProtocolApproved(),
      tasks: tasks.map((t) => ({ ...this.view(t, now), cat: byId.get(t.catId) ?? null })),
    };
  }

  // ── Owner actions ───────────────────────────────────────────────────────

  async setStatus(userId: string, taskId: string, status: "DONE" | "SKIPPED" | "OPEN") {
    const task = await this.prisma.careTask.findFirst({
      where: { id: taskId, cat: { userId, deletedAt: null } },
      select: { id: true, kind: true, source: true },
    });
    if (!task) throw new NotFoundException("Care task not found");
    // A medical dose isn't "skipped" by ticking a box — it's recorded, or it
    // stays due. Routine and owner tasks can be skipped.
    if (status === "SKIPPED" && task.kind === "VACCINE" && task.source !== "OWNER") {
      throw new BadRequestException({ code: "CARE_CANNOT_SKIP_VACCINE", message: "Record the dose instead, or leave it due." });
    }
    const updated = await this.prisma.careTask.update({
      where: { id: task.id },
      data: { status, completedAt: status === "OPEN" ? null : new Date() },
    });
    return this.view(updated, new Date());
  }

  async createOwnerTask(userId: string, catId: string, dto: { title: string; dueAt: string; kind?: string }) {
    await this.ownedCat(userId, catId);
    const title = dto.title?.trim().slice(0, 120);
    const due = new Date(dto.dueAt);
    if (!title) throw new BadRequestException("Title is required");
    if (Number.isNaN(due.getTime())) throw new BadRequestException("A valid date is required");
    const kind = ["DEWORM", "FLEA", "DENTAL", "CHECKUP", "CUSTOM"].includes(dto.kind ?? "") ? dto.kind! : "CUSTOM";
    const t = await this.prisma.careTask.create({
      data: {
        catId,
        kind,
        seriesKey: `owner:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`,
        titleAr: title,
        titleEn: title,
        dueAt: due,
        source: "OWNER",
      },
    });
    return this.view(t, new Date());
  }

  async deleteOwnerTask(userId: string, taskId: string) {
    const task = await this.prisma.careTask.findFirst({
      where: { id: taskId, cat: { userId, deletedAt: null } },
      select: { id: true, source: true },
    });
    if (!task) throw new NotFoundException("Care task not found");
    if (task.source !== "OWNER") throw new ForbiddenException("Only tasks you added can be removed");
    await this.prisma.careTask.delete({ where: { id: task.id } });
    return { success: true };
  }

  // ── Weight log (owner) ──────────────────────────────────────────────────

  async listWeights(userId: string, catId: string) {
    await this.ownedCat(userId, catId);
    return this.prisma.catWeightRecord.findMany({
      where: { catId, deletedAt: null },
      orderBy: { measuredAt: "asc" },
      select: { id: true, weightKg: true, bcs: true, measuredAt: true, source: true },
    });
  }

  private validWeight(kg: unknown): number {
    const n = Number(kg);
    // A cat is between ~0.1 kg (newborn) and ~15 kg (a very large Maine Coon).
    if (!Number.isFinite(n) || n < 0.1 || n > 15) {
      throw new BadRequestException({ code: "WEIGHT_OUT_OF_RANGE", message: "Weight must be between 0.1 and 15 kg." });
    }
    return Math.round(n * 100) / 100;
  }

  private validDate(raw: unknown): Date {
    const d = raw ? new Date(String(raw)) : new Date();
    if (Number.isNaN(d.getTime()) || d.getTime() > Date.now() + DAY) {
      throw new BadRequestException({ code: "WEIGHT_DATE_INVALID", message: "Choose a date that isn't in the future." });
    }
    return d;
  }

  async addWeight(userId: string, catId: string, dto: { weightKg: number; measuredAt?: string }) {
    await this.ownedCat(userId, catId);
    const record = await this.prisma.catWeightRecord.create({
      data: { catId, weightKg: this.validWeight(dto.weightKg), measuredAt: this.validDate(dto.measuredAt), source: "owner" },
      select: { id: true, weightKg: true, bcs: true, measuredAt: true, source: true },
    });
    await this.afterWeightChange(catId);
    // Logging a weight is doing the weigh-in.
    await this.prisma.careTask.updateMany({
      where: { catId, kind: "WEIGH_IN", status: "OPEN" },
      data: { status: "DONE", completedAt: new Date() },
    });
    await this.syncCat(catId);
    return record;
  }

  async updateWeight(userId: string, catId: string, weightId: string, dto: { weightKg?: number; measuredAt?: string }) {
    await this.ownedCat(userId, catId);
    const row = await this.ownerWeight(catId, weightId);
    const updated = await this.prisma.catWeightRecord.update({
      where: { id: row.id },
      data: {
        ...(dto.weightKg !== undefined ? { weightKg: this.validWeight(dto.weightKg) } : {}),
        ...(dto.measuredAt !== undefined ? { measuredAt: this.validDate(dto.measuredAt) } : {}),
      },
      select: { id: true, weightKg: true, bcs: true, measuredAt: true, source: true },
    });
    await this.afterWeightChange(catId);
    return updated;
  }

  async deleteWeight(userId: string, catId: string, weightId: string) {
    await this.ownedCat(userId, catId);
    const row = await this.ownerWeight(catId, weightId);
    await this.prisma.catWeightRecord.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
    await this.afterWeightChange(catId);
    return { success: true };
  }

  /** Clinic weights are part of the medical record — owners correct only their own. */
  private async ownerWeight(catId: string, weightId: string) {
    const row = await this.prisma.catWeightRecord.findFirst({
      where: { id: weightId, catId, deletedAt: null },
      select: { id: true, source: true },
    });
    if (!row) throw new NotFoundException("Weight entry not found");
    if (row.source !== "owner") {
      throw new ForbiddenException({ code: "WEIGHT_CLINIC_RECORD", message: "A clinic's weight is part of the medical record and can't be changed here." });
    }
    return row;
  }

  /** The cat's headline weight is always its latest live measurement. */
  private async afterWeightChange(catId: string) {
    const latest = await this.prisma.catWeightRecord.findFirst({
      where: { catId, deletedAt: null },
      orderBy: { measuredAt: "desc" },
      select: { weightKg: true },
    });
    if (latest) await this.prisma.cat.update({ where: { id: catId }, data: { weightKg: latest.weightKg } });
  }

  private async ownedCat(userId: string, catId: string) {
    const cat = await this.prisma.cat.findFirst({ where: { id: catId, userId, deletedAt: null }, select: { id: true } });
    if (!cat) throw new NotFoundException("Cat not found");
    return cat;
  }
}
