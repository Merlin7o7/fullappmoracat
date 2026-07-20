/**
 * Patient lookup, the consent-tier resolver, and the access ledger writer —
 * MRC-VET-001 §05/§06. This file is the spine of the clinical half: the other
 * clinical services depend on it for "may this clinic see this cat, and at what
 * depth", and for the row that tells the owner somebody looked.
 *
 * Two commitments are implemented here as code, not copy:
 *
 *   1. Search is not a member directory. Name queries reach only cats this
 *      clinic has already cared for (a prior Visit at this org). Everyone else
 *      requires possession of an exact identifier — the card, the number, the
 *      owner's phone, or a microchip read. A clinic can verify anyone who
 *      presents; it can browse no one who hasn't.
 *   2. Reading is an event. Every profile / timeline / entry / emergency read
 *      writes a RecordAccessLog row the OWNER can read back. Privacy is a
 *      ledger, not a claim (P3).
 */
import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type ConsentTier } from "@moraqat/db";
import { PrismaService } from "../prisma/prisma.service";
import { normalizeName } from "../common/text";
import {
  type PrescriptionListQueryDto,
  type SearchPatientsQueryDto,
  type TimelineQueryDto,
  type WeightSeriesQueryDto,
} from "./dto/vet-patient.dto";
import type { EffectiveTier } from "./dto/vet-consent.dto";

// ── Actor ─────────────────────────────────────────────────────────────────

/**
 * The authenticated clinic actor, resolved by `VetStaffGuard`. Re-exported from
 * the shared decorator so the clinical services and the auth half hold exactly
 * ONE definition of "who is acting, at which clinic, with what scope" — two
 * structurally-similar interfaces would drift the moment one grew a field.
 */
export type { VetActor } from "./decorators/vet-actor.decorator";
import type { VetActor } from "./decorators/vet-actor.decorator";

// ── Errors ────────────────────────────────────────────────────────────────

export type VetErrorCode =
  | "VET_PATIENT_NOT_FOUND"
  | "VET_SEARCH_SCOPED"
  | "VET_SEARCH_TOO_SHORT"
  | "VET_NO_CONSENT"
  | "VET_NO_TREATMENT_RELATIONSHIP"
  | "VET_CONSENT_EXISTS"
  | "VET_NOT_OWNER"
  | "VET_VISIT_NOT_FOUND"
  | "VET_VISIT_CLOSED"
  | "VET_VISIT_OPEN_EXISTS"
  | "VET_VISIT_EMPTY"
  | "VET_BRANCH_OUT_OF_SCOPE"
  | "VET_ENTRY_NOT_FOUND"
  | "VET_ENTRY_IMMUTABLE"
  | "VET_ENTRY_FOREIGN"
  | "VET_ENTRY_NOT_DRAFT"
  | "VET_ALREADY_COSIGNED"
  | "VET_COSIGN_SELF"
  | "VET_PAYLOAD_INVALID"
  | "VET_ATTACHMENT_INVALID"
  | "VET_ATTACHMENT_NOT_FOUND"
  | "VET_PRESCRIPTION_NOT_FOUND"
  | "VET_INVALID_TRANSITION"
  | "VET_NO_REFILLS"
  | "VET_REASON_REQUIRED"
  | "VET_FUTURE_DATE";

export interface VetErrorBody {
  code: VetErrorCode;
  /** Developer-facing. Clients branch on `code` and render `hint`, never this. */
  message: string;
  /** Bilingual, member/staff-facing recovery copy (R101/R113 — say what to do next). */
  hint?: { ar: string; en: string };
  [key: string]: unknown;
}

export function vetError(
  code: VetErrorCode,
  message: string,
  extra?: Omit<VetErrorBody, "code" | "message">
): VetErrorBody {
  return { code, message, ...extra };
}

export const vetNotFound = (c: VetErrorCode, m: string, x?: Record<string, unknown>) =>
  new NotFoundException(vetError(c, m, x));
export const vetForbidden = (c: VetErrorCode, m: string, x?: Record<string, unknown>) =>
  new ForbiddenException(vetError(c, m, x));
export const vetBadRequest = (c: VetErrorCode, m: string, x?: Record<string, unknown>) =>
  new BadRequestException(vetError(c, m, x));
export const vetConflict = (c: VetErrorCode, m: string, x?: Record<string, unknown>) =>
  new HttpException(vetError(c, m, x), 409);

// ── Query auto-detection ──────────────────────────────────────────────────

export type LookupKind = "catId" | "qrToken" | "microchip" | "phone" | "email" | "name";

export interface DetectedQuery {
  kind: LookupKind;
  /** Canonical form used for the DB lookup (E.164 phone, MRC-XXXX-XXXX, …). */
  normalized: string;
  /** True when possession of this value is proof of a care relationship. */
  isIdentifier: boolean;
}

/** Cat ID alphabet excludes 0/O/1/I/L so a number can be read aloud (IdsService). */
const ID_CHARS = "23456789A-HJ-NP-Z";
const CAT_ID_RE = new RegExp(`^(?:MRC)?([${ID_CHARS}]{4})([${ID_CHARS}]{4})$`, "i");
const QR_TOKEN_RE = new RegExp(`^[${ID_CHARS}]{20}$`, "i");

/** Saudi-aware E.164 normalisation: 05…, 5…, 9665…, 009665…, +9665… → +9665…. */
export function normalizeSaudiPhone(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "");
  if (!/^\+?\d{7,15}$/.test(digits)) return null;
  let d = digits.replace(/^\+/, "").replace(/^00/, "");
  if (d.startsWith("966")) d = d.slice(3);
  else if (d.startsWith("0")) d = d.slice(1);
  if (/^5\d{8}$/.test(d)) return `+966${d}`;
  // A non-Saudi number the member registered with — keep it in E.164 as typed.
  return digits.startsWith("+") ? digits : `+${digits}`;
}

/**
 * One omnibox, every identifier. The receptionist never chooses a mode; the
 * server decides what was typed. Order matters: the most specific shapes are
 * tested first so a 15-digit chip is never mistaken for a phone number.
 */
export function detectQuery(raw: string): DetectedQuery {
  const q = raw.trim();
  const compact = q.replace(/[\s-]/g, "");

  if (q.includes("@") && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q)) {
    return { kind: "email", normalized: q.toLowerCase(), isIdentifier: true };
  }
  // Microchip: exactly 15 digits (ISO 11784/11785), including chip-reader wedges.
  if (/^\d{15}$/.test(compact)) {
    return { kind: "microchip", normalized: compact, isIdentifier: true };
  }
  if (/^\+?[\d\s()-]{7,17}$/.test(q) && /\d{7,}/.test(compact)) {
    const phone = normalizeSaudiPhone(q);
    if (phone) return { kind: "phone", normalized: phone, isIdentifier: true };
  }
  const catId = CAT_ID_RE.exec(compact);
  if (catId?.[1] && catId[2]) {
    return {
      kind: "catId",
      normalized: `MRC-${catId[1].toUpperCase()}-${catId[2].toUpperCase()}`,
      isIdentifier: true,
    };
  }
  if (QR_TOKEN_RE.test(compact)) {
    return { kind: "qrToken", normalized: compact.toUpperCase(), isIdentifier: true };
  }
  return { kind: "name", normalized: normalizeName(q), isIdentifier: false };
}

