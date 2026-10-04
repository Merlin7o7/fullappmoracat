import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CLINICAL_ENTRY_TYPES,
  VET_ENTRY_FIELDS,
  buildEntryPayload,
  parseClinicalNumber,
  VACCINE_CODES,
  normalizeVaccineCode,
  vaccineKey,
  latestDosePerVaccine,
  annotateDoses,
  overdueVaccines,
  visitReasonLabel,
  emergencyReasonLabel,
  composeReason,
  isStaleOpenVisit,
  licenceStanding,
  ownerDeliveryNotice,
} from "../src/vet-contract";
import { can, capabilitiesFor, requiresCoSign } from "../src/vet-permissions";
import { riyadhDayBounds } from "../src/metrics";
import {
  canonicalTermsText,
  partnerTermsFor,
  VET_PARTNER_AGREEMENT,
  VET_PARTNER_TERMS_VERSION,
  VET_PDPL_ADDENDUM,
} from "../src/vet-registration";

/**
 * The composer and the API used to disagree on 11 of 14 entry types, and every
 * save 400'd. These pin the shared declaration the two now derive from.
 */
describe("VET_ENTRY_FIELDS — the one declaration", () => {
  it("declares every entry type and nothing else", () => {
    expect(Object.keys(VET_ENTRY_FIELDS).sort()).toEqual([...CLINICAL_ENTRY_TYPES].sort());
  });

  it("never declares the keys that broke every save", () => {
    const all = Object.values(VET_ENTRY_FIELDS).flatMap((fs) => fs.map((f) => f.name as string));
    for (const ghost of ["clinicalType", "allergyOverride", "batch", "drug", "respRate", "nextDueAt", "refills", "test"]) {
      expect(all).not.toContain(ghost);
    }
  });

  it("gives every field a bilingual label and every enum its options", () => {
    for (const fields of Object.values(VET_ENTRY_FIELDS)) {
      for (const f of fields) {
        expect(f.label.ar.length).toBeGreaterThan(0);
        expect(f.label.en.length).toBeGreaterThan(0);
        if (f.kind === "enum") expect(f.options?.length).toBeGreaterThan(0);
      }
    }
  });

  it("names BCS correctly — a body condition score is not a BMI", () => {
    const bcs = VET_ENTRY_FIELDS.WEIGHT.find((f) => f.name === "bcs")!;
    expect(bcs.label.ar).toBe("درجة حالة الجسم (BCS)");
  });

  it("offers the coded vaccine picklist", () => {
    const code = VET_ENTRY_FIELDS.VACCINATION.find((f) => f.name === "vaccineCode")!;
    expect(code.options?.map((o) => o.value)).toEqual([...VACCINE_CODES]);
  });
});

