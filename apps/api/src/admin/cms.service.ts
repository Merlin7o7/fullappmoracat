import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateAnnouncementDto,
  CreateFaqDto,
  CreatePostDto,
  UpdateAnnouncementDto,
  UpdateFaqDto,
  UpdatePostDto,
} from "./cms.dto";

/**
 * Admin content management. Publishing a post stamps `publishedAt` the first
 * time so public ordering is stable; re-publishing after archive keeps the
 * original date.
 */
@Injectable()
export class CmsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Blog posts ────────────────────────────────────────────────────────────
  async listPosts() {
    return this.prisma.blogPost.findMany({
      orderBy: { createdAt: "desc" },
      include: { category: { select: { nameEn: true } } },
    });
  }

  async createPost(dto: CreatePostDto) {
    const clash = await this.prisma.blogPost.findUnique({ where: { slug: dto.slug } });
    if (clash) throw new BadRequestException("A post with that slug already exists");
    return this.prisma.blogPost.create({
      data: {
        ...dto,
        publishedAt: dto.status === "PUBLISHED" ? new Date() : null,
      },
    });
  }

  async updatePost(id: string, dto: UpdatePostDto) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException("Post not found");
    return this.prisma.blogPost.update({
      where: { id },
      data: {
        ...dto,
        // First publish stamps the date; later edits keep it.
        publishedAt:
          dto.status === "PUBLISHED" && !post.publishedAt ? new Date() : post.publishedAt,
      },
    });
  }

  async publishPost(id: string, publish: boolean) {
    const post = await this.prisma.blogPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException("Post not found");
    return this.prisma.blogPost.update({
      where: { id },
      data: {
        status: publish ? "PUBLISHED" : "DRAFT",
        publishedAt: publish ? (post.publishedAt ?? new Date()) : post.publishedAt,
      },
    });
  }

  // ── FAQs ──────────────────────────────────────────────────────────────────
  listFaqs() {
    return this.prisma.faq.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] });
  }
  createFaq(dto: CreateFaqDto) {
    return this.prisma.faq.create({ data: dto });
  }
  async updateFaq(id: string, dto: UpdateFaqDto) {
    await this.mustExist(this.prisma.faq, id, "FAQ");
    return this.prisma.faq.update({ where: { id }, data: dto });
  }
  async deleteFaq(id: string) {
    await this.mustExist(this.prisma.faq, id, "FAQ");
    await this.prisma.faq.delete({ where: { id } });
    return { success: true };
  }

  // ── Announcements ─────────────────────────────────────────────────────────
  listAnnouncements() {
    return this.prisma.announcement.findMany({ orderBy: { id: "desc" } });
  }
  createAnnouncement(dto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: {
        ...dto,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
    });
  }
  async updateAnnouncement(id: string, dto: UpdateAnnouncementDto) {
    await this.mustExist(this.prisma.announcement, id, "Announcement");
    return this.prisma.announcement.update({
      where: { id },
      data: {
        ...dto,
        startsAt: dto.startsAt !== undefined ? (dto.startsAt ? new Date(dto.startsAt) : null) : undefined,
        endsAt: dto.endsAt !== undefined ? (dto.endsAt ? new Date(dto.endsAt) : null) : undefined,
      },
    });
  }
  async deleteAnnouncement(id: string) {
    await this.mustExist(this.prisma.announcement, id, "Announcement");
    await this.prisma.announcement.delete({ where: { id } });
    return { success: true };
  }

  private async mustExist(
    delegate: { findUnique: (args: { where: { id: string } }) => Promise<unknown> },
    id: string,
    label: string
  ) {
    const row = await delegate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`${label} not found`);
  }
}
