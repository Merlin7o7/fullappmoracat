/**
 * Clinical entries — MRC-VET-001 §10. The append-only heart of the platform.
 *
 * Three rules are enforced here and cannot be configured away:
 *
 *   1. NOTHING IS EVER UPDATED IN PLACE. A correction inserts a new row whose
 *      `revisionOf` points at its predecessor (which becomes AMENDED). A
 *      withdrawal stamps `retractedAt` + a required reason. There is no code
 *      path in this file that mutates a payload or deletes an entry, because a
 *      medical history has to be reconstructable years later, in a dispute,
 *      by someone who was not there.
 *   2. A TRAINEE'S WORK IS DRAFT UNTIL A CLINICIAN SIGNS IT. Interns author real
 *      records; those records do not become facts — and crucially do not fire
 *      side effects — until a senior co-signs.
 *   3. SIDE EFFECTS ARE THE THESIS. A vaccination written here also writes
 *      `CatVaccination`, so the existing lifecycle engine reminds the owner
 *      automatically. A weight writes `CatWeightRecord` and updates the cat. A
 *      prescription writes `Prescription` with allergy warnings attached. One
 *      clinical act, and the member is cared for — that is the entire product.
 */
import { Injectable } from "@nestjs/common";
import { Prisma, type ClinicalEntryType, type PrescriptionStatus } from "@moraqat/db";
import { requiresCoSign, deriveVaccinationStatus } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";
import {
  VetPatientsService,
  staffLabel,
  vetBadRequest,
  vetConflict,
  vetForbidden,
  vetNotFound,
  type VetActor,
} from "./vet-patients.service";
import {
  validateEntryPayload,
  type ClinicalEntryTypeName,
  type CoSignClinicalEntryDto,
  type CreateAttachmentDto,
  type CreateClinicalEntryDto,
  type PrescriptionAction,
  type RetractClinicalEntryDto,
  type ReviseClinicalEntryDto,
  type UpdatePrescriptionStatusDto,
} from "./dto/vet-record.dto";

type Tx = Prisma.TransactionClient;

const ENTRY_SELECT = {
  id: true,
  catId: true,
  visitId: true,
  orgId: true,
  type: true,
  status: true,
  payload: true,
  note: true,
  occurredAt: true,
  createdAt: true,
  authorId: true,
  coSignedById: true,
  coSignedAt: true,
  revisionOfId: true,
  retractedAt: true,
  retractReason: true,
  visit: { select: { id: true, mode: true, reason: true, checkedInAt: true, state: true } },
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
} satisfies Prisma.ClinicalEntrySelect;

/** Active = the cat is on it right now. Drives safety cross-checks. */
const ACTIVE_RX: PrescriptionStatus[] = ["ISSUED", "COLLECTED", "REFILLED"];

/**
 * Valid prescription lifecycle. Anything not listed is a 409, so a cancelled
 * prescription can never be quietly resurrected into a dispensable one.
 */
