/**
 * Lost & Found — the Cat ID's safety job, made a place.
 *
 * The QR tag already handles "a stranger scans the collar" (PublicCatsService).
 * This is the other half, and the harder one: a cat with no tag, or a tag
 * nobody scanned. A board where a neighbourhood can look.
 *
 * THE THREE RULES THIS FILE ENFORCES
 *
 *  1. **Speed beats completeness.** Someone filing a LOST notice has just lost
 *     their cat. Required fields: what they look like, and when. Everything
 *     else is optional, and a registered cat fills most of it in itself (R002).
 *
 *  2. **The person stays private.** A notice shows a cat, a coarse area and a
 *     relay button. The reporter's email is never published; their phone
 *     appears only if they chose to publish it, and they can change that at any
 *     moment (R106). A signed-out finder may write to them without learning who
 *     they are.
 *
 *  3. **Never claim a match we can't stand behind.** The only automatic
 *     "this might be your cat" is an EXACT microchip match against a registered
 *     cat. Colour and district are search filters for humans, never a
 *     notification — a false reunion is crueller than none (R006).
 */
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type { Prisma } from "@moraqat/db";
import { normalizeSaudiPhone, saudiCityLabel } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import { EventsService } from "../events/events.service";
import { lostFoundMessageTemplate } from "../mail/mail.templates";
import type {
  CreateLostFoundDto,
  LostFoundMessageDto,
  LostFoundQueryDto,
  SetLostFoundStatusDto,
  UpdateLostFoundDto,
} from "./dto/lost-found.dto";

const PAGE_SIZE = 24;
/** A notice can only be written to so often before it becomes harassment. */
const MESSAGES_PER_POST_PER_DAY = 20;
const VIEW_DEDUPE_TTL_MS = 60 * 60 * 1000;
const VIEW_DEDUPE_MAX = 50_000;

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
/** Microchips are written down inconsistently; compare digits only. */
const normalizeChip = (raw: string | null | undefined) =>
  raw ? raw.replace(/\D/g, "") || null : null;

