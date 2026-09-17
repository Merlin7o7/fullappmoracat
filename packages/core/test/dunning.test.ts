import { describe, expect, it } from "vitest";
import {
  DUNNING_OFFSETS_DAYS,
  GRACE_DAYS,
  MAX_DUNNING_ATTEMPTS,
  graceUntil,
  isFinalAttempt,
  nextDunningAt,
  CANCEL_REASONS,
  CANCEL_REASON_LABELS,
  isCancelReason,
} from "../src";

const DAY = 86_400_000;
const end = new Date("2026-10-01T00:00:00Z");

describe("dunning ladder", () => {
  it("retries at day 0, 2 and 5 then stops", () => {
    expect(DUNNING_OFFSETS_DAYS).toEqual([0, 2, 5]);
    expect(nextDunningAt(end, 0)?.getTime()).toBe(end.getTime());
    expect(nextDunningAt(end, 1)?.getTime()).toBe(end.getTime() + 2 * DAY);
    expect(nextDunningAt(end, 2)?.getTime()).toBe(end.getTime() + 5 * DAY);
    expect(nextDunningAt(end, 3)).toBeNull();
  });
  it("keeps benefits for a grace week", () => {
    expect(GRACE_DAYS).toBe(7);
    expect(graceUntil(end).getTime()).toBe(end.getTime() + 7 * DAY);
  });
  it("names the final attempt", () => {
    expect(isFinalAttempt(MAX_DUNNING_ATTEMPTS)).toBe(true);
    expect(isFinalAttempt(1)).toBe(false);
  });
});

describe("cancel reasons", () => {
  it("every reason has bilingual copy", () => {
    for (const r of CANCEL_REASONS) {
      expect(CANCEL_REASON_LABELS[r].ar.length).toBeGreaterThan(0);
      expect(CANCEL_REASON_LABELS[r].en.length).toBeGreaterThan(0);
    }
  });
  it("guards unknown values", () => {
    expect(isCancelReason("CAT_PASSED")).toBe(true);
    expect(isCancelReason("nope")).toBe(false);
  });
});