const RX_TRANSITIONS: Record<PrescriptionStatus, PrescriptionStatus[]> = {
  ISSUED: ["COLLECTED", "COMPLETED", "CANCELLED", "EXPIRED"],
  COLLECTED: ["REFILLED", "COMPLETED", "CANCELLED", "EXPIRED"],
  REFILLED: ["REFILLED", "COMPLETED", "CANCELLED", "EXPIRED"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

const ACTION_TARGET: Record<PrescriptionAction, PrescriptionStatus> = {
  dispense: "COLLECTED",
  refill: "REFILLED",
  complete: "COMPLETED",
  cancel: "CANCELLED",
};

@Injectable()
export class VetRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: VetPatientsService
  ) {}

  // ── 4 · Author an entry ─────────────────────────────────────────────────

  async create(actor: VetActor, dto: CreateClinicalEntryDto) {
    const cat = await this.patients.requireCat(dto.catId, actor);
    // Authoring requires an encounter at THIS clinic. Consent governs read
    // depth, never the right to write facts onto someone else's patient.
    await this.patients.requireTreatmentRelationship(cat.id, actor.orgId);
    const payload = this.parsePayload(dto.type, dto.payload);
    const occurredAt = this.parseOccurredAt(dto.occurredAt);

    // A visit, if given, must be this org's, this cat's, and still open.
    let visitId: string | null = null;
    if (dto.visitId) {
      const visit = await this.prisma.visit.findFirst({
        where: { id: dto.visitId, orgId: actor.orgId },
        select: { id: true, catId: true, state: true, closedAt: true },
      });
      if (!visit || visit.catId !== cat.id) {
        throw vetNotFound("VET_VISIT_NOT_FOUND", "No such visit for this cat at your clinic", {
          hint: {
            ar: "الزيارة غير موجودة أو تخص قطة أخرى.",
            en: "That visit doesn't exist, or belongs to a different cat.",
          },
        });
      }
      if (visit.state === "CLOSED") {
        throw vetConflict("VET_VISIT_CLOSED", "Cannot add records to a closed visit", {
          visitId: visit.id,
          closedAt: visit.closedAt,
          hint: {
            ar: "هذه الزيارة مُغلقة. افتحوا زيارة جديدة لتسجيل رعاية جديدة.",
            en: "That visit is closed. Open a new visit to record new care.",
          },
        });
      }
      visitId = visit.id;
    }

    // The trainee rule: an intern's record is real, attributed, and not yet a
    // fact. It stays DRAFT — and fires no owner-facing side effects — until a
    // clinician co-signs it.
    const isDraft = requiresCoSign(actor.role);

    const result = await this.prisma.$transaction(async (tx) => {
      const entry = await tx.clinicalEntry.create({
        data: {
          catId: cat.id,
          visitId,
          orgId: actor.orgId,
          type: dto.type as ClinicalEntryType,
          status: isDraft ? "DRAFT" : "FINAL",
          payload: payload as Prisma.InputJsonValue,
          note: dto.note ?? null,
          occurredAt,
          authorId: actor.staffId,
        },
        select: ENTRY_SELECT,
      });
      const effects = isDraft ? { deferred: true as const } : await this.applySideEffects(tx, actor, entry);
      return { entry, effects };
    });

    // The ledger is the owner's answer to "who touched my cat's record". A
    // clinic authoring a diagnosis is at least as material as one reading it.
    await this.patients.logAccess({
      catId: cat.id,
      orgId: actor.orgId,
      staffId: actor.staffId,
      tier: "T1",
      surface: "write",
    });

    return {
      entry: this.patients.presentEntry(result.entry, actor.orgId),
      sideEffects: result.effects,
      coSign: isDraft
        ? {
            required: true,
            notice: {
              ar: "حُفظ السجل كمسودة بانتظار توقيع طبيب. لن تُرسل تذكيرات للمالك قبل التوقيع.",
              en: "Saved as a draft awaiting a clinician's co-signature. No owner reminders are scheduled until it's signed.",
            },
          }
        : { required: false, notice: null },
    };
  }

  // ── Co-sign ─────────────────────────────────────────────────────────────

  /**
   * A clinician takes responsibility for a trainee's record. This is the only
   * transition that changes an entry's status without creating a new row — and
   * it adds a signature rather than altering what was written.
   */
  async coSign(actor: VetActor, entryId: string, dto: CoSignClinicalEntryDto) {
    const entry = await this.requireOwnEntry(actor, entryId);
    if (entry.retractedAt) throw this.immutable(entry.id, "retracted");
    if (entry.status !== "DRAFT") {
      throw vetConflict("VET_ALREADY_COSIGNED", "This entry is not awaiting a co-signature", {
        status: entry.status,
        coSignedAt: entry.coSignedAt,
        hint: {
          ar: "هذا السجل ليس مسودة — لا حاجة لتوقيع.",
          en: "This entry isn't a draft — no co-signature is needed.",
        },
      });
    }
    if (entry.authorId === actor.staffId) {
      throw vetForbidden("VET_COSIGN_SELF", "You cannot co-sign your own draft", {
        hint: {
          ar: "لا يمكن توقيع مسودتكم بأنفسكم — يوقّعها طبيب آخر.",
          en: "You can't co-sign your own draft — another clinician must.",
        },
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const signed = await tx.clinicalEntry.update({
        where: { id: entry.id },
        data: {
          status: "FINAL",
          coSignedById: actor.staffId,
          coSignedAt: new Date(),
          ...(dto.note?.trim()
            ? { note: [entry.note, `— co-sign: ${dto.note.trim()}`].filter(Boolean).join("\n") }
            : {}),
        },
        select: ENTRY_SELECT,
      });
      // NOW the side effects fire: the record became a fact at signature.
      const effects = await this.applySideEffects(tx, actor, signed);
      return { signed, effects };
    });

    return {
      entry: this.patients.presentEntry(result.signed, actor.orgId),
      sideEffects: result.effects,
    };
  }

  // ── Revise (the only way to "edit") ─────────────────────────────────────

  /**
   * Correct an entry by superseding it. The predecessor becomes AMENDED and
   * stays fully readable; the correction is a new row that points back at it.
   * Nobody ever loses the ability to see what was originally written, or when
   * somebody changed their mind.
   */
  async revise(actor: VetActor, entryId: string, dto: ReviseClinicalEntryDto) {
    const entry = await this.requireOwnEntry(actor, entryId);
    if (entry.retractedAt) throw this.immutable(entry.id, "retracted");
    if (entry.status === "AMENDED") {
      throw vetConflict("VET_ENTRY_IMMUTABLE", "This entry has already been superseded", {
        supersededBy: entry.revisedBy?.id ?? null,
        hint: {
          ar: "صُحِّح هذا السجل من قبل. صحّحوا النسخة الأحدث.",
          en: "This entry was already corrected. Revise the newer version instead.",
        },
      });
    }

    const type = entry.type as ClinicalEntryTypeName;
    const payload = this.parsePayload(type, dto.payload);
    const occurredAt = this.parseOccurredAt(dto.occurredAt ?? entry.occurredAt.toISOString());
    const isDraft = requiresCoSign(actor.role);

    const result = await this.prisma.$transaction(async (tx) => {
      // Retire the predecessor's owner-facing projections first, so a corrected
      // weight or vaccination never leaves a stale reminder behind it.
      await this.retireProjections(tx, entry);

      const revision = await tx.clinicalEntry.create({
        data: {
          catId: entry.catId,
          visitId: entry.visitId,
          orgId: entry.orgId,
          type: entry.type,
          status: isDraft ? "DRAFT" : "FINAL",
          payload: payload as Prisma.InputJsonValue,
          note: [dto.note ?? null, dto.reason ? `— revision reason: ${dto.reason}` : null]
            .filter(Boolean)
            .join("\n") || null,
          occurredAt,
          authorId: actor.staffId,
          revisionOfId: entry.id,
        },
        select: ENTRY_SELECT,
      });

      await tx.clinicalEntry.update({
        where: { id: entry.id },
        data: { status: "AMENDED" },
      });

      const effects = isDraft
        ? { deferred: true as const }
        : await this.applySideEffects(tx, actor, revision);
      return { revision, effects };
    });

    return {
      entry: this.patients.presentEntry(result.revision, actor.orgId),
      supersededEntryId: entry.id,
      sideEffects: result.effects,
      notice: {
        ar: "أُنشئت نسخة مصحّحة. النسخة السابقة محفوظة ومقروءة كسجل تاريخي.",
        en: "A corrected version was created. The previous version is kept and stays readable.",
      },
    };
  }

  // ── Retract ─────────────────────────────────────────────────────────────

  /** Withdraw an entry. It greys out with a reason; it never vanishes. */
  async retract(actor: VetActor, entryId: string, dto: RetractClinicalEntryDto) {
    const entry = await this.requireOwnEntry(actor, entryId);
    if (entry.retractedAt) {
      throw vetConflict("VET_ENTRY_IMMUTABLE", "This entry is already retracted", {
        retractedAt: entry.retractedAt,
        reason: entry.retractReason,
        hint: { ar: "هذا السجل مسحوب مسبقًا.", en: "This entry was already retracted." },
      });
    }
    const reason = dto.reason.trim();
    if (!reason) {
      throw vetBadRequest("VET_REASON_REQUIRED", "A retraction reason is required", {
        hint: {
          ar: "اكتبوا سبب السحب — السحب بلا سبب ليس سجلًا موثوقًا.",
          en: "Give a reason for the retraction — a withdrawal without one isn't an audit trail.",
        },
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // A withdrawn record must stop acting on the owner's life: cancel its
      // prescription, drop its weight point, remove its vaccination reminder.
      await this.retireProjections(tx, entry);
      return tx.clinicalEntry.update({
        where: { id: entry.id },
        data: { status: "RETRACTED", retractedAt: new Date(), retractReason: reason },
        select: ENTRY_SELECT,
      });
    });

    return {
      entry: this.patients.presentEntry(updated, actor.orgId),
      notice: {
        ar: "سُحب السجل مع بيان السبب. يبقى محفوظًا في التاريخ الطبي ولا يُحذف.",
        en: "The entry was retracted with its reason. It stays in the medical history and is not deleted.",
      },
    };
  }

  // ── Read one ────────────────────────────────────────────────────────────

  async getOne(actor: VetActor, entryId: string, ip?: string | null) {
    const entry = await this.prisma.clinicalEntry.findUnique({
      where: { id: entryId },
      select: ENTRY_SELECT,
    });
    if (!entry) throw this.entryNotFound();

    const access = await this.patients.resolveAccess(entry.catId, actor.orgId);
    const isOurs = entry.orgId === actor.orgId;
    if (!isOurs && access.tier !== "T2") {
      throw vetForbidden("VET_NO_CONSENT", "Cross-clinic records need T2 consent", {
        tier: access.tier,
        required: "T2",
        hint: {
          ar: "هذا السجل من عيادة أخرى ويحتاج إذن المالك الكامل.",
          en: "This record belongs to another clinic and needs the owner's full consent.",
        },
      });
    }
    if (!isOurs && entry.status === "DRAFT") throw this.entryNotFound();

    await this.patients.logAccess({
      catId: entry.catId,
      orgId: actor.orgId,
      staffId: actor.staffId,
      tier: access.tier,
      surface: "entry",
      ipAddress: ip,
    });

    return { entry: this.patients.presentEntry(entry, actor.orgId), access: { tier: access.tier } };
  }

  // ── 5 · Attachments ─────────────────────────────────────────────────────

  /**
   * Attach an already-stored object (upload via `POST /api/uploads/image`, which
   * sniffs the real bytes before storing). We persist the reference, never the
   * bytes, and never hand the URL back in a list response.
   */
  async addAttachment(actor: VetActor, entryId: string, dto: CreateAttachmentDto) {
    const entry = await this.requireOwnEntry(actor, entryId);
    if (entry.retractedAt) throw this.immutable(entry.id, "retracted");

    let url: URL;
    try {
      url = new URL(dto.fileUrl);
    } catch {
      throw vetBadRequest("VET_ATTACHMENT_INVALID", "fileUrl must be an absolute URL", {
        hint: {
          ar: "ارفعوا الملف أولًا عبر /api/uploads/image ثم أرسلوا الرابط الناتج.",
          en: "Upload the file via /api/uploads/image first, then send the URL it returns.",
        },
      });
    }
    // data:/file:/javascript: URIs are how a "medical image" becomes a payload.
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw vetBadRequest("VET_ATTACHMENT_INVALID", "Only http(s) object URLs are accepted", {
        protocol: url.protocol,
        hint: {
          ar: "الرابط يجب أن يكون https من مساحة التخزين.",
          en: "The URL must be an https link from object storage.",
        },
      });
    }

    const attachment = await this.prisma.entryAttachment.create({
      data: {
        entryId: entry.id,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName ?? null,
        mime: dto.mime ?? null,
        bytes: dto.bytes ?? null,
        kind: dto.kind ?? null,
      },
      select: {
        id: true,
        fileName: true,
        mime: true,
        bytes: true,
        kind: true,
        scanStatus: true,
        createdAt: true,
      },
    });

    return {
      attachment: { ...attachment, urlEndpoint: `/api/vet/records/${entry.id}/attachments/${attachment.id}` },
      notice: {
        ar: "أُرفق الملف بالسجل. يُفتح عبر رابط مُسجَّل الوصول، لا كملف عام.",
        en: "Attached to the record. It opens through an access-logged endpoint, never as a public file.",
      },
    };
  }

  /**
   * Hand out the object URL for one medical image — and log that somebody looked.
   * List responses deliberately carry metadata only, so an X-ray is never
   * scattered across a timeline payload where nobody counted the read.
   */
  async getAttachment(actor: VetActor, entryId: string, attachmentId: string, ip?: string | null) {
    const attachment = await this.prisma.entryAttachment.findFirst({
      where: { id: attachmentId, entryId },
      select: {
        id: true,
        fileUrl: true,
        fileName: true,
        mime: true,
        bytes: true,
        kind: true,
        scanStatus: true,
        createdAt: true,
        entry: { select: { id: true, catId: true, orgId: true, status: true } },
      },
    });
    if (!attachment) {
      throw vetNotFound("VET_ATTACHMENT_NOT_FOUND", "No such attachment on that entry", {
        hint: { ar: "لا يوجد مرفق بهذا المعرّف.", en: "No attachment with that id." },
      });
    }

    const access = await this.patients.resolveAccess(attachment.entry.catId, actor.orgId);
    const isOurs = attachment.entry.orgId === actor.orgId;
    if (!isOurs && access.tier !== "T2") {
      throw vetForbidden("VET_NO_CONSENT", "Cross-clinic attachments need T2 consent", {
        tier: access.tier,
        required: "T2",
        hint: {
          ar: "هذا المرفق من عيادة أخرى ويحتاج إذن المالك الكامل.",
          en: "This file belongs to another clinic and needs the owner's full consent.",
        },
      });
    }

    await this.patients.logAccess({
      catId: attachment.entry.catId,
      orgId: actor.orgId,
      staffId: actor.staffId,
      tier: access.tier,
      surface: "attachment",
      ipAddress: ip,
    });

    return {
      id: attachment.id,
      url: attachment.fileUrl,
      fileName: attachment.fileName,
      mime: attachment.mime,
      bytes: attachment.bytes,
      kind: attachment.kind,
      scanStatus: attachment.scanStatus,
      createdAt: attachment.createdAt,
      ledgerNotice: {
        ar: "سُجِّل فتح هذا الملف في سجل اطلاع المالك.",
        en: "Opening this file was recorded in the owner's access ledger.",
      },
    };
  }

  // ── 6 · Prescription lifecycle ──────────────────────────────────────────

  async updatePrescriptionStatus(
    actor: VetActor,
    prescriptionId: string,
    dto: UpdatePrescriptionStatusDto
  ) {
    const rx = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      select: {
        id: true,
        catId: true,
        orgId: true,
        medication: true,
        status: true,
        refillsAllowed: true,
        refillsUsed: true,
        expiresAt: true,
        cat: { select: { name: true, userId: true } },
      },
    });
    if (!rx) {
      throw vetNotFound("VET_PRESCRIPTION_NOT_FOUND", "No prescription with that id", {
        hint: { ar: "لا توجد وصفة بهذا المعرّف.", en: "No prescription with that id." },
      });
    }
    // Only the clinic that issued a prescription may advance it — dispensing
    // another practice's script is not a thing this system will pretend to do.
    if (rx.orgId !== actor.orgId) {
      throw vetForbidden("VET_ENTRY_FOREIGN", "Only the issuing clinic can update this prescription", {
        hint: {
          ar: "هذه الوصفة صادرة من عيادة أخرى — لا يمكن تحديث حالتها من هنا.",
          en: "This prescription was issued by another clinic — its status can't be changed here.",
        },
      });
    }

    const target = ACTION_TARGET[dto.action];
    const allowed = RX_TRANSITIONS[rx.status] ?? [];
    if (!allowed.includes(target)) {
      throw vetConflict("VET_INVALID_TRANSITION", `Cannot go ${rx.status} → ${target}`, {
        from: rx.status,
        to: target,
        allowed,
        hint: {
          ar: `لا يمكن الانتقال من «${rx.status}» إلى «${target}».`,
          en: `A ${rx.status.toLowerCase()} prescription can't become ${target.toLowerCase()}.`,
        },
      });
    }
    if (dto.action === "refill" && rx.refillsUsed >= rx.refillsAllowed) {
      throw vetConflict("VET_NO_REFILLS", "No refills remain on this prescription", {
        allowed: rx.refillsAllowed,
        used: rx.refillsUsed,
        hint: {
          ar: "لا توجد إعادات صرف متبقية. يلزم وصفة جديدة من الطبيب.",
          en: "No refills remain — the vet needs to issue a new prescription.",
        },
      });
    }
    // A script past its own expiry date is not dispensable, whatever its status
    // says — the date is the clinical limit the prescriber set.
    if (
      (dto.action === "dispense" || dto.action === "refill") &&
      rx.expiresAt &&
      rx.expiresAt.getTime() < Date.now()
    ) {
      throw vetConflict("VET_INVALID_TRANSITION", "This prescription has passed its expiry date", {
        from: rx.status,
        to: target,
        expiredAt: rx.expiresAt,
        hint: {
          ar: "انتهت صلاحية هذه الوصفة. يلزم وصفة جديدة من الطبيب قبل الصرف.",
          en: "This prescription has expired. The vet needs to issue a new one before dispensing.",
        },
      });
    }
    if (dto.action === "cancel" && !dto.reason?.trim()) {
      throw vetBadRequest("VET_REASON_REQUIRED", "Cancelling needs a reason", {
        hint: {
          ar: "اكتبوا سبب الإلغاء — المالك يستحق تفسيرًا.",
          en: "Give a reason for cancelling — the owner deserves an explanation.",
        },
      });
    }

    const now = new Date();
    const updated = await this.prisma.prescription.update({
      where: { id: rx.id },
      data: {
        status: target,
        ...(target === "COLLECTED" ? { collectedAt: now } : {}),
        ...(target === "REFILLED" ? { refillsUsed: { increment: 1 }, collectedAt: now } : {}),
        ...(target === "COMPLETED" ? { completedAt: now } : {}),
        // The reason joins the permanent audit trail on the row itself, so
        // "why was this cancelled" is answerable years later without a log dive.
        ...(dto.reason?.trim() ? { warnings: { push: `${target}: ${dto.reason.trim()}` } } : {}),
      },
      select: {
        id: true,
        medication: true,
        status: true,
        collectedAt: true,
        completedAt: true,
        refillsAllowed: true,
        refillsUsed: true,
        warnings: true,
      },
    });

    if (dto.notifyOwner) {
      const copy = this.rxOwnerCopy(dto.action, rx.cat.name, rx.medication, dto.reason);
      if (copy) {
        await this.patients.notifyOwner({
          userId: rx.cat.userId,
          category: "SYSTEM",
          type: `vet_prescription_${dto.action}`,
          ar: copy.ar,
          en: copy.en,
          data: { prescriptionId: rx.id, catId: rx.catId, link: `/portal/cats/${rx.catId}/health` },
        });
      }
    }

    return {
      prescription: {
        ...updated,
        refills: {
          allowed: updated.refillsAllowed,
          used: updated.refillsUsed,
          remaining: updated.refillsAllowed - updated.refillsUsed,
        },
      },
      transition: { from: rx.status, to: target },
    };
  }

  private rxOwnerCopy(action: PrescriptionAction, catName: string, med: string, reason?: string) {
    switch (action) {
      case "dispense":
        return {
          ar: { title: `دواء ${catName} جاهز`, body: `تم صرف ${med} من العيادة.` },
          en: { title: `${catName}'s medication is ready`, body: `${med} has been dispensed.` },
        };
      case "refill":
        return {
          ar: { title: `أُعيد صرف دواء ${catName}`, body: `تم إعادة صرف ${med}.` },
          en: { title: `${catName}'s medication was refilled`, body: `${med} has been refilled.` },
        };
      case "complete":
        return {
          ar: { title: `انتهى علاج ${catName}`, body: `اكتملت دورة ${med}.` },
          en: { title: `${catName}'s course is complete`, body: `The ${med} course has finished.` },
        };
      case "cancel":
        return {
          ar: {
            title: `أُلغيت وصفة ${catName}`,
            body: reason ? `${med} — ${reason}` : `أُلغيت وصفة ${med}. تواصلوا مع العيادة للتفاصيل.`,
          },
          en: {
            title: `${catName}'s prescription was cancelled`,
            body: reason ? `${med} — ${reason}` : `The ${med} prescription was cancelled. Your clinic can explain more.`,
          },
        };
      default:
        return null;
    }
  }

  // ── Side-effect writers — the platform thesis ───────────────────────────

  /**
   * Project a finalised clinical entry into the member-facing tables the rest of
   * Moracat already runs on. This is what makes the vet portal worth building:
   * the vet does their job, and the owner is reminded, charted, and informed
   * without anyone doing data entry twice.
   */
  private async applySideEffects(
    tx: Tx,
    actor: VetActor,
    entry: { id: string; catId: string; orgId: string; type: string; payload: Prisma.JsonValue; occurredAt: Date }
  ) {
    switch (entry.type) {
      case "VACCINATION":
        return this.writeVaccination(tx, actor, entry);
      case "WEIGHT":
        return this.writeWeight(tx, entry);
      case "PRESCRIPTION":
        return this.writePrescription(tx, actor, entry);
      default:
        return { deferred: false as const };
    }
  }

  /**
   * A vaccination becomes an owner reminder. `CatVaccination.dueAt` is exactly
   * the field the existing lifecycle engine watches, so writing this row is the
   * whole integration — no scheduler, no duplicate reminder logic.
   */
  private async writeVaccination(
    tx: Tx,
    actor: VetActor,
    entry: { id: string; catId: string; orgId: string; payload: Prisma.JsonValue; occurredAt: Date }
  ) {
    const p = (entry.payload ?? {}) as {
      vaccine?: string;
      batchNo?: string;
      dueAt?: string;
      manufacturer?: string;
    };
    if (!p.vaccine) return { deferred: false as const };

    const [org, staff] = await Promise.all([
      tx.partnerOrg.findUnique({ where: { id: entry.orgId }, select: { nameEn: true, nameAr: true } }),
      tx.partnerStaff.findUnique({
        where: { id: actor.staffId },
        select: { title: true, user: { select: { firstName: true, lastName: true } } },
      }),
    ]);

    const created = await tx.catVaccination.create({
      data: {
        catId: entry.catId,
        name: p.vaccine,
        administeredAt: entry.occurredAt,
        dueAt: p.dueAt ? new Date(p.dueAt) : null,
        vetName: staffLabel(staff ?? null),
        clinic: org?.nameEn ?? null,
        batchNo: p.batchNo ?? null,
        notes: `Recorded from clinical entry ${entry.id}`,
      },
      select: { id: true, name: true, administeredAt: true, dueAt: true },
    });

    // The badge is DERIVED from the records (see deriveVaccinationStatus), not
    // asserted here. Writing "UP_TO_DATE" unconditionally meant one dose of a
    // three-dose kitten series flipped the owner-facing badge green, and nothing
    // ever recomputed it when dueAt passed — so the status was only true at the
    // instant it was written. Recompute from the full record set instead.
    const allDoses = await tx.catVaccination.findMany({
      where: { catId: entry.catId },
      select: { administeredAt: true, dueAt: true },
    });
    const derived = deriveVaccinationStatus(allDoses);
    await tx.cat.update({
      where: { id: entry.catId },
      // Cached projection of the derivation, refreshed on every clinical write
      // and by the lifecycle pass — never a standalone claim.
      data: { vaccinationStatus: derived.standing },
    });

    return {
      deferred: false as const,
      vaccination: created,
      ownerImpact: created.dueAt
        ? {
            ar: `سيصل المالك تذكير قبل الجرعة القادمة في ${created.dueAt.toISOString().slice(0, 10)}.`,
            en: `The owner will be reminded before the next dose on ${created.dueAt.toISOString().slice(0, 10)}.`,
          }
        : {
            ar: "سُجِّل التطعيم. أضيفوا تاريخ الجرعة القادمة ليصل المالك تذكير.",
            en: "Vaccination recorded. Add a next-dose date and the owner gets a reminder.",
          },
    };
  }

  /** A weight becomes a chart point — and the cat's current weight. */
  private async writeWeight(
    tx: Tx,
    entry: { id: string; catId: string; payload: Prisma.JsonValue; occurredAt: Date }
  ) {
    const p = (entry.payload ?? {}) as { weightKg?: number; bcs?: number };
    if (typeof p.weightKg !== "number") return { deferred: false as const };

    const record = await tx.catWeightRecord.create({
      data: {
        catId: entry.catId,
        entryId: entry.id,
        weightKg: p.weightKg,
        bcs: p.bcs ?? null,
        measuredAt: entry.occurredAt,
        source: "clinic",
      },
      select: { id: true, weightKg: true, bcs: true, measuredAt: true },
    });

    // Only move the cat's headline weight if this is the most recent measurement.
    const newer = await tx.catWeightRecord.count({
      where: { catId: entry.catId, measuredAt: { gt: entry.occurredAt } },
    });
    if (newer === 0) {
      await tx.cat.update({ where: { id: entry.catId }, data: { weightKg: p.weightKg } });
    }

    return { deferred: false as const, weightRecord: record, currentWeightUpdated: newer === 0 };
  }

  /**
   * A prescription becomes a tracked, owner-visible medication — with warnings.
   *
   * Warnings are RECORDED, never blocking. The system cross-checks the cat's
   * recorded allergies and current medications and puts what it found in front
   * of the vet and into the permanent audit trail; the decision stays with the
   * clinician, who can see the patient and knows what the software doesn't.
   */
  private async writePrescription(
    tx: Tx,
    actor: VetActor,
    entry: { id: string; catId: string; orgId: string; payload: Prisma.JsonValue }
  ) {
    const p = (entry.payload ?? {}) as {
      medication?: string;
      strength?: string;
      form?: string;
      dosage?: string;
      frequency?: string;
      durationDays?: number;
      quantity?: string;
      instructions?: string;
      refillsAllowed?: number;
      expiresAt?: string;
    };
    if (!p.medication || !p.dosage || !p.frequency) return { deferred: false as const };

    const warnings = await this.computeRxWarnings(tx, entry.catId, p.medication);

    const rx = await tx.prescription.create({
      data: {
        catId: entry.catId,
        entryId: entry.id,
        orgId: entry.orgId,
        prescriberId: actor.staffId,
        medication: p.medication,
        strength: p.strength ?? null,
        form: p.form ?? null,
        dosage: p.dosage,
        frequency: p.frequency,
        durationDays: p.durationDays ?? null,
        quantity: p.quantity ?? null,
        instructions: p.instructions ?? null,
        refillsAllowed: p.refillsAllowed ?? 0,
        expiresAt: p.expiresAt ? new Date(p.expiresAt) : null,
        warnings: warnings.map((w) => w.text),
      },
      select: { id: true, medication: true, status: true, issuedAt: true, warnings: true },
    });

    return {
      deferred: false as const,
      prescription: rx,
      warnings,
      // The UI should make the vet look at these before they hand the bag over —
      // an interface confirmation, never a server-side refusal to treat.
      requiresAcknowledgement: warnings.some((w) => w.severity === "high"),
    };
  }

  /** Allergy + duplicate-therapy cross-check. Substring matching, deliberately generous. */
  private async computeRxWarnings(tx: Tx, catId: string, medication: string) {
    const med = medication.toLowerCase();
    const [allergies, active] = await Promise.all([
      tx.catAllergy.findMany({ where: { catId }, select: { allergen: true } }),
      tx.prescription.findMany({
        where: { catId, status: { in: ACTIVE_RX } },
        select: { medication: true, issuedAt: true, orgId: true },
        take: 40,
      }),
    ]);

    const warnings: Array<{ code: string; severity: "high" | "info"; text: string; ar: string }> = [];

    for (const a of allergies) {
      const allergen = a.allergen.trim().toLowerCase();
      if (!allergen) continue;
      if (med.includes(allergen) || allergen.includes(med)) {
        warnings.push({
          code: "ALLERGY_MATCH",
          severity: "high",
          text: `Recorded allergy: ${a.allergen} — matches "${medication}". Confirm before dispensing.`,
          ar: `حساسية مسجّلة: ${a.allergen} — تتطابق مع «${medication}». تأكّدوا قبل الصرف.`,
        });
      }
    }

    for (const rx of active) {
      if (rx.medication.trim().toLowerCase() === med) {
        warnings.push({
          code: "DUPLICATE_THERAPY",
          severity: "high",
          text: `Already on ${rx.medication} (issued ${rx.issuedAt.toISOString().slice(0, 10)}). Check for double-dosing.`,
          ar: `القطة تتناول ${rx.medication} بالفعل (صُرف في ${rx.issuedAt.toISOString().slice(0, 10)}). تحقّقوا من ازدواج الجرعة.`,
        });
      }
    }

    if (allergies.length === 0) {
      warnings.push({
        code: "NO_ALLERGIES_ON_FILE",
        severity: "info",
        text: "No allergies recorded for this cat — absence of a record is not evidence of absence.",
        ar: "لا توجد حساسيات مسجّلة لهذه القطة — غياب التسجيل لا يعني غياب الحساسية.",
      });
    }

    return warnings;
  }

  /**
   * Undo the owner-facing projections of an entry that is being superseded or
   * withdrawn. The clinical entry itself is untouched — only the derived rows
   * that would otherwise keep acting on a record that is no longer current.
   */
  private async retireProjections(
    tx: Tx,
    entry: { id: string; catId: string; type: string; payload: Prisma.JsonValue; occurredAt: Date }
  ) {
    if (entry.type === "WEIGHT") {
      await tx.catWeightRecord.deleteMany({ where: { entryId: entry.id } });
      return;
    }
    if (entry.type === "PRESCRIPTION") {
      await tx.prescription.updateMany({
        where: { entryId: entry.id, status: { in: ACTIVE_RX } },
        data: { status: "CANCELLED" },
      });
      return;
    }
    if (entry.type === "VACCINATION") {
      const p = (entry.payload ?? {}) as { vaccine?: string };
      if (!p.vaccine) return;
      // CatVaccination has no back-reference, so match on what we wrote.
      await tx.catVaccination.deleteMany({
        where: { catId: entry.catId, name: p.vaccine, administeredAt: entry.occurredAt },
      });
    }
  }

  // ── helpers ─────────────────────────────────────────────────────────────

  private parsePayload(type: ClinicalEntryTypeName, raw: unknown) {
    const parsed = validateEntryPayload(type, raw);
    if (!parsed.ok) {
      throw vetBadRequest("VET_PAYLOAD_INVALID", `Invalid payload for a ${type} entry`, {
        type,
        errors: parsed.errors,
        hint: {
          ar: "بعض حقول هذا السجل غير صحيحة. راجعوا الحقول المذكورة — لن يُفقد ما كتبتم.",
          en: "Some fields on this record aren't valid. Check the listed fields — nothing you typed is lost.",
        },
      });
    }
    return parsed.value;
  }

  private parseOccurredAt(raw?: string) {
    if (!raw) return new Date();
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw vetBadRequest("VET_FUTURE_DATE", "occurredAt is not a valid date");
    }
    // A minute of clock skew is forgiven; care that "happened" tomorrow is not.
    if (d.getTime() > Date.now() + 60_000) {
      throw vetBadRequest("VET_FUTURE_DATE", "occurredAt cannot be in the future", {
        hint: {
          ar: "لا يمكن تسجيل رعاية بتاريخ مستقبلي. استخدموا تاريخ اليوم أو تاريخًا سابقًا.",
          en: "Care can't be recorded with a future date. Use today's date, or an earlier one.",
        },
      });
    }
    return d;
  }

  /** Entries are authored by an org and only that org may revise/retract them. */
  private async requireOwnEntry(actor: VetActor, entryId: string) {
    const entry = await this.prisma.clinicalEntry.findUnique({
      where: { id: entryId },
      select: ENTRY_SELECT,
    });
    if (!entry) throw this.entryNotFound();
    if (entry.orgId !== actor.orgId) {
      throw vetForbidden("VET_ENTRY_FOREIGN", "This record belongs to another clinic", {
        hint: {
          ar: "هذا السجل من تأليف عيادة أخرى — لا يمكن تعديله من هنا.",
          en: "Another clinic authored this record — it can't be changed from here.",
        },
      });
    }
    return entry;
  }

  private entryNotFound() {
    return vetNotFound("VET_ENTRY_NOT_FOUND", "No clinical entry with that id", {
      hint: { ar: "لا يوجد سجل بهذا المعرّف.", en: "No clinical entry with that id." },
    });
  }

  private immutable(entryId: string, why: string) {
    return vetConflict("VET_ENTRY_IMMUTABLE", `Entry is ${why} and cannot be changed`, {
      entryId,
      hint: {
        ar: "لا يمكن تعديل هذا السجل. السجلات الطبية تُصحَّح بإصدار نسخة جديدة، ولا تُعدَّل مكانها.",
        en: "This entry can't be changed. Medical records are corrected by issuing a new version, never edited in place.",
      },
    });
  }
}
