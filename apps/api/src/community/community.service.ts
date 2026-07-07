import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeName } from "../common/text";
import type { CommunityQueryDto } from "./dto/community-query.dto";

const PAGE_SIZE = 24;

/**
 * Public community read model. PRIVACY IS LOAD-BEARING HERE: only cats the owner
 * explicitly made public (isPublic) and that aren't hidden by moderation are
 * ever returned, and each optional field (owner name, city, breed, age, gallery)
 * is included only when its per-cat flag is on. Nothing else — no email, phone,
 * address, userId, or the private QR token — is exposed.
 */
@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  private baseWhere(): Prisma.CatWhereInput {
    return {
      isPublic: true,
      hiddenAt: null,
      deletedAt: null,
      status: "ACTIVE",
      // Never surface cats of a deactivated / soft-deleted owner (suspension also
      // hides cats explicitly; this covers the other account states too).
      user: { is: { status: "ACTIVE", deletedAt: null } },
    };
  }

  async list(query: CommunityQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const where: Prisma.CatWhereInput = { ...this.baseWhere() };

    if (query.breedId) where.breedId = query.breedId;
    if (query.gender) where.gender = query.gender as Prisma.CatWhereInput["gender"];
    if (query.stage) where.lifeStage = query.stage as Prisma.CatWhereInput["lifeStage"];
    // Search the Arabic-folded copy so diacritic/tatweel/alef variants all match
    // (R101). Fall back to the raw name for legacy rows not yet backfilled.
    if (query.search) {
      const term = normalizeName(query.search);
      if (term) {
        where.OR = [
          { nameNormalized: { contains: term } },
          { name: { contains: query.search, mode: "insensitive" } },
        ];
      }
    }
    // City filter only matches cats that actually reveal their city (privacy).
    // Merge into the owner constraint from baseWhere rather than replacing it.
    if (query.cityId) {
      where.showCity = true;
      where.user = {
        is: {
          status: "ACTIVE",
          deletedAt: null,
          addresses: { some: { isDefault: true, cityId: query.cityId } },
        },
      };
    }

    // Every sort ends with a unique `id` tiebreaker so pages don't duplicate or
    // skip rows when items share the primary sort value (offset pagination).
    const orderBy: Prisma.CatOrderByWithRelationInput[] =
      query.sort === "viewed"
        ? [{ viewCount: "desc" }, { sharedAt: "desc" }, { id: "desc" }]
        : query.sort === "liked"
          ? [{ likeCount: "desc" }, { sharedAt: "desc" }, { id: "desc" }]
          : query.sort === "featured"
            ? [{ isFeatured: "desc" }, { viewCount: "desc" }, { id: "desc" }]
            : [{ sharedAt: "desc" }, { id: "desc" }];

    const [rows, total] = await Promise.all([
      this.prisma.cat.findMany({
        where,
        orderBy,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: this.cardSelect(),
      }),
      this.prisma.cat.count({ where }),
    ]);

    return {
      items: rows.map((c) => this.toCard(c)),
      pagination: {
        page,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
        hasMore: page * PAGE_SIZE < total,
      },
    };
  }

  async detail(slug: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { publicSlug: slug, ...this.baseWhere() },
      select: {
        ...this.cardSelect(),
        catIdNumber: true,
        idIssuedAt: true,
        coverUrl: true,
        bio: true,
        birthDate: true,
        showGallery: true,
        photos: { orderBy: [{ sortOrder: "asc" }], select: { id: true, url: true } },
        user: {
          select: {
            ownerNickname: true,
            addresses: {
              where: { isDefault: true },
              take: 1,
              select: { city: { select: { nameEn: true, nameAr: true } } },
            },
          },
        },
      },
    });
    if (!cat) throw new NotFoundException("This cat isn't public");

    // Count the visit (best-effort; never blocks the response).
    void this.prisma.cat
      .update({ where: { publicSlug: slug }, data: { viewCount: { increment: 1 } } })
      .catch(() => undefined);

    const card = this.toCard(cat);
    return {
      ...card,
      catIdNumber: cat.catIdNumber,
      issuedAt: cat.idIssuedAt,
      coverUrl: cat.coverUrl,
      bio: cat.bio,
      ownerNickname: cat.showOwnerName ? (cat.user?.ownerNickname ?? null) : null,
      gallery: cat.showGallery ? (cat.photos ?? []) : [],
      birthDate: cat.showAge ? cat.birthDate : null,
    };
  }

  // ── Filter facets (breeds + cities that actually have public cats) ──────────
  async facets() {
    // Distinct breeds among public cats — a grouped aggregate, never a full scan
    // of every public row into Node (that grew linearly with the community).
    const grouped = await this.prisma.cat.groupBy({
      by: ["breedId"],
      where: { ...this.baseWhere(), breedId: { not: null } },
    });
    const breedIds = grouped.map((g) => g.breedId).filter((b): b is string => Boolean(b));
    const [breeds, cities] = await Promise.all([
      this.prisma.breed.findMany({
        where: { id: { in: breedIds } },
        select: { id: true, nameEn: true, nameAr: true },
        orderBy: { nameEn: "asc" },
      }),
      this.prisma.city.findMany({
        where: { isActive: true },
        select: { id: true, nameEn: true, nameAr: true },
        orderBy: { nameEn: "asc" },
      }),
    ]);
    return { breeds, cities };
  }

  // ── Shared selection + privacy-aware mapping ────────────────────────────────
  private cardSelect() {
    return {
      publicSlug: true,
      name: true,
      photoUrl: true,
      gender: true,
      viewCount: true,
      likeCount: true,
      isFeatured: true,
      sharedAt: true,
      lifeStage: true,
      showBreed: true,
      showCity: true,
      showAge: true,
      showOwnerName: true,
      breed: { select: { nameEn: true, nameAr: true } },
      user: {
        select: {
          addresses: {
            where: { isDefault: true },
            take: 1,
            select: { city: { select: { nameEn: true, nameAr: true } } },
          },
        },
      },
    } satisfies Prisma.CatSelect;
  }

  private toCard(c: {
    publicSlug: string | null;
    name: string;
    photoUrl: string | null;
    gender: string;
    viewCount: number;
    likeCount: number;
    isFeatured: boolean;
    lifeStage: string | null;
    showBreed: boolean;
    showCity: boolean;
    showAge: boolean;
    breed?: { nameEn: string; nameAr: string } | null;
    user?: { addresses?: { city: { nameEn: string; nameAr: string } | null }[] } | null;
  }) {
    const city = c.user?.addresses?.[0]?.city ?? null;
    return {
      slug: c.publicSlug,
      name: c.name,
      photoUrl: c.photoUrl,
      gender: c.gender,
      viewCount: c.viewCount,
      likeCount: c.likeCount,
      isFeatured: c.isFeatured,
      breed: c.showBreed ? (c.breed ?? null) : null,
      city: c.showCity ? city : null,
      lifeStage: c.showAge ? c.lifeStage : null,
    };
  }
}
