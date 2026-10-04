import { describe, expect, it } from "vitest";
import { getMetadataStorage } from "class-validator";
import { CLINICAL_ENTRY_TYPES, VET_ENTRY_FIELDS, buildEntryPayload, type VetFieldSpec } from "@moraqat/core";
import { ENTRY_PAYLOAD_CLASSES, validateEntryPayload } from "./vet-record.dto";

/**
 * The composer (built from `VET_ENTRY_FIELDS`) and these validators used to
 * disagree on field names for 11 of 14 entry types, so every clinical save was
 * a 400 (UX audit 2026-10-04, Problem 1). This compares the two declarations
 * decorator by decorator, so a rename on either side fails here, not in a clinic.
 */

type Meta = { propertyName: string; name?: string; type: string; constraints?: unknown[]; each?: boolean };

function metasFor(cls: unknown): Map<string, Meta[]> {
  const list = getMetadataStorage().getTargetValidationMetadatas(
    cls as new () => object,
    "",
    true,
    false
  ) as unknown as Meta[];
  const out = new Map<string, Meta[]>();
  for (const m of list) out.set(m.propertyName, [...(out.get(m.propertyName) ?? []), m]);
  return out;
}

const named = (ms: Meta[], name: string) => ms.find((m) => m.name === name);

describe("vet-record DTOs ⇄ core VET_ENTRY_FIELDS", () => {
  for (const type of CLINICAL_ENTRY_TYPES) {
    describe(type, () => {
      const fields = VET_ENTRY_FIELDS[type] as ReadonlyArray<VetFieldSpec>;
      const metas = metasFor(ENTRY_PAYLOAD_CLASSES[type]);

      it("declares exactly the same field names", () => {
        expect([...metas.keys()].sort()).toEqual(fields.map((f) => f.name).sort());
      });

      for (const f of fields) {
        it(`${f.name}: required/optional, type, bounds and enum agree`, () => {
          const ms = metas.get(f.name) ?? [];
          const optional = ms.some((m) => m.type === "conditionalValidation");
          expect(optional).toBe(!f.required);

          switch (f.kind) {
            case "int":
              expect(named(ms, "isInt")).toBeTruthy();
              break;
            case "decimal":
              expect(named(ms, "isNumber")).toBeTruthy();
              break;
            case "date":
            case "datetime":
              expect(named(ms, "isDateString")).toBeTruthy();
              break;
            case "enum":
              expect([...((named(ms, "isIn")?.constraints?.[0] as string[]) ?? [])].sort()).toEqual((f.options ?? []).map((o) => o.value).sort());
              break;
            case "stringList":
              expect(named(ms, "arrayMaxSize")?.constraints?.[0]).toBe(f.max);
              break;
            case "labResults":
              expect(ms.some((m) => m.type === "nestedValidation")).toBe(true);
              break;
            default:
              expect(named(ms, "isString")).toBeTruthy();
          }
          if ((f.kind === "int" || f.kind === "decimal") && typeof f.min === "number") {
            expect(named(ms, "min")?.constraints?.[0]).toBe(f.min);
          }
          if ((f.kind === "int" || f.kind === "decimal") && typeof f.max === "number") {
            expect(named(ms, "max")?.constraints?.[0]).toBe(f.max);
          }
          if (typeof f.maxLength === "number") {
            expect(named(ms, "maxLength")?.constraints?.[0]).toBe(f.maxLength);
          }
        });
      }
    });
  }
});

describe("a composer-built payload is always accepted by the API validator", () => {
  // One realistic, fully-filled entry per type, built the way the composer
  // builds it — from raw typed strings, Arabic digits included.
  const samples: Record<string, Record<string, unknown>> = {
    EXAM: { subjective: "أكل أقل", objective: "نشيط", assessment: "سليم", plan: "متابعة", temperatureC: "٣٨٫٦", heartRate: "180", respiratoryRate: "٢٨" },
    DIAGNOSIS: { condition: "FLUTD", severity: "MODERATE", status: "CONFIRMED", notes: "UA" },
    VACCINATION: { vaccineCode: "RABIES", product: "Rabisin", manufacturer: "Boehringer", batchNo: "B-1", route: "SC", site: "Right hind", dueAt: "2027-10-04" },
    TREATMENT: { treatment: "Ear flush", diagnosis: "Otitis", medication: "Otomax", dosage: "3 drops", frequency: "BID", durationDays: "7", outcome: "Good", followUpAt: "2026-10-20" },
    PRESCRIPTION: { medication: "Amoxicillin", strength: "50 mg", form: "tablet", dosage: "1 tab", frequency: "BID", durationDays: "10", quantity: "20 tablets", refillsAllowed: "1", expiresAt: "2026-12-01", instructions: "With food" },
    LAB: { panel: "Renal", laboratory: "IDEXX", sampledAt: "2026-10-01", results: [{ analyte: "Creatinine", value: "1.4", unit: "mg/dL", flag: "NORMAL" }], interpretation: "OK" },
    IMAGING: { modality: "XRAY", region: "Thorax", findings: "Clear", interpretation: "NAD" },
    SURGERY: { procedure: "Spay", anaesthesia: "Iso", complications: "None", dischargeInstructions: "Rest", followUpAt: "2026-10-14" },
    DENTAL: { procedure: "Scale", grade: "2", extractions: "307, 407", findings: "Calculus", homeCare: "Brush" },
    HOSPITALIZATION: { reason: "Blocked bladder", admittedAt: "2026-10-01T09:00", dischargedAt: "2026-10-03T11:00", ward: "B4", monitoring: "q4h", dischargeInstructions: "Wet diet" },
    WEIGHT: { weightKg: "٤٫٢", bcs: "5", method: "Clinic scale" },
    NUTRITION: { dietType: "PRESCRIPTION", brand: "RC", product: "Urinary", caloriesPerDay: "240", waterIntake: "180 ml", schedule: "2 meals", notes: "FLUTD" },
    SUPPLEMENT: { name: "Omega-3", brand: "Nutramax", reason: "Coat", dosage: "1 pump", frequency: "Daily", compliance: "GOOD" },
    NOTE: { subtype: "HANDLING", text: "Hates carriers" },
  };

  for (const type of CLINICAL_ENTRY_TYPES) {
    it(type, () => {
      const built = buildEntryPayload(type, samples[type] as never);
      expect(built.ok, JSON.stringify(!built.ok && built.errors)).toBe(true);
      if (!built.ok) return;
      const v = validateEntryPayload(type, built.payload);
      expect(v.ok, JSON.stringify(!v.ok && v.errors)).toBe(true);
    });
  }

  it("still rejects the ghost keys the old composer sent", () => {
    const v = validateEntryPayload("EXAM", { clinicalType: "EXAM", subjective: "x" });
    expect(v.ok).toBe(false);
    const w = validateEntryPayload("PRESCRIPTION", { medication: "x", dosage: "1", frequency: "BID", allergyOverride: {} });
    expect(w.ok).toBe(false);
  });
});