@Injectable()
export class LostFoundService {
  private readonly logger = new Logger("LostFound");
  private readonly viewSeen = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly events: EventsService
  ) {}

  /* ──────────────────────────────────────────────────────────────────────
   * The board
   * ────────────────────────────────────────────────────────────────────*/

  private publicWhere(): Prisma.LostFoundPostWhereInput {
    return {
      hiddenAt: null,
      reporter: { is: { status: "ACTIVE", deletedAt: null } },
    };
  }

  async list(query: LostFoundQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const where: Prisma.LostFoundPostWhereInput = { ...this.publicWhere() };

    if (query.kind) where.kind = query.kind as Prisma.LostFoundPostWhereInput["kind"];
    // Default to live notices; a reunion is browsable on purpose (it is the
    // proof the board works) but never the default view.
    where.status = (query.status ?? "ACTIVE") as Prisma.LostFoundPostWhereInput["status"];
    if (query.cityCode) where.cityCode = query.cityCode;
    if (query.gender) where.gender = query.gender as Prisma.LostFoundPostWhereInput["gender"];

    if (query.search) {
      const chip = normalizeChip(query.search);
      where.OR = [
        { catName: { contains: query.search, mode: "insensitive" } },
        { description: { contains: query.search, mode: "insensitive" } },
        { colorNote: { contains: query.search, mode: "insensitive" } },
        { district: { contains: query.search, mode: "insensitive" } },
        // An exact chip lookup is the single most valuable search here.
        ...(chip && chip.length >= 9 ? [{ microchipNo: chip }] : []),
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.lostFoundPost.findMany({
        where,
        orderBy: [{ happenedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: this.cardSelect(),
      }),
      this.prisma.lostFoundPost.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.toCard(r)),
      pagination: {
        page,
        limit: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
        hasMore: page * PAGE_SIZE < total,
      },
    };
  }

  /** Live counts per kind + the cities with notices — never an empty filter. */
  async facets() {
    const [byKind, byCity, reunited] = await Promise.all([
      this.prisma.lostFoundPost.groupBy({
        by: ["kind"],
        where: { ...this.publicWhere(), status: "ACTIVE" },
        _count: { _all: true },
      }),
      this.prisma.lostFoundPost.groupBy({
        by: ["cityCode"],
        where: { ...this.publicWhere(), status: "ACTIVE", cityCode: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.lostFoundPost.count({ where: { ...this.publicWhere(), status: "REUNITED" } }),
    ]);

    return {
      lost: byKind.find((k) => k.kind === "LOST")?._count._all ?? 0,
      found: byKind.find((k) => k.kind === "FOUND")?._count._all ?? 0,
      // An honest, earned number: cats actually marked home again.
      reunited,
      cities: byCity
        .filter((c) => c.cityCode)
        .map((c) => ({
          code: c.cityCode as string,
          ar: saudiCityLabel(c.cityCode as string, "ar"),
          en: saudiCityLabel(c.cityCode as string, "en"),
          count: c._count._all,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /**
   * One notice. `viewerId` only ever unlocks the viewer's own reporter view —
   * it never widens what a stranger sees.
   */
  async detail(id: string, viewerId?: string | null) {
    const post = await this.prisma.lostFoundPost.findFirst({
      where: { id, hiddenAt: null },
      select: {
        ...this.cardSelect(),
        description: true,
        areaNote: true,
        colorNote: true,
        hasCollar: true,
        microchipNo: true,
        extraPhotos: true,
        contactPref: true,
        contactPhone: true,
        contactEmail: true,
        reporterId: true,
        reunitedAt: true,
        createdAt: true,
        cat: {
          select: {
            id: true,
            name: true,
            photoUrl: true,
            catIdNumber: true,
            publicSlug: true,
            isPublic: true,
            breed: { select: { nameAr: true, nameEn: true } },
          },
        },
        _count: { select: { messages: true } },
      },
    });
    if (!post) throw new NotFoundException("Notice not found");

    const isReporter = !!viewerId && viewerId === post.reporterId;

    return {
      ...this.toCard(post),
      description: post.description,
      areaNote: post.areaNote,
      colorNote: post.colorNote,
      hasCollar: post.hasCollar,
      // A chip number is a key to a cat's identity: shown as "on file" to the
      // public, in full only to the person who wrote it down.
      microchip: post.microchipNo ? { onFile: true, value: isReporter ? post.microchipNo : null } : null,
      photos: post.extraPhotos,
      createdAt: post.createdAt,
      reunitedAt: post.reunitedAt,
      // The Cat ID behind a registered lost cat — proof this is a real,
      // documented animal rather than an anonymous post (R040).
      registeredCat: post.cat
        ? {
            catIdNumber: post.cat.catIdNumber,
            breed: post.cat.breed ? { ar: post.cat.breed.nameAr, en: post.cat.breed.nameEn } : null,
            publicSlug: post.cat.isPublic ? post.cat.publicSlug : null,
          }
        : null,
      // Only what the reporter chose to publish. IN_APP publishes nothing.
      contact: this.publicContact(post.contactPref, post.contactPhone, post.contactEmail),
      viewer: { isReporter },
      messageCount: isReporter ? post._count.messages : undefined,
    };
  }

  async recordView(id: string, ip: string | undefined) {
    const key = `${ip ?? "anon"}:${id}`;
    const now = Date.now();
    const seen = this.viewSeen.get(key);
    if (seen && now - seen < VIEW_DEDUPE_TTL_MS) return;
    if (this.viewSeen.size > VIEW_DEDUPE_MAX) this.viewSeen.clear();
    this.viewSeen.set(key, now);
    await this.prisma.lostFoundPost.updateMany({
      where: { id, hiddenAt: null },
      data: { viewCount: { increment: 1 } },
    });
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Filing and tending a notice
   * ────────────────────────────────────────────────────────────────────*/

  async create(userId: string, dto: CreateLostFoundDto) {
    // A LOST notice may name one of MY registered cats. Ownership is checked
    // here, not trusted from the body: a notice claiming someone else's Cat ID
    // would be a way to solicit their cat.
    let cat: { id: string; name: string; photoUrl: string | null; cityCode: string | null; microchipNo: string | null; gender: string } | null =
      null;
    if (dto.catId) {
      if (dto.kind !== "LOST") {
        throw new BadRequestException({
          code: "LOSTFOUND_FOUND_HAS_CAT",
          message: "A found-cat notice is about a cat nobody has claimed yet.",
        });
      }
      cat = await this.prisma.cat.findFirst({
        where: { id: dto.catId, userId, deletedAt: null },
        select: { id: true, name: true, photoUrl: true, cityCode: true, microchipNo: true, gender: true },
      });
      if (!cat) throw new NotFoundException("Cat not found");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });

    const contact = this.contactData(dto.contactPref, dto.contactPhone, user?.phone ?? null, user?.email ?? null);

    const post = await this.prisma.lostFoundPost.create({
      data: {
        kind: dto.kind,
        reporterId: userId,
        catId: cat?.id ?? null,
        catName: dto.catName ?? cat?.name ?? null,
        description: dto.description,
        cityCode: dto.cityCode ?? cat?.cityCode ?? null,
        district: dto.district ?? null,
        areaNote: dto.areaNote ?? null,
        gender: (dto.gender ?? cat?.gender ?? "UNKNOWN") as Prisma.LostFoundPostCreateInput["gender"],
        colorNote: dto.colorNote ?? null,
        hasCollar: dto.hasCollar ?? null,
        microchipNo: normalizeChip(dto.microchipNo) ?? normalizeChip(cat?.microchipNo) ?? null,
        photoUrl: dto.photoUrl ?? cat?.photoUrl ?? null,
        extraPhotos: dto.extraPhotos?.slice(0, 6) ?? [],
        happenedAt: new Date(dto.happenedAt),
        ...contact,
      },
      select: { id: true, kind: true, catId: true, microchipNo: true },
    });

    // Filing a lost notice IS putting the cat in lost mode — two separate
    // switches for one situation is exactly the kind of effort R002 forbids.
    if (post.catId) {
      await this.prisma.cat.updateMany({
        where: { id: post.catId, userId, lostModeAt: null },
        data: { lostModeAt: new Date() },
      });
      this.events.emit("lost_mode_toggled", { userId, catId: post.catId, props: { on: true, via: "lost_found" } });
    }

    this.events.emit(dto.kind === "LOST" ? "lost_post_created" : "found_post_created", {
      userId,
      catId: post.catId,
      props: { hasChip: !!post.microchipNo, hasPhoto: !!(dto.photoUrl ?? cat?.photoUrl) },
    });

    // The one automatic match we are willing to stand behind.
    if (post.kind === "FOUND" && post.microchipNo) {
      void this.notifyChipMatch(post.id, post.microchipNo).catch((err: Error) =>
        this.logger.warn(`chip match check failed: ${err.message}`)
      );
    }

    return { id: post.id };
  }

  async update(userId: string, id: string, dto: UpdateLostFoundDto) {
    const post = await this.mustOwn(userId, id);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true },
    });
    await this.prisma.lostFoundPost.update({
      where: { id },
      data: {
        catName: dto.catName,
        description: dto.description,
        cityCode: dto.cityCode,
        district: dto.district,
        areaNote: dto.areaNote,
        gender: dto.gender as Prisma.LostFoundPostUpdateInput["gender"],
        colorNote: dto.colorNote,
        hasCollar: dto.hasCollar,
        ...(dto.microchipNo !== undefined ? { microchipNo: normalizeChip(dto.microchipNo) } : {}),
        photoUrl: dto.photoUrl,
        ...(dto.extraPhotos ? { extraPhotos: dto.extraPhotos.slice(0, 6) } : {}),
        ...(dto.happenedAt ? { happenedAt: new Date(dto.happenedAt) } : {}),
        ...(dto.contactPref !== undefined
          ? this.contactData(dto.contactPref, dto.contactPhone, user?.phone ?? null, user?.email ?? null)
          : {}),
      },
    });
    void post;
    return { id, updated: true };
  }

  /**
   * Lost → Reunited is the happiest write in this codebase. It also takes the
   * cat back out of lost mode, because a member who just found their cat
   * should not have to remember a second switch.
   */
  async setStatus(userId: string, id: string, dto: SetLostFoundStatusDto) {
    const post = await this.mustOwn(userId, id);
    const now = new Date();
    await this.prisma.lostFoundPost.update({
      where: { id },
      data: {
        status: dto.status,
        reunitedAt: dto.status === "REUNITED" ? now : null,
        closedAt: dto.status === "CLOSED" ? now : null,
      },
    });

    if (dto.status !== "ACTIVE" && post.catId) {
      await this.prisma.cat.updateMany({
        where: { id: post.catId, userId },
        data: { lostModeAt: null },
      });
      this.events.emit("lost_mode_toggled", { userId, catId: post.catId, props: { on: false, via: "lost_found" } });
    }
    // Re-opening a notice puts the cat back in lost mode too.
    if (dto.status === "ACTIVE" && post.catId && post.kind === "LOST") {
      await this.prisma.cat.updateMany({
        where: { id: post.catId, userId, lostModeAt: null },
        data: { lostModeAt: now },
      });
    }

    if (dto.status === "REUNITED") {
      this.events.emit("lost_found_reunited", { userId, catId: post.catId, props: { kind: post.kind } });
    }
    return { id, status: dto.status };
  }

  /** My notices, with their message counts. */
  async mine(userId: string) {
    const rows = await this.prisma.lostFoundPost.findMany({
      where: { reporterId: userId },
      orderBy: { createdAt: "desc" },
      select: {
        ...this.cardSelect(),
        description: true,
        _count: { select: { messages: true } },
      },
    });
    return {
      items: rows.map((r) => ({
        ...this.toCard(r),
        description: r.description,
        messageCount: r._count.messages,
      })),
    };
  }

  /** The messages on my notice — the whole point of having filed it. */
  async messages(userId: string, id: string) {
    await this.mustOwn(userId, id);
    const rows = await this.prisma.lostFoundMessage.findMany({
      where: { postId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        message: true,
        senderName: true,
        senderPhone: true,
        createdAt: true,
        sender: { select: { firstName: true } },
      },
    });
    return {
      items: rows.map((m) => ({
        id: m.id,
        message: m.message,
        // A signed-in sender's account name is a better answer than the one
        // they typed; either way the reporter sees a name, never an email.
        name: m.sender?.firstName ?? m.senderName ?? null,
        phone: m.senderPhone,
        createdAt: m.createdAt,
      })),
    };
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Reaching the reporter
   * ────────────────────────────────────────────────────────────────────*/

  /**
   * The relay. Open to anyone — including a signed-out neighbour — and it
   * tells the sender only that the message went through.
   */
  async sendMessage(
    id: string,
    dto: LostFoundMessageDto,
    ctx: { userId?: string | null; ip?: string }
  ) {
    const post = await this.prisma.lostFoundPost.findFirst({
      where: { id, hiddenAt: null, status: "ACTIVE" },
      select: {
        id: true,
        kind: true,
        catName: true,
        reporterId: true,
        reporter: { select: { email: true, firstName: true, locale: true } },
      },
    });
    if (!post) throw new NotFoundException("Notice not found");
    if (post.reporterId === ctx.userId) {
      throw new BadRequestException({
        code: "LOSTFOUND_OWN_POST",
        message: "This is your own notice.",
      });
    }

    const since = new Date(Date.now() - 86_400_000);
    const today = await this.prisma.lostFoundMessage.count({
      where: { postId: id, createdAt: { gte: since } },
    });
    if (today >= MESSAGES_PER_POST_PER_DAY) {
      throw new BadRequestException({
        code: "LOSTFOUND_MESSAGE_LIMIT",
        message: "This notice has had a lot of messages today. Try again tomorrow.",
      });
    }

    const senderPhone = dto.senderPhone ? normalizeSaudiPhone(dto.senderPhone) : null;
    await this.prisma.lostFoundMessage.create({
      data: {
        postId: id,
        senderId: ctx.userId ?? null,
        senderName: dto.senderName ?? null,
        senderPhone,
        message: dto.message,
        ipHash: ctx.ip ? createHash("sha256").update(ctx.ip).digest("hex").slice(0, 32) : null,
      },
    });

    const url = `${siteUrl()}/lost-found/${id}`;
    this.notifications.emit(post.reporterId, {
      category: "SYSTEM",
      type: "lost_found_message",
      params: {
        ...(post.catName ? { name: post.catName } : {}),
        message: dto.message.slice(0, 140),
        ...(senderPhone ? { phone: senderPhone } : {}),
      },
      data: { kind: "lost_found", postId: id, url },
    });
    if (post.reporter.email) {
      const tpl = lostFoundMessageTemplate(post.reporter.locale === "en" ? "en" : "ar", {
        kind: post.kind,
        catName: post.catName,
        message: dto.message,
        senderName: dto.senderName ?? null,
        senderPhone,
        url,
      });
      void this.mail
        .send({ to: post.reporter.email, subject: tpl.subject, html: tpl.html, text: tpl.text })
        .catch((err: Error) => this.logger.warn(`lost-found mail failed: ${err.message}`));
    }
    this.events.emit("lost_found_message_sent", {
      userId: ctx.userId ?? null,
      props: { kind: post.kind, withPhone: !!senderPhone },
    });
    return { delivered: true };
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Internals
   * ────────────────────────────────────────────────────────────────────*/

  /**
   * Exact microchip match only. If a found cat's chip matches a registered
   * cat, that cat's owner hears about it — no colour matching, no "cats near
   * you", nothing a human wouldn't call a certainty.
   */
  private async notifyChipMatch(postId: string, chip: string) {
    const matches = await this.prisma.cat.findMany({
      where: { microchipNo: chip, deletedAt: null, claimStatus: "CLAIMED", isDemo: false },
      select: { id: true, name: true, userId: true },
      take: 5,
    });
    const url = `${siteUrl()}/lost-found/${postId}`;
    for (const cat of matches) {
      this.notifications.emit(cat.userId, {
        category: "SYSTEM",
        type: "lost_found_possible_match",
        params: { name: cat.name },
        data: { kind: "lost_found", postId, catId: cat.id, url },
      });
    }
  }

  private async mustOwn(userId: string, id: string) {
    const post = await this.prisma.lostFoundPost.findUnique({
      where: { id },
      select: { id: true, reporterId: true, catId: true, kind: true, status: true },
    });
    if (!post) throw new NotFoundException("Notice not found");
    if (post.reporterId !== userId) throw new ForbiddenException("This isn't your notice");
    return post;
  }

  /**
   * Resolve the reporter's contact choice. Defaults to IN_APP — the relay —
   * because publishing a phone number should always be a deliberate act.
   */
  private contactData(
    pref: string | undefined,
    phone: string | undefined,
    accountPhone: string | null,
    accountEmail: string | null
  ) {
    const contactPref = (pref ?? "IN_APP") as "IN_APP" | "PHONE" | "WHATSAPP" | "EMAIL";
    if (contactPref === "PHONE" || contactPref === "WHATSAPP") {
      const normalized = phone ? normalizeSaudiPhone(phone) : accountPhone;
      if (!normalized) {
        throw new BadRequestException({
          code: "LOSTFOUND_PHONE_REQUIRED",
          message: "Add the number to show, or keep messages inside Moracat.",
        });
      }
      return { contactPref, contactPhone: normalized, contactEmail: null };
    }
    if (contactPref === "EMAIL") {
      if (!accountEmail) {
        throw new BadRequestException({
          code: "LOSTFOUND_EMAIL_REQUIRED",
          message: "Your account has no email to show. Keep messages inside Moracat instead.",
        });
      }
      return { contactPref, contactPhone: null, contactEmail: accountEmail };
    }
    return { contactPref, contactPhone: null, contactEmail: null };
  }

  /** What a stranger may see of the reporter. IN_APP discloses nothing. */
  private publicContact(pref: string, phone: string | null, email: string | null) {
    if (pref === "PHONE" || pref === "WHATSAPP") return { pref, phone, email: null };
    if (pref === "EMAIL") return { pref, phone: null, email };
    return { pref: "IN_APP" as const, phone: null, email: null };
  }

  private cardSelect() {
    return {
      id: true,
      kind: true,
      status: true,
      catName: true,
      photoUrl: true,
      cityCode: true,
      district: true,
      gender: true,
      happenedAt: true,
      viewCount: true,
      catId: true,
    } satisfies Prisma.LostFoundPostSelect;
  }

  private toCard(row: {
    id: string;
    kind: string;
    status: string;
    catName: string | null;
    photoUrl: string | null;
    cityCode: string | null;
    district: string | null;
    gender: string;
    happenedAt: Date;
    viewCount: number;
    catId: string | null;
  }) {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      catName: row.catName,
      photoUrl: row.photoUrl,
      city: row.cityCode
        ? { code: row.cityCode, ar: saudiCityLabel(row.cityCode, "ar"), en: saudiCityLabel(row.cityCode, "en") }
        : null,
      district: row.district,
      gender: row.gender,
      happenedAt: row.happenedAt,
      viewCount: row.viewCount,
      // Whether this notice is backed by a real Cat ID — a badge on the card.
      registered: !!row.catId,
    };
  }
}
