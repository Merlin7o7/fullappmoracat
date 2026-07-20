/**
 * Consent — MRC-VET-001 §06 and principle P3, "trust is bilateral".
 *
 * A clinic may ASK. Only the owner may GRANT. And the owner can always see who
 * looked, when, and how deep. That last part is not a nicety bolted on for
 * compliance — it is the competitive moat: members consent because they can
 * read the ledger.
 *
 * There is deliberately no way for a clinic to raise its own tier here. The
 * only clinic-initiated escalation in the whole system is break-glass, which
 * returns tier-0 safety data ONLY and notifies the owner immediately
 * (see VetEmergencyService).
 */
import { Injectable } from "@nestjs/common";
import { Prisma } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import {
  VetPatientsService,
  vetBadRequest,
  vetForbidden,
  vetNotFound,
  type VetActor,
} from "./vet-patients.service";
import type {
  AccessLogQueryDto,
  GrantConsentDto,
  OwnerGrantsQueryDto,
  RequestConsentDto,
  RevokeConsentDto,
} from "./dto/vet-consent.dto";

const PAGE_DEFAULT = 20;

const TIER_COPY = {
  T1: {
    ar: "ملخّص الرعاية: التطعيمات، الحالات المعروفة، الأدوية الحالية، سجل الوزن.",
    en: "Care summary: vaccinations, known conditions, current medications, weight history.",
  },
  T2: {
    ar: "السجل الكامل: كل ما سبق، إضافة إلى ملاحظات وتقارير العيادات الأخرى.",
    en: "Full history: everything above, plus notes and reports from other clinics.",
  },
} as const;

