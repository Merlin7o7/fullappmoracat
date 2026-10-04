/**
 * Arabic grammar for sentences whose subject is a cat (R082, R087, MRC-UX
 * audit 2026-10-04 Part 08).
 *
 * Arabic verbs, adjectives and attached pronouns agree with the subject's
 * gender, so "لولو صار عضو" is wrong for a female cat in a way English never
 * shows. The rules, decided once:
 *
 *   • MALE / FEMALE — the matching form.
 *   • UNKNOWN (or missing) — NEVER silently masculine. The caller supplies a
 *     neutral phrasing, usually one that repeats the cat's name instead of a
 *     pronoun ("رقم لولو" rather than "رقمه"). That is why `n` is required.
 *   • English — he / she when known, they when not.
 *
 * Platform-free so the API (notifications, email) and the web share it.
 * Counting nouns («5 قطط», «12 شهراً») lives in format.ts (`countLabel`).
 */
import { countLabel, type FormatLocale } from "./format";

/** Mirrors the Prisma `CatGender` enum (see member-contract `CatGenderValue`). */
export type CatGrammarGender = "MALE" | "FEMALE" | "UNKNOWN";

/** Accept whatever a caller has (enum, string, null) and settle on one of three. */
export function catGender(value: unknown): CatGrammarGender {
  return value === "MALE" || value === "FEMALE" ? value : "UNKNOWN";
}

/**
 * Pick the form that agrees with the cat.
 *
 *   catVerb(cat.gender, { m: "صار", f: "صارت", n: "صار للقط" })
 *
 * `n` is used for UNKNOWN and must not be the masculine form wearing a
 * disguise — rephrase around the cat's name instead.
 */
export function catVerb<T = string>(gender: unknown, forms: { m: T; f: T; n: T }): T {
  const g = catGender(gender);
  return g === "MALE" ? forms.m : g === "FEMALE" ? forms.f : forms.n;
}

/** The attached Arabic pronoun: «ه» / «ها», or null when the gender is unknown. */
export function catSuffix(gender: unknown): "ه" | "ها" | null {
  const g = catGender(gender);
  return g === "MALE" ? "ه" : g === "FEMALE" ? "ها" : null;
}

/** Attach a suffix pronoun to an Arabic noun: هوية + ه → هويته, ذكرى + ها → ذكراها. */
function attach(noun: string, suffix: string): string {
  if (noun.endsWith("ة")) return `${noun.slice(0, -1)}ت${suffix}`;
  if (noun.endsWith("ى")) return `${noun.slice(0, -1)}ا${suffix}`;
  return `${noun}${suffix}`;
}

/**
 * "his/her X" in Arabic, falling back to "X of {name}" when the gender is
 * unknown: catPossessive("رقم", "FEMALE", "لولو") → «رقمها»;
 * catPossessive("رقم", "UNKNOWN", "لولو") → «رقم لولو».
 */
export function catPossessive(noun: string, gender: unknown, name: string): string {
  const s = catSuffix(gender);
  return s ? attach(noun, s) : `${noun} ${name}`.trim();
}

type PronounCase = "subject" | "object" | "possessive";
const EN_PRONOUNS: Record<CatGrammarGender, Record<PronounCase, string>> = {
  MALE: { subject: "he", object: "him", possessive: "his" },
  FEMALE: { subject: "she", object: "her", possessive: "her" },
  UNKNOWN: { subject: "they", object: "them", possessive: "their" },
};

/**
 * A pronoun for the cat. English: he/him/his · she/her/her · they/them/their.
 * Arabic: the independent pronoun «هو» / «هي», or the cat's name when the
 * gender is unknown (Arabic has no neutral pronoun, and «هو» would be a guess).
 */
export function catPronoun(
  gender: unknown,
  locale: FormatLocale,
  opts: { case?: PronounCase; name?: string } = {}
): string {
  const g = catGender(gender);
  if (locale === "en") return EN_PRONOUNS[g][opts.case ?? "subject"];
  if (g === "MALE") return "هو";
  if (g === "FEMALE") return "هي";
  return opts.name ?? "القط";
}

/** Noun forms for counting cats: «قطة واحدة»… «قطتين» · «5 قطط» · «12 قطة». */
export const CAT_COUNT_FORMS = {
  ar: { one: "قطة واحدة", two: "قطتين", few: "قطط", many: "قطة" },
  en: { one: "cat", other: "cats" },
} as const;

/** «قطة واحدة» · «قطتين» · «5 قطط» · «12 قطة» / "1 cat" · "5 cats". */
export function formatCats(n: number, locale: FormatLocale): string {
  return countLabel(n, locale, CAT_COUNT_FORMS);
}
