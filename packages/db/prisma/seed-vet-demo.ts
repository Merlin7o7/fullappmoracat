/**
 * Vet portal DEMO clinic — a realistic clinic you can actually show a vet.
 *
 * WHY THIS EXISTS
 * The vet portal cannot be demonstrated without a clinic, and nothing in the
 * normal seed creates one: no PartnerOrg, no staff, no consent grants, no
 * clinical history. A fresh portal login therefore lands on empty screens,
 * which demos as "there's nothing here" rather than as a product. It was also
 * the reason 72 vet API routes had no end-to-end test coverage.
 *
 * So this doubles as the missing test fixture and the sales demo.
 *
 * WHAT IT CREATES
 *   • One LIVE, verified clinic with two branches
 *   • Five staff covering every role a clinic actually has, each with a PIN
 *   • Three demo owners with four cats, at DIFFERENT consent tiers — so you can
 *     show what a clinic sees at T0 vs T1 vs T2, which is the hardest idea to
 *     explain in words
 *   • A cat with real longitudinal history: exams, vaccinations with lot
 *     numbers and due dates, a weight series that trends, a chronic diagnosis,
 *     an active prescription, and a closed visit with an owner summary
 *   • One OPEN visit, so the day-book has something waiting when you log in
 *
 * SAFETY
 * Every record is obviously fictional and every account is prefixed `demo-`.
 * This must NEVER be pointed at a database holding real members: showing a
 * prospective vet a real customer's cat's medical record would be a privacy
 * breach, not a demo. The guard below refuses to run against a database that
 * already contains non-demo clinical data unless explicitly forced.
 *
 * Run:  pnpm --filter @moraqat/db seed:vet-demo
 */
import { PrismaClient, PartnerStaffRole, ClinicalEntryType } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "DemoVet!2026";
const DEMO_PIN = "2468";
const ORG_SLUG = "demo-alnoor-vet";

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY);
const ahead = (days: number) => new Date(Date.now() + days * DAY);