// ── Consent resolution ────────────────────────────────────────────────────

export interface ResolvedAccess {
  /** The depth this clinic may read cross-clinic data at. */
  tier: EffectiveTier;
  /** The live grant that produced a tier above T0, if any. */
  grant: { id: string; tier: ConsentTier; grantedAt: Date; expiresAt: Date | null } | null;
  /** Orgs whose clinical entries this clinic may read. */
  visibleOrgIds: string[] | "ALL";
  /** True when a break-glass grant is the only thing on file. */
  emergencyOnly: boolean;
}

const TIER_RANK: Record<EffectiveTier, number> = { T0: 0, T1: 1, T2: 2 };

/**
 * How long after a visit closes a clinic may still author against that patient.
 * Lab results, histology and discharge addenda routinely arrive days after the
 * cat has gone home; forcing a new visit for those would corrupt the encounter
 * record. Amendments to existing entries are governed separately by
 * `requireOwnEntry` and are not time-boxed by this.
 */
const AMENDMENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

// ── Bilingual furniture ───────────────────────────────────────────────────

const SCOPE_NOTICE = {
  identifier: {
    ar: "تم العثور على هذه القطة عبر معرّف دقيق قدّمه العميل.",
    en: "Found by an exact identifier the member presented.",
  },
  clinic: {
    ar: "البحث بالاسم يشمل قطط عيادتكم فقط. القطط الجديدة تظهر بعد أول زيارة، أو بمسح البطاقة أو رقم المالك.",
    en: "Name search covers your clinic's own patients only. New cats appear after their first visit — or scan their card, or use the owner's phone number.",
  },
} as const;

const HIDDEN_REASONS = {
  T1: {
    code: "NEEDS_T1" as const,
    ar: "ملخّص الرعاية محجوب — لم يمنح المالك عيادتكم إذن الاطلاع بعد.",
    en: "Care summary is restricted — the owner hasn't granted your clinic access yet.",
    remedy: "POST /api/vet/consent/request",
  },
  T2: {
    code: "NEEDS_T2" as const,
    ar: "السجل من العيادات الأخرى محجوب — يحتاج إذن المالك الكامل.",
    en: "History from other clinics is restricted — it needs the owner's full consent.",
    remedy: "POST /api/vet/consent/request",
  },
} as const;

const LEDGER_NOTICE = {
  ar: "سُجِّل اطلاعكم على هذا الملف، ويستطيع المالك رؤيته.",
  en: "This view was recorded in the owner's access ledger.",
} as const;

const MEMBERSHIP_LABELS: Record<string, { ar: string; en: string }> = {
  ACTIVE: { ar: "عضوية سارية", en: "Active member" },
  INACTIVE: { ar: "العضوية غير مفعّلة", en: "Not activated" },
  PAUSED: { ar: "العضوية موقوفة مؤقتًا", en: "Paused" },
  EXPIRED: { ar: "انتهت العضوية", en: "Lapsed" },
  CANCELLED: { ar: "أُلغيت العضوية", en: "Cancelled" },
};

/** Safety never expires — this line is what staff say when membership has lapsed. */
const COUNTER_SCRIPTS: Record<string, { ar: string; en: string }> = {
  EXPIRED: {
    ar: "انتهت عضوية {name} — الرعاية تستمر اليوم كالمعتاد بالأسعار العادية.",
    en: "{name}'s membership has lapsed — care continues as usual today at standard rates.",
  },
  CANCELLED: {
    ar: "عضوية {name} مُلغاة — الرعاية تستمر اليوم كالمعتاد بالأسعار العادية.",
    en: "{name}'s membership was cancelled — care continues as usual today at standard rates.",
  },
  PAUSED: {
    ar: "عضوية {name} موقوفة مؤقتًا — الرعاية تستمر اليوم كالمعتاد.",
    en: "{name}'s membership is paused — care continues as usual today.",
  },
};

/** `05• ••• ••12` — present but deliberately unreadable until someone chooses to reveal it. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const tail = phone.slice(-2);
  return `${phone.slice(0, 3)}• ••• ••${tail}`;
}

export function ownerDisplayName(user: {
  ownerNickname: string | null;
  firstName: string | null;
  lastName: string | null;
}): string | null {
  if (user.ownerNickname) return user.ownerNickname;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
}

export function ageFrom(birthDate: Date | null): {
  months: number | null;
  label: { ar: string; en: string } | null;
} {
  if (!birthDate) return { months: null, label: null };
  const now = new Date();
  let months =
    (now.getFullYear() - birthDate.getFullYear()) * 12 + (now.getMonth() - birthDate.getMonth());
  if (now.getDate() < birthDate.getDate()) months -= 1;
  months = Math.max(0, months);
  const y = Math.floor(months / 12);
  const m = months % 12;
  const en = y === 0 ? `${m} mo` : m === 0 ? `${y} yr` : `${y} yr ${m} mo`;
  const ar = y === 0 ? `${m} شهر` : m === 0 ? `${y} سنة` : `${y} سنة و${m} شهر`;
  return { months, label: { ar, en } };
}

// ── Select fragments (deliberate, to keep reads narrow) ───────────────────

const CAT_CARD_SELECT = {
  id: true,
  catIdNumber: true,
  name: true,
  photoUrl: true,
  gender: true,
  birthDate: true,
  weightKg: true,
  microchipNo: true,
  membershipStatus: true,
  status: true,
  breed: { select: { id: true, nameEn: true, nameAr: true } },
  user: {
    select: { id: true, firstName: true, lastName: true, ownerNickname: true, phone: true, locale: true },
  },
} satisfies Prisma.CatSelect;

const AUTHOR_SELECT = {
  id: true,
  role: true,
  title: true,
  licenceNo: true,
  user: { select: { firstName: true, lastName: true } },
} satisfies Prisma.PartnerStaffSelect;

const ORG_SELECT = { id: true, nameEn: true, nameAr: true, logoUrl: true } satisfies Prisma.PartnerOrgSelect;

export interface OrgLite {
  id: string;
  nameEn: string;
  nameAr: string;
  logoUrl: string | null;
}

/**
 * `ClinicalEntry` and `Prescription` carry `orgId` without a Prisma back-relation
 * to PartnerOrg, so clinic names are resolved in ONE extra query per result set
 * rather than by joining per row. Every record must be able to say which clinic
 * wrote it — a cross-clinic timeline that can't name its sources is worthless
 * (and, at T2, dishonest).
 */
export type OrgLookup = Map<string, OrgLite>;