describe("buildEntryPayload", () => {
  it("builds exactly the declared keys, typed", () => {
    const r = buildEntryPayload("EXAM", {
      subjective: " eating less ",
      temperatureC: "٣٨٫٦",
      heartRate: "١٨٠",
      respiratoryRate: "28",
      junk: "dropped",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload).toEqual({ subjective: "eating less", temperatureC: 38.6, heartRate: 180, respiratoryRate: 28 });
    }
  });

  it("enforces API-required and composer-required fields, bilingually", () => {
    const r = buildEntryPayload("PRESCRIPTION", { medication: "Amoxicillin" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errors).sort()).toEqual(["dosage", "durationDays", "frequency"]);
      expect(r.errors.dosage!.ar).toBe("هذا الحقل مطلوب");
    }
    const relaxed = buildEntryPayload("PRESCRIPTION", { medication: "Amoxicillin", dosage: "1 tab", frequency: "BID" }, { enforceUiRequired: false });
    expect(relaxed.ok).toBe(true);
  });

  it("rejects out-of-range numbers and non-integers", () => {
    const r = buildEntryPayload("WEIGHT", { weightKg: "120", bcs: "4.5" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.weightKg!.en).toMatch(/Maximum is 40/);
      expect(r.errors.bcs!.en).toMatch(/whole number/);
    }
  });

  it("requires a vaccine name only for OTHER", () => {
    const coded = buildEntryPayload("VACCINATION", { vaccineCode: "RABIES", batchNo: "B1", route: "SC", dueAt: "2027-01-01" });
    expect(coded.ok).toBe(true);
    const other = buildEntryPayload("VACCINATION", { vaccineCode: "OTHER", batchNo: "B1", route: "SC", dueAt: "2027-01-01" });
    expect(other.ok).toBe(false);
    if (!other.ok) expect(other.errors.vaccine).toBeDefined();
  });

  it("splits a tooth list in either script and keeps lab rows", () => {
    const d = buildEntryPayload("DENTAL", { procedure: "Extraction", extractions: "٣٠٧، 407", grade: "2" });
    expect(d.ok && d.payload).toEqual({ procedure: "Extraction", extractions: ["307", "407"], grade: 2 });
    const lab = buildEntryPayload("LAB", {
      panel: "Renal",
      results: [
        { analyte: "Creatinine", value: "١٫٤", unit: "mg/dL", flag: "HIGH" },
        { analyte: "", value: "" },
      ],
    });
    expect(lab.ok && lab.payload.results).toEqual([{ analyte: "Creatinine", value: "1.4", unit: "mg/dL", flag: "HIGH" }]);
  });

  it("sends a datetime as an ISO instant and a date as a date", () => {
    const h = buildEntryPayload("HOSPITALIZATION", { reason: "Blocked bladder", admittedAt: "2026-07-18T09:00" });
    expect(h.ok && typeof h.payload.admittedAt === "string" && h.payload.admittedAt.endsWith("Z")).toBe(true);
    const v = buildEntryPayload("VACCINATION", { vaccineCode: "FVRCP", batchNo: "x", route: "SC", dueAt: "2027-08-03" });
    expect(v.ok && v.payload.dueAt).toBe("2027-08-03");
  });
});

describe("parseClinicalNumber — digits as clinics type them", () => {
  it("accepts Arabic-Indic, Eastern-Arabic and the Arabic decimal separator", () => {
    expect(parseClinicalNumber("٤٫٢", "decimal")).toBe(4.2);
    expect(parseClinicalNumber("۳۸,۵", "decimal")).toBe(38.5);
    expect(parseClinicalNumber("١٢", "int")).toBe(12);
  });
  it("refuses what is not a number", () => {
    expect(parseClinicalNumber("abc", "decimal")).toBeNull();
    expect(parseClinicalNumber("2.5", "int")).toBeNull();
    expect(parseClinicalNumber("", "int")).toBeNull();
  });
});

describe("vaccine normalisation", () => {
  it("maps legacy free-text names, in both scripts, to codes", () => {
    expect(normalizeVaccineCode("Rabies")).toBe("RABIES");
    expect(normalizeVaccineCode("rabisin")).toBe("RABIES");
    expect(normalizeVaccineCode("سعار")).toBe("RABIES");
    expect(normalizeVaccineCode("لقاح السعار")).toBe("RABIES");
    expect(normalizeVaccineCode("Tricat Trio (FVRCP)")).toBe("FVRCP");
    expect(normalizeVaccineCode("tricat")).toBe("FVRCP");
    expect(normalizeVaccineCode("الثلاثي")).toBe("FVRCP");
    expect(normalizeVaccineCode("Purevax RCPCh FeLV")).toBe("FVRCP");
    expect(normalizeVaccineCode("Leucogen")).toBe("FELV");
    expect(normalizeVaccineCode("FeLV booster")).toBe("FELV");
    expect(normalizeVaccineCode("اللوكيميا")).toBe("FELV");
    expect(normalizeVaccineCode("Chlamydia")).toBe("CHLAMYDIA");
    expect(normalizeVaccineCode("Ringworm vaccine")).toBe("OTHER");
  });

  it("trusts an explicit code over the name", () => {
    expect(normalizeVaccineCode("Nobivac something", "RABIES")).toBe("RABIES");
  });

  it("keeps two different OTHER vaccines apart", () => {
    expect(vaccineKey("Ringworm")).not.toBe(vaccineKey("Bordetella"));
    expect(vaccineKey("Rabies")).toBe(vaccineKey("سعار"));
  });
});

