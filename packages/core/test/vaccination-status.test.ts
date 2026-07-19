import { describe, expect, it } from "vitest";
import { deriveVaccinationStatus, DUE_SOON_DAYS } from "../src/vaccination-status";

const NOW = new Date("2026-07-19T12:00:00Z");
const daysFrom = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

/**
 * The clinical write path used to set `vaccinationStatus = "UP_TO_DATE"`
 * unconditionally on ANY vaccination entry, and nothing recomputed it. These
 * pin the two failures that produced.
 */
describe("deriveVaccinationStatus", () => {
  it("does NOT claim currency from a single dose in an unfinished series", () => {
    // One dose given, next dose already scheduled and still ahead: the cat is
    // mid-series, not up to date in the sense the badge implies.
    const d = deriveVaccinationStatus(
      [{ administeredAt: daysFrom(-14), dueAt: daysFrom(7) }],
      NOW
    );
    expect(d.standing).toBe("DUE_SOON");
    expect(d.standing).not.toBe("UP_TO_DATE");
  });

  it("goes OVERDUE once a due date passes — the badge cannot stay green forever", () => {
    const d = deriveVaccinationStatus(
      [{ administeredAt: daysFrom(-400), dueAt: daysFrom(-30) }],
      NOW
    );
    expect(d.standing).toBe("OVERDUE");
    expect(d.overdueSince).toEqual(daysFrom(-30));
    expect(d.daysUntilDue).toBeLessThan(0);
  });

  it("is UP_TO_DATE only when the next dose is comfortably ahead", () => {
    const d = deriveVaccinationStatus(
      [{ administeredAt: daysFrom(-30), dueAt: daysFrom(DUE_SOON_DAYS + 10) }],
      NOW
    );
    expect(d.standing).toBe("UP_TO_DATE");
  });

  it("reports UNKNOWN rather than guessing when no due date was recorded", () => {
    const d = deriveVaccinationStatus([{ administeredAt: daysFrom(-10), dueAt: null }], NOW);
    expect(d.standing).toBe("UNKNOWN");
    expect(d.nextDueAt).toBeNull();
  });

  it("is UNKNOWN for a cat with no records at all", () => {
    expect(deriveVaccinationStatus([], NOW).standing).toBe("UNKNOWN");
  });

  it("lets one overdue dose dominate several current ones", () => {
    // Safety-biased: being current on three vaccines does not make you current.
    const d = deriveVaccinationStatus(
      [
        { administeredAt: daysFrom(-60), dueAt: daysFrom(200) },
        { administeredAt: daysFrom(-90), dueAt: daysFrom(180) },
        { administeredAt: daysFrom(-400), dueAt: daysFrom(-5) },
      ],
      NOW
    );
    expect(d.standing).toBe("OVERDUE");
  });

  it("picks the soonest upcoming dose as next", () => {
    const d = deriveVaccinationStatus(
      [
        { administeredAt: daysFrom(-10), dueAt: daysFrom(90) },
        { administeredAt: daysFrom(-10), dueAt: daysFrom(15) },
      ],
      NOW
    );
    expect(d.nextDueAt).toEqual(daysFrom(15));
    expect(d.standing).toBe("DUE_SOON");
  });

  it("accepts ISO strings as well as Dates", () => {
    const d = deriveVaccinationStatus(
      [{ administeredAt: daysFrom(-10).toISOString(), dueAt: daysFrom(-1).toISOString() }],
      NOW
    );
    expect(d.standing).toBe("OVERDUE");
  });

  it("ignores unparseable dates instead of throwing mid-consult", () => {
    const d = deriveVaccinationStatus(
      [{ administeredAt: "not-a-date", dueAt: "nonsense" }],
      NOW
    );
    expect(d.standing).toBe("UNKNOWN");
  });
});