export function clinicOf(orgId: string, orgs: OrgLookup, viewerOrgId: string) {
  const org = orgs.get(orgId);
  return {
    id: orgId,
    ar: org?.nameAr ?? null,
    en: org?.nameEn ?? null,
    logoUrl: org?.logoUrl ?? null,
    isYours: orgId === viewerOrgId,
  };
}

export function staffLabel(
  staff: { title: string | null; user: { firstName: string | null; lastName: string | null } } | null
): string | null {
  if (!staff) return null;
  const name = [staff.user.firstName, staff.user.lastName].filter(Boolean).join(" ").trim();
  if (!name) return staff.title ?? null;
  return staff.title ? `${staff.title} ${name}` : name;
}

const PAGE_DEFAULT = 20;

@Injectable()
export class VetPatientsService {
  private readonly logger = new Logger("VetPatients");

  constructor(private readonly prisma: PrismaService) {}

  // ── Shared infrastructure the other clinical services use ───────────────

  /**
   * Resolve what this org may read about this cat, right now.
   *
   * The rule, in one place:
   *   • T0 is the floor and needs no grant — safety alerts, identity, emergency
   *     contacts, current medications. A hidden allergy can kill.
   *   • A live, unrevoked, unexpired ConsentGrant raises the ceiling: T1 = the
   *     care summary, T2 = other clinics' records too.
   *   • Regardless of tier, a clinic ALWAYS sees the records it authored itself
   *     (§06: "a clinic never loses access to its own clinical work"; T2 governs
   *     cross-clinic visibility only). That is why `visibleOrgIds` contains this
   *     org even at T0 — the *tier* is about other people's data.
   *   • The highest live grant wins; a break-glass (emergency) grant records the
   *     event but never raises the tier above T0.
   */
  async resolveAccess(catId: string, orgId: string): Promise<ResolvedAccess> {
    const now = new Date();
    const grants = await this.prisma.consentGrant.findMany({
      where: {
        catId,
        orgId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true, tier: true, grantedAt: true, expiresAt: true, emergency: true },
      orderBy: { grantedAt: "desc" },
    });

    const consenting = grants.filter((g) => !g.emergency);
    const best = consenting.reduce<(typeof consenting)[number] | null>(
      (acc, g) => (acc && TIER_RANK[acc.tier] >= TIER_RANK[g.tier] ? acc : g),
      null
    );
    const tier: EffectiveTier = best ? best.tier : "T0";

    return {
      tier,
      grant: best
        ? { id: best.id, tier: best.tier, grantedAt: best.grantedAt, expiresAt: best.expiresAt }
        : null,
      visibleOrgIds: tier === "T2" ? "ALL" : [orgId],
      emergencyOnly: !best && grants.some((g) => g.emergency),
    };
  }

  /**
   * Authoring gate for clinical writes.
   *
   * Consent governs how much *history* a clinic may read. It does not license
   * authoring: a clinic may only write facts about a patient it is actually
   * treating. Without this, any staff member at any org could author a
   * diagnosis, weight or prescription onto any cat in the network — rows that
   * then surface in every other clinic's T0 alerts and in the emergency payload.
   *
   * A treatment relationship is an open visit at this org, or one closed inside
   * the amendment window (lab results and discharge notes legitimately land
   * after the cat has gone home). Emergency break-glass deliberately does NOT
   * qualify — it is a read-only escape hatch.
   */
  async requireTreatmentRelationship(catId: string, orgId: string): Promise<void> {
    const since = new Date(Date.now() - AMENDMENT_WINDOW_MS);
    const visit = await this.prisma.visit.findFirst({
      where: {
        catId,
        orgId,
        OR: [{ state: "OPEN" }, { closedAt: { gte: since } }],
      },
      select: { id: true },
    });
    if (visit) return;

    throw vetForbidden("VET_NO_TREATMENT_RELATIONSHIP", "Open a visit before recording care", {
      catId,
      hint: {
        ar: "لتسجيل رعاية لهذه القطة، افتحوا زيارة أولاً. السجل الطبي يُكتب من واقع زيارة فعلية.",
        en: "To record care for this cat, open a visit first. Clinical records are written from an actual encounter.",
      },
    });
  }

  /**
   * Write the owner-visible ledger row. Awaited, not fire-and-forget: a read the
   * owner cannot see is a read that did not respect them. Failures are logged
   * loudly but never break clinical care mid-consult.
   */
  async logAccess(input: {
    catId: string;
    orgId: string;
    staffId?: string | null;
    tier: EffectiveTier;
    surface: "profile" | "timeline" | "entry" | "emergency" | "export" | "search" | "attachment" | "write";
    emergency?: boolean;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      await this.prisma.recordAccessLog.create({
        data: {
          catId: input.catId,
          orgId: input.orgId,
          staffId: input.staffId ?? null,
          // The ledger column is the granted-tier enum; a T0 read is recorded at
          // its floor, T1, with the surface making the depth unambiguous.
          tier: input.tier === "T2" ? "T2" : "T1",
          surface: input.surface,
          emergency: input.emergency ?? false,
          ipAddress: input.ipAddress ?? null,
        },
      });
    } catch (e) {
      this.logger.error(`access-log write failed cat=${input.catId} org=${input.orgId}: ${String(e)}`);
    }
  }

