/**
 * Visits — MRC-VET-001 §09.
 *
 * A visit is one episode of care. It exists so the timeline reads as visits
 * rather than a flat wall of records, and so the moment care ends can become a
 * message home. The closing act of a standard visit is not paperwork: it is the
 * owner's summary. That is where the portal stops being clinic software and
 * starts being the member's experience.
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import {
  VetPatientsService,
  staffLabel,
  vetBadRequest,
  vetConflict,
  vetNotFound,
  type VetActor,
} from "./vet-patients.service";
import type {
  CloseVisitDto,
  ListVisitsQueryDto,
  OpenVisitDto,
  OwnerSummaryDto,
  UpdateVisitDto,
} from "./dto/vet-visit.dto";

const PAGE_DEFAULT = 20;

const VISIT_SELECT = {
  id: true,
  catId: true,
  orgId: true,
  branchId: true,
  mode: true,
  state: true,
  reason: true,
  presentingComplaint: true,
  checkedInAt: true,
  closedAt: true,
  ownerSummary: true,
  summarySentAt: true,
  followUpAt: true,
  cat: {
    select: {
      id: true,
      name: true,
      catIdNumber: true,
      photoUrl: true,
      membershipStatus: true,
      userId: true,
    },
  },
  branch: { select: { id: true, nameEn: true, nameAr: true } },
  openedBy: {
    select: { id: true, role: true, title: true, user: { select: { firstName: true, lastName: true } } },
  },
  closedBy: {
    select: { id: true, role: true, title: true, user: { select: { firstName: true, lastName: true } } },
  },
  _count: { select: { entries: true } },
} satisfies Prisma.VisitSelect;

@Injectable()
export class VetVisitsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: VetPatientsService
  ) {}

  // ── Open ────────────────────────────────────────────────────────────────

  /**
   * Start an episode of care. If this cat already has an OPEN visit at this org
   * we refuse rather than fork a second chart — two half-charts for one
   * consultation is how a medication gets given twice.
   */
  async open(actor: VetActor, dto: OpenVisitDto) {
    const cat = await this.patients.requireCat(dto.catId, actor);
    const branch = await this.patients.requireBranchInScope(actor, dto.branchId);

    const existing = await this.prisma.visit.findFirst({
      where: { catId: cat.id, orgId: actor.orgId, state: "OPEN" },
      select: VISIT_SELECT,
    });
    if (existing) {
      if (!dto.resumeExisting) {
        throw vetConflict("VET_VISIT_OPEN_EXISTS", "This cat already has an open visit here", {
          visitId: existing.id,
          openedAt: existing.checkedInAt,
          openedBy: staffLabel(existing.openedBy),
          hint: {
            ar: `لدى ${cat.name} زيارة مفتوحة بالفعل. تابعوها بدل فتح ملف جديد.`,
            en: `${cat.name} already has an open visit. Resume it rather than starting a second chart.`,
          },
        });
      }
      return { visit: this.present(existing), resumed: true };
    }

    const visit = await this.prisma.visit.create({
      data: {
        catId: cat.id,
        orgId: actor.orgId,
        branchId: branch?.id ?? null,
        mode: dto.mode ?? "STANDARD",
        reason: dto.reason ?? null,
        presentingComplaint: dto.presentingComplaint ?? null,
        openedById: actor.staffId,
      },
      select: VISIT_SELECT,
    });

    // Opening a visit IS the care relationship this clinic will later search by
    // name on — worth logging as an access event in its own right.
    const access = await this.patients.resolveAccess(cat.id, actor.orgId);
    await this.patients.logAccess({
      catId: cat.id,
      orgId: actor.orgId,
      staffId: actor.staffId,
      tier: access.tier,
      surface: "profile",
    });

    return { visit: this.present(visit), resumed: false };
  }

  // ── Read ────────────────────────────────────────────────────────────────

  async get(actor: VetActor, visitId: string) {
    const visit = await this.requireVisit(actor, visitId);
    const access = await this.patients.resolveAccess(visit.catId, actor.orgId);
    const entries = await this.prisma.clinicalEntry.findMany({
      where: { visitId: visit.id },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 100,
      select: {
        id: true,
        type: true,
        status: true,
        payload: true,
        note: true,
        occurredAt: true,
        createdAt: true,
        coSignedAt: true,
        retractedAt: true,
        retractReason: true,
        revisionOfId: true,
        orgId: true,
        author: {
          select: {
            id: true,
            role: true,
            title: true,
            licenceNo: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        coSignedBy: {
          select: {
            id: true,
            role: true,
            title: true,
            licenceNo: true,
            user: { select: { firstName: true, lastName: true } },
          },
        },
        revisedBy: { select: { id: true, occurredAt: true } },
        attachments: {
          select: {
            id: true,
            fileName: true,
            mime: true,
            bytes: true,
            kind: true,
            scanStatus: true,
            createdAt: true,
          },
        },
      },
    });

    await this.patients.logAccess({
      catId: visit.catId,
      orgId: actor.orgId,
      staffId: actor.staffId,
      tier: access.tier,
      surface: "timeline",
    });

    const orgs = await this.patients.orgLookup(entries.map((e) => e.orgId));
    return {
      visit: this.present(visit),
      entries: entries.map((e) => this.patients.presentEntry(e, actor.orgId, orgs)),
      draftCount: entries.filter((e) => e.status === "DRAFT").length,
    };
  }

  /**
   * The clinic day-book. Defaults to today, because that is the screen a front
   * desk lives on; any explicit date/range filter overrides it.
   */
  async list(actor: VetActor, query: ListVisitsQueryDto) {
    const limit = Math.min(query.limit ?? PAGE_DEFAULT, 100);
    const page = Math.max(1, query.page ?? 1);

    let checkedInAt = this.patients.dateRange(query.from, query.to);
    if (!checkedInAt && query.date) {
      const start = new Date(query.date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      checkedInAt = { gte: start, lte: end };
    }
    if (!checkedInAt && !query.state && !query.catId) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      checkedInAt = { gte: start };
    }

    // A staff member scoped to specific branches sees only those branches' book.
    const branchFilter: Prisma.VisitWhereInput = query.branchId
      ? { branchId: query.branchId }
      : actor.branchIds.length
        ? { OR: [{ branchId: { in: actor.branchIds } }, { branchId: null }] }
        : {};

    const where: Prisma.VisitWhereInput = {
      orgId: actor.orgId,
      ...(checkedInAt ? { checkedInAt } : {}),
      ...(query.state ? { state: query.state } : {}),
      ...(query.mode ? { mode: query.mode } : {}),
      ...(query.catId ? { catId: query.catId } : {}),
      ...branchFilter,
    };

    const [rows, total, openNow] = await Promise.all([
      this.prisma.visit.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ state: "asc" }, { checkedInAt: "desc" }],
        select: VISIT_SELECT,
      }),
      this.prisma.visit.count({ where }),
      this.prisma.visit.count({ where: { orgId: actor.orgId, state: "OPEN" } }),
    ]);

    return {
      items: rows.map((v) => this.present(v)),
      summary: { openNow },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: (page - 1) * limit + rows.length < total,
      },
      empty:
        total === 0
          ? {
              ar: "لا زيارات بعد اليوم. كل قطة تدخل بابكم ستظهر هنا.",
              en: "No visits yet today. Every cat that walks in will appear here.",
            }
          : null,
    };
  }

  // ── Update / close ──────────────────────────────────────────────────────

  async update(actor: VetActor, visitId: string, dto: UpdateVisitDto) {
    const visit = await this.requireVisit(actor, visitId);
    if (visit.state === "CLOSED") throw this.closedError(visit.id, visit.closedAt);

    const updated = await this.prisma.visit.update({
      where: { id: visit.id },
      data: {
        ...(dto.presentingComplaint !== undefined
          ? { presentingComplaint: dto.presentingComplaint }
          : {}),
        ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
        ...(dto.followUpAt !== undefined ? { followUpAt: new Date(dto.followUpAt) } : {}),
      },
      select: VISIT_SELECT,
    });
    return { visit: this.present(updated) };
  }

  /**
   * Close the episode. A visit with no clinical entries may still close — cats
   * do leave before the consult — but it must then say why, so the day-book
   * never contains a silent blank.
   */
  async close(actor: VetActor, visitId: string, dto: CloseVisitDto) {
    const visit = await this.requireVisit(actor, visitId);
    if (visit.state === "CLOSED") throw this.closedError(visit.id, visit.closedAt);

    if (visit._count.entries === 0 && !dto.reason?.trim()) {
      throw vetBadRequest("VET_VISIT_EMPTY", "Closing an empty visit needs a reason", {
        hint: {
          ar: "لا يوجد سجل طبي في هذه الزيارة. اكتبوا سببًا مختصرًا للإغلاق حتى يبقى الدفتر صادقًا.",
          en: "This visit has no clinical entries. Add a short reason for closing so the day-book stays honest.",
        },
      });
    }

    const drafts = await this.prisma.clinicalEntry.count({
      where: { visitId: visit.id, status: "DRAFT" },
    });

    const updated = await this.prisma.visit.update({
      where: { id: visit.id },
      data: {
        state: "CLOSED",
        closedAt: new Date(),
        closedById: actor.staffId,
        ...(dto.reason?.trim() && visit._count.entries === 0 ? { reason: dto.reason.trim() } : {}),
        ...(dto.followUpAt ? { followUpAt: new Date(dto.followUpAt) } : {}),
      },
      select: VISIT_SELECT,
    });

    return {
      visit: this.present(updated),
      // Closing does not force a co-sign — it surfaces the debt so a senior can
      // clear it, rather than silently finalising a trainee's unreviewed work.
      pendingCoSign: drafts,
      nextStep:
        updated.ownerSummary
          ? null
          : {
              action: "owner-summary",
              ar: `أرسلوا لمالك ${updated.cat.name} ملخّصًا بلغة بسيطة — هذه هي اللحظة التي يشعر فيها بالرعاية.`,
              en: `Send ${updated.cat.name}'s owner a plain-language summary — that's the moment the care is felt.`,
            },
    };
  }

  // ── Owner summary ───────────────────────────────────────────────────────

  /**
   * The letter home. Saved on the visit AND delivered in-app, in both languages
   * around the vet's own words, so a clinical act becomes member communication
   * without anyone typing it twice.
   */
  async sendOwnerSummary(actor: VetActor, visitId: string, dto: OwnerSummaryDto) {
    const visit = await this.requireVisit(actor, visitId);
    const summary = dto.summary.trim();
    if (!summary) {
      throw vetBadRequest("VET_REASON_REQUIRED", "Summary text is required", {
        hint: {
          ar: "اكتبوا سطرًا واحدًا على الأقل — المالك ينتظر خبرًا عن قطته.",
          en: "Write at least one line — the owner is waiting to hear how their cat did.",
        },
      });
    }

    const updated = await this.prisma.visit.update({
      where: { id: visit.id },
      data: {
        ownerSummary: summary,
        summarySentAt: new Date(),
        ...(dto.followUpAt ? { followUpAt: new Date(dto.followUpAt) } : {}),
      },
      select: VISIT_SELECT,
    });

    const org = await this.prisma.partnerOrg.findUnique({
      where: { id: actor.orgId },
      select: { nameEn: true, nameAr: true },
    });
    const clinicEn = org?.nameEn ?? "your clinic";
    const clinicAr = org?.nameAr ?? "العيادة";
    const catName = updated.cat.name;

    await this.patients.notifyOwner({
      userId: updated.cat.userId,
      category: "SYSTEM",
      type: "vet_visit_summary",
      ar: {
        title: `ملخّص زيارة ${catName}`,
        body: `${clinicAr}: ${summary}`,
      },
      en: {
        title: `${catName}'s visit summary`,
        body: `${clinicEn}: ${summary}`,
      },
      data: {
        visitId: updated.id,
        catId: updated.catId,
        orgId: actor.orgId,
        followUpAt: updated.followUpAt,
        link: `/portal/cats/${updated.catId}/health`,
      },
    });

    return { visit: this.present(updated), delivered: true };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async requireVisit(actor: VetActor, visitId: string) {
    const visit = await this.prisma.visit.findFirst({
      // Org-scoped: one clinic can never open another clinic's chart by id.
      where: { id: visitId, orgId: actor.orgId },
      select: VISIT_SELECT,
    });
    if (!visit) {
      throw vetNotFound("VET_VISIT_NOT_FOUND", "No visit with that id at your clinic", {
        hint: {
          ar: "لا توجد زيارة بهذا المعرّف في عيادتكم.",
          en: "No visit with that id at your clinic.",
        },
      });
    }
    if (actor.branchIds.length && visit.branchId && !actor.branchIds.includes(visit.branchId)) {
      throw vetNotFound("VET_VISIT_NOT_FOUND", "Visit is outside your branch scope", {
        hint: {
          ar: "هذه الزيارة في فرع خارج نطاقكم.",
          en: "That visit belongs to a branch outside your scope.",
        },
      });
    }
    return visit;
  }

  private closedError(visitId: string, closedAt: Date | null) {
    return vetConflict("VET_VISIT_CLOSED", "This visit is already closed", {
      visitId,
      closedAt,
      hint: {
        ar: "هذه الزيارة مُغلقة. افتحوا زيارة جديدة إن عادت القطة — السجل لا يُعدّل بأثر رجعي.",
        en: "This visit is closed. Open a new visit if the cat returned — the record isn't edited after the fact.",
      },
    });
  }

  private present(v: Prisma.VisitGetPayload<{ select: typeof VISIT_SELECT }>) {
    const waitMinutes =
      v.state === "OPEN" ? Math.floor((Date.now() - v.checkedInAt.getTime()) / 60_000) : null;
    return {
      id: v.id,
      catId: v.catId,
      cat: {
        id: v.cat.id,
        name: v.cat.name,
        catIdNumber: v.cat.catIdNumber,
        photoUrl: v.cat.photoUrl,
        membershipStatus: v.cat.membershipStatus,
      },
      mode: v.mode,
      state: v.state,
      reason: v.reason,
      presentingComplaint: v.presentingComplaint,
      branch: v.branch ? { id: v.branch.id, ar: v.branch.nameAr, en: v.branch.nameEn } : null,
      openedBy: v.openedBy ? { id: v.openedBy.id, name: staffLabel(v.openedBy), role: v.openedBy.role } : null,
      closedBy: v.closedBy ? { id: v.closedBy.id, name: staffLabel(v.closedBy), role: v.closedBy.role } : null,
      checkedInAt: v.checkedInAt,
      closedAt: v.closedAt,
      followUpAt: v.followUpAt,
      entryCount: v._count.entries,
      ownerSummary: v.ownerSummary,
      summarySentAt: v.summarySentAt,
      waitMinutes,
      // A calm nudge, not an alarm: amber at 10 minutes is the only escalation.
      waitLevel: waitMinutes === null ? null : waitMinutes >= 10 ? "amber" : "calm",
    };
  }
}
