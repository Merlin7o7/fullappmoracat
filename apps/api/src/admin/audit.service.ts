import { Injectable } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";

const PAGE_SIZE = 30;

/**
 * Read surface over the audit trail. Writes were already thorough across every
 * sensitive mutation; this makes them reviewable in-app (accountability + PDPL).
 */
@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, filters: { action?: string; entityType?: string; actorId?: string } = {}) {
    const where: Prisma.AuditLogWhereInput = {};
    // `action` is a prefix filter (e.g. "community." matches all moderation).
    if (filters.action) where.action = { startsWith: filters.action };
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.actorId) where.userId = filters.actorId;

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          metadata: true,
          ipAddress: true,
          createdAt: true,
          user: { select: { email: true, firstName: true, lastName: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // Distinct actions present, for a filter dropdown in the UI.
    const actions = await this.prisma.auditLog.findMany({
      distinct: ["action"],
      select: { action: true },
      orderBy: { action: "asc" },
      take: 100,
    });

    return {
      items: rows,
      actions: actions.map((a) => a.action),
      pagination: { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    };
  }
}
