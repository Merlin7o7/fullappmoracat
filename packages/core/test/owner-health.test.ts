import { describe, expect, it } from "vitest";
import { describeEntryForOwner } from "../src/owner-health";

describe("describeEntryForOwner", () => {
  it("never shows clinician notes: NOTE entries are hidden entirely", () => {
    expect(describeEntryForOwner("NOTE", { text: "aggressive on table" })).toBeNull();
  });

  it("shows the vaccine name and next dose, nothing else from the payload", () => {
    const v = describeEntryForOwner("VACCINATION", {
      vaccine: "Tricat",
      dueAt: "2027-01-15T00:00:00Z",
      batchNo: "B123",
      site: "left hind — owner complained about price",
    });
    expect(v?.title.en).toBe("Tricat");
    expect(v?.summary?.en).toBe("Next dose 2027-01-15");
    expect(JSON.stringify(v)).not.toContain("complained");
    expect(JSON.stringify(v)).not.toContain("B123");
  });

  it("keeps clinical values identical in both languages", () => {
    const rx = describeEntryForOwner("PRESCRIPTION", { medication: "Metacam", dosage: "0.1 mg/kg", frequency: "SID" });
    expect(rx?.title.ar).toBe("Metacam");
    expect(rx?.title.en).toBe("Metacam");
    expect(rx?.summary?.ar).toBe("0.1 mg/kg · SID");
  });

  it("summarises lab results as a count, not the panel detail", () => {
    const lab = describeEntryForOwner("LAB", {
      panel: "CBC",
      results: [{ analyte: "WBC", flag: "high" }, { analyte: "RBC", flag: "normal" }],
    });
    expect(lab?.summary?.en).toBe("1 out of range — ask your vet");
    expect(JSON.stringify(lab)).not.toContain("WBC");
  });

  it("falls back to the kind label when the payload is malformed", () => {
    expect(describeEntryForOwner("EXAM", "garbage")?.title.en).toBe("Check-up");
    expect(describeEntryForOwner("EXAM", null)?.summary).toBeNull();
  });
});
