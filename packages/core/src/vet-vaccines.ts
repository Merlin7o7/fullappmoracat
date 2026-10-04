/**
 * Vaccines as codes, not free text — and "overdue" computed from the LATEST
 * dose of each vaccine, never from every dose ever given.
 *
 * Why: vaccine names were free text ("Tricat", "tricat trio", "FVRCP booster",
 * «ثلاثي»), so the clinic's alerts band could not tell that a booster given
 * this year replaced last year's dose. Last year's dose still carried last
 * year's `dueAt`, which had passed — so every vaccinated cat with any history
 * showed as OVERDUE (UX audit 2026-10-04, #vet P1). A wrong red badge on a
 * clinical screen teaches a vet to ignore the badge.
 *
 * Rules:
 *   • New records carry a `vaccineCode` (FVRCP · FELV · RABIES · CHLAMYDIA ·
 *     OTHER). The product name is a separate field.
 *   • Old free-text records are normalised to a code by name, in both scripts.
 *   • Only the most recent dose per vaccine can be overdue; an older dose is
 *     "superseded" whatever its dueAt says.
 *
 * Pure and dependency-free: imported by the API, the portal and tests.
 */

export const VACCINE_CODES = ["FVRCP", "FELV", "RABIES", "CHLAMYDIA", "OTHER"] as const;
export type VaccineCode = (typeof VACCINE_CODES)[number];

/** One wording per vaccine, everywhere (and «تطعيم», never «تحصين»). */
export const VACCINE_LABELS: Record<VaccineCode, { ar: string; en: string }> = {
  FVRCP: { ar: "الثلاثي (FVRCP)", en: "FVRCP (core trivalent)" },
  FELV: { ar: "اللوكيميا (FeLV)", en: "FeLV (feline leukaemia)" },
  RABIES: { ar: "السعار", en: "Rabies" },
  CHLAMYDIA: { ar: "الكلاميديا", en: "Chlamydia" },
  OTHER: { ar: "أخرى", en: "Other" },
};

/** The canonical stored name for a coded dose (what `CatVaccination.name` holds). */
export const VACCINE_CANONICAL_NAME: Record<Exclude<VaccineCode, "OTHER">, string> = {
  FVRCP: "FVRCP",
  FELV: "FeLV",
  RABIES: "Rabies",
  CHLAMYDIA: "Chlamydia",
};

export function isVaccineCode(v: unknown): v is VaccineCode {
  return typeof v === "string" && (VACCINE_CODES as readonly string[]).includes(v);
}

/** Lower-case, strip diacritics/tatweel and unify Arabic letter forms. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ًͯ-ٰٟـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

// `fold` turns every separator into a single space, so "(?:^| )" is the word
// start. (JS `\b` does not work here: Arabic letters are not `\w`, so `\bسعار`
// never matches.) Order matters: rabies is never combined in feline products;
// a combined core product ("RCP + FeLV", "RCPCh") is filed under FVRCP, its
// core component, before the single-antigen FeLV / chlamydia checks.
const W = "(?:^| )";
const PATTERNS: ReadonlyArray<[Exclude<VaccineCode, "OTHER">, RegExp]> = [
  ["RABIES", new RegExp(`${W}(rabies|rabisin|rabvac|defensor|imrab|(?:ال)?سعار|داء (?:ال)?كلب)`)],
  [
    "FVRCP",
    new RegExp(
      `${W}(fvrcp|fvrc|f?rcp|tricat|trio|feligen|leucofeligen|felocell|fel o vax|panleuk|calici|herpes|rhinotrach|(?:ال)?ثلاثي|بانليوكوبينيا|كاليسي|هربس)`
    ),
  ],
  ["FELV", new RegExp(`${W}(felv|leuk|leucogen|leukocell|(?:ال)?لوكيميا|ابيضاض)`)],
  ["CHLAMYDIA", new RegExp(`${W}(chlam|(?:ال)?كلاميديا)`)],
];

/**
 * The code for a dose, from its explicit code if it has one, else its name.
 * Unknown names are OTHER — never guessed into a core vaccine.
 */
