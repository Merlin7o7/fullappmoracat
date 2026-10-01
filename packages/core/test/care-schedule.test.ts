import { describe, expect, it } from "vitest";
import { careState, generateCareTasks } from "../src";

const now = new Date("2026-10-01T09:00:00Z");
const d = (s: string) => new Date(s);

describe("care schedule", () => {
  it("reminds only from recorded due dates, using the latest dose per vaccine", () => {
    const t = generateCareTasks({
      now,
      birthDate: d("2023-01-01"),
      joinedAt: d("2026-01-01"),
      vaccinations: [
        { id: "a", name: "Rabies", administeredAt: d("2024-01-01"), dueAt: d("2025-01-01") },
        { id: "b", name: "rabies ", administeredAt: d("2025-02-01"), dueAt: d("2026-02-01") },
        { id: "c", name: "FVRCP", administeredAt: d("2025-10-01"), dueAt: null },
      ],
      lastWeighInAt: null,
      lastCheckupAt: null,
      protocolApproved: false,
    });
    const vacc = t.filter((x) => x.kind === "VACCINE");
    expect(vacc).toHaveLength(1);
    expect(vacc[0]!.linkedVaccinationId).toBe("b");
    expect(vacc.every((x) => !x.proposed)).toBe(true);
  });

  it("never proposes a kitten series without a signed-off protocol", () => {
    const base = {
      now,
      birthDate: d("2026-08-20"),
      joinedAt: d("2026-09-20"),
      vaccinations: [],
      lastWeighInAt: null,
      lastCheckupAt: null,
    };
    expect(generateCareTasks({ ...base, protocolApproved: false }).some((x) => x.proposed)).toBe(false);
    const approved = generateCareTasks({ ...base, protocolApproved: true });
    expect(approved.filter((x) => x.proposed).length).toBeGreaterThan(0);
    expect(approved.filter((x) => x.proposed).every((x) => x.kind === "VACCINE")).toBe(true);
  });

  it("weighs kittens monthly and adults quarterly, keyed by the previous weigh-in", () => {
    const kitten = generateCareTasks({ now, birthDate: d("2026-05-01"), joinedAt: d("2026-06-01"), vaccinations: [], lastWeighInAt: d("2026-09-01"), lastCheckupAt: null, protocolApproved: false });
    const adult = generateCareTasks({ now, birthDate: d("2020-05-01"), joinedAt: d("2026-06-01"), vaccinations: [], lastWeighInAt: d("2026-09-01"), lastCheckupAt: null, protocolApproved: false });
    const wk = kitten.find((x) => x.kind === "WEIGH_IN")!;
    const wa = adult.find((x) => x.kind === "WEIGH_IN")!;
    expect(wk.seriesKey).toBe("weigh-in:after:2026-09-01T00:00:00.000Z");
    expect(Math.round((+wk.dueAt - +d("2026-09-01")) / 86_400_000)).toBe(30);
    expect(Math.round((+wa.dueAt - +d("2026-09-01")) / 86_400_000)).toBe(90);
  });

  it("derives states", () => {
    expect(careState({ status: "OPEN", dueAt: "2026-09-20" }, now)).toBe("overdue");
    expect(careState({ status: "OPEN", dueAt: "2026-10-05" }, now)).toBe("due");
    expect(careState({ status: "OPEN", dueAt: "2026-11-05" }, now)).toBe("upcoming");
    expect(careState({ status: "DONE", dueAt: "2026-09-20" }, now)).toBe("done");
    expect(careState({ status: "SKIPPED", dueAt: "2026-09-20" }, now)).toBe("skipped");
  });
});