describe("overdue = latest dose per vaccine", () => {
  const now = new Date("2026-10-04T08:00:00Z");
  const doses = [
    // Last year's FVRCP: dueAt passed — but superseded by this year's booster.
    { name: "Tricat", administeredAt: "2025-09-01", dueAt: "2026-09-01" },
    { name: "FVRCP", vaccineCode: "FVRCP", administeredAt: "2026-09-05", dueAt: "2027-09-05" },
    // Rabies: one dose, genuinely overdue.
    { name: "سعار", administeredAt: "2025-06-01", dueAt: "2026-06-01" },
  ];

  it("keeps one dose per vaccine, the most recent", () => {
    const latest = latestDosePerVaccine(doses);
    expect(latest).toHaveLength(2);
    expect(latest.find((d) => normalizeVaccineCode(d.name, (d as { vaccineCode?: string }).vaccineCode) === "FVRCP")?.administeredAt).toBe("2026-09-05");
  });

  it("never reports a superseded dose as overdue", () => {
    const annotated = annotateDoses(doses, now);
    expect(annotated[0]!.standing).toBe("SUPERSEDED");
    expect(annotated[0]!.overdue).toBe(false);
    expect(annotated[1]!.standing).toBe("SCHEDULED");
    expect(annotated[2]!.overdue).toBe(true);
    expect(overdueVaccines(doses, now).map((d) => d.name)).toEqual(["سعار"]);
  });
});

describe("reasons are codes, rendered per locale", () => {
  it("renders visit reasons in the reader's language", () => {
    expect(visitReasonLabel("checkup", "ar")).toBe("فحص دوري");
    expect(visitReasonLabel("vaccination", "ar")).toBe("تطعيم");
    expect(visitReasonLabel("sterilisation", "en")).toBe("Spay / neuter");
    expect(visitReasonLabel("no-show", "ar")).toBe("لم يحضر");
    expect(visitReasonLabel("other — owner left early", "ar")).toBe("owner left early");
    expect(visitReasonLabel("vaccination · no-show", "ar")).toBe("تطعيم · لم يحضر");
  });
  it("keeps free text verbatim", () => {
    expect(visitReasonLabel("Limping since Tuesday", "ar")).toBe("Limping since Tuesday");
    expect(visitReasonLabel(null, "ar")).toBe("");
  });
  it("never puts English presets into an Arabic emergency notice", () => {
    expect(emergencyReasonLabel("COLLAPSE", "ar")).toBe("انهيار / فقدان وعي");
    expect(emergencyReasonLabel(composeReason("TRAUMA", "hit by car"), "ar")).toBe("إصابة أو حادث — hit by car");
    expect(emergencyReasonLabel(composeReason("OTHER", "heatstroke"), "en")).toBe("heatstroke");
  });
});

describe("open visits across midnight", () => {
  it("flags an OPEN visit from an earlier Riyadh day as stale", () => {
    const now = new Date("2026-10-04T06:00:00Z"); // 09:00 Riyadh
    const { start } = riyadhDayBounds(now);
    expect(isStaleOpenVisit({ state: "OPEN", checkedInAt: "2026-10-03T19:00:00Z" }, start)).toBe(true); // 22:00 yesterday
    expect(isStaleOpenVisit({ state: "OPEN", checkedInAt: "2026-10-03T22:00:00Z" }, start)).toBe(false); // 01:00 today, Riyadh
    expect(isStaleOpenVisit({ state: "CLOSED", checkedInAt: "2026-10-01T10:00:00Z" }, start)).toBe(false);
  });
});