export function normalizeVaccineCode(name: string | null | undefined, code?: string | null): VaccineCode {
  if (isVaccineCode(code)) return code;
  const f = fold(name ?? "");
  if (!f) return "OTHER";
  for (const [c, re] of PATTERNS) if (re.test(f)) return c;
  return "OTHER";
}

/**
 * The grouping key for "same vaccine": the code, except that two different
 * OTHER vaccines must never supersede each other.
 */
export function vaccineKey(name: string | null | undefined, code?: string | null): string {
  const c = normalizeVaccineCode(name, code);
  return c === "OTHER" ? `OTHER:${fold(name ?? "")}` : c;
}

/** Bilingual display name for a dose: the code's label, or the typed name for OTHER. */
export function vaccineDisplayName(
  name: string | null | undefined,
  code?: string | null
): { ar: string; en: string } {
  const c = normalizeVaccineCode(name, code);
  if (c === "OTHER") {
    const n = (name ?? "").trim() || VACCINE_LABELS.OTHER.en;
    return { ar: (name ?? "").trim() || VACCINE_LABELS.OTHER.ar, en: n };
  }
  return VACCINE_LABELS[c];
}

export interface DoseLike {
  name?: string | null;
  vaccineCode?: string | null;
  administeredAt: Date | string | null;
  dueAt: Date | string | null;
}

function t(v: Date | string | null | undefined): number {
  if (!v) return Number.NEGATIVE_INFINITY;
  const n = (v instanceof Date ? v : new Date(v)).getTime();
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

/**
 * Keep only the most recent dose of each vaccine. Ties on administeredAt keep
 * the one with the later dueAt (a same-day correction).
 */
export function latestDosePerVaccine<T extends DoseLike>(doses: readonly T[]): T[] {
  const best = new Map<string, T>();
  for (const d of doses) {
    const key = vaccineKey(d.name, d.vaccineCode);
    const cur = best.get(key);
    if (
      !cur ||
      t(d.administeredAt) > t(cur.administeredAt) ||
      (t(d.administeredAt) === t(cur.administeredAt) && t(d.dueAt) > t(cur.dueAt))
    ) {
      best.set(key, d);
    }
  }
  return [...best.values()];
}

export type DoseStanding = "OVERDUE" | "DUE_SOON" | "SCHEDULED" | "NO_DUE_DATE" | "SUPERSEDED";

/** How many days ahead a dose counts as "due soon". */
export const VACCINE_DUE_SOON_DAYS = 30;

/**
 * Annotate every dose with its standing. Superseded doses can never be
 * overdue — that is the whole fix.
 */
export function annotateDoses<T extends DoseLike>(
  doses: readonly T[],
  now: Date = new Date()
): Array<T & { vaccineKey: string; vaccineCode: VaccineCode; isLatest: boolean; overdue: boolean; standing: DoseStanding }> {
  const latest = new Set(latestDosePerVaccine(doses));
  return doses.map((d) => {
    const isLatest = latest.has(d);
    const due = t(d.dueAt);
    let standing: DoseStanding;
    if (!isLatest) standing = "SUPERSEDED";
    else if (due === Number.NEGATIVE_INFINITY) standing = "NO_DUE_DATE";
    else if (due < now.getTime()) standing = "OVERDUE";
    else if (due - now.getTime() <= VACCINE_DUE_SOON_DAYS * 86_400_000) standing = "DUE_SOON";
    else standing = "SCHEDULED";
    return {
      ...d,
      vaccineKey: vaccineKey(d.name, d.vaccineCode),
      vaccineCode: normalizeVaccineCode(d.name, d.vaccineCode),
      isLatest,
      overdue: standing === "OVERDUE",
      standing,
    };
  });
}

/** The latest doses that are overdue right now — the alerts band's list. */
export function overdueVaccines<T extends DoseLike>(doses: readonly T[], now: Date = new Date()): T[] {
  return latestDosePerVaccine(doses).filter((d) => {
    const due = t(d.dueAt);
    return due !== Number.NEGATIVE_INFINITY && due < now.getTime();
  });
}
