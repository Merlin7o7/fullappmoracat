/**
 * The adoption marketplace — rehoming, done the way Moracat does everything
 * else: the cat is the hero, the person stays private, and the identity
 * survives the move.
 *
 * WHAT MAKES THIS DIFFERENT FROM A CLASSIFIEDS BOARD
 * A listing is a VIEW onto a real Cat row, not a copy of one. So the page can
 * honestly show "vaccinated, record kept since 2024", and the adopter receives
 * that record — the same Cat ID, the same number, the same vaccination history
 * — through OwnershipService rather than starting a blank file. A rehomed cat
 * does not lose their first years.
 *
 * PRIVACY (load-bearing — read before changing any select)
 * The public read models below never select owner email, phone, address or
 * user id. An adopter reaches an owner through an in-app enquiry; the owner's
 * chosen contact detail is released ONLY to someone they explicitly accepted,
 * and only if they chose to publish one at all (R106, community principle #9).
 *
 * MONEY
 * Moracat takes no cut and handles no payment for an adoption. `feeSar` is the
 * owner's own figure, displayed as their claim, defaulting to zero.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@moraqat/db";
import { normalizeSaudiPhone, saudiCityLabel } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import { NotificationsService } from "../notifications/notifications.service";
import { MailService } from "../mail/mail.service";
import { EventsService } from "../events/events.service";
import { OwnershipService } from "../ownership/ownership.service";
import { adoptionAcceptedTemplate, adoptionRequestTemplate } from "../mail/mail.templates";
import { normalizeName } from "../common/text";
import type {
  AdoptionQueryDto,
  CreateAdoptionRequestDto,
  CreateListingDto,
  DecideAdoptionRequestDto,
  UpdateListingDto,
} from "./dto/adoption.dto";

const PAGE_SIZE = 24;
/** One counted visit per (ip, listing) per hour — same honesty as the feed. */
const VIEW_DEDUPE_TTL_MS = 60 * 60 * 1000;
const VIEW_DEDUPE_MAX = 50_000;

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