  /**
   * Write an in-app notification to a member with honest bilingual copy.
   *
   * Deliberately writes the row directly rather than going through
   * `NotificationsService.notify`, whose catalogue has no veterinary entries yet:
   * borrowing an unrelated key ("support replied") would put a lie in the
   * member's feed. The row shape — `data.i18n` + `data.type` — is identical, so
   * the portal feed renders it with no client change (R101: ar+en or it doesn't
   * ship).
   */
  async notifyOwner(input: {
    userId: string;
    category: "SYSTEM" | "COMMUNITY" | "SUBSCRIPTION";
    type: string;
    ar: { title: string; body: string };
    en: { title: string; body: string };
    data?: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId: input.userId,
          channel: "IN_APP",
          category: input.category,
          title: input.en.title,
          body: input.en.body,
          data: {
            type: input.type,
            params: {},
            i18n: { ar: input.ar, en: input.en },
            ...(input.data ?? {}),
          } as Prisma.InputJsonValue,
        },
      });
    } catch (e) {
      this.logger.error(`owner notify failed user=${input.userId}: ${String(e)}`);
    }
  }

  /** Load a cat or 404 with a code the counter UI can turn into recovery copy. */
  async requireCat(catId: string, actor?: Pick<VetActor, "orgIsDemo">) {
    const cat = await this.prisma.cat.findFirst({
      // Same quarantine as search: a demo clinic resolves only demo cats, and a
      // real clinic never resolves one. Falls through to the ordinary not-found
      // error, so the boundary is not itself an information leak.
      where: { id: catId, deletedAt: null, ...(actor ? { isDemo: actor.orgIsDemo } : {}) },
      select: CAT_CARD_SELECT,
    });
    if (!cat) {
      throw vetNotFound("VET_PATIENT_NOT_FOUND", "No cat with that id", {
        hint: {
          ar: "لا يوجد سجل بهذا المعرّف. تحقّقوا من الرقم أو امسحوا بطاقة العضوية.",
          en: "No record with that id. Check the number, or scan the membership card.",
        },
      });
    }
    return cat;
  }

  /** A branch must be inside the staff member's scope; empty scope = whole org. */
  async requireBranchInScope(actor: VetActor, branchId: string | undefined | null) {
    if (!branchId) return null;
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, orgId: actor.orgId, isActive: true },
      select: { id: true, nameEn: true, nameAr: true },
    });
    if (!branch || (actor.branchIds.length > 0 && !actor.branchIds.includes(branchId))) {
      throw vetForbidden("VET_BRANCH_OUT_OF_SCOPE", "Branch is outside your scope", {
        hint: {
          ar: "هذا الفرع خارج نطاق صلاحيتكم. اختاروا فرعًا من فروعكم أو اطلبوا من المدير توسيع النطاق.",
          en: "That branch is outside your scope. Pick one of your branches, or ask your manager to widen it.",
        },
      });
    }
    return branch;
  }

  /** Resolve every clinic named in a result set in one query. */
  async orgLookup(orgIds: Array<string | null | undefined>): Promise<OrgLookup> {
    const unique = [...new Set(orgIds.filter((id): id is string => Boolean(id)))];
    if (!unique.length) return new Map();
    const rows = await this.prisma.partnerOrg.findMany({
      where: { id: { in: unique } },
      select: ORG_SELECT,
    });
    return new Map(rows.map((o) => [o.id, o]));
  }

  // ── 1 · Patient lookup ──────────────────────────────────────────────────

  async search(actor: VetActor, query: SearchPatientsQueryDto) {
    const raw = (query.q ?? "").trim();
    if (raw.length < 2) {
      throw vetBadRequest("VET_SEARCH_TOO_SHORT", "Query must be at least 2 characters", {
        hint: {
          ar: "اكتبوا حرفين على الأقل، أو امسحوا بطاقة العضوية.",
          en: "Type at least two characters, or scan the membership card.",
        },
      });
    }
    const limit = Math.min(query.limit ?? 10, 25);
    const detected = detectQuery(raw);

    const where = this.buildSearchWhere(detected, actor.orgId, actor.orgIsDemo);
    if (!where) {
      // A malformed Moracat-looking number: say so as-you-type, keep their input.
      throw vetBadRequest("VET_PATIENT_NOT_FOUND", "Unrecognised identifier", {
        detectedAs: detected.kind,
        hint: {
          ar: "هذا لا يشبه رقم مُراقط — الأرقام تُكتب هكذا: MRC-D7Y9-X5CW.",
          en: "That doesn't look like a Moracat number — they read like MRC-D7Y9-X5CW.",
        },
      });
    }

    const cats = await this.prisma.cat.findMany({
      where,
      select: {
        ...CAT_CARD_SELECT,
        _count: { select: { visits: { where: { orgId: actor.orgId } } } },
        visits: {
          where: { orgId: actor.orgId },
          orderBy: { checkedInAt: "desc" },
          take: 1,
          select: { id: true, checkedInAt: true, state: true },
        },
      },
      orderBy: [{ name: "asc" }],
      take: limit,
    });

    // An exact-identifier match resolves to one cat: the counter needs the safety
    // band immediately, so alerts ride along — and that read is logged, because
    // showing allergies is a medical read however fast it was.
    const soleHit = detected.isIdentifier && cats.length === 1 ? cats[0] : undefined;
    let alerts: Awaited<ReturnType<typeof this.loadAlerts>> | null = null;
    if (soleHit) {
      const access = await this.resolveAccess(soleHit.id, actor.orgId);
      alerts = await this.loadAlerts(soleHit.id);
      await this.logAccess({
        catId: soleHit.id,
        orgId: actor.orgId,
        staffId: actor.staffId,
        tier: access.tier,
        surface: "search",
      });
    }

    return {
      query: { raw, detectedAs: detected.kind, normalized: detected.normalized },
      scope: {
        mode: detected.isIdentifier ? "identifier" : "clinicPatients",
        scopedToClinic: !detected.isIdentifier,
        // The UI can render this verbatim so the boundary is explained, not hidden.
        notice: detected.isIdentifier ? SCOPE_NOTICE.identifier : SCOPE_NOTICE.clinic,
      },
      results: cats.map((c) => ({
        ...this.cardOf(c),
        clinicRelationship: {
          isKnownPatient: c._count.visits > 0,
          visitCountHere: c._count.visits,
          lastVisitHere: c.visits[0]?.checkedInAt ?? null,
          openVisitId: c.visits[0]?.state === "OPEN" ? c.visits[0].id : null,
        },
        alerts: soleHit ? alerts : null,
      })),
      total: cats.length,
      empty:
        cats.length === 0
          ? {
              ar: "لا توجد نتيجة هنا. إن كان العميل معكم فامسحوا بطاقته أو جرّبوا رقم جواله — القطط الجديدة لا تظهر بالاسم قبل أول زيارة.",
              en: "No match for that here. If the member is with you, scan their card or try their phone number — new patients won't appear by name until their first visit.",
            }
          : null,
    };
  }

  /** The privacy boundary, expressed as a Prisma filter. */
  private buildSearchWhere(
    detected: DetectedQuery,
    orgId: string,
    orgIsDemo = false
  ): Prisma.CatWhereInput | null {
    // THE DEMO QUARANTINE, applied to the base of EVERY branch below.
    //
    // Exact identifiers (Cat ID, microchip, phone) deliberately match any
    // registered cat — correct when a real member is standing at the counter,
    // and unacceptable for a demo account handed to a visiting vet. Scoping
    // here, on the shared base, means a new search branch inherits it by
    // default rather than having to remember.
    const base: Prisma.CatWhereInput = { deletedAt: null, isDemo: orgIsDemo };
    switch (detected.kind) {
      case "catId":
        return { ...base, catIdNumber: detected.normalized };
      case "qrToken":
        return { ...base, qrToken: detected.normalized };
      case "microchip":
        return { ...base, microchipNo: detected.normalized };
      case "phone":
        // A household is one household (R109): the owner's phone lists their cats.
        return { ...base, user: { phone: detected.normalized, deletedAt: null } };
      case "email":
        return { ...base, user: { email: detected.normalized, deletedAt: null } };
      case "name": {
        if (!detected.normalized) return null;
        // THE BOUNDARY: fuzzy name matching, but only across cats this clinic has
        // already seen. No prior visit, no name lookup — possession of an exact
        // identifier is the only other way in.
        return {
          ...base,
          visits: { some: { orgId } },
          OR: [
            { nameNormalized: { contains: detected.normalized } },
            { name: { contains: detected.normalized, mode: "insensitive" } },
            {
              user: {
                OR: [
                  { firstName: { contains: detected.normalized, mode: "insensitive" } },
                  { lastName: { contains: detected.normalized, mode: "insensitive" } },
                  { ownerNickname: { contains: detected.normalized, mode: "insensitive" } },
                ],
              },
            },
          ],
        };
      }
      default:
        return null;
    }
  }

  private cardOf(c: {
    id: string;
    catIdNumber: string | null;
    name: string;
    photoUrl: string | null;
    gender: string;
    birthDate: Date | null;
    weightKg: number | null;
    microchipNo: string | null;
    membershipStatus: string;
    status: string;
    breed: { id: string; nameEn: string; nameAr: string } | null;
    user: {
      id: string;
      firstName: string | null;
      lastName: string | null;
      ownerNickname: string | null;
      phone: string | null;
      locale: string;
    };
  }) {
    const age = ageFrom(c.birthDate);
    const script = COUNTER_SCRIPTS[c.membershipStatus];
    return {
      catId: c.id,
      catIdNumber: c.catIdNumber,
      name: c.name,
      photoUrl: c.photoUrl,
      breed: c.breed ? { id: c.breed.id, ar: c.breed.nameAr, en: c.breed.nameEn } : null,
      gender: c.gender,
      birthDate: c.birthDate,
      ageMonths: age.months,
      ageLabel: age.label,
      weightKg: c.weightKg,
      microchipNo: c.microchipNo,
      lifecycleStatus: c.status,
      membership: {
        status: c.membershipStatus,
        // Status is never colour alone (R093) — the words travel with it.
        label: MEMBERSHIP_LABELS[c.membershipStatus] ?? MEMBERSHIP_LABELS.INACTIVE,
        // Safety never expires: a lapsed membership changes the price, never the care.
        careContinues: true,
        counterScript: script
          ? { ar: script.ar.replace("{name}", c.name), en: script.en.replace("{name}", c.name) }
          : null,
      },
      owner: {
        // Identity of the owner is T1; at the counter the phone is present but
        // unreadable until someone deliberately reveals it.
        displayName: null as string | null,
        phone: null as string | null,
        phoneMasked: maskPhone(c.user.phone),
        locale: c.user.locale,
      },
    };
  }

  /** Tier-0 safety payload. Never gated — a hidden allergy can kill. */
  private async loadAlerts(catId: string) {
    const [cat, allergies, conditions, activeRx, handlingNotes] = await Promise.all([
      this.prisma.cat.findUnique({
        where: { id: catId },
        select: { currentMedications: true, emergencyNotes: true, vaccinationStatus: true },
      }),
      this.prisma.catAllergy.findMany({ where: { catId }, select: { id: true, allergen: true } }),
      this.prisma.catHealthCondition.findMany({
        where: { catId },
        select: { id: true, name: true, notes: true },
      }),
      this.prisma.prescription.findMany({
        where: { catId, status: { in: ["ISSUED", "COLLECTED", "REFILLED"] } },
        select: {
          id: true,
          medication: true,
          strength: true,
          dosage: true,
          frequency: true,
          status: true,
          issuedAt: true,
          expiresAt: true,
          orgId: true,
        },
        orderBy: { issuedAt: "desc" },
        take: 25,
      }),
      // Handling/behaviour notes are tier-0 by design: knowing a cat hates
      // carriers prevents an injury, and it is not private medical history.
      this.prisma.clinicalEntry.findMany({
        where: {
          catId,
          type: "NOTE",
          retractedAt: null,
          status: { in: ["FINAL", "AMENDED"] },
          OR: [
            { payload: { path: ["subtype"], equals: "HANDLING" } },
            { payload: { path: ["subtype"], equals: "BEHAVIOUR" } },
          ],
        },
        select: { id: true, payload: true, occurredAt: true, orgId: true },
        orderBy: { occurredAt: "desc" },
        take: 5,
      }),
    ]);

    const orgs = await this.orgLookup([
      ...activeRx.map((p) => p.orgId),
      ...handlingNotes.map((n) => n.orgId),
    ]);

    return {
      allergies: allergies.map((a) => ({ id: a.id, allergen: a.allergen })),
      conditions: conditions.map((c) => ({ id: c.id, name: c.name, notes: c.notes })),
      currentMedications: {
        ownerReported: cat?.currentMedications ?? null,
        prescribed: activeRx.map((p) => ({
          id: p.id,
          medication: p.medication,
          strength: p.strength,
          dosage: p.dosage,
          frequency: p.frequency,
          status: p.status,
          issuedAt: p.issuedAt,
          expiresAt: p.expiresAt,
          clinic: clinicOf(p.orgId, orgs, p.orgId),
        })),
      },
      handlingNotes: handlingNotes.map((n) => ({
        id: n.id,
        text: (n.payload as { text?: string } | null)?.text ?? null,
        at: n.occurredAt,
        clinic: clinicOf(n.orgId, orgs, n.orgId),
      })),
      emergencyNotes: cat?.emergencyNotes ?? null,
      vaccinationStatus: cat?.vaccinationStatus ?? null,
      hasCritical: allergies.length > 0 || conditions.length > 0,
    };
  }

  /** The consent-tier-resolved clinical profile. Always logged. */
  async getProfile(actor: VetActor, catId: string, ip?: string | null) {
    const cat = await this.requireCat(catId, actor);
    const access = await this.resolveAccess(catId, actor.orgId);
    const canSeeCare = TIER_RANK[access.tier] >= 1;

    const [alerts, emergencyContacts, relationship, care, history] = await Promise.all([
      this.loadAlerts(catId),
      this.prisma.catEmergencyContact.findMany({
        where: { catId },
        select: { id: true, kind: true, name: true, phone: true, relation: true, isPrimary: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      }),
      this.prisma.visit.aggregate({
        where: { catId, orgId: actor.orgId },
        _count: { _all: true },
        _max: { checkedInAt: true },
      }),
      canSeeCare ? this.loadCareSummary(catId) : Promise.resolve(null),
      access.tier === "T2" ? this.loadCrossClinicSummary(catId, actor.orgId) : Promise.resolve(null),
    ]);

    await this.logAccess({
      catId,
      orgId: actor.orgId,
      staffId: actor.staffId,
      tier: access.tier,
      surface: "profile",
      ipAddress: ip,
    });

    const card = this.cardOf(cat);
    if (canSeeCare) {
      card.owner.displayName = ownerDisplayName(cat.user);
      card.owner.phone = cat.user.phone;
    }

    const hidden: Array<{
      section: string;
      reason: { code: string; ar: string; en: string };
      remedy: string;
    }> = [];
    if (!canSeeCare) {
      hidden.push({
        section: "care",
        reason: { code: HIDDEN_REASONS.T1.code, ar: HIDDEN_REASONS.T1.ar, en: HIDDEN_REASONS.T1.en },
        remedy: HIDDEN_REASONS.T1.remedy,
      });
      hidden.push({
        section: "owner.contact",
        reason: { code: HIDDEN_REASONS.T1.code, ar: HIDDEN_REASONS.T1.ar, en: HIDDEN_REASONS.T1.en },
        remedy: HIDDEN_REASONS.T1.remedy,
      });
    }
    if (access.tier !== "T2") {
      hidden.push({
        section: "history.otherClinics",
        reason: { code: HIDDEN_REASONS.T2.code, ar: HIDDEN_REASONS.T2.ar, en: HIDDEN_REASONS.T2.en },
        remedy: HIDDEN_REASONS.T2.remedy,
      });
    }

    return {
      ...card,
      // Tier 0 — unconditional, because safety is not a permission.
      alerts,
      emergencyContacts,
      clinicRelationship: {
        isKnownPatient: relationship._count._all > 0,
        visitCountHere: relationship._count._all,
        lastVisitHere: relationship._max.checkedInAt,
      },
      care,
      history,
      access: {
        tier: access.tier,
        grant: access.grant,
        // Restricted is stated honestly, never rendered as an empty section (§06).
        hidden,
        /**
         * A clinic never loses access to the work it authored, whatever the tier —
         * that is a medico-legal necessity, and T2 governs cross-clinic reading
         * only. The flag makes that explicit rather than surprising.
         */
        ownRecordsAlwaysVisible: true,
        emergencyGrantOnFile: access.emergencyOnly,
        ledgerNotice: LEDGER_NOTICE,
      },
    };
  }

  /** T1 — the care summary. Cross-clinic *facts*, not other clinics' notes. */
  private async loadCareSummary(catId: string) {
    const [cat, vaccinations, weights, activeRx] = await Promise.all([
      this.prisma.cat.findUnique({
        where: { id: catId },
        select: { isNeutered: true, lifeStage: true, isIndoor: true, diet: true, vaccinationStatus: true },
      }),
      this.prisma.catVaccination.findMany({
        where: { catId },
        select: {
          id: true,
          name: true,
          administeredAt: true,
          dueAt: true,
          vetName: true,
          clinic: true,
          batchNo: true,
        },
        orderBy: { administeredAt: "desc" },
        take: 40,
      }),
      this.prisma.catWeightRecord.findMany({
        where: { catId },
        select: { id: true, weightKg: true, bcs: true, measuredAt: true, source: true },
        orderBy: { measuredAt: "desc" },
        take: 12,
      }),
      this.prisma.prescription.findMany({
        where: { catId, status: { in: ["ISSUED", "COLLECTED", "REFILLED"] } },
        select: {
          id: true,
          medication: true,
          dosage: true,
          frequency: true,
          status: true,
          issuedAt: true,
          orgId: true,
        },
        orderBy: { issuedAt: "desc" },
        take: 25,
      }),
    ]);
    const orgs = await this.orgLookup(activeRx.map((p) => p.orgId));
    const now = new Date();
    return {
      sterilised: cat?.isNeutered ?? null,
      lifeStage: cat?.lifeStage ?? null,
      isIndoor: cat?.isIndoor ?? null,
      diet: cat?.diet ?? null,
      vaccinationStatus: cat?.vaccinationStatus ?? null,
      vaccinations: vaccinations.map((v) => ({
        ...v,
        overdue: Boolean(v.dueAt && v.dueAt < now),
      })),
      recentWeights: weights,
      activePrescriptions: activeRx.map((p) => ({
        id: p.id,
        medication: p.medication,
        dosage: p.dosage,
        frequency: p.frequency,
        status: p.status,
        issuedAt: p.issuedAt,
        clinic: clinicOf(p.orgId, orgs, p.orgId),
      })),
    };
  }

  /** T2 — who else has cared for this cat, so the vet knows where to look. */
  private async loadCrossClinicSummary(catId: string, ownOrgId: string) {
    const grouped = await this.prisma.clinicalEntry.groupBy({
      by: ["orgId"],
      where: { catId, orgId: { not: ownOrgId }, retractedAt: null },
      _count: { _all: true },
      _max: { occurredAt: true },
    });
    if (!grouped.length) return { otherClinics: [] };
    const orgs = await this.prisma.partnerOrg.findMany({
      where: { id: { in: grouped.map((g) => g.orgId) } },
      select: ORG_SELECT,
    });
    const byId = new Map(orgs.map((o) => [o.id, o]));
    return {
      otherClinics: grouped
        .map((g) => {
          const org = byId.get(g.orgId);
          return {
            clinic: org ? { id: org.id, ar: org.nameAr, en: org.nameEn, logoUrl: org.logoUrl } : null,
            entryCount: g._count._all,
            lastEntryAt: g._max.occurredAt,
          };
        })
        .sort((a, b) => (b.lastEntryAt?.getTime() ?? 0) - (a.lastEntryAt?.getTime() ?? 0)),
    };
  }

  // ── 1b · The clinic's own patients ──────────────────────────────────────

  /**
   * Cats this clinic has actually treated, newest visit first.
   *
   * The portal has always linked to a patients list; the endpoint did not
   * exist, so the nav item 404'd. Scoped to cats with a visit at THIS org —
   * a clinic's patient list is its treatment history, never the whole network,
   * which is also what keeps the privacy boundary intact.
   */
  async listOwnPatients(
    actor: VetActor,
    query: { q?: string; cursor?: string; limit?: number }
  ) {
    const limit = Math.min(Math.max(query.limit ?? 25, 1), 50);
    const term = query.q?.trim();

    const where: Prisma.CatWhereInput = {
      deletedAt: null,
      visits: { some: { orgId: actor.orgId } },
      isDemo: actor.orgIsDemo,
      ...(term
        ? {
            OR: [
              { nameNormalized: { contains: normalizeName(term) } },
              { catIdNumber: { contains: term.toUpperCase() } },
              { microchipNo: { contains: term } },
            ],
          }
        : {}),
    };

    // take+1 is the hasMore probe; ordering is [id] so the cursor is stable
    // while consults write new rows underneath.
    const rows = await this.prisma.cat.findMany({
      where,
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      orderBy: { id: "desc" },
      select: {
        id: true,
        name: true,
        catIdNumber: true,
        photoUrl: true,
        membershipStatus: true,
        user: { select: { ownerNickname: true, firstName: true, lastName: true } },
        visits: {
          where: { orgId: actor.orgId },
          orderBy: { checkedInAt: "desc" },
          take: 1,
          select: { checkedInAt: true, state: true },
        },
      },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: page.map((c) => ({
        catId: c.id,
        name: c.name,
        catIdNumber: c.catIdNumber,
        photoUrl: c.photoUrl,
        membershipStatus: c.membershipStatus,
        ownerName: ownerDisplayName(c.user),
        lastVisitAt: c.visits[0]?.checkedInAt ?? null,
        hasOpenVisit: c.visits[0]?.state === "OPEN",
        isOwnPatient: true,
      })),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  // ── 2 · Medical timeline ────────────────────────────────────────────────

  async getTimeline(actor: VetActor, catId: string, query: TimelineQueryDto, ip?: string | null) {
    await this.requireCat(catId, actor);
    const access = await this.resolveAccess(catId, actor.orgId);

    const limit = Math.min(query.limit ?? PAGE_DEFAULT, 100);
    const page = Math.max(1, query.page ?? 1);

    const occurredAt = this.dateRange(query.from, query.to);
    const where: Prisma.ClinicalEntryWhereInput = {
      catId,
      ...(access.visibleOrgIds === "ALL" ? {} : { orgId: { in: access.visibleOrgIds } }),
      ...(query.type?.length ? { type: { in: query.type } } : {}),
      ...(occurredAt ? { occurredAt } : {}),
      // A trainee's unsigned draft is not yet a record anyone else may read.
      OR: [{ status: { not: "DRAFT" } }, { orgId: actor.orgId }],
    };

    // Cursor paging is stable while a consult writes new rows; page paging stays
    // available for the day-book UI. Both hit [catId, occurredAt].
    const cursorArgs: { cursor?: { id: string }; skip: number } = query.cursor
      ? { cursor: { id: query.cursor }, skip: 1 }
      : { skip: (page - 1) * limit };

    const [rows, total] = await Promise.all([
      this.prisma.clinicalEntry.findMany({
        where,
        ...cursorArgs,
        take: limit + 1,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
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
          visit: { select: { id: true, mode: true, reason: true, checkedInAt: true, state: true } },
          author: { select: AUTHOR_SELECT },
          coSignedBy: { select: AUTHOR_SELECT },
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
      }),
      this.prisma.clinicalEntry.count({ where }),
    ]);

    const hasMore = rows.length > limit;
    const page_ = hasMore ? rows.slice(0, limit) : rows;
    const orgs = await this.orgLookup(page_.map((e) => e.orgId));
    const items = page_.map((e) => this.presentEntry(e, actor.orgId, orgs));

    await this.logAccess({
      catId,
      orgId: actor.orgId,
      staffId: actor.staffId,
      tier: access.tier,
      surface: "timeline",
      ipAddress: ip,
    });

    return {
      items,
      access: {
        tier: access.tier,
        scope: access.tier === "T2" ? "all-clinics" : "this-clinic-only",
        hidden:
          access.tier === "T2"
            ? []
            : [
                {
                  section: "entries.otherClinics",
                  reason: {
                    code: HIDDEN_REASONS.T2.code,
                    ar: HIDDEN_REASONS.T2.ar,
                    en: HIDDEN_REASONS.T2.en,
                  },
                  remedy: HIDDEN_REASONS.T2.remedy,
                },
              ],
        ledgerNotice: LEDGER_NOTICE,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore,
        nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
      },
      empty: total === 0 ? { ar: "لا توجد سجلات بعد.", en: "No records yet." } : null,
    };
  }

  /**
   * Shape one entry for the wire. A retracted entry is present and readable AS a
   * retraction — its payload is withheld, its reason is not. Nothing vanishes.
   */
  presentEntry(
    e: {
      id: string;
      type: string;
      status: string;
      payload: Prisma.JsonValue;
      note: string | null;
      occurredAt: Date;
      createdAt: Date;
      coSignedAt: Date | null;
      retractedAt: Date | null;
      retractReason: string | null;
      revisionOfId: string | null;
      orgId: string;
      visit?: { id: string; mode: string; reason: string | null; checkedInAt: Date; state: string } | null;
      author?: {
        id: string;
        role: string;
        title: string | null;
        licenceNo: string | null;
        user: { firstName: string | null; lastName: string | null };
      } | null;
      coSignedBy?: {
        id: string;
        role: string;
        title: string | null;
        licenceNo: string | null;
        user: { firstName: string | null; lastName: string | null };
      } | null;
      revisedBy?: { id: string; occurredAt: Date } | null;
      attachments?: Array<{
        id: string;
        fileName: string | null;
        mime: string | null;
        bytes: number | null;
        kind: string | null;
        scanStatus: string;
        createdAt: Date;
      }>;
    },
    viewerOrgId: string,
    orgs: OrgLookup = new Map()
  ) {
    const retracted = Boolean(e.retractedAt);
    return {
      id: e.id,
      type: e.type,
      status: e.status,
      occurredAt: e.occurredAt,
      createdAt: e.createdAt,
      // Withheld, not deleted — the fact of the entry and why it was withdrawn
      // both survive, because a medical history must stay reconstructable.
      payload: retracted ? null : e.payload,
      note: retracted ? null : e.note,
      retracted: retracted
        ? {
            at: e.retractedAt,
            reason: e.retractReason,
            notice: {
              ar: "سُحب هذا السجل ولم يعد ساريًا. يبقى محفوظًا للسجل التاريخي.",
              en: "This entry was retracted and is no longer current. It is kept for the record.",
            },
          }
        : null,
      revision: {
        isRevisionOf: e.revisionOfId,
        supersededBy: e.revisedBy?.id ?? null,
        isCurrent: !retracted && e.status !== "AMENDED",
      },
      // Which clinic wrote this — cross-clinic entries always name their source.
      clinic: clinicOf(e.orgId, orgs, viewerOrgId),
      visit: e.visit
        ? { id: e.visit.id, mode: e.visit.mode, reason: e.visit.reason, at: e.visit.checkedInAt, state: e.visit.state }
        : null,
      author: e.author
        ? { id: e.author.id, name: staffLabel(e.author), role: e.author.role, licenceNo: e.author.licenceNo }
        : null,
      coSignedBy: e.coSignedBy
        ? { id: e.coSignedBy.id, name: staffLabel(e.coSignedBy), role: e.coSignedBy.role, at: e.coSignedAt }
        : null,
      // Metadata only. The object URL is issued by the attachment endpoint, which
      // logs the read — medical images are never handed out in a list.
      attachments: (e.attachments ?? []).map((a) => ({
        id: a.id,
        fileName: a.fileName,
        mime: a.mime,
        bytes: a.bytes,
        kind: a.kind,
        scanStatus: a.scanStatus,
        createdAt: a.createdAt,
        urlEndpoint: `/api/vet/records/${e.id}/attachments/${a.id}`,
      })),
    };
  }

  // ── 7 · Weight series ───────────────────────────────────────────────────

  async getWeights(actor: VetActor, catId: string, query: WeightSeriesQueryDto, ip?: string | null) {
    const cat = await this.requireCat(catId, actor);
    const access = await this.resolveAccess(catId, actor.orgId);
    if (TIER_RANK[access.tier] < 1) {
      throw vetForbidden("VET_NO_CONSENT", "Weight history needs at least T1 consent", {
        tier: access.tier,
        required: "T1",
        hint: { ar: HIDDEN_REASONS.T1.ar, en: HIDDEN_REASONS.T1.en },
        remedy: HIDDEN_REASONS.T1.remedy,
      });
    }

    const months = query.months ?? 24;
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const series = await this.prisma.catWeightRecord.findMany({
      where: { catId, measuredAt: { gte: since } },
      select: { id: true, weightKg: true, bcs: true, measuredAt: true, source: true },
      orderBy: { measuredAt: "asc" },
      take: 500,
    });

    await this.logAccess({
      catId,
      orgId: actor.orgId,
      staffId: actor.staffId,
      tier: access.tier,
      surface: "timeline",
      ipAddress: ip,
    });

    return {
      catId,
      catName: cat.name,
      currentWeightKg: cat.weightKg,
      windowMonths: months,
      series,
      trend: this.describeTrend(series),
    };
  }

  /**
   * Describe the data. Never diagnose it.
   *
   * This returns arithmetic and a sentence that restates the arithmetic — no
   * "overweight", no "concerning", no thresholds. Reading a weight curve is
   * clinical judgement, and inventing an opinion here would put words in a
   * veterinarian's mouth and, worse, in an owner's.
   */
  private describeTrend(series: Array<{ weightKg: number; measuredAt: Date }>) {
    const first = series[0];
    const last = series[series.length - 1];
    if (!first || !last || series.length < 2) {
      return {
        direction: "insufficient" as const,
        changeKg: null,
        changePercent: null,
        from: first ?? null,
        to: last ?? null,
        description: {
          ar: "قياس واحد فقط — الاتجاه يحتاج قياسين على الأقل.",
          en: "Only one measurement — a trend needs at least two.",
        },
      };
    }
    const changeKg = Number((last.weightKg - first.weightKg).toFixed(3));
    const changePercent = first.weightKg
      ? Number(((changeKg / first.weightKg) * 100).toFixed(1))
      : null;
    // A 2% band is measurement noise on a scale, not a movement worth naming.
    const direction =
      changePercent === null || Math.abs(changePercent) < 2
        ? ("steady" as const)
        : changeKg > 0
          ? ("up" as const)
          : ("down" as const);
    const spanDays = Math.max(
      1,
      Math.round((last.measuredAt.getTime() - first.measuredAt.getTime()) / 86_400_000)
    );
    const abs = Math.abs(changePercent ?? 0);
    const en =
      direction === "steady"
        ? `${first.weightKg} kg → ${last.weightKg} kg over ${spanDays} days — within ±2%.`
        : `${first.weightKg} kg → ${last.weightKg} kg over ${spanDays} days — ${direction === "up" ? "up" : "down"} ${abs}%.`;
    const ar =
      direction === "steady"
        ? `${first.weightKg} كجم ← ${last.weightKg} كجم خلال ${spanDays} يومًا — ضمن ±٢٪.`
        : `${first.weightKg} كجم ← ${last.weightKg} كجم خلال ${spanDays} يومًا — ${direction === "up" ? "ارتفاع" : "انخفاض"} ${abs}٪.`;
    return {
      direction,
      changeKg,
      changePercent,
      spanDays,
      from: first,
      to: last,
      description: { ar, en },
    };
  }

  // ── 6 · Prescriptions (read side) ───────────────────────────────────────

  async listPrescriptions(
    actor: VetActor,
    catId: string,
    query: PrescriptionListQueryDto,
    ip?: string | null
  ) {
    await this.requireCat(catId, actor);
    const access = await this.resolveAccess(catId, actor.orgId);
    const limit = Math.min(query.limit ?? PAGE_DEFAULT, 100);
    const page = Math.max(1, query.page ?? 1);
    const activeStatuses = ["ISSUED", "COLLECTED", "REFILLED"] as const;

    /**
     * Active medication is tier-0 safety information wherever it was prescribed —
     * you cannot safely anaesthetise a cat whose current drugs you can't see.
     * Completed/cancelled history from OTHER clinics is ordinary medical history
     * and stays behind T2.
     */
    const where: Prisma.PrescriptionWhereInput =
      access.tier === "T2"
        ? { catId, ...(query.scope === "active" ? { status: { in: [...activeStatuses] } } : {}) }
        : {
            catId,
            OR: [
              { orgId: actor.orgId },
              { status: { in: [...activeStatuses] } },
            ],
            ...(query.scope === "active" ? { status: { in: [...activeStatuses] } } : {}),
          };

    const [rows, total] = await Promise.all([
      this.prisma.prescription.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { issuedAt: "desc" },
        select: {
          id: true,
          medication: true,
          strength: true,
          form: true,
          dosage: true,
          frequency: true,
          durationDays: true,
          quantity: true,
          instructions: true,
          status: true,
          issuedAt: true,
          collectedAt: true,
          completedAt: true,
          expiresAt: true,
          refillsAllowed: true,
          refillsUsed: true,
          warnings: true,
          orgId: true,
          entryId: true,
          prescriber: { select: AUTHOR_SELECT },
        },
      }),
      this.prisma.prescription.count({ where }),
    ]);
    const orgs = await this.orgLookup(rows.map((p) => p.orgId));

    await this.logAccess({
      catId,
      orgId: actor.orgId,
      staffId: actor.staffId,
      tier: access.tier,
      surface: "profile",
      ipAddress: ip,
    });

    return {
      items: rows.map((p) => {
        const isOurs = p.orgId === actor.orgId;
        return {
          id: p.id,
          medication: p.medication,
          strength: p.strength,
          form: p.form,
          dosage: p.dosage,
          frequency: p.frequency,
          durationDays: p.durationDays,
          quantity: p.quantity,
          // Another clinic's dispensing instructions are their clinical voice —
          // shown only at T2 or when we wrote them.
          instructions: isOurs || access.tier === "T2" ? p.instructions : null,
          status: p.status,
          issuedAt: p.issuedAt,
          collectedAt: p.collectedAt,
          completedAt: p.completedAt,
          expiresAt: p.expiresAt,
          refills: { allowed: p.refillsAllowed, used: p.refillsUsed, remaining: p.refillsAllowed - p.refillsUsed },
          warnings: p.warnings,
          entryId: isOurs || access.tier === "T2" ? p.entryId : null,
          clinic: clinicOf(p.orgId, orgs, actor.orgId),
          prescriber: p.prescriber ? { id: p.prescriber.id, name: staffLabel(p.prescriber) } : null,
          // Only the issuing clinic dispenses its own prescription.
          canDispense: isOurs,
        };
      }),
      access: { tier: access.tier, ledgerNotice: LEDGER_NOTICE },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: (page - 1) * limit + rows.length < total,
      },
    };
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  /** Build an inclusive [from, to] filter; `to` covers the whole calendar day. */
  dateRange(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
    if (!from && !to) return undefined;
    const filter: Prisma.DateTimeFilter = {};
    if (from) filter.gte = new Date(from);
    if (to) {
      const end = new Date(to);
      // A bare date means "through the end of that day", which is what a human
      // filtering a day-book means.
      if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setHours(23, 59, 59, 999);
      filter.lte = end;
    }
    return filter;
  }
}
