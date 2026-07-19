import { describe, expect, it } from "vitest";
import {
  assertShape,
  assertEnum,
  VISIT_STATES,
  PRESCRIPTION_STATUSES,
} from "../src/vet-contract";

/**
 * The portal was written against a specification of the backend rather than the
 * backend itself, and the fetch helper cast responses without validating them —
 * so a contract mismatch rendered a blank screen instead of an error, across an
 * entire platform. These pin the guard that turns that silence into a
 * diagnosable failure.
 */
describe("assertShape", () => {
  it("passes a response carrying the expected keys", () => {
    const res = assertShape<{ items: number[] }>(
      { items: [1], pagination: {}, access: {} },
      ["items", "pagination", "access"],
      "GET /vet/patients/:catId/timeline"
    );
    expect(res.items).toEqual([1]);
  });

  it("names the endpoint AND the missing keys, so the mismatch is diagnosable", () => {
    // This is the real shipped bug: the API sends { items, access, pagination }
    // and the portal read `.entries`.
    expect(() =>
      assertShape({ items: [], access: {}, pagination: {} }, ["entries"], "GET /timeline")
    ).toThrow(/GET \/timeline.*"entries".*Received keys: items, access, pagination/s);
  });

  it("says it is a contract mismatch, not a data problem", () => {
    expect(() => assertShape({}, ["visit"], "GET /vet/visits/:id")).toThrow(
      /contract mismatch, not a data problem/i
    );
  });

  it("rejects null and non-objects rather than letting them through as {}", () => {
    expect(() => assertShape(null, ["items"], "ctx")).toThrow(/received null/);
    expect(() => assertShape("oops", ["items"], "ctx")).toThrow(/received string/);
  });

  it("treats an explicitly-null value as present — absent means MISSING, not empty", () => {
    // `{ nextCursor: null }` is a valid response; only an absent key is drift.
    expect(() => assertShape({ nextCursor: null }, ["nextCursor"], "ctx")).not.toThrow();
  });
});

describe("assertEnum", () => {
  it("accepts a real visit state", () => {
    expect(assertEnum("CLOSED", VISIT_STATES, "visit.state")).toBe("CLOSED");
  });

  it("rejects the invented states the portal used to test for", () => {
    // The portal checked state === "COMPLETED" || "CANCELLED", which was ALWAYS
    // false, so closed charts rendered as editable and every save 409'd.
    for (const invented of ["WAITING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]) {
      expect(() => assertEnum(invented, VISIT_STATES, "visit.state")).toThrow(/expected one of/);
    }
  });

  it("rejects the invented prescription statuses too", () => {
    expect(() => assertEnum("ACTIVE", PRESCRIPTION_STATUSES, "rx.status")).toThrow();
    expect(assertEnum("ISSUED", PRESCRIPTION_STATUSES, "rx.status")).toBe("ISSUED");
  });

  it("lists the allowed values in the error, so the fix is obvious", () => {
    expect(() => assertEnum("NOPE", VISIT_STATES, "visit.state")).toThrow(/OPEN \| CLOSED/);
  });
});
