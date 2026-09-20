/**
 * The Vet Demo — a real, working clinic an admin can walk into from the admin
 * dashboard, with a realistic patient on the books and nothing whatsoever to do
 * with a real member's cat.
 *
 * WHY THIS LIVES IN THE API AND NOT ONLY IN A SEED SCRIPT
 * `pnpm db:seed:vet-demo` builds this clinic beautifully — on a machine with a
 * shell and a database URL. An admin showing the portal to a prospective
 * partner has neither. A demo you have to deploy is a demo that is never shown,
 * so the provisioning runs here, idempotently, behind one button.
 *
 * WHY IT IS SAFE
 * Three independent guards, and they are the whole point of the feature:
 *
 *   1. **The clinic is flagged `isDemo`.** VetStaffGuard resolves every clinic
 *      request through that flag and quarantines a demo org so it can only ever
 *      see demo cats — patient search, scan, emergency, all of it. A demo
 *      account is therefore not a lookup tool over real members, which is
 *      exactly what it would otherwise be.
 *   2. **Every record it creates is fictional and flagged.** Demo cats carry
 *      `isDemo`, which keeps them out of the census count, the community feed
 *      and every real clinic's search.
 *   3. **It only ever writes rows it owns.** The rebuild deletes by org id and
 *      by a verified list of demo cat ids, and refuses outright if either
 *      assertion fails. It cannot reach a real clinical entry.
 *
 * Entering grants the admin a genuine PartnerStaff membership at the demo org —
 * not a bypass, not an impersonation token. The vet portal's authorisation is
 * untouched: the admin is simply, actually, staff at a fictional clinic, and
 * leaving offboards them the same way any clinic offboards anyone.
 */
import { Injectable, Logger } from "@nestjs/common";
import { hash } from "bcryptjs";
import type { Prisma } from "@moraqat/db";
import { deriveVaccinationStatus } from "@moraqat/core";
import { PrismaService } from "../prisma/prisma.service";

/** The demo clinic's stable identity. Every lookup here keys off this. */
export const DEMO_ORG_SLUG = "demo-alnoor-vet";
/** Shared by the seeded demo staff accounts (not the admin's own login). */
const DEMO_PASSWORD = "DemoVet!2026";
const DEMO_PIN = "2468";
/**
 * The clinical history is dated relative to when it was built, so an old demo
 * shows an "open visit" that has been waiting three weeks and a day-book that
 * looks abandoned. Rebuild anything older than this.
 */
const FRESHNESS_DAYS = 3;

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

type StaffSeed = {
  email: string;
  first: string;
  last: string;
  role: Prisma.PartnerStaffCreateInput["role"];
  title?: string;
  licence?: string;
};

const STAFF: StaffSeed[] = [
  { email: "demo.owner@moracat.co", first: "Layla", last: "Al-Harbi", role: "OWNER", title: "Clinic Owner" },
  { email: "demo.vet@moracat.co", first: "Faisal", last: "Al-Qahtani", role: "VET_SENIOR", title: "Dr.", licence: "SVC-11482" },
  { email: "demo.vet2@moracat.co", first: "Noura", last: "Al-Dossari", role: "VET", title: "Dr.", licence: "SVC-20913" },
  { email: "demo.tech@moracat.co", first: "Omar", last: "Al-Shehri", role: "VET_TECH", title: "Vet Technician" },
  { email: "demo.reception@moracat.co", first: "Sara", last: "Al-Mutairi", role: "RECEPTION", title: "Front Desk" },
];

/**
 * Three households at three different consent tiers — because the hardest idea
 * in the whole partnership ("what a clinic may see depends on what the owner
 * granted") is impossible to explain in words and obvious in thirty seconds
 * once you can click between three patients.
 */