@Injectable()
export class VetConsentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: VetPatientsService
  ) {}

  // ── Clinic side ─────────────────────────────────────────────────────────

  /**
   * Ask the owner for access.
   *
   * The schema has no pending-request table, and inventing one here would mean
   * a second source of truth for consent. So the request IS the notification: a
   * durable, member-readable row that names the clinic, the depth asked for and
   * the stated reason, deep-linking to the screen where the owner decides. If
   * they do nothing, nothing happens — silence is never consent.
   */
  async request(actor: VetActor, dto: RequestConsentDto) {
    const cat = await this.patients.requireCat(dto.catId, actor);
    const existing = await this.patients.resolveAccess(cat.id, actor.orgId);
    if (existing.tier === dto.tier || (existing.tier === "T2" && dto.tier === "T1")) {
      return {
        requested: false,
        alreadyGranted: true,
        tier: existing.tier,
        grant: existing.grant,
        notice: {
          ar: "لديكم بالفعل هذا المستوى من الإذن.",
          en: "You already hold this level of access.",
        },
      };
    }

    const org = await this.prisma.partnerOrg.findUnique({
      where: { id: actor.orgId },
      select: { nameEn: true, nameAr: true },
    });
    const clinicEn = org?.nameEn ?? "A partner clinic";
    const clinicAr = org?.nameAr ?? "عيادة شريكة";
    const scope = TIER_COPY[dto.tier];

    await this.patients.notifyOwner({
      userId: cat.user.id,
      category: "SYSTEM",
      type: "vet_consent_requested",
      ar: {
        title: `${clinicAr} تطلب الاطلاع على سجل ${cat.name}`,
        body: `${scope.ar}${dto.reason ? ` السبب: ${dto.reason}` : ""} القرار لكم، ويمكن سحبه في أي وقت.`,
      },
      en: {
        title: `${clinicEn} is asking to see ${cat.name}'s record`,
        body: `${scope.en}${dto.reason ? ` Reason: ${dto.reason}` : ""} It's your call, and you can withdraw it any time.`,
      },
      data: {
        catId: cat.id,
        orgId: actor.orgId,
        requestedTier: dto.tier,
        reason: dto.reason ?? null,
        link: `/portal/cats/${cat.id}/privacy`,
      },
    });

    return {
      requested: true,
      tier: dto.tier,
      currentTier: existing.tier,
      notice: {
        ar: `وصل الطلب لمالك ${cat.name}. لا يُفتح السجل قبل موافقتهم.`,
        en: `${cat.name}'s owner has been asked. Nothing opens until they say yes.`,
      },
    };
  }

  /** What this clinic may currently see, and what it would take to see more. */
  async effectiveTier(actor: VetActor, catId: string) {
    const cat = await this.patients.requireCat(catId, actor);
    const access = await this.patients.resolveAccess(cat.id, actor.orgId);
    return {
      catId: cat.id,
      catName: cat.name,
      tier: access.tier,
      grant: access.grant,
      emergencyGrantOnFile: access.emergencyOnly,
      ownRecordsAlwaysVisible: true,
      upgradePath:
        access.tier === "T2"
          ? null
          : {
              nextTier: access.tier === "T1" ? "T2" : "T1",
              endpoint: "POST /api/vet/consent/request",
              scope: TIER_COPY[access.tier === "T1" ? "T2" : "T1"],
            },
    };
  }

  // ── Owner side ──────────────────────────────────────────────────────────

  /** Every clinic the member has trusted, per cat, with an honest expiry. */
  async listOwnerGrants(userId: string, query: OwnerGrantsQueryDto) {
    const limit = Math.min(query.limit ?? PAGE_DEFAULT, 100);
    const page = Math.max(1, query.page ?? 1);
    const catIds = await this.ownedCatIds(userId, query.catId);
    if (!catIds.length) return this.emptyGrants(page, limit);

    const where: Prisma.ConsentGrantWhereInput = { catId: { in: catIds } };
    const [rows, total] = await Promise.all([
      this.prisma.consentGrant.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ revokedAt: "asc" }, { grantedAt: "desc" }],
        select: {
          id: true,
          catId: true,
          tier: true,
          grantedAt: true,
          expiresAt: true,
          revokedAt: true,
          emergency: true,
          reason: true,
          cat: { select: { id: true, name: true, photoUrl: true } },
          org: { select: { id: true, nameEn: true, nameAr: true, logoUrl: true } },
        },
      }),
      this.prisma.consentGrant.count({ where }),
    ]);

    const now = Date.now();
    return {
      items: rows.map((g) => ({
        id: g.id,
        cat: g.cat,
        clinic: { id: g.org.id, ar: g.org.nameAr, en: g.org.nameEn, logoUrl: g.org.logoUrl },
        tier: g.tier,
        scope: TIER_COPY[g.tier],
        grantedAt: g.grantedAt,
        expiresAt: g.expiresAt,
        revokedAt: g.revokedAt,
        emergency: g.emergency,
        reason: g.reason,
        active:
          !g.revokedAt && (!g.expiresAt || g.expiresAt.getTime() > now) && !g.emergency,
        canRevoke: !g.revokedAt,
      })),
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
              ar: "لم تمنحوا أي عيادة إذن الاطلاع بعد. سجل قططكم يخصّكم وحدكم.",
              en: "You haven't given any clinic access yet. Your cats' records are yours alone.",
            }
          : null,
    };
  }

  /** The member grants access. This is the only path that raises a tier. */
  async grant(userId: string, dto: GrantConsentDto) {
    const cat = await this.requireOwnedCat(userId, dto.catId);
    const org = await this.prisma.partnerOrg.findFirst({
      where: { id: dto.orgId, status: { in: ["APPROVED", "LIVE"] } },
      select: { id: true, nameEn: true, nameAr: true, logoUrl: true },
    });
    if (!org) {
      throw vetNotFound("VET_PATIENT_NOT_FOUND", "No such active clinic", {
        hint: {
          ar: "هذه العيادة غير متاحة حاليًا في شبكة مُراقط.",
          en: "That clinic isn't currently active in the Moracat network.",
        },
      });
    }
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      throw vetBadRequest("VET_FUTURE_DATE", "expiresAt must be in the future", {
        hint: {
          ar: "تاريخ الانتهاء يجب أن يكون في المستقبل.",
          en: "The expiry date needs to be in the future.",
        },
      });
    }

    // Superseding rather than stacking: an owner adjusting a clinic's access
    // should end up with ONE live grant, not a pile nobody can reason about.
    const now = new Date();
    await this.prisma.consentGrant.updateMany({
      where: { catId: cat.id, orgId: org.id, revokedAt: null, emergency: false },
      data: { revokedAt: now, revokedById: userId },
    });

    const created = await this.prisma.consentGrant.create({
      data: {
        catId: cat.id,
        orgId: org.id,
        tier: dto.tier,
        grantedById: userId,
        expiresAt,
      },
      select: { id: true, tier: true, grantedAt: true, expiresAt: true },
    });

    return {
      grant: {
        ...created,
        cat: { id: cat.id, name: cat.name },
        clinic: { id: org.id, ar: org.nameAr, en: org.nameEn, logoUrl: org.logoUrl },
        scope: TIER_COPY[dto.tier],
      },
      notice: {
        ar: `يستطيع ${org.nameAr} الآن الاطلاع على ${TIER_COPY[dto.tier].ar} يمكنكم السحب في أي لحظة.`,
        en: `${org.nameEn} can now see ${TIER_COPY[dto.tier].en} You can withdraw this at any moment.`,
      },
    };
  }

  /**
   * Revoke. No interrogation, no retention flow, no "are you sure you want to
   * put your cat at risk" — one tap, effective immediately (R068).
   */
  async revoke(userId: string, grantId: string, dto: RevokeConsentDto) {
    const grant = await this.prisma.consentGrant.findUnique({
      where: { id: grantId },
      select: {
        id: true,
        catId: true,
        revokedAt: true,
        tier: true,
        cat: { select: { id: true, name: true, userId: true } },
        org: { select: { id: true, nameEn: true, nameAr: true } },
      },
    });
    if (!grant || grant.cat.userId !== userId) {
      throw vetNotFound("VET_PATIENT_NOT_FOUND", "No such grant on your cats", {
        hint: {
          ar: "لا يوجد إذن بهذا المعرّف على قططكم.",
          en: "No access grant with that id on your cats.",
        },
      });
    }
    if (grant.revokedAt) {
      return {
        grant: { id: grant.id, revokedAt: grant.revokedAt },
        alreadyRevoked: true,
        notice: { ar: "هذا الإذن مسحوب مسبقًا.", en: "That access was already withdrawn." },
      };
    }

    const updated = await this.prisma.consentGrant.update({
      where: { id: grant.id },
      data: {
        revokedAt: new Date(),
        revokedById: userId,
        ...(dto.reason?.trim() ? { reason: dto.reason.trim() } : {}),
      },
      select: { id: true, revokedAt: true },
    });

    return {
      grant: updated,
      alreadyRevoked: false,
      notice: {
        ar: `لم يعد ${grant.org.nameAr} يرى سجل ${grant.cat.name}. تنبيهات السلامة فقط تبقى ظاهرة — لأن الحساسية المخفية قد تقتل.`,
        en: `${grant.org.nameEn} can no longer see ${grant.cat.name}'s record. Safety alerts stay visible — because a hidden allergy can kill.`,
      },
    };
  }

  /**
   * The ledger. Who looked at my cat's record, when, how deep, and was it an
   * emergency. This is the promise the whole consent model is collateral for.
   */
  async accessLog(userId: string, query: AccessLogQueryDto) {
    const limit = Math.min(query.limit ?? PAGE_DEFAULT, 100);
    const page = Math.max(1, query.page ?? 1);
    const catIds = await this.ownedCatIds(userId, query.catId);
    if (!catIds.length) return this.emptyLedger(page, limit);

    const at = this.patients.dateRange(query.from, query.to);
    const where: Prisma.RecordAccessLogWhereInput = {
      catId: { in: catIds },
      ...(at ? { at } : {}),
    };

    const [rows, total, emergencyCount] = await Promise.all([
      this.prisma.recordAccessLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { at: "desc" },
        select: {
          id: true,
          at: true,
          tier: true,
          surface: true,
          emergency: true,
          cat: { select: { id: true, name: true, photoUrl: true } },
          org: { select: { id: true, nameEn: true, nameAr: true, logoUrl: true } },
        },
      }),
      this.prisma.recordAccessLog.count({ where }),
      this.prisma.recordAccessLog.count({ where: { ...where, emergency: true } }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        at: r.at,
        cat: r.cat,
        // The ledger names the clinic, not the individual — the org is who the
        // member has a relationship with, and staff privacy is not the member's
        // to browse. Moracat retains staffId for investigations.
        clinic: { id: r.org.id, ar: r.org.nameAr, en: r.org.nameEn, logoUrl: r.org.logoUrl },
        tier: r.tier,
        surface: r.surface,
        emergency: r.emergency,
        description: this.describeAccess(r.surface, r.cat.name, r.org.nameEn, r.org.nameAr, r.emergency),
      })),
      summary: { total, emergencyCount },
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
              ar: "لم يطّلع أحد على سجل قططكم بعد. كل اطلاع سيظهر هنا.",
              en: "Nobody has looked at your cats' records yet. Every view will appear here.",
            }
          : null,
    };
  }

  private describeAccess(
    surface: string,
    catName: string,
    clinicEn: string,
    clinicAr: string,
    emergency: boolean
  ) {
    const whatEn: Record<string, string> = {
      profile: `${catName}'s profile`,
      timeline: `${catName}'s medical timeline`,
      entry: `a record in ${catName}'s history`,
      attachment: `a file in ${catName}'s record`,
      emergency: `${catName}'s emergency safety information`,
      search: `${catName}'s identity card`,
      export: `an export of ${catName}'s record`,
    };
    const whatAr: Record<string, string> = {
      profile: `ملف ${catName}`,
      timeline: `السجل الطبي لـ${catName}`,
      entry: `سجلًا في تاريخ ${catName}`,
      attachment: `ملفًا مرفقًا في سجل ${catName}`,
      emergency: `معلومات السلامة الطارئة لـ${catName}`,
      search: `بطاقة هوية ${catName}`,
      export: `نسخة من سجل ${catName}`,
    };
    const en = `${clinicEn} viewed ${whatEn[surface] ?? `${catName}'s record`}${emergency ? " — emergency access" : ""}.`;
    const ar = `اطّلع ${clinicAr} على ${whatAr[surface] ?? `سجل ${catName}`}${emergency ? " — وصول طارئ" : ""}.`;
    return { ar, en };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private async ownedCatIds(userId: string, catId?: string): Promise<string[]> {
    if (catId) {
      const cat = await this.requireOwnedCat(userId, catId);
      return [cat.id];
    }
    const cats = await this.prisma.cat.findMany({
      where: { userId, deletedAt: null },
      select: { id: true },
    });
    return cats.map((c) => c.id);
  }

  private async requireOwnedCat(userId: string, catId: string) {
    const cat = await this.prisma.cat.findFirst({
      where: { id: catId, deletedAt: null },
      select: { id: true, name: true, userId: true },
    });
    if (!cat) {
      throw vetNotFound("VET_PATIENT_NOT_FOUND", "No cat with that id", {
        hint: { ar: "لا توجد قطة بهذا المعرّف.", en: "No cat with that id." },
      });
    }
    if (cat.userId !== userId) {
      throw vetForbidden("VET_NOT_OWNER", "That cat is not yours", {
        hint: {
          ar: "هذه ليست إحدى قططكم.",
          en: "That isn't one of your cats.",
        },
      });
    }
    return cat;
  }

  private emptyGrants(page: number, limit: number) {
    return {
      items: [],
      pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
      empty: {
        ar: "لم تمنحوا أي عيادة إذن الاطلاع بعد.",
        en: "You haven't given any clinic access yet.",
      },
    };
  }

  private emptyLedger(page: number, limit: number) {
    return {
      items: [],
      summary: { total: 0, emergencyCount: 0 },
      pagination: { page, limit, total: 0, totalPages: 0, hasMore: false },
      empty: {
        ar: "لم يطّلع أحد على سجل قططكم بعد.",
        en: "Nobody has looked at your cats' records yet.",
      },
    };
  }
}
