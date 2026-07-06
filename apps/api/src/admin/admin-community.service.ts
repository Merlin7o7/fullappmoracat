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
      title: `${cat.name} was hidden from the community`,
      body: reason
        ? `A moderator hid this public profile. Reason: ${reason}. Contact support if you have questions.`
        : `A moderator hid this public profile. Contact support if you have questions.`,
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
        title: `${cat.name} is featured ⭐`,
        body: `A moderator featured ${cat.name} in the community. They're front and centre now.`,
        data: { kind: "cat_featured", slug: cat.publicSlug },
      });
    }
    return { isFeatured: featured };
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
}
