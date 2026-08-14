import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeName } from "../common/text";
import type { CommunityQueryDto } from "./dto/community-query.dto";

const PAGE_SIZE = 24;

/**
 * Cats shared before this date carry a "founding member" chip — a tenure fact
 * (like "member since"), never points or gamification. Keep in sync with the
 * web's copy if it ever moves.
 */
export const FOUNDING_CUTOFF = new Date("2026-09-01T00:00:00Z");

/** One counted visit per (ip, slug) per hour — naive but honest. */
const VIEW_DEDUPE_TTL_MS = 60 * 60 * 1000;
/** Hard cap on the dedupe map so a scan can't grow memory unbounded. */
const VIEW_DEDUPE_MAX = 50_000;

/**
 * Public community read model. PRIVACY IS LOAD-BEARING HERE: cats are shared by
 * default at registration (opt-out, decision 2026-08-14), so this filter is the
 * whole contract — only non-hidden, photo-bearing, active cats of active owners
 * whose isPublic flag is still on are ever returned, and each optional field
 * (owner name, city, breed, age, gallery) is included only when its per-cat
 * flag is on. Nothing else — no email, phone, address, userId, or the private
 * QR token — is exposed.
 */
@Injectable()
export class CommunityService {
  constructor(private readonly prisma: PrismaService) {}

  /** ip+slug → timestamp of the last counted view (in-memory, best-effort). */
  private readonly viewSeen = new Map<string, number>();

  private baseWhere(): Prisma.CatWhereInput {
    return {
      isPublic: true,
      hiddenAt: null,
      deletedAt: null,
      status: "ACTIVE",
      // Never surface cats of a deactivated / soft-deleted owner (suspension also
      // hides cats explicitly; this covers the other account states too).
      user: { is: { status: "ACTIVE", deletedAt: null } },
      // Demo cats are fictional and exist only to show the vet portal to
      // prospective partners. They must never appear to a real member.
      isDemo: false,
      // A card without a photo is an empty frame — cats join the feed the moment
      // a photo lands, automatically, with zero event plumbing (the opt-out
      // default publishes photo-less cats too; this keeps them invisible).
      photoUrl: { not: null },
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

    // "Featured" is an honest collection, not a sort trick: it returns ONLY cats
    // an admin actually featured (the web hides the door when it's empty). No
    // "viewed" sort exists — see the query DTO for why (R006).
    if (query.sort === "featured") where.isFeatured = true;

    // Every sort ends with a unique `id` tiebreaker so pages don't duplicate or
    // skip rows when items share the primary sort value (offset pagination).
    const orderBy: Prisma.CatOrderByWithRelationInput[] =
      query.sort === "liked"
        ? [{ likeCount: "desc" }, { sharedAt: "desc" }, { id: "desc" }]
        : query.sort === "featured"
          ? [{ featuredAt: "desc" }, { id: "desc" }]
          : // "new" / "recent" (alias) / default — most recently shared first.
            [{ sharedAt: "desc" }, { id: "desc" }];

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

    // NOTE: views are counted by POST /community/cats/:slug/view (deduped,
    // beacon-driven) — a GET must never mutate, and bots/prefetchers hammering
    // this endpoint were inflating the number (R006: honest by default).

    const card = this.toCard(cat);
    return {
      ...card,
      catIdNumber: cat.catIdNumber,
      issuedAt: cat.idIssuedAt,
      coverUrl: cat.coverUrl,
      bio: cat.bio,
      ownerNickname: cat.showOwnerName ? (cat.user?.ownerNickname ?? null) : null,
      gallery: cat.showGallery ? (cat.photos ?? []) : [],
      // Consent correctness: "show age" means the AGE, not the birth date. The
      // raw date never leaves the API — visitors get a coarse month tally the
      // web renders as "2y 3m" (or the life stage when no date is on file).
      ageMonths: cat.showAge && cat.birthDate ? monthsSince(cat.birthDate) : null,
    };
  }

  /**
   * Truthful view counting: one increment per (ip, slug) per hour, fired by the
   * profile page's client-side beacon. In-memory dedupe is deliberate — approx.
   * is fine (the owner-facing label says so), lying upward is not.
   */
  async recordView(slug: string, ip: string | undefined) {
    const key = `${ip ?? "?"}:${slug}`;
    const now = Date.now();
    const seen = this.viewSeen.get(key);
    if (seen && now - seen < VIEW_DEDUPE_TTL_MS) return { counted: false };

    // Opportunistic sweep + hard cap so the map can't grow without bound.
    if (this.viewSeen.size >= VIEW_DEDUPE_MAX) {
      for (const [k, t] of this.viewSeen) {
        if (now - t >= VIEW_DEDUPE_TTL_MS) this.viewSeen.delete(k);
      }
      if (this.viewSeen.size >= VIEW_DEDUPE_MAX) this.viewSeen.clear();
    }
    this.viewSeen.set(key, now);

    // Only public cats count — and a miss is a silent no-op (beacons never error).
    const { count } = await this.prisma.cat.updateMany({
      where: { publicSlug: slug, ...this.baseWhere() },
      data: { viewCount: { increment: 1 } },
    });
    return { counted: count > 0 };
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
    const [breeds, cities, featuredCount] = await Promise.all([
      this.prisma.breed.findMany({
        where: { id: { in: breedIds } },
        select: { id: true, nameEn: true, nameAr: true },
        orderBy: { nameEn: "asc" },
      }),
      // Mirror the breeds facet: only cities where a public, city-revealing cat
      // actually lives — a filter that can return zero results is a broken door.
      this.prisma.city.findMany({
        where: {
          isActive: true,
          addresses: {
            some: {
              isDefault: true,
              user: {
                status: "ACTIVE",
                deletedAt: null,
                cats: {
                  some: {
                    isPublic: true,
                    hiddenAt: null,
                    deletedAt: null,
                    status: "ACTIVE",
                    isDemo: false,
                    photoUrl: { not: null },
                    showCity: true,
                  },
                },
              },
            },
          },
        },
        select: { id: true, nameEn: true, nameAr: true },
        orderBy: { nameEn: "asc" },
      }),
      // Lets the web hide the Featured door entirely while nothing is featured.
      this.prisma.cat.count({ where: { ...this.baseWhere(), isFeatured: true } }),
    ]);
    return { breeds, cities, featuredCount };
  }

  // ── Shared selection + privacy-aware mapping ────────────────────────────────
  private cardSelect() {
    return {
      publicSlug: true,
      name: true,
      photoUrl: true,
      gender: true,
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
    likeCount: number;
    isFeatured: boolean;
    sharedAt: Date | null;
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
      // viewCount is deliberately NOT public: it stays an owner-only, clearly
      // "approx." number. Love (likes) is the one public signal.
      likeCount: c.likeCount,
      isFeatured: c.isFeatured,
      // Tenure fact, never points: shared before the founding cutoff.
      isFounding: Boolean(c.sharedAt && c.sharedAt < FOUNDING_CUTOFF),
      breed: c.showBreed ? (c.breed ?? null) : null,
      city: c.showCity ? city : null,
      lifeStage: c.showAge ? c.lifeStage : null,
    };
  }
}

/** Whole months elapsed since `date` (floored at zero). */
function monthsSince(date: Date): number {
  const now = new Date();
  let months = (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (now.getDate() < date.getDate()) months -= 1;
  return Math.max(0, months);
}