@Injectable()
export class AdoptionService {
  private readonly logger = new Logger("Adoption");
  private readonly viewSeen = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
    private readonly events: EventsService,
    private readonly ownership: OwnershipService
  ) {}

  /* ──────────────────────────────────────────────────────────────────────
   * Public browse
   * ────────────────────────────────────────────────────────────────────*/

  /** Only live listings, of live cats, belonging to live accounts. */
  private publicWhere(): Prisma.AdoptionListingWhereInput {
    return {
      status: { in: ["AVAILABLE", "RESERVED"] },
      hiddenAt: null,
      cat: {
        is: {
          deletedAt: null,
          status: "ACTIVE",
          // A demo cat is fictional and must never be offered to a real person.
          isDemo: false,
        },
      },
      owner: { is: { status: "ACTIVE", deletedAt: null } },
    };
  }

  async list(query: AdoptionQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const where: Prisma.AdoptionListingWhereInput = { ...this.publicWhere() };

    if (query.cityCode) where.cityCode = query.cityCode;
    if (query.freeOnly) where.feeSar = 0;

    const catFilters: Prisma.CatWhereInput = {};
    if (query.gender) catFilters.gender = query.gender as Prisma.CatWhereInput["gender"];
    if (query.stage) catFilters.lifeStage = query.stage as Prisma.CatWhereInput["lifeStage"];
    if (query.search) {
      // Arabic-folded search, exactly as the community feed does it (R101).
      const term = normalizeName(query.search);
      if (term) {
        catFilters.OR = [
          { nameNormalized: { contains: term } },
          { name: { contains: query.search, mode: "insensitive" } },
        ];
      }
    }
    if (Object.keys(catFilters).length > 0) {
      where.cat = { is: { ...(where.cat as { is: Prisma.CatWhereInput }).is, ...catFilters } };
    }

    const [rows, total] = await Promise.all([
      this.prisma.adoptionListing.findMany({
        where,
        orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: this.cardSelect(),
      }),
      this.prisma.adoptionListing.count({ where }),
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

  /** Cities that actually have a cat waiting — never a dropdown of nothing. */
  async facets() {
    const rows = await this.prisma.adoptionListing.groupBy({
      by: ["cityCode"],
      where: { ...this.publicWhere(), cityCode: { not: null } },
      _count: { _all: true },
    });
    return {
      cities: rows
        .filter((r) => r.cityCode)
        .map((r) => ({
          code: r.cityCode as string,
          ar: saudiCityLabel(r.cityCode as string, "ar"),
          en: saudiCityLabel(r.cityCode as string, "en"),
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      total: rows.reduce((sum, r) => sum + r._count._all, 0),
    };
  }

  /**
   * One listing, as a visitor sees it.
   *
   * `viewerId` only ever unlocks the viewer's OWN request state and, if the
   * owner accepted them, the contact detail the owner chose to share. It never
   * widens what is shown about the household.
   */
  async detail(id: string, viewerId?: string | null) {
    const listing = await this.prisma.adoptionListing.findFirst({
      where: { id, hiddenAt: null },
      select: {
        ...this.cardSelect(),
        story: true,
        reason: true,
        goodWithKids: true,
        goodWithCats: true,
        goodWithDogs: true,
        district: true,
        contactPref: true,
        contactPhone: true,
        ownerId: true,
        adoptedAt: true,
        owner: { select: { firstName: true, ownerNickname: true, createdAt: true } },
        cat: {
          select: {
            ...this.catSelect(),
            bio: true,
            coatColor: true,
            isNeutered: true,
            weightKg: true,
            isIndoor: true,
            publicSlug: true,
            isPublic: true,
            createdAt: true,
            photos: { orderBy: [{ sortOrder: "asc" }], take: 8, select: { id: true, url: true } },
            vaccinations: { select: { administeredAt: true, dueAt: true } },
          },
        },
        _count: { select: { requests: true } },
      },
    });
    if (!listing) throw new NotFoundException("Listing not found");

    const isOwner = !!viewerId && viewerId === listing.ownerId;
    const myRequest = viewerId
      ? await this.prisma.adoptionRequest.findUnique({
          where: { listingId_requesterId: { listingId: id, requesterId: viewerId } },
          select: { id: true, status: true, message: true, ownerNote: true, createdAt: true },
        })
      : null;

    // The owner's contact detail crosses to exactly one person: someone they
    // accepted. Anyone else — including a pending requester — gets null.
    const contactUnlocked = isOwner || myRequest?.status === "ACCEPTED" || myRequest?.status === "COMPLETED";
    const contact =
      contactUnlocked && listing.contactPref !== "IN_APP"
        ? { pref: listing.contactPref, phone: listing.contactPhone }
        : null;

    return {
      ...this.toCard(listing),
      story: listing.story,
      reason: listing.reason,
      district: listing.district,
      goodWith: {
        kids: listing.goodWithKids,
        cats: listing.goodWithCats,
        dogs: listing.goodWithDogs,
      },
      adoptedAt: listing.adoptedAt,
      // First name or chosen nickname only — never the legal name, never the
      // email, never the city of the household.
      owner: {
        name: listing.owner.ownerNickname ?? listing.owner.firstName ?? null,
        memberSince: listing.owner.createdAt,
      },
      contactPref: listing.contactPref,
      contact,
      cat: {
        ...this.toCatCard(listing.cat),
        bio: listing.cat.bio,
        coatColor: listing.cat.coatColor,
        isNeutered: listing.cat.isNeutered,
        weightKg: listing.cat.weightKg,
        isIndoor: listing.cat.isIndoor,
        // The community profile, when the cat has one — the two surfaces are
        // the same cat and should say so.
        publicSlug: listing.cat.isPublic ? listing.cat.publicSlug : null,
        registeredAt: listing.cat.createdAt,
        photos: listing.cat.photos,
        vaccinationCount: listing.cat.vaccinations.length,
      },
      viewer: {
        isOwner,
        request: myRequest,
      },
      requestCount: isOwner ? listing._count.requests : undefined,
    };
  }

  /** A deduped visit beacon, mirroring the community feed's honesty. */
  async recordView(id: string, ip: string | undefined) {
    const key = `${ip ?? "anon"}:${id}`;
    const now = Date.now();
    const seen = this.viewSeen.get(key);
    if (seen && now - seen < VIEW_DEDUPE_TTL_MS) return;
    if (this.viewSeen.size > VIEW_DEDUPE_MAX) this.viewSeen.clear();
    this.viewSeen.set(key, now);
    await this.prisma.adoptionListing.updateMany({
      where: { id, hiddenAt: null },
      data: { viewCount: { increment: 1 } },
    });
  }

  /* ──────────────────────────────────────────────────────────────────────
   * The owner's side
   * ────────────────────────────────────────────────────────────────────*/

  async create(ownerId: string, dto: CreateListingDto) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: dto.catId, userId: ownerId, deletedAt: null },
      select: { id: true, name: true, status: true, cityCode: true, photoUrl: true },
    });
    if (!cat) throw new NotFoundException("Cat not found");
    if (cat.status !== "ACTIVE") {
      throw new BadRequestException({
        code: "ADOPTION_CAT_NOT_ACTIVE",
        message: "Only an active cat can be listed for adoption.",
      });
    }

    const existing = await this.prisma.adoptionListing.findFirst({
      where: { catId: cat.id, status: { in: ["AVAILABLE", "RESERVED"] } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: "ADOPTION_ALREADY_LISTED",
        message: `${cat.name} is already listed. Edit that listing instead.`,
        listingId: existing.id,
      });
    }

    const listing = await this.prisma.adoptionListing.create({
      data: {
        catId: cat.id,
        ownerId,
        story: dto.story,
        reason: dto.reason ?? null,
        cityCode: dto.cityCode ?? cat.cityCode,
        district: dto.district ?? null,
        feeSar: dto.feeSar ?? 0,
        goodWithKids: dto.goodWithKids ?? null,
        goodWithCats: dto.goodWithCats ?? null,
        goodWithDogs: dto.goodWithDogs ?? null,
        ...this.contactData(dto.contactPref, dto.contactPhone),
      },
      select: { id: true, status: true },
    });

    this.events.emit("adoption_listed", {
      userId: ownerId,
      catId: cat.id,
      props: { hasPhoto: !!cat.photoUrl, fee: dto.feeSar ?? 0 },
    });
    return { id: listing.id, status: listing.status };
  }

  async update(ownerId: string, id: string, dto: UpdateListingDto) {
    const listing = await this.mustOwn(ownerId, id);
    if (listing.status === "ADOPTED") {
      throw new ConflictException({
        code: "ADOPTION_SETTLED",
        message: "This adoption is complete — its listing is kept as it was.",
      });
    }
    await this.prisma.adoptionListing.update({
      where: { id },
      data: {
        story: dto.story,
        reason: dto.reason,
        cityCode: dto.cityCode,
        district: dto.district,
        feeSar: dto.feeSar,
        goodWithKids: dto.goodWithKids,
        goodWithCats: dto.goodWithCats,
        goodWithDogs: dto.goodWithDogs,
        ...(dto.contactPref !== undefined
          ? this.contactData(dto.contactPref, dto.contactPhone)
          : {}),
        // Editing a withdrawn listing puts it back on the board — the same
        // door works in both directions (R010).
        ...(listing.status === "WITHDRAWN" ? { status: "AVAILABLE" as const, withdrawnAt: null } : {}),
      },
    });
    return { id, updated: true };
  }

  /** Take it down. One tap, no reason required, no consequences (R063). */
  async withdraw(ownerId: string, id: string) {
    const listing = await this.mustOwn(ownerId, id);
    if (listing.status === "ADOPTED") {
      throw new ConflictException({
        code: "ADOPTION_SETTLED",
        message: "This cat has already been adopted.",
      });
    }
    await this.prisma.$transaction([
      this.prisma.adoptionListing.update({
        where: { id },
        data: { status: "WITHDRAWN", withdrawnAt: new Date() },
      }),
      // Nobody is left waiting on an answer that will never come.
      this.prisma.adoptionRequest.updateMany({
        where: { listingId: id, status: "PENDING" },
        data: { status: "DECLINED", decidedAt: new Date() },
      }),
    ]);
    return { id, status: "WITHDRAWN" as const };
  }

  /** My listings and my enquiries, in one call — the portal's adoption page. */
  async mine(userId: string) {
    const [listings, requests] = await Promise.all([
      this.prisma.adoptionListing.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          ...this.cardSelect(),
          story: true,
          _count: { select: { requests: { where: { status: "PENDING" } } } },
        },
      }),
      this.prisma.adoptionRequest.findMany({
        where: { requesterId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          message: true,
          ownerNote: true,
          createdAt: true,
          decidedAt: true,
          listing: { select: this.cardSelect() },
        },
      }),
    ]);

    return {
      listings: listings.map((l) => ({
        ...this.toCard(l),
        story: l.story,
        pendingRequests: l._count.requests,
      })),
      requests: requests.map((r) => ({
        id: r.id,
        status: r.status,
        message: r.message,
        ownerNote: r.ownerNote,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        listing: this.toCard(r.listing),
      })),
    };
  }

  /** The enquiries on one of my listings. Owner-only. */
  async requestsFor(ownerId: string, listingId: string) {
    await this.mustOwn(ownerId, listingId);
    const rows = await this.prisma.adoptionRequest.findMany({
      where: { listingId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        status: true,
        message: true,
        ownerNote: true,
        createdAt: true,
        decidedAt: true,
        requester: {
          select: {
            id: true,
            firstName: true,
            ownerNickname: true,
            createdAt: true,
            email: true,
            _count: { select: { cats: true } },
          },
        },
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        status: r.status,
        message: r.message,
        ownerNote: r.ownerNote,
        createdAt: r.createdAt,
        decidedAt: r.decidedAt,
        requester: {
          name: r.requester.ownerNickname ?? r.requester.firstName ?? null,
          memberSince: r.requester.createdAt,
          catsRegistered: r.requester._count.cats,
          // Released only once they have accepted this person — it is how the
          // two arrange to meet. The enquiry dialog says so in as many words;
          // keep that copy and this rule in step.
          email: r.status === "ACCEPTED" || r.status === "COMPLETED" ? r.requester.email : null,
        },
      })),
    };
  }

  /* ──────────────────────────────────────────────────────────────────────
   * The adopter's side
   * ────────────────────────────────────────────────────────────────────*/

  async request(userId: string, listingId: string, dto: CreateAdoptionRequestDto) {
    const listing = await this.prisma.adoptionListing.findFirst({
      where: { id: listingId, ...this.publicWhere() },
      select: {
        id: true,
        ownerId: true,
        status: true,
        cat: { select: { id: true, name: true } },
        owner: { select: { email: true, firstName: true, locale: true } },
      },
    });
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.ownerId === userId) {
      throw new BadRequestException({
        code: "ADOPTION_OWN_LISTING",
        message: "This is your own listing.",
      });
    }

    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, ownerNickname: true },
    });

    const request = await this.prisma.adoptionRequest.upsert({
      where: { listingId_requesterId: { listingId, requesterId: userId } },
      // A second send edits the first rather than spamming the owner.
      update: { message: dto.message, status: "PENDING", decidedAt: null, ownerNote: null },
      create: { listingId, requesterId: userId, message: dto.message },
      select: { id: true, status: true },
    });

    const url = `${siteUrl()}/portal/adoption?listing=${listingId}`;
    const who = me?.ownerNickname ?? me?.firstName ?? null;
    this.notifications.emit(listing.ownerId, {
      category: "COMMUNITY",
      type: "adoption_request_received",
      params: { name: listing.cat.name, who: who ?? "" },
      data: { kind: "adoption_request", listingId, requestId: request.id, url },
    });
    if (listing.owner.email) {
      const tpl = adoptionRequestTemplate(listing.owner.locale === "en" ? "en" : "ar", {
        catName: listing.cat.name,
        requesterName: who,
        message: dto.message,
        url,
      });
      void this.mail
        .send({ to: listing.owner.email, subject: tpl.subject, html: tpl.html, text: tpl.text })
        .catch((err: Error) => this.logger.warn(`adoption mail failed: ${err.message}`));
    }
    this.events.emit("adoption_requested", { userId, catId: listing.cat.id });
    return { id: request.id, status: request.status };
  }

  /** The requester changes their mind. */
  async withdrawRequest(userId: string, requestId: string) {
    const request = await this.prisma.adoptionRequest.findFirst({
      where: { id: requestId, requesterId: userId },
      select: { id: true, status: true },
    });
    if (!request) throw new NotFoundException("Request not found");
    if (request.status === "COMPLETED") {
      throw new ConflictException({ code: "ADOPTION_SETTLED", message: "This adoption is already complete." });
    }
    await this.prisma.adoptionRequest.update({
      where: { id: requestId },
      data: { status: "WITHDRAWN", decidedAt: new Date() },
    });
    return { id: requestId, status: "WITHDRAWN" as const };
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Deciding
   * ────────────────────────────────────────────────────────────────────*/

  /**
   * The owner picks someone. This RESERVES the cat and introduces the two
   * sides — it does not move the cat. The hand-over is a separate, deliberate
   * act (`handover`), because meeting the adopter comes before giving them the
   * animal, and the product should not pretend otherwise.
   */
  async acceptRequest(ownerId: string, requestId: string, dto: DecideAdoptionRequestDto) {
    const request = await this.prisma.adoptionRequest.findFirst({
      where: { id: requestId, listing: { ownerId } },
      select: {
        id: true,
        status: true,
        requesterId: true,
        listingId: true,
        listing: {
          select: {
            id: true,
            status: true,
            contactPref: true,
            cat: { select: { id: true, name: true } },
            owner: { select: { firstName: true, ownerNickname: true } },
          },
        },
        requester: { select: { email: true, locale: true } },
      },
    });
    if (!request) throw new NotFoundException("Request not found");
    if (request.listing.status === "ADOPTED") {
      throw new ConflictException({ code: "ADOPTION_SETTLED", message: "This cat has already been adopted." });
    }
    if (request.status === "WITHDRAWN") {
      throw new ConflictException({
        code: "ADOPTION_REQUEST_WITHDRAWN",
        message: "They've withdrawn their enquiry.",
      });
    }

    await this.prisma.$transaction([
      this.prisma.adoptionRequest.update({
        where: { id: requestId },
        data: {
          status: "ACCEPTED",
          decidedAt: new Date(),
          ownerNote: dto.note ?? null,
          contactSharedAt: request.listing.contactPref === "IN_APP" ? null : new Date(),
        },
      }),
      this.prisma.adoptionListing.update({
        where: { id: request.listingId },
        data: { status: "RESERVED", reservedAt: new Date() },
      }),
    ]);

    const url = `${siteUrl()}/adopt/${request.listingId}`;
    this.notifications.emit(request.requesterId, {
      category: "COMMUNITY",
      type: "adoption_request_accepted",
      params: { name: request.listing.cat.name },
      data: { kind: "adoption_request", listingId: request.listingId, url },
    });
    if (request.requester.email) {
      const tpl = adoptionAcceptedTemplate(request.requester.locale === "en" ? "en" : "ar", {
        catName: request.listing.cat.name,
        ownerName: request.listing.owner.ownerNickname ?? request.listing.owner.firstName ?? null,
        ownerNote: dto.note ?? null,
        url,
      });
      void this.mail
        .send({ to: request.requester.email, subject: tpl.subject, html: tpl.html, text: tpl.text })
        .catch((err: Error) => this.logger.warn(`adoption accept mail failed: ${err.message}`));
    }
    this.events.emit("adoption_request_accepted", { userId: ownerId, catId: request.listing.cat.id });
    return { id: requestId, status: "ACCEPTED" as const };
  }

  /** A "no" that is still kind — the requester hears back either way (R084). */
  async declineRequest(ownerId: string, requestId: string, dto: DecideAdoptionRequestDto) {
    const request = await this.prisma.adoptionRequest.findFirst({
      where: { id: requestId, listing: { ownerId } },
      select: {
        id: true,
        status: true,
        requesterId: true,
        listingId: true,
        listing: { select: { status: true, cat: { select: { name: true } } } },
      },
    });
    if (!request) throw new NotFoundException("Request not found");
    if (request.status === "COMPLETED") {
      throw new ConflictException({ code: "ADOPTION_SETTLED", message: "This adoption is already complete." });
    }

    await this.prisma.$transaction([
      this.prisma.adoptionRequest.update({
        where: { id: requestId },
        data: { status: "DECLINED", decidedAt: new Date(), ownerNote: dto.note ?? null, contactSharedAt: null },
      }),
      // Declining the person we had reserved for puts the cat back on the board.
      ...(request.status === "ACCEPTED" && request.listing.status === "RESERVED"
        ? [
            this.prisma.adoptionListing.update({
              where: { id: request.listingId },
              data: { status: "AVAILABLE", reservedAt: null },
            }),
          ]
        : []),
    ]);

    this.notifications.emit(request.requesterId, {
      category: "COMMUNITY",
      type: "adoption_request_declined",
      params: { name: request.listing.cat.name, ...(dto.note ? { note: dto.note } : {}) },
      data: { kind: "adoption_request", listingId: request.listingId, url: `${siteUrl()}/adopt` },
    });
    return { id: requestId, status: "DECLINED" as const };
  }

  /**
   * The hand-over. Sends the accepted adopter a Cat ID transfer through
   * OwnershipService — one transactional path for every change of owner, so
   * adoption can never invent a second, weaker one.
   */
  async handover(ownerId: string, requestId: string, confirmCatName: string) {
    const request = await this.prisma.adoptionRequest.findFirst({
      where: { id: requestId, listing: { ownerId } },
      select: {
        id: true,
        status: true,
        listingId: true,
        requester: { select: { email: true } },
        listing: { select: { id: true, catId: true, status: true } },
      },
    });
    if (!request) throw new NotFoundException("Request not found");
    if (request.status !== "ACCEPTED") {
      throw new ConflictException({
        code: "ADOPTION_NOT_ACCEPTED",
        message: "Accept this adopter first — then you can hand the Cat ID over.",
      });
    }

    return this.ownership.start(
      ownerId,
      request.listing.catId,
      {
        toEmail: request.requester.email,
        confirmCatName,
        reason: "ADOPTION",
      },
      { listingId: request.listingId }
    );
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Internals
   * ────────────────────────────────────────────────────────────────────*/

  private async mustOwn(ownerId: string, id: string) {
    const listing = await this.prisma.adoptionListing.findUnique({
      where: { id },
      select: { id: true, ownerId: true, status: true, catId: true },
    });
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.ownerId !== ownerId) throw new ForbiddenException("This isn't your listing");
    return listing;
  }

  /** Normalise the contact choice so a stale number can never linger. */
  private contactData(pref: string | undefined, phone: string | undefined) {
    const contactPref = (pref ?? "IN_APP") as "IN_APP" | "PHONE" | "WHATSAPP" | "EMAIL";
    if (contactPref === "PHONE" || contactPref === "WHATSAPP") {
      const normalized = phone ? normalizeSaudiPhone(phone) : null;
      if (!normalized) {
        throw new BadRequestException({
          code: "ADOPTION_PHONE_REQUIRED",
          message: "Add the mobile number adopters should reach you on, or choose in-app messages.",
        });
      }
      return { contactPref, contactPhone: normalized };
    }
    // Switching back to in-app or email must actually drop the number.
    return { contactPref, contactPhone: null };
  }

  private catSelect() {
    return {
      id: true,
      name: true,
      photoUrl: true,
      gender: true,
      birthDate: true,
      lifeStage: true,
      catIdNumber: true,
      vaccinationStatus: true,
      breed: { select: { nameAr: true, nameEn: true } },
    } satisfies Prisma.CatSelect;
  }

  private cardSelect() {
    return {
      id: true,
      status: true,
      cityCode: true,
      feeSar: true,
      publishedAt: true,
      viewCount: true,
      cat: { select: this.catSelect() },
    } satisfies Prisma.AdoptionListingSelect;
  }

  private toCatCard(cat: {
    id: string;
    name: string;
    photoUrl: string | null;
    gender: string;
    birthDate: Date | null;
    lifeStage: string | null;
    catIdNumber: string | null;
    vaccinationStatus: string | null;
    breed: { nameAr: string; nameEn: string } | null;
  }) {
    return {
      id: cat.id,
      name: cat.name,
      photoUrl: cat.photoUrl,
      gender: cat.gender,
      birthDate: cat.birthDate,
      ageMonths: monthsSince(cat.birthDate),
      lifeStage: cat.lifeStage,
      // Proof the identity is real and travels — the number itself, not a claim.
      catIdNumber: cat.catIdNumber,
      vaccinationStatus: cat.vaccinationStatus,
      breed: cat.breed ? { ar: cat.breed.nameAr, en: cat.breed.nameEn } : null,
    };
  }

  private toCard(row: {
    id: string;
    status: string;
    cityCode: string | null;
    feeSar: number;
    publishedAt: Date;
    viewCount: number;
    cat: Parameters<AdoptionService["toCatCard"]>[0];
  }) {
    return {
      id: row.id,
      status: row.status,
      city: row.cityCode
        ? { code: row.cityCode, ar: saudiCityLabel(row.cityCode, "ar"), en: saudiCityLabel(row.cityCode, "en") }
        : null,
      feeSar: row.feeSar,
      publishedAt: row.publishedAt,
      viewCount: row.viewCount,
      cat: this.toCatCard(row.cat),
    };
  }
}

/** Whole months since a birth date — null when the owner never knew it. */
function monthsSince(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const months =
    (new Date().getFullYear() - birthDate.getFullYear()) * 12 +
    (new Date().getMonth() - birthDate.getMonth());
  return months >= 0 ? months : null;
}
