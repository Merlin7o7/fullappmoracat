/**
 * Moderation for the two new public boards — adoption and Lost & Found.
 *
 * WHY THIS EXISTS
 * Both boards carry `hiddenAt` / `hiddenReason` columns and both public read
 * models filter on them, which is only half a moderation story: without a way
 * to SET those columns, a scam listing or a distressing photo comes down by a
 * database edit, or not at all. Two public surfaces that staff cannot operate
 * are two surfaces that should not be public.
 *
 * It deliberately mirrors the community's posture rather than inventing a
 * second one: post-moderation (visible immediately, hidden on a real signal),
 * an audit row for every action, and the owner told what happened and why —
 * never a silent disappearance (R006, R084).
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";

const PAGE_SIZE = 20;

@Injectable()
export class AdminListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService
  ) {}

  /* ── Adoption ─────────────────────────────────────────────────────────*/

  async listAdoption(page = 1, filter?: "live" | "hidden" | "settled") {
    const where: Prisma.AdoptionListingWhereInput =
      filter === "hidden"
        ? { hiddenAt: { not: null } }
        : filter === "settled"
          ? { status: { in: ["ADOPTED", "WITHDRAWN"] } }
          : { hiddenAt: null, status: { in: ["AVAILABLE", "RESERVED"] } };

    const [rows, total] = await Promise.all([
      this.prisma.adoptionListing.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          status: true,
          story: true,
          feeSar: true,
          cityCode: true,
          viewCount: true,
          hiddenAt: true,
          hiddenReason: true,
          createdAt: true,
          cat: { select: { id: true, name: true, photoUrl: true, catIdNumber: true } },
          owner: { select: { id: true, email: true, firstName: true } },
          _count: { select: { requests: true } },
        },
      }),
      this.prisma.adoptionListing.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        // Enough to judge a listing without opening it; the full story is one
        // click away on the public page.
        excerpt: r.story.slice(0, 220),
        feeSar: r.feeSar,
        cityCode: r.cityCode,
        viewCount: r.viewCount,
        requests: r._count.requests,
        hiddenAt: r.hiddenAt,
        hiddenReason: r.hiddenReason,
        createdAt: r.createdAt,
        cat: r.cat,
        owner: { id: r.owner.id, email: r.owner.email, name: r.owner.firstName },
      })),
      pagination: { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    };
  }

  async hideAdoption(actorId: string, id: string, reason?: string) {
    const listing = await this.prisma.adoptionListing.findUnique({
      where: { id },
      select: { id: true, ownerId: true, cat: { select: { name: true } } },
    });
    if (!listing) throw new NotFoundException("Listing not found");

    await this.prisma.$transaction([
      this.prisma.adoptionListing.update({
        where: { id },
        data: { hiddenAt: new Date(), hiddenReason: reason ?? null },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: "adoption.listing.hide",
          entityType: "AdoptionListing",
          entityId: id,
          metadata: { reason },
        },
      }),
    ]);

    // Never a silent disappearance: the owner is told, and told why (R006).
    this.notifications.emit(listing.ownerId, {
      category: "COMMUNITY",
      type: "listing_hidden",
      params: { name: listing.cat.name, ...(reason ? { reason } : {}) },
      data: { kind: "adoption_listing", listingId: id },
    });
    return { hidden: true };
  }

  async unhideAdoption(actorId: string, id: string) {
    await this.prisma.adoptionListing.update({
      where: { id },
      data: { hiddenAt: null, hiddenReason: null },
    });
    await this.prisma.auditLog.create({
      data: { userId: actorId, action: "adoption.listing.unhide", entityType: "AdoptionListing", entityId: id },
    });
    return { hidden: false };
  }

  /* ── Lost & Found ─────────────────────────────────────────────────────*/

  async listLostFound(page = 1, filter?: "live" | "hidden" | "settled") {
    const where: Prisma.LostFoundPostWhereInput =
      filter === "hidden"
        ? { hiddenAt: { not: null } }
        : filter === "settled"
          ? { status: { in: ["REUNITED", "CLOSED"] } }
          : { hiddenAt: null, status: "ACTIVE" };

    const [rows, total] = await Promise.all([
      this.prisma.lostFoundPost.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          kind: true,
          status: true,
          catName: true,
          description: true,
          photoUrl: true,
          cityCode: true,
          district: true,
          contactPref: true,
          viewCount: true,
          hiddenAt: true,
          hiddenReason: true,
          happenedAt: true,
          createdAt: true,
          cat: { select: { id: true, catIdNumber: true } },
          reporter: { select: { id: true, email: true, firstName: true } },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.lostFoundPost.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        status: r.status,
        catName: r.catName,
        excerpt: r.description.slice(0, 220),
        photoUrl: r.photoUrl,
        cityCode: r.cityCode,
        district: r.district,
        // Whether this reporter published a number — the field most likely to
        // need a moderator's judgement.
        contactPref: r.contactPref,
        viewCount: r.viewCount,
        messages: r._count.messages,
        hiddenAt: r.hiddenAt,
        hiddenReason: r.hiddenReason,
        happenedAt: r.happenedAt,
        createdAt: r.createdAt,
        registeredCatId: r.cat?.id ?? null,
        catIdNumber: r.cat?.catIdNumber ?? null,
        reporter: { id: r.reporter.id, email: r.reporter.email, name: r.reporter.firstName },
      })),
      pagination: { page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    };
  }

  async hideLostFound(actorId: string, id: string, reason?: string) {
    const post = await this.prisma.lostFoundPost.findUnique({
      where: { id },
      select: { id: true, reporterId: true, catName: true },
    });
    if (!post) throw new NotFoundException("Notice not found");

    await this.prisma.$transaction([
      this.prisma.lostFoundPost.update({
        where: { id },
        data: { hiddenAt: new Date(), hiddenReason: reason ?? null },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action: "lostfound.post.hide",
          entityType: "LostFoundPost",
          entityId: id,
          metadata: { reason },
        },
      }),
    ]);

    this.notifications.emit(post.reporterId, {
      category: "SYSTEM",
      type: "listing_hidden",
      params: { name: post.catName ?? "", ...(reason ? { reason } : {}) },
      data: { kind: "lost_found", postId: id },
    });
    return { hidden: true };
  }

  async unhideLostFound(actorId: string, id: string) {
    await this.prisma.lostFoundPost.update({
      where: { id },
      data: { hiddenAt: null, hiddenReason: null },
    });
    await this.prisma.auditLog.create({
      data: { userId: actorId, action: "lostfound.post.unhide", entityType: "LostFoundPost", entityId: id },
    });
    return { hidden: false };
  }
}
