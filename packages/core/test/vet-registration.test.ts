import { describe, expect, it } from "vitest";
import {
  canonicalTermsText,
  capabilitiesFor,
  can,
  normalizeSaudiMobile,
  normalizeNationalAddressCode,
  registrationGaps,
  VET_PARTNER_AGREEMENT,
  VET_PDPL_ADDENDUM,
  type RegistrationSnapshot,
} from "../src";

const future = new Date(Date.now() + 365 * 86_400_000).toISOString();

function complete(): RegistrationSnapshot {
  return {
    owner: { claimed: true },
    clinic: {
      nameAr: "عيادة النخيل",
      nameEn: "Palm Clinic",
      legalNameAr: "مؤسسة النخيل البيطرية",
      crNumber: "1010123456",
      unifiedNumber: "7001234567",
      crExpiresAt: future,
    },
    branches: [
      {
        id: "b1",
        nameAr: "فرع العليا",
        cityCode: "riyadh",
        district: "العليا",
        addressLine: "طريق الملك فهد",
        phone: "+966500000000",
        lat: 24.7,
        lng: 46.6,
        licenceNo: "MEWA-1",
        licenceExpiresAt: future,
      },
    ],
    documents: [
      { kind: "CR", branchId: null },
      { kind: "MEWA_LICENCE", branchId: "b1" },
    ],
    team: [{ role: "VET", licenceNo: "P-1" }],
  };
}

describe("registrationGaps", () => {
  it("is empty for a complete registration", () => {
    expect(registrationGaps(complete())).toEqual([]);
  });

  it("lists every gap bilingually, linked to its step", () => {
    const s = complete();
    s.clinic.crNumber = "123";
    s.documents = [];
    s.team = [{ role: "RECEPTION" }];
    const gaps = registrationGaps(s);
    const codes = gaps.map((g) => g.code);
    expect(codes).toEqual(expect.arrayContaining(["CR_NUMBER", "DOC_CR", "DOC_MEWA", "NO_DOCTOR"]));
    expect(gaps.every((g) => g.ar && g.en)).toBe(true);
    expect(gaps.find((g) => g.code === "DOC_MEWA")?.branchId).toBe("b1");
  });

  it("requires a practitioner licence for doctors only", () => {
    const s = complete();
    s.team = [{ role: "VET" }, { role: "RECEPTION" }];
    expect(registrationGaps(s).map((g) => g.code)).toEqual(["DOCTOR_LICENCE"]);
  });

  it("lets a solo-vet owner satisfy the doctor rule with their own licence", () => {
    const s = complete();
    s.team = [];
    s.owner = { claimed: true, practisesAsVet: true };
    expect(registrationGaps(s).map((g) => g.code)).toEqual(["OWNER_LICENCE"]);
    s.owner.licenceNo = "P-OWNER";
    expect(registrationGaps(s)).toEqual([]);
  });

  it("rejects an expired CR or licence", () => {
    const s = complete();
    s.clinic.crExpiresAt = "2020-01-01";
    s.branches[0]!.licenceExpiresAt = "2020-01-01";
    const codes = registrationGaps(s).map((g) => g.code);
    expect(codes).toContain("CR_EXPIRED");
    expect(codes).toContain("BRANCH_LICENCE_EXPIRED");
  });
});

describe("setup sandbox", () => {
  it("strips clinical capabilities until the clinic is LIVE", () => {
    const approved = capabilitiesFor({ role: "OWNER", orgStatus: "APPROVED" });
    expect(approved).toContain("patient.search");
    expect(approved).toContain("device.manage");
    expect(approved).not.toContain("patient.view");
    expect(approved).not.toContain("record.write");
    expect(can({ role: "VET", orgStatus: "APPROVED" }, "visit.open")).toBe(false);
    expect(can({ role: "VET", orgStatus: "LIVE" }, "visit.open")).toBe(true);
    // Omitted status keeps existing callers on the full matrix.
    expect(capabilitiesFor({ role: "VET" })).toContain("record.write");
  });
});

describe("Saudi formats", () => {
  it("normalises mobiles in every common shape, including Arabic digits", () => {
    for (const raw of ["0501234567", "501234567", "+966501234567", "00966501234567", "٠٥٠١٢٣٤٥٦٧", "050 123 4567"]) {
      expect(normalizeSaudiMobile(raw)).toBe("+966501234567");
    }
    expect(normalizeSaudiMobile("0112345678")).toBeNull();
  });

  it("normalises national address codes", () => {
    expect(normalizeNationalAddressCode(" rrrd ٢٩٢٩ ")).toBe("RRRD2929");
  });
});

describe("terms", () => {
  it("renders a stable canonical text containing both languages", () => {
    const text = canonicalTermsText([VET_PARTNER_AGREEMENT, VET_PDPL_ADDENDUM]);
    expect(text).toContain("partner-agreement@");
    expect(text).toContain("pdpl-addendum@");
    expect(text).toContain("اتفاقية");
    expect(text).toContain("Governing law");
    expect(canonicalTermsText([VET_PARTNER_AGREEMENT, VET_PDPL_ADDENDUM])).toBe(text);
  });
});
