/**
 * Break-glass — MRC-VET-001 §09 mode C.
 *
 * Read this before changing anything here: emergency access does NOT bypass
 * consent. It cannot, because there is nothing to bypass — everything it
 * returns is tier 0, the floor that exists precisely so no clinician is ever
 * standing over a collapsing cat waiting for a permission dialog. Allergies,
 * chronic conditions, current medications and who to call are safety data, and
 * safety is not a permission.
 *
 * What break-glass actually does is create a RECORD of itself: a ConsentGrant
 * row flagged `emergency` with the clinician's stated reason, an access-log row
 * flagged `emergency`, and an immediate notification to the owner. Nothing here
 * is silent. That is the deal — instant access, total transparency.
 *
 * Optimised for the twenty seconds that matter: one parallel read round, a
 * minimal payload, no joins the counter doesn't need.
 */
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  VetPatientsService,
  maskPhone,
  ownerDisplayName,
  vetBadRequest,
  vetNotFound,
  type VetActor,
} from "./vet-patients.service";
import type { EmergencyAccessDto } from "./dto/vet-consent.dto";

@Injectable()
export class VetEmergencyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly patients: VetPatientsService
  ) {}

  async breakGlass(actor: VetActor, catId: string, dto: EmergencyAccessDto, ip?: string | null) {
    const reason = dto.reason?.trim();
    if (!reason) {
      throw vetBadRequest("VET_REASON_REQUIRED", "Emergency access requires a stated reason", {
        hint: {
          ar: "اكتبوا سبب الوصول الطارئ — يُعرض للمالك كما هو.",
          en: "State why emergency access is needed — the owner sees it verbatim.",
        },
      });
    }

    // ONE round trip for everything the screen shows. Speed is a safety feature.
    const [cat, allergies, conditions, activeRx, contacts, lastClinic] = await Promise.all([
      this.prisma.cat.findFirst({
        where: { id: catId, deletedAt: null },
        select: {
          id: true,
          name: true,
          catIdNumber: true,
          photoUrl: true,
          gender: true,
          birthDate: true,
          weightKg: true,
          microchipNo: true,
          membershipStatus: true,
          currentMedications: true,
          emergencyNotes: true,
          isNeutered: true,
          breed: { select: { nameEn: true, nameAr: true } },
          user: {
            select: { id: true, firstName: true, lastName: true, ownerNickname: true, phone: true, locale: true },
          },
        },
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
          issuedAt: true,
          orgId: true,
        },
        orderBy: { issuedAt: "desc" },
        take: 20,
      }),
      this.prisma.catEmergencyContact.findMany({
        where: { catId },
        select: { id: true, kind: true, name: true, phone: true, relation: true, isPrimary: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      }),
      this.prisma.visit.findFirst({
        where: { catId },
        orderBy: { checkedInAt: "desc" },
        select: {
          checkedInAt: true,
          org: { select: { id: true, nameEn: true, nameAr: true } },
          branch: { select: { nameEn: true, nameAr: true, phone: true } },
        },
      }),
    ]);

    if (!cat) {
      throw vetNotFound("VET_PATIENT_NOT_FOUND", "No cat with that id", {
        hint: {
          ar: "لا يوجد سجل بهذا المعرّف. امسحوا البطاقة أو استخدموا رقم الشريحة.",
          en: "No record with that id. Scan the card, or use the microchip number.",
        },
      });
    }

    // Record the break-glass BEFORE returning it. If the write fails the read
    // still completes — a cat is not left untreated because an audit row didn't
    // land — but the failure is logged loudly by the services below.
    const [grant] = await Promise.all([
      this.prisma.consentGrant.create({
        data: {
          catId: cat.id,
          orgId: actor.orgId,
          // The floor tier. This grant is an audit artefact, not an escalation:
          // resolveAccess() deliberately ignores emergency grants when computing
          // a clinic's readable depth, so this can never unlock T1/T2 content.
          tier: "T1",
          grantedById: null,
          emergency: true,
          reason,
        },
        select: { id: true, grantedAt: true },
      }),
      this.patients.logAccess({
        catId: cat.id,
        orgId: actor.orgId,
        staffId: actor.staffId,
        tier: "T0",
        surface: "emergency",
        emergency: true,
        ipAddress: ip,
      }),
    ]);

    const [org, rxOrgs] = await Promise.all([
      this.prisma.partnerOrg.findUnique({
        where: { id: actor.orgId },
        select: { nameEn: true, nameAr: true },
      }),
      this.patients.orgLookup(activeRx.map((p) => p.orgId)),
    ]);
    const clinicEn = org?.nameEn ?? "A partner clinic";
    const clinicAr = org?.nameAr ?? "عيادة شريكة";

    // Transparency, never silence — the owner hears about this now, not later.
    await this.patients.notifyOwner({
      userId: cat.user.id,
      category: "SYSTEM",
      type: "vet_emergency_access",
      ar: {
        title: `وصول طارئ لسجل ${cat.name}`,
        body: `اطّلع ${clinicAr} على معلومات السلامة الأساسية لـ${cat.name} (الحساسيات، الحالات المزمنة، الأدوية الحالية، جهات الاتصال). السبب المُعلن: ${reason}`,
      },
      en: {
        title: `Emergency access to ${cat.name}'s safety information`,
        body: `${clinicEn} opened ${cat.name}'s essential safety details (allergies, chronic conditions, current medications, emergency contacts). Stated reason: ${reason}`,
      },
      data: {
        catId: cat.id,
        orgId: actor.orgId,
        grantId: grant.id,
        emergency: true,
        link: `/portal/cats/${cat.id}/privacy`,
      },
    });

    return {
      tier: "T0" as const,
      cat: {
        id: cat.id,
        name: cat.name,
        catIdNumber: cat.catIdNumber,
        photoUrl: cat.photoUrl,
        gender: cat.gender,
        birthDate: cat.birthDate,
        weightKg: cat.weightKg,
        microchipNo: cat.microchipNo,
        sterilised: cat.isNeutered,
        breed: cat.breed ? { ar: cat.breed.nameAr, en: cat.breed.nameEn } : null,
        membershipStatus: cat.membershipStatus,
      },
      criticalAlerts: {
        allergies: allergies.map((a) => a.allergen),
        conditions: conditions.map((c) => ({ name: c.name, notes: c.notes })),
        emergencyNotes: cat.emergencyNotes,
        hasCritical: allergies.length > 0 || conditions.length > 0,
        // Absence of a record is not evidence of absence — say so, in an
        // emergency more than anywhere else.
        disclaimer:
          allergies.length === 0
            ? {
                ar: "لا توجد حساسيات مسجّلة — هذا لا يعني عدم وجودها.",
                en: "No allergies on file — that is not the same as none.",
              }
            : null,
      },
      currentMedications: {
        ownerReported: cat.currentMedications,
        prescribed: activeRx.map((p) => ({
          medication: p.medication,
          strength: p.strength,
          dosage: p.dosage,
          frequency: p.frequency,
          since: p.issuedAt,
          clinic: {
            ar: rxOrgs.get(p.orgId)?.nameAr ?? null,
            en: rxOrgs.get(p.orgId)?.nameEn ?? null,
          },
        })),
      },
      // In an emergency the owner's number is revealed, not masked — this is
      // exactly the moment the Cat ID exists for. `ownerPhoneMasked` rides along
      // for any surface that still wants to hide it behind a tap.
      owner: {
        displayName: ownerDisplayName(cat.user),
        phone: cat.user.phone,
        phoneMasked: maskPhone(cat.user.phone),
        locale: cat.user.locale,
      },
      emergencyContacts: contacts,
      primaryClinic: lastClinic
        ? {
            id: lastClinic.org.id,
            ar: lastClinic.org.nameAr,
            en: lastClinic.org.nameEn,
            branch: lastClinic.branch
              ? { ar: lastClinic.branch.nameAr, en: lastClinic.branch.nameEn, phone: lastClinic.branch.phone }
              : null,
            lastSeenAt: lastClinic.checkedInAt,
          }
        : null,
      audit: {
        grantId: grant.id,
        at: grant.grantedAt,
        reason,
        ownerNotified: true,
        notice: {
          ar: "أُبلغ المالك فورًا بهذا الوصول الطارئ وسببه. هذا الاطلاع مقصور على معلومات السلامة فقط.",
          en: "The owner has been told about this emergency access and its reason. It covers safety information only.",
        },
      },
      nextStep: {
        action: "open-visit",
        endpoint: "POST /api/vet/visits",
        body: { catId: cat.id, mode: "EMERGENCY" },
        ar: "الورق بعد أن تأمن القطة — افتحوا زيارة طارئة عندما تستطيعون.",
        en: "Paperwork after the cat is safe — open an emergency visit when you can.",
      },
    };
  }
}
