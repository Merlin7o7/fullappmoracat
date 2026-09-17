import { Injectable } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { normalizeSaudiPhone } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { CatsService } from "../cats/cats.service";
import { normalizeName } from "../common/text";

/**
 * The cat CRM (MRC-PROD-001 T4): find any cat by Cat ID, microchip, owner
 * phone/email or name, see who owns it and how it entered the record, and
 * fold a duplicate into its survivor. Clinic-created claims are the usual
 * source of twins, so merge lives beside search.
 */
@Injectable()
export class AdminCatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cats: CatsService
  ) {}

  async search(q: string | undefined, page = 1, limit = 20) {
    const raw = (q ?? "").trim();
    const phone = raw ? normalizeSaudiPhone(raw) : null;
    const where: Prisma.CatWhereInput = {
      deletedAt: null,
      ...(raw
        ? {
            OR: [
              { catIdNumber: { equals: raw.toUpperCase().replace(/\s/g, "") } },
              { microchipNo: { contains: raw.replace(/\s/g, "") } },
              { nameNormalized: { contains: normalizeName(raw) } },
              { user: { email: { contains: raw, mode: "insensitive" } } },
              ...(phone ? [{ user: { phone } }, { claimInvites: { some: { phone } } }] : []),
            ],
          }
        : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.cat.count({ where }),
      this.prisma.cat.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, catIdNumber: true, catNumber: true, microchipNo: true, photoUrl: true,
          origin: true, claimStatus: true, status: true, isDemo: true, createdAt: true, claimedAt: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true, phone: true } },
          _count: { select: { vaccinations: true, clinicalEntries: true, visits: true } },
        },
      }),
    ]);
    return {
      items: rows.map((c) => ({
        id: c.id,
        name: c.name,
        catIdNumber: c.catIdNumber,
        catNumber: c.catNumber,
        microchipNo: c.microchipNo,
        photoUrl: c.photoUrl,
        origin: c.origin,
        claimStatus: c.claimStatus,
        status: c.status,
        isDemo: c.isDemo,
        createdAt: c.createdAt,
        claimedAt: c.claimedAt,
        owner: c.claimStatus === "PENDING_CLAIM"
          ? null
          : { id: c.user.id, email: c.user.email, name: [c.user.firstName, c.user.lastName].filter(Boolean).join(" ") || "—", phone: c.user.phone },
        records: c._count,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  merge(actorUserId: string, sourceId: string, targetId: string) {
    return this.cats.merge(sourceId, targetId, { actorUserId, reason: "admin" });
  }
}
