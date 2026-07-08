import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

const PAGE_SIZE = 20;

/** Admin moderation of community cats + the membership waitlist. */
@Injectable()
export class AdminCommunityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  async listCats(page = 1, filter?: "public" | "hidden" | "featured") {
    const where: Prisma.CatWhereInput = { deletedAt: null, sharedAt: { not: null } };
    if (filter === "hidden") where.hiddenAt = { not: null };
    else if (filter === "public") where.isPublic = true;
    else if (filter === "featured") where.isFeatured = true;

    const [rows, total] = await Promise.all([
      this.prisma.cat.findMany({
        where,
        orderBy: [{ sharedAt: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          publicSlug: true,
          photoUrl: true,
          isPublic: true,
          isFeatured: true,
          hiddenAt: true,
          hiddenReason: true,
          viewCount: true,
          sharedAt: true,
          user: { select: { email: true } },
        },
      }),
      this.prisma.cat.count({ where }),
    ]);

    return {
      items: rows,
      pagination: { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    };
  }

  async hide(actorId: string, catId: string, reason?: string) {
    const cat = await this.prisma.cat.findUnique({
      where: { id: catId },
      select: { id: true, name: true, userId: true },
    });
    if (!cat) throw new NotFoundException("Cat not found");
    await this.prisma.$transaction([
      this.prisma.cat.update({ where: { id: catId }, data: { hiddenAt: new Date(), hiddenReason: reason ?? null } }),
      this.prisma.auditLog.create({
        data: { userId: actorId, action: "community.cat.hide", entityType: "Cat", entityId: catId, metadata: { reason } },
      }),
    ]);
    // Honest-by-default (R006): tell the owner their cat was hidden and why, so
    // it never silently vanishes from the community.
    this.notifications.emit(cat.userId, {
      category: "COMMUNITY",
      type: "cat_hidden",
      params: { name: cat.name, ...(reason ? { reason } : {}) },
      data: { kind: "cat_hidden", catId },
    });
    return { hidden: true };
  }

  async unhide(actorId: string, catId: string) {
    await this.prisma.cat.update({ where: { id: catId }, data: { hiddenAt: null, hiddenReason: null } });
    await this.prisma.auditLog.create({
      data: { userId: actorId, action: "community.cat.unhide", entityType: "Cat", entityId: catId },
    });
    return { hidden: false };
  }

  async setFeatured(actorId: string, catId: string, featured: boolean) {
    const cat = await this.prisma.cat.update({
      where: { id: catId },
      data: { isFeatured: featured, featuredAt: featured ? new Date() : null },
      select: { name: true, userId: true, publicSlug: true },
    });
    await this.prisma.auditLog.create({
      data: { userId: actorId, action: "community.cat.feature", entityType: "Cat", entityId: catId, metadata: { featured } },
    });
    // Celebrate being featured (a genuine honour — R003 value stays visible).
    if (featured) {
      this.notifications.emit(cat.userId, {
        category: "COMMUNITY",
        type: "cat_featured",
        params: { name: cat.name },
        data: { kind: "cat_featured", slug: cat.publicSlug },
      });
    }
    return { isFeatured: featured };
  }

  // ── Reported content — the moderation queue (the at-scale signal) ─────────

  async listReports(page = 1, status: "PENDING" | "RESOLVED" | "DISMISSED" = "PENDING") {
    const where: Prisma.CatReportWhereInput = { status };
    const [rows, total] = await Promise.all([
      this.prisma.catReport.findMany({
        where,
        // Pending: oldest first (work the backlog). Resolved: newest first.
        orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          reason: true,
          detail: true,
          status: true,
          createdAt: true,
          resolvedAt: true,
          resolution: true,
          reporter: { select: { email: true } },
          cat: {
            select: { id: true, name: true, publicSlug: true, photoUrl: true, isPublic: true, hiddenAt: true, likeCount: true },
          },
        },
      }),
      this.prisma.catReport.count({ where }),
    ]);
    // Surface how many reports each cat has accrued (brigade signal).
    const catIds = [...new Set(rows.map((r) => r.cat.id))];
    const counts = await this.prisma.catReport.groupBy({
      by: ["catId"],
      where: { catId: { in: catIds }, status: "PENDING" },
      _count: true,
    });
    const countByCat = new Map(counts.map((c) => [c.catId, c._count]));
    const items = rows.map((r) => ({ ...r, catReportCount: countByCat.get(r.cat.id) ?? 1 }));

    const pendingTotal = status === "PENDING" ? total : await this.prisma.catReport.count({ where: { status: "PENDING" } });
    return {
      items,
      pendingTotal,
      pagination: { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    };
  }

  /**
   * Resolve a report. "hide" hides the cat AND resolves every pending report
   * against it (a cat is judged once, not per-report); "dismiss" clears just
   * this report. Both are audited.
   */
  async resolveReport(actorId: string, reportId: string, action: "hide" | "dismiss", note?: string) {
    const report = await this.prisma.catReport.findUnique({
      where: { id: reportId },
      select: { id: true, catId: true, cat: { select: { name: true, userId: true } } },
    });
    if (!report) throw new NotFoundException("Report not found");

    if (action === "hide") {
      await this.prisma.$transaction([
        this.prisma.cat.update({ where: { id: report.catId }, data: { hiddenAt: new Date(), hiddenReason: note ?? "Reported by the community" } }),
        this.prisma.catReport.updateMany({
          where: { catId: report.catId, status: "PENDING" },
          data: { status: "RESOLVED", resolvedById: actorId, resolvedAt: new Date(), resolution: note ? `hidden: ${note}` : "hidden" },
        }),
        this.prisma.auditLog.create({
          data: { userId: actorId, action: "community.report.hide", entityType: "Cat", entityId: report.catId, metadata: { reportId, note: note ?? null } },
        }),
      ]);
      this.notifications.emit(report.cat.userId, {
        category: "COMMUNITY",
        type: "cat_hidden",
        params: { name: report.cat.name },
        data: { kind: "cat_hidden", catId: report.catId },
      });
      return { resolved: true, hidden: true };
    }

    await this.prisma.$transaction([
      this.prisma.catReport.update({
        where: { id: reportId },
        data: { status: "DISMISSED", resolvedById: actorId, resolvedAt: new Date(), resolution: note ? `dismissed: ${note}` : "dismissed" },
      }),
      this.prisma.auditLog.create({
        data: { userId: actorId, action: "community.report.dismiss", entityType: "CatReport", entityId: reportId, metadata: { note: note ?? null } },
      }),
    ]);
    return { resolved: true, hidden: false };
  }

  async listWaitlist(page = 1) {
    const [rows, total] = await Promise.all([
      this.prisma.waitlistEntry.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.waitlistEntry.count(),
    ]);
    return { items: rows, pagination: { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) } };
  }

  /**
   * The ENTIRE waitlist as a CSV string (not one page). The launch invite list
   * is the point of this table — a page-limited export silently truncated it to
   * 20 rows. Formula-injection-safe cells + a UTF-8 BOM so Arabic cat names
   * survive Excel.
   */
  async exportWaitlistCsv(): Promise<string> {
    const rows = await this.prisma.waitlistEntry.findMany({ orderBy: { createdAt: "desc" } });
    const header = ["email", "catName", "planInterest", "source", "locale", "notifiedAt", "createdAt"];
    const lines = [header.map(csvCell).join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.email,
          r.catName ?? "",
          r.planInterest ?? "",
          r.source ?? "",
          r.locale,
          r.notifiedAt ? r.notifiedAt.toISOString() : "",
          r.createdAt.toISOString(),
        ]
          .map(csvCell)
          .join(",")
      );
    }
    // ﻿ BOM → Excel reads UTF-8; \r\n line endings per RFC 4180.
    return "﻿" + lines.join("\r\n");
  }
}

/**
 * RFC-4180 quote + defuse spreadsheet formula injection: a leading =, +, -, @,
 * tab or CR is prefixed with a single quote so Excel/Sheets treats it as text.
 */
function csvCell(value: string): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
  if (/[",\r\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}
