import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

/** Like tallies at which we nudge the owner — enough to feel loved, never spammy. */
const LIKE_MILESTONES = new Set([1, 5, 10, 25, 50, 100, 250, 500, 1000]);

/**
 * "Love" for public cats. A like is one idempotent (user, cat) row; the cat's
 * denormalized `likeCount` is advanced atomically in the same transaction so the
 * "Most Loved" sort reads an indexed integer, never a live COUNT.
 */
@Injectable()
export class CommunityLikesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  private async publicCatBySlug(slug: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { publicSlug: slug, isPublic: true, hiddenAt: null, deletedAt: null, status: "ACTIVE" },
      select: { id: true, name: true, userId: true, publicSlug: true },
    });
    if (!cat) throw new NotFoundException("This cat isn't public");
    return cat;
  }

  async like(userId: string, slug: string) {
    const cat = await this.publicCatBySlug(slug);

    // Idempotent: create the like + bump the tally atomically only when the row
    // is genuinely new (P2002 = already liked → no double count).
    let created = false;
    let likeCount: number;
    try {
      const [, updated] = await this.prisma.$transaction([
        this.prisma.catLike.create({ data: { userId, catId: cat.id } }),
        this.prisma.cat.update({
          where: { id: cat.id },
          data: { likeCount: { increment: 1 } },
          select: { likeCount: true },
        }),
      ]);
      created = true;
      likeCount = updated.likeCount;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const c = await this.prisma.cat.findUnique({
          where: { id: cat.id },
          select: { likeCount: true },
        });
        likeCount = c?.likeCount ?? 0;
      } else {
        throw e;
      }
    }

    // Tell the owner their cat is loved — at milestones only, never for self-likes.
    if (created && cat.userId !== userId && LIKE_MILESTONES.has(likeCount)) {
      this.notifications.emit(cat.userId, {
        category: "COMMUNITY",
        type: likeCount === 1 ? "cat_first_like" : "cat_like_milestone",
        params: { name: cat.name, likeCount },
        data: { kind: "cat_like_milestone", slug: cat.publicSlug, likeCount },
      });
    }

    return { liked: true, likeCount };
  }

  async unlike(userId: string, slug: string) {
    const cat = await this.publicCatBySlug(slug);
    const existing = await this.prisma.catLike.findUnique({
      where: { userId_catId: { userId, catId: cat.id } },
      select: { id: true },
    });
    if (!existing) {
      const c = await this.prisma.cat.findUnique({
        where: { id: cat.id },
        select: { likeCount: true },
      });
      return { liked: false, likeCount: c?.likeCount ?? 0 };
    }
    const [, updated] = await this.prisma.$transaction([
      this.prisma.catLike.delete({ where: { id: existing.id } }),
      this.prisma.cat.update({
        where: { id: cat.id },
        // Guard the floor: never let a race drive the tally below zero.
        data: { likeCount: { decrement: 1 } },
        select: { likeCount: true },
      }),
    ]);
    const likeCount = Math.max(0, updated.likeCount);
    return { liked: false, likeCount };
  }

  /**
   * Report a public cat. Idempotent per (cat, reporter) — a member reporting the
   * same cat twice updates their existing report rather than stacking. Feeds the
   * admin moderation queue (the primary at-scale signal).
   */
  async report(userId: string, slug: string, reason: string, detail?: string) {
    const cat = await this.publicCatBySlug(slug);

    // ANIMAL_WELFARE is accepted at the API but the DB enum doesn't carry it yet
    // (adding an enum value needs a migration — out of this change's scope). It
    // is stored as OTHER with a machine-greppable bilingual prefix so moderators
    // still see exactly what the reporter meant, and nothing is silently lost.
    // Promote to a real enum value in the next schema migration, then drop this.
    let stored = reason;
    let storedDetail = detail;
    if (reason === "ANIMAL_WELFARE") {
      stored = "OTHER";
      storedDetail = `[ANIMAL_WELFARE] قلق على سلامة الحيوان / Concern for the animal's welfare${
        detail ? ` — ${detail}` : ""
      }`;
    }

    await this.prisma.catReport.upsert({
      where: { catId_reporterId: { catId: cat.id, reporterId: userId } },
      update: { reason: stored as never, detail: storedDetail, status: "PENDING", resolvedAt: null, resolvedById: null },
      create: { catId: cat.id, reporterId: userId, reason: stored as never, detail: storedDetail },
    });
    return { reported: true };
  }

  /** Slugs the member has liked — lets the browse grid render filled hearts. */
  async myLikedSlugs(userId: string): Promise<string[]> {
    const rows = await this.prisma.catLike.findMany({
      where: { userId, cat: { publicSlug: { not: null } } },
      select: { cat: { select: { publicSlug: true } } },
    });
    return rows.map((r) => r.cat.publicSlug).filter((s): s is string => Boolean(s));
  }
}