async function main() {
  console.log("▶ Seeding the vet DEMO clinic…\n");

  // ── Safety gate ─────────────────────────────────────────────────────────
  // Real clinical data means real people. Refuse rather than risk showing a
  // member's cat to a prospective partner.
  const realEntries = await prisma.clinicalEntry.count({
    where: { org: { slug: { not: ORG_SLUG } } },
  });
  if (realEntries > 0 && process.env.ALLOW_DEMO_ON_REAL_DATA !== "1") {
    throw new Error(
      `Refusing to seed: this database already holds ${realEntries} clinical entries from other clinics.\n` +
        `  A demo must never sit beside real patient records — a vet you are pitching\n` +
        `  could search and open a real member's cat.\n` +
        `  Use a local or staging database. Set ALLOW_DEMO_ON_REAL_DATA=1 only if you\n` +
        `  are certain this database is disposable.`
    );
  }

  const passwordHash = await hash(DEMO_PASSWORD, 12);
  const pinHash = await hash(DEMO_PIN, 12);

  // ── The clinic ──────────────────────────────────────────────────────────
  const org = await prisma.partnerOrg.upsert({
    where: { slug: ORG_SLUG },
    update: { status: "LIVE", verifiedAt: new Date(), isDemo: true },
    create: {
      slug: ORG_SLUG,
      isDemo: true,
      nameEn: "Al-Noor Veterinary Clinic (DEMO)",
      nameAr: "عيادة النور البيطرية (تجريبية)",
      status: "LIVE",
      verifiedAt: new Date(),
      tier: "founding",
      crNumber: "1010999001",
    },
  });

  const city = await prisma.city.findFirst({ select: { id: true } });

  const branchMain = await prisma.branch.upsert({
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
  });

  await prisma.branch.upsert({
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

  // ── Staff: every role a real clinic has ─────────────────────────────────
  const STAFF: Array<{
    email: string;
    first: string;
    last: string;
    role: PartnerStaffRole;
    title?: string;
    licence?: string;
  }> = [
    { email: "demo.owner@moracat.co", first: "Layla", last: "Al-Harbi", role: "OWNER", title: "Clinic Owner" },
    { email: "demo.vet@moracat.co", first: "Faisal", last: "Al-Qahtani", role: "VET_SENIOR", title: "Dr.", licence: "SVC-11482" },
    { email: "demo.vet2@moracat.co", first: "Noura", last: "Al-Dossari", role: "VET", title: "Dr.", licence: "SVC-20913" },
    { email: "demo.tech@moracat.co", first: "Omar", last: "Al-Shehri", role: "VET_TECH", title: "Vet Technician" },
    { email: "demo.reception@moracat.co", first: "Sara", last: "Al-Mutairi", role: "RECEPTION", title: "Front Desk" },
  ];

  const staffByRole: Record<string, string> = {};
  for (const s of STAFF) {
    const user = await prisma.user.upsert({
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
    });
    const staff = await prisma.partnerStaff.upsert({
      where: { orgId_userId: { orgId: org.id, userId: user.id } },
      update: { role: s.role, status: "ACTIVE", pinHash },
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
    });
    staffByRole[s.role] = staff.id;
  }

  const drSenior = staffByRole.VET_SENIOR!;
  const drVet = staffByRole.VET!;
  const tech = staffByRole.VET_TECH!;

  // ── Demo members + their cats, at different consent tiers ───────────────
  const breed = await prisma.breed.findFirst({ select: { id: true } });

  const OWNERS = [
    {
      email: "demo.member1@moracat.co", first: "Hessa", last: "Al-Otaibi", phone: "+966551110001",
      cats: [
        { name: "مشمش", nameEn: "Mishmish", sex: "MALE" as const, tier: "T2" as const, chip: "968000011122233", flagship: true },
        { name: "لوزة", nameEn: "Loza", sex: "FEMALE" as const, tier: "T1" as const, chip: "968000011122234", flagship: false },
      ],
    },
    {
      email: "demo.member2@moracat.co", first: "Abdulaziz", last: "Al-Ghamdi", phone: "+966551110002",
      cats: [{ name: "سمسم", nameEn: "Simsim", sex: "MALE" as const, tier: "T1" as const, chip: "968000011122235", flagship: false }],
    },
    {
      // Deliberately T0 — so you can DEMONSTRATE the consent boundary rather
      // than describe it. This cat shows allergies and current meds only.
      email: "demo.member3@moracat.co", first: "Reem", last: "Al-Zahrani", phone: "+966551110003",
      cats: [{ name: "بسبس", nameEn: "Basbas", sex: "UNKNOWN" as const, tier: null, chip: "968000011122236", flagship: false }],
    },
  ];

  let flagshipCatId = "";
  const catIds: string[] = [];

  for (const o of OWNERS) {
    const user = await prisma.user.upsert({
      where: { email: o.email },
      update: {},
      create: {
        email: o.email,
        passwordHash,
        firstName: o.first,
        lastName: o.last,
        phone: o.phone,
        phoneVerified: new Date(),
        emailVerified: new Date(),
        locale: "ar",
        status: "ACTIVE",
      },
    });

    for (const c of o.cats) {
      const existing = await prisma.cat.findFirst({
        where: { userId: user.id, name: c.name },
        select: { id: true },
      });
      const cat = existing
        ? await prisma.cat.update({
            where: { id: existing.id },
            data: { microchipNo: c.chip, membershipStatus: "ACTIVE", isDemo: true },
          })
        : await prisma.cat.create({
            data: {
              userId: user.id,
              isDemo: true,
              name: c.name,
              nameNormalized: c.nameEn.toLowerCase(),
              gender: c.sex,
              breedId: breed?.id ?? null,
              birthDate: ago(c.flagship ? 1400 : 900),
              weightKg: c.flagship ? 5.1 : 4.2,
              microchipNo: c.chip,
              isNeutered: true,
              status: "ACTIVE",
              membershipStatus: "ACTIVE",
              catIdNumber: null,
            },
          });
      catIds.push(cat.id);
      if (c.flagship) flagshipCatId = cat.id;

      // Allergies are TIER 0 — always visible to any clinic, by design. This is
      // the single most important thing to show a vet: a hidden allergy can kill,
      // so consent never hides it.
      const allergen = c.flagship ? "Chicken protein" : "None recorded";
      if (c.flagship) {
        const has = await prisma.catAllergy.findFirst({ where: { catId: cat.id, allergen } });
        if (!has) await prisma.catAllergy.create({ data: { catId: cat.id, allergen } });
      }

      if (c.tier) {
        const live = await prisma.consentGrant.findFirst({
          where: { catId: cat.id, orgId: org.id, revokedAt: null, emergency: false },
        });
        if (!live) {
          await prisma.consentGrant.create({
            data: { catId: cat.id, orgId: org.id, tier: c.tier, grantedById: user.id, grantedAt: ago(60) },
          });
        }
      }
    }
  }

  // ── The flagship patient's real clinical history ────────────────────────
  // A vet judges this product on ONE screen: a patient with actual history.
  // An empty timeline demos as an empty product.
  const already = await prisma.clinicalEntry.count({ where: { catId: flagshipCatId } });
  if (already === 0) {
    const pastVisit = await prisma.visit.create({
      data: {
        catId: flagshipCatId,
        orgId: org.id,
        branchId: branchMain.id,
        state: "CLOSED",
        reason: "Annual check-up + booster",
        presentingComplaint: "Routine; owner reports mild scratching",
        openedById: drSenior,
        closedById: drSenior,
        checkedInAt: ago(210),
        closedAt: ago(210),
        ownerSummary:
          "مشمش بصحة جيدة. أعطيناه جرعة التطعيم السنوية، ولاحظنا حكة خفيفة — راقبي الجلد وراجعينا لو زادت.",
        summarySentAt: ago(210),
      },
    });

    const entry = (
      type: ClinicalEntryType,
      payload: object,
      daysAgo: number,
      authorId: string,
      visitId?: string,
      note?: string
    ) =>
      prisma.clinicalEntry.create({
        data: {
          catId: flagshipCatId,
          orgId: org.id,
          visitId: visitId ?? null,
          type,
          status: "FINAL",
          payload: payload as never,
          note: note ?? null,
          occurredAt: ago(daysAgo),
          authorId,
        },
      });

    await entry("EXAM", {
      temperatureC: 38.6, heartRate: 180, respRate: 28,
      subjective: "Bright, alert, eating normally. Mild pruritus reported.",
      objective: "BCS 5/9. Coat good. Mild erythema ventral abdomen. Teeth grade 1 tartar.",
      assessment: "Healthy adult. Suspect mild food-responsive dermatitis.",
      plan: "Booster today. Trial hypoallergenic diet 8 weeks. Recheck if worsening.",
    }, 210, drSenior, pastVisit.id);

    await entry("VACCINATION", {
      vaccine: "Feline Tricat (FVRCP)", batchNo: "TRC-2451-B", manufacturer: "MSD",
      site: "Left shoulder", route: "Subcutaneous", dueAt: ahead(155).toISOString(),
    }, 210, drSenior, pastVisit.id, "Annual booster. No immediate reaction observed over 15 min.");

    await entry("VACCINATION", {
      vaccine: "Rabies", batchNo: "RAB-8890-C", manufacturer: "Boehringer",
      site: "Right hind limb", route: "Subcutaneous", dueAt: ahead(155).toISOString(),
    }, 210, drSenior, pastVisit.id);

    // A weight series that actually trends — the chart is meaningless with one point.
    const weights: Array<[number, number]> = [[210, 4.6], [150, 4.8], [90, 5.0], [30, 5.1]];
    for (const [d, kg] of weights) {
      await entry("WEIGHT", { weightKg: kg, bcs: 5 }, d, tech);
      await prisma.catWeightRecord.create({
        data: { catId: flagshipCatId, weightKg: kg, bcs: 5, measuredAt: ago(d), source: "clinic" },
      });
    }

    await entry("DIAGNOSIS", {
      condition: "Food-responsive dermatitis", status: "chronic",
      onsetAt: ago(210).toISOString(),
      notes: "Responded well to hypoallergenic diet; flares when owner reintroduces chicken.",
    }, 150, drVet, undefined, "Confirmed by dietary elimination and rechallenge.");

    await entry("LAB", {
      panel: "Biochemistry + CBC", performedAt: ago(150).toISOString(),
      results: [
        { analyte: "Creatinine", value: 1.3, unit: "mg/dL", refLow: 0.8, refHigh: 2.4, flag: "normal" },
        { analyte: "ALT", value: 61, unit: "U/L", refLow: 12, refHigh: 130, flag: "normal" },
        { analyte: "Eosinophils", value: 1.4, unit: "10^3/uL", refLow: 0.1, refHigh: 0.79, flag: "high" },
      ],
    }, 150, drVet, undefined, "Eosinophilia consistent with the dermatitis picture.");

    // An ACTIVE prescription — visible to ANY clinic regardless of tier,
    // because a drug interaction is a safety matter, not a privacy one.
    await prisma.prescription.create({
      data: {
        catId: flagshipCatId,
        orgId: org.id,
        medication: "Hypoallergenic diet (hydrolysed)",
        form: "diet",
        dosage: "60 g",
        frequency: "twice daily",
        durationDays: 56,
        status: "ISSUED",
        prescriberId: drVet,
        issuedAt: ago(30),
        instructions: "Strict — no treats containing poultry.",
      },
    });

    // Somebody is waiting RIGHT NOW, so the day-book isn't empty on login.
    await prisma.visit.create({
      data: {
        catId: flagshipCatId,
        orgId: org.id,
        branchId: branchMain.id,
        state: "OPEN",
        reason: "Recheck — scratching returned",
        presentingComplaint: "Owner reports scratching resumed after a chicken treat",
        openedById: staffByRole.RECEPTION!,
        checkedInAt: new Date(Date.now() - 8 * 60_000),
      },
    });
  }

  // ── Access ledger: prove the owner can see who looked ───────────────────
  const ledger = await prisma.recordAccessLog.count({ where: { orgId: org.id } });
  if (ledger === 0) {
    for (const [i, surface] of ["profile", "timeline", "entry"].entries()) {
      await prisma.recordAccessLog.create({
        data: {
          catId: flagshipCatId, orgId: org.id, staffId: drSenior,
          tier: "T2", surface, emergency: false, at: ago(210 - i),
        },
      });
    }
  }

  console.log("✅ Demo clinic ready.\n");
  console.log("   Clinic : Al-Noor Veterinary Clinic (DEMO) — LIVE, verified, 2 branches");
  console.log("   Sign in at /vet/login with any of these (password + PIN identical):\n");
  console.log("     Role         Email                        Password        PIN");
  console.log("     ─────────────────────────────────────────────────────────────");
  for (const s of STAFF) {
    console.log(
      `     ${s.role.padEnd(12)} ${s.email.padEnd(28)} ${DEMO_PASSWORD}   ${DEMO_PIN}`
    );
  }
  console.log("\n   Patients (search by name, Cat ID, or microchip):");
  console.log("     مشمش / Mishmish  chip 968000011122233  — T2 FULL history (the one to demo)");
  console.log("     لوزة  / Loza      chip 968000011122234  — T1 this clinic's records only");
  console.log("     سمسم  / Simsim    chip 968000011122235  — T1");
  console.log("     بسبس  / Basbas    chip 968000011122236  — T0 NO consent (shows the boundary)");
  console.log("\n   One visit is already OPEN for Mishmish, so Today has something waiting.\n");
}

main()
  .catch((e) => {
    console.error("❌ vet demo seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