describe("practitioner licences hold doctor capabilities", () => {
  const now = new Date("2026-10-04T00:00:00Z");
  it("derives the standing", () => {
    expect(licenceStanding({ role: "RECEPTION" }, now)).toBe("NOT_REQUIRED");
    expect(licenceStanding({ role: "VET" }, now)).toBe("MISSING");
    expect(licenceStanding({ role: "VET", licenceNo: "SVC-1", licenceExpiresAt: "2026-01-01" }, now)).toBe("EXPIRED");
    expect(licenceStanding({ role: "VET", licenceNo: "SVC-1", licenceExpiresAt: "2027-01-01" }, now)).toBe("VALID");
    expect(licenceStanding({ role: "VET_SENIOR", licenceNo: "SVC-1" }, now)).toBe("VALID");
  });

  it("holds prescribing and co-signing, and makes writing a draft", () => {
    expect(can({ role: "VET", licence: "MISSING" }, "prescription.write")).toBe(false);
    expect(can({ role: "VET_SENIOR", licence: "EXPIRED" }, "record.cosign")).toBe(false);
    expect(can({ role: "VET", licence: "MISSING" }, "record.write")).toBe(true);
    expect(capabilitiesFor({ role: "VET", licence: "MISSING" })).not.toContain("prescription.dispense");
    expect(requiresCoSign("VET", "MISSING")).toBe(true);
    expect(requiresCoSign("VET", "VALID")).toBe(false);
    expect(can({ role: "VET", licence: "VALID" }, "prescription.write")).toBe(true);
  });

  it("leaves counter-mode and sandbox semantics untouched", () => {
    expect(can({ role: "OWNER", counterMode: true, licence: "VALID" }, "staff.manage")).toBe(false);
    expect(can({ role: "VET", orgStatus: "APPROVED", licence: "VALID" }, "record.write")).toBe(false);
    // Omitted licence = not evaluated, exactly as before.
    expect(can({ role: "VET" }, "prescription.write")).toBe(true);
  });
});

describe("owner delivery is reported honestly", () => {
  it("says nothing when delivered, and why when not", () => {
    expect(ownerDeliveryNotice({ delivered: true, channel: "IN_APP" })).toBeNull();
    expect(ownerDeliveryNotice({ delivered: false, channel: null, reason: "UNCLAIMED" })?.ar).toBe(
      "هذا القط ما استُلم بعد — اعرضوا رمز الاستلام أولاً."
    );
  });
});

describe("partner terms are versioned, never silently rewritten", () => {
  const hash = (docs: Parameters<typeof canonicalTermsText>[0]) =>
    createHash("sha256").update(canonicalTermsText(docs)).digest("hex");

  it("bumped the version for the benefit-clause removal", () => {
    expect(VET_PARTNER_TERMS_VERSION).toBe("2026-10-04");
    const text = canonicalTermsText([VET_PARTNER_AGREEMENT, VET_PDPL_ADDENDUM]);
    expect(text).not.toMatch(/member benefit/i);
    expect(text).not.toContain("ميزة معلنة");
  });

  it("reproduces the exact hash signed under 2026-09-16 from the archive", () => {
    const archived = partnerTermsFor("2026-09-16");
    expect(archived).not.toBeNull();
    expect(hash([...archived!])).toBe("7c62bdfd3ea9b4ed59c5e0b47e96df89aeee7060fe2e75e6714364b8579af670");
  });

  it("returns the current documents for the current version", () => {
    expect(partnerTermsFor(VET_PARTNER_TERMS_VERSION)).toEqual([VET_PARTNER_AGREEMENT, VET_PDPL_ADDENDUM]);
    expect(partnerTermsFor("1999-01-01")).toBeNull();
  });
});
