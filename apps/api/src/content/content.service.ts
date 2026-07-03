import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Public content reads — only PUBLISHED (and date-valid) content ever leaves here. */
@Injectable()
export class ContentService {
  constructor(private readonly prisma: PrismaService) {}

  async blogList(page = 1, limit = 9) {
    const where = { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.blogPost.count({ where }),
      this.prisma.blogPost.findMany({
        where,
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: { category: { select: { slug: true, nameEn: true, nameAr: true } } },
      }),
    ]);
    return {
      items: rows.map((p) => ({
        slug: p.slug,
        titleEn: p.titleEn,
        titleAr: p.titleAr,
        excerptEn: p.excerptEn,
        excerptAr: p.excerptAr,
        coverUrl: p.coverUrl,
        authorName: p.authorName,
        publishedAt: p.publishedAt,
        category: p.category,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async blogPost(slug: string) {
    const post = await this.prisma.blogPost.findFirst({
      where: { slug, status: "PUBLISHED", publishedAt: { lte: new Date() } },
      include: { category: { select: { slug: true, nameEn: true, nameAr: true } } },
    });
    if (!post) throw new NotFoundException("Post not found");
    return post;
  }

  async faqs() {
    return this.prisma.faq.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    });
  }

  async announcements() {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        status: "PUBLISHED",
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: { id: "desc" },
      take: 3,
    });
  }

  async testimonials() {
    return this.prisma.testimonial.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { sortOrder: "asc" },
      take: 12,
    });
  }
}