const OWNERS = [
  {
    email: "demo.member1@moracat.co",
    first: "Hessa",
    last: "Al-Otaibi",
    phone: "+966551110001",
    cats: [
      { name: "مشمش", latin: "Mishmish", gender: "MALE" as const, tier: "T2" as const, chip: "968000011122233", flagship: true },
      { name: "لوزة", latin: "Loza", gender: "FEMALE" as const, tier: "T1" as const, chip: "968000011122234", flagship: false },
    ],
  },
  {
    email: "demo.member2@moracat.co",
    first: "Abdulaziz",
    last: "Al-Ghamdi",
    phone: "+966551110002",
    cats: [{ name: "سمسم", latin: "Simsim", gender: "MALE" as const, tier: "T1" as const, chip: "968000011122235", flagship: false }],
  },
  {
    // Deliberately T0: this cat demonstrates the consent boundary rather than
    // describing it — allergies and active medication only, nothing else.
    email: "demo.member3@moracat.co",
    first: "Reem",
    last: "Al-Zahrani",
    phone: "+966551110003",
    cats: [{ name: "بسبس", latin: "Basbas", gender: "UNKNOWN" as const, tier: null, chip: "968000011122236", flagship: false }],
  },
];

@Injectable()
export class VetDemoService {
  private readonly logger = new Logger("VetDemo");

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The button. Provision (or refresh) the demo clinic, then put this admin on
   * its team so the vet portal recognises them the ordinary way.
   */
  async enter(adminUserId: string) {
    const org = await this.ensure();

    const staff = await this.prisma.partnerStaff.upsert({
      where: { orgId_userId: { orgId: org.id, userId: adminUserId } },
      update: { status: "ACTIVE", role: "OWNER", offboardedAt: null },
      create: {
        orgId: org.id,
        userId: adminUserId,
        role: "OWNER",
        status: "ACTIVE",
        title: "Moracat (demo access)",
        joinedAt: new Date(),
      },
      select: { id: true, role: true },
    });

    // Demo access is still access: it is logged like every other grant.
    await this.prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: "vet.demo.enter",
        entityType: "PartnerOrg",
        entityId: org.id,
        metadata: { slug: DEMO_ORG_SLUG, staffId: staff.id },
      },
    });

    return {
      orgId: org.id,
      slug: DEMO_ORG_SLUG,
      nameAr: org.nameAr,
      nameEn: org.nameEn,
      role: staff.role,
      isDemo: true,
      /** Surfaced in the admin UI so a demo can be handed to a colleague. */
      credentials: { password: DEMO_PASSWORD, pin: DEMO_PIN, accounts: STAFF.map((s) => ({ email: s.email, role: s.role })) },
    };
  }

  /** Leave the demo — the admin is offboarded exactly as any clinic offboards. */
  async leave(adminUserId: string) {
    const org = await this.prisma.partnerOrg.findUnique({
      where: { slug: DEMO_ORG_SLUG },
      select: { id: true },
    });
    if (!org) return { left: true };
    await this.prisma.partnerStaff.updateMany({
      where: { orgId: org.id, userId: adminUserId },
      data: { status: "OFFBOARDED", offboardedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { userId: adminUserId, action: "vet.demo.leave", entityType: "PartnerOrg", entityId: org.id },
    });
    return { left: true };
  }

  /** Whether the demo exists and whether this admin is currently inside it. */
  async status(adminUserId: string) {
    const org = await this.prisma.partnerOrg.findUnique({
      where: { slug: DEMO_ORG_SLUG },
      select: {
        id: true,
        nameAr: true,
        nameEn: true,
        isDemo: true,
        staff: { where: { userId: adminUserId }, select: { status: true, role: true } },
        _count: { select: { branches: true, staff: true } },
      },
    });
    if (!org) return { provisioned: false, inside: false };
    const patients = await this.prisma.cat.count({ where: { isDemo: true, deletedAt: null } });
    return {
      provisioned: true,
      orgId: org.id,
      nameAr: org.nameAr,
      nameEn: org.nameEn,
      inside: org.staff[0]?.status === "ACTIVE",
      branches: org._count.branches,
      staff: org._count.staff,
      patients,
    };
  }

  /* ──────────────────────────────────────────────────────────────────────
   * Provisioning
   * ────────────────────────────────────────────────────────────────────*/

  /**
   * Idempotent. Creates what is missing, refreshes the clinical history when it
   * has gone stale, and never touches anything it did not create.
   */
  async ensure() {
    const org = await this.prisma.partnerOrg.upsert({
      where: { slug: DEMO_ORG_SLUG },
      update: { status: "LIVE", verifiedAt: new Date(), isDemo: true, suspendedAt: null },
      create: {
        slug: DEMO_ORG_SLUG,
        isDemo: true,
        nameEn: "Al-Noor Veterinary Clinic (DEMO)",
        nameAr: "عيادة النور البيطرية (تجريبية)",
        status: "LIVE",
        verifiedAt: new Date(),
        tier: "founding",
        crNumber: "1010999001",
      },
      select: { id: true, nameAr: true, nameEn: true, isDemo: true },
    });

    // A demo org that somehow lost its flag would be quarantine-free — a real
    // member's cat one search away. Refuse rather than proceed.
    if (!org.isDemo) {
      throw new Error(`Refusing to provision: PartnerOrg ${DEMO_ORG_SLUG} is not flagged isDemo.`);
    }

    const city = await this.prisma.city.findFirst({ select: { id: true } });
    const branchMain = await this.prisma.branch.upsert({
      where: { id: `${org.id}-main` },
      update: {},
      create: {
        id: `${org.id}-main`,
        orgId: org.id,
        nameEn: "Al-Noor — Al Olaya",
        nameAr: "النور — العليا",
        cityId: city?.id ?? null,
        addressLine: "Prince Mohammed Bin Abdulaziz Rd, Al Olaya, Riyadh",
        phone: "+966112345678",
        specialties: ["Internal medicine", "Dentistry"],
        services: ["Consultation", "Vaccination", "Surgery", "Lab"],
        emergency24h: true,
      },
      select: { id: true },
    });
    await this.prisma.branch.upsert({
      where: { id: `${org.id}-north` },
      update: {},
      create: {
        id: `${org.id}-north`,
        orgId: org.id,
        nameEn: "Al-Noor — Al Nakheel",
        nameAr: "النور — النخيل",
        cityId: city?.id ?? null,
        addressLine: "Al Nakheel District, Riyadh",
        phone: "+966112345679",
        specialties: ["Preventive care"],
        services: ["Consultation", "Vaccination"],
      },
    });

    const passwordHash = await hash(DEMO_PASSWORD, 12);
    const pinHash = await hash(DEMO_PIN, 12);

    const staffByRole: Record<string, string> = {};
    for (const s of STAFF) {
      const user = await this.prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: {
          email: s.email,
          passwordHash,
          firstName: s.first,
          lastName: s.last,
          emailVerified: new Date(),
          locale: "ar",
          status: "ACTIVE",
        },
        select: { id: true },
      });
      const staff = await this.prisma.partnerStaff.upsert({
        where: { orgId_userId: { orgId: org.id, userId: user.id } },
        update: { role: s.role, status: "ACTIVE", pinHash, offboardedAt: null },
        create: {
          orgId: org.id,
          userId: user.id,
          role: s.role,
          status: "ACTIVE",
          title: s.title,
          licenceNo: s.licence,
          pinHash,
          joinedAt: ago(120),
        },
        select: { id: true },
      });
      staffByRole[s.role as string] = staff.id;
    }

    const { catIds, flagshipCatId } = await this.ensurePatients(org.id);

    // Rebuild the clinical history only when it has aged out — so the day-book
    // always has someone waiting and the weight chart always ends "last month".
    //
    // Scoped to the FLAGSHIP CAT's own open visit, not to any open visit in the
    // org. A demo clinic accumulates other visits over time (a colleague
    // clicking around, an e2e run creating walk-ins), and any one of those
    // would make this read "fresh" while the curated history it is actually
    // measuring had gone months stale — the exact decay this check exists to
    // prevent.
    const openVisit = flagshipCatId
      ? await this.prisma.visit.findFirst({
          where: { orgId: org.id, catId: flagshipCatId, state: "OPEN" },
          orderBy: { checkedInAt: "desc" },
          select: { checkedInAt: true },
        })
      : null;
    const stale = !openVisit || Date.now() - openVisit.checkedInAt.getTime() > FRESHNESS_DAYS * DAY;
    if (stale && flagshipCatId) {
      await this.rebuildHistory(org.id, branchMain.id, catIds, flagshipCatId, staffByRole);
    }

    return org;
  }

  /** The demo households and their cats. Every cat flagged `isDemo`. */
  private async ensurePatients(orgId: string) {
    const breed = await this.prisma.breed.findFirst({ select: { id: true } });
    const catIds: string[] = [];
    let flagshipCatId = "";

    for (const owner of OWNERS) {
      const user = await this.prisma.user.upsert({
        where: { email: owner.email },
        update: {},
        create: {
          email: owner.email,
          firstName: owner.first,
          lastName: owner.last,
          phone: owner.phone,
          phoneVerified: new Date(),
          emailVerified: new Date(),
          locale: "ar",
          status: "ACTIVE",
        },
        select: { id: true },
      });

      for (const c of owner.cats) {
        const existing = await this.prisma.cat.findFirst({
          where: { userId: user.id, name: c.name },
          select: { id: true },
        });
        const cat = existing
          ? await this.prisma.cat.update({
              where: { id: existing.id },
              data: { microchipNo: c.chip, membershipStatus: "ACTIVE", isDemo: true },
              select: { id: true },
            })
          : await this.prisma.cat.create({
              data: {
                userId: user.id,
                isDemo: true,
                name: c.name,
                nameNormalized: c.latin.toLowerCase(),
                gender: c.gender,
                breedId: breed?.id ?? null,
                birthDate: ago(c.flagship ? 1400 : 900),
                weightKg: c.flagship ? 5.1 : 4.2,
                microchipNo: c.chip,
                isNeutered: true,
                status: "ACTIVE",
                membershipStatus: "ACTIVE",
                // No Cat ID number: the demo cats are deliberately outside the
                // census, and a number would imply a place in it.
                catIdNumber: null,
              },
              select: { id: true },
            });
        catIds.push(cat.id);
        if (c.flagship) flagshipCatId = cat.id;

        // Allergies are TIER 0 — visible to any clinic whatever the consent,
        // because a hidden allergy can kill. This is the single most important
        // thing to show a vet.
        if (c.flagship) {
          const allergen = "Chicken protein";
          const has = await this.prisma.catAllergy.findFirst({ where: { catId: cat.id, allergen } });
          if (!has) await this.prisma.catAllergy.create({ data: { catId: cat.id, allergen } });
        }

        if (c.tier) {
          const live = await this.prisma.consentGrant.findFirst({
            where: { catId: cat.id, orgId, revokedAt: null, emergency: false },
            select: { id: true },
          });
          if (!live) {
            await this.prisma.consentGrant.create({
              data: { catId: cat.id, orgId, tier: c.tier, grantedById: user.id, grantedAt: ago(60) },
            });
          }
        }
      }
    }

    return { catIds, flagshipCatId };
  }

  /**
   * Wipe and rebuild THIS clinic's history.
   *
   * The deletes are scoped two ways and both are asserted before anything is
   * removed, because a mistake here would delete a real cat's medical record
   * from an append-only store. It deletes only rows it created.
   */
  private async rebuildHistory(
    orgId: string,
    branchId: string,
    catIds: string[],
    flagshipCatId: string,
    staffByRole: Record<string, string>
  ) {
    const demoCats = await this.prisma.cat.findMany({
      where: { id: { in: catIds } },
      select: { id: true, isDemo: true, name: true },
    });
    const notDemo = demoCats.filter((c) => !c.isDemo);
    if (notDemo.length > 0 || demoCats.length !== catIds.length) {
      throw new Error(
        `Refusing to rebuild the demo: expected ${catIds.length} demo cats, resolved ${demoCats.length}` +
          (notDemo.length ? `, and ${notDemo.map((c) => c.name).join(", ")} are NOT flagged isDemo.` : ".")
      );
    }

    const senior = staffByRole.VET_SENIOR;
    const vet = staffByRole.VET;
    const tech = staffByRole.VET_TECH;
    const reception = staffByRole.RECEPTION;
    if (!senior || !vet || !tech || !reception) {
      this.logger.warn("Demo staff incomplete — skipping the history rebuild.");
      return;
    }

    // Order matters: weights and vaccinations reference entries, entries
    // reference visits.
    await this.prisma.recordAccessLog.deleteMany({ where: { orgId } });
    await this.prisma.catWeightRecord.deleteMany({ where: { catId: { in: catIds } } });
    await this.prisma.catVaccination.deleteMany({ where: { catId: { in: catIds } } });
    await this.prisma.prescription.deleteMany({ where: { orgId } });
    await this.prisma.clinicalEntry.deleteMany({ where: { orgId } });
    await this.prisma.visit.deleteMany({ where: { orgId } });

    const pastVisit = await this.prisma.visit.create({
      data: {
        catId: flagshipCatId,
        orgId,
        branchId,
        state: "CLOSED",
        reason: "Annual check-up + booster",
        presentingComplaint: "Routine; owner reports mild scratching",
        openedById: senior,
        closedById: senior,
        checkedInAt: ago(210),
        closedAt: ago(210),
        ownerSummary:
          "مشمش بصحة جيدة. أعطيناه جرعة التطعيم السنوية، ولاحظنا حكة خفيفة — راقبي الجلد وراجعينا لو زادت.",
        summarySentAt: ago(210),
      },
      select: { id: true },
    });

    const entry = (
      type: Prisma.ClinicalEntryCreateInput["type"],
      payload: object,
      daysAgo: number,
      authorId: string,
      visitId?: string,
      note?: string
    ) =>
      this.prisma.clinicalEntry.create({
        data: {
          catId: flagshipCatId,
          orgId,
          visitId: visitId ?? null,
          type,
          status: "FINAL",
          payload: payload as never,
          note: note ?? null,
          occurredAt: ago(daysAgo),
          authorId,
        },
        select: { id: true },
      });

    await entry(
      "EXAM",
      {
        temperatureC: 38.6,
        heartRate: 180,
        respRate: 28,
        subjective: "Bright, alert, eating normally. Mild pruritus reported.",
        objective: "BCS 5/9. Coat good. Mild erythema ventral abdomen. Teeth grade 1 tartar.",
        assessment: "Healthy adult. Suspect mild food-responsive dermatitis.",
        plan: "Booster today. Trial hypoallergenic diet 8 weeks. Recheck if worsening.",
      },
      210,
      senior,
      pastVisit.id
    );

    // A finalised vaccination writes BOTH the clinical entry and the
    // CatVaccination row the lifecycle engine watches — the join that turns one
    // clinical act into care at home. Mirroring it here is what makes the demo
    // able to show the claim the whole partnership rests on.
    const VACCINES = [
      { vaccine: "Feline Tricat (FVRCP)", batchNo: "TRC-2451-B", manufacturer: "MSD", site: "Left shoulder" },
      { vaccine: "Rabies", batchNo: "RAB-8890-C", manufacturer: "Boehringer", site: "Right hind limb" },
    ];
    for (const [i, v] of VACCINES.entries()) {
      const dueAt = ahead(155);
      const created = await entry(
        "VACCINATION",
        { ...v, route: "Subcutaneous", dueAt: dueAt.toISOString() },
        210,
        senior,
        pastVisit.id,
        i === 0 ? "Annual booster. No immediate reaction observed over 15 min." : undefined
      );
      await this.prisma.catVaccination.create({
        data: {
          catId: flagshipCatId,
          name: v.vaccine,
          administeredAt: ago(210),
          dueAt,
          vetName: "Dr. Faisal Al-Qahtani",
          clinic: "Al-Noor Veterinary Clinic (DEMO)",
          batchNo: v.batchNo,
          notes: `Recorded from clinical entry ${created.id}`,
        },
      });
    }

    // The badge is DERIVED from the doses on file, never asserted.
    const doses = await this.prisma.catVaccination.findMany({
      where: { catId: flagshipCatId },
      select: { administeredAt: true, dueAt: true },
    });
    await this.prisma.cat.update({
      where: { id: flagshipCatId },
      data: { vaccinationStatus: deriveVaccinationStatus(doses).standing },
    });

    // A weight series that actually trends — one point is not a chart.
    for (const [d, kg] of [
      [210, 4.6],
      [150, 4.8],
      [90, 5.0],
      [30, 5.1],
    ] as [number, number][]) {
      const weightEntry = await entry("WEIGHT", { weightKg: kg, bcs: 5 }, d, tech);
      await this.prisma.catWeightRecord.create({
        data: {
          catId: flagshipCatId,
          entryId: weightEntry.id,
          weightKg: kg,
          bcs: 5,
          measuredAt: ago(d),
          source: "clinic",
        },
      });
    }

    await entry(
      "DIAGNOSIS",
      {
        condition: "Food-responsive dermatitis",
        status: "chronic",
        onsetAt: ago(210).toISOString(),
        notes: "Responded well to hypoallergenic diet; flares when owner reintroduces chicken.",
      },
      150,
      vet,
      undefined,
      "Confirmed by dietary elimination and rechallenge."
    );

    await entry(
      "LAB",
      {
        panel: "Biochemistry + CBC",
        performedAt: ago(150).toISOString(),
        results: [
          { analyte: "Creatinine", value: 1.3, unit: "mg/dL", refLow: 0.8, refHigh: 2.4, flag: "normal" },
          { analyte: "ALT", value: 61, unit: "U/L", refLow: 12, refHigh: 130, flag: "normal" },
          { analyte: "Eosinophils", value: 1.4, unit: "10^3/uL", refLow: 0.1, refHigh: 0.79, flag: "high" },
        ],
      },
      150,
      vet,
      undefined,
      "Eosinophilia consistent with the dermatitis picture."
    );

    // An ACTIVE prescription — visible to any clinic regardless of tier,
    // because a drug interaction is a safety matter, not a privacy one.
    await this.prisma.prescription.create({
      data: {
        catId: flagshipCatId,
        orgId,
        medication: "Hypoallergenic diet (hydrolysed)",
        form: "diet",
        dosage: "60 g",
        frequency: "twice daily",
        durationDays: 56,
        status: "ISSUED",
        prescriberId: vet,
        issuedAt: ago(30),
        instructions: "Strict — no treats containing poultry.",
      },
    });

    // Somebody is waiting RIGHT NOW, so the day-book is never empty on arrival.
    await this.prisma.visit.create({
      data: {
        catId: flagshipCatId,
        orgId,
        branchId,
        state: "OPEN",
        reason: "Recheck — scratching returned",
        presentingComplaint: "Owner reports scratching resumed after a chicken treat",
        openedById: reception,
        checkedInAt: new Date(Date.now() - 8 * 60_000),
      },
    });

    // The access ledger: proof the owner can see who looked.
    for (const [i, surface] of ["profile", "timeline", "entry"].entries()) {
      await this.prisma.recordAccessLog.create({
        data: {
          catId: flagshipCatId,
          orgId,
          staffId: senior,
          tier: "T2",
          surface,
          emergency: false,
          at: ago(210 - i),
        },
      });
    }
  }
}
