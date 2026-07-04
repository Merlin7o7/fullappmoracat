/**
 * #1 Automatic name localization — rule-based, deterministic transliteration
 * between Arabic and Latin scripts, applied at display time so a user enters a
 * name once and sees the right script per interface.
 *
 * Rule-based is instant and free but inherently approximate (names carry no
 * vowel/pronunciation metadata). It aims for a recognizable, respectful
 * rendering — not a perfect one. Detection is by script, so an already-correct
 * name for the active locale is returned untouched.
 */

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN_RE = /[A-Za-z]/;

export type Script = "ar" | "en" | "other";

export function detectScript(input: string): Script {
  if (ARABIC_RE.test(input)) return "ar";
  if (LATIN_RE.test(input)) return "en";
  return "other";
}

// ── Latin → Arabic ─────────────────────────────────────────────────────────
// Longest keys first so digraphs win over single letters.
const LATIN_TO_AR: [string, string][] = [
  ["sh", "ش"], ["ch", "تش"], ["th", "ث"], ["kh", "خ"], ["gh", "غ"], ["dh", "ذ"],
  ["ph", "ف"], ["ck", "ك"], ["oo", "و"], ["ou", "و"], ["ee", "ي"], ["ei", "ي"],
  ["ai", "اي"], ["ay", "اي"], ["aa", "ا"],
  ["a", "ا"], ["b", "ب"], ["c", "ك"], ["d", "د"], ["e", "ي"], ["f", "ف"],
  ["g", "ق"], ["h", "ه"], ["i", "ي"], ["j", "ج"], ["k", "ك"], ["l", "ل"],
  ["m", "م"], ["n", "ن"], ["o", "و"], ["p", "ب"], ["q", "ق"], ["r", "ر"],
  ["s", "س"], ["t", "ت"], ["u", "و"], ["v", "ف"], ["w", "و"], ["x", "كس"],
  ["y", "ي"], ["z", "ز"],
];

function wordToArabic(word: string): string {
  let s = word.toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    let matched = false;
    for (const [lat, ar] of LATIN_TO_AR) {
      if (s.startsWith(lat, i)) {
        out += ar;
        i += lat.length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // pass through anything we don't map (digits, punctuation)
      out += s[i];
      i += 1;
    }
  }
  return out;
}

// ── Arabic → Latin ─────────────────────────────────────────────────────────
const AR_TO_LATIN: Record<string, string> = {
  "ا": "a", "أ": "a", "إ": "i", "آ": "aa", "ٱ": "a", "ء": "", "ئ": "", "ؤ": "",
  "ب": "b", "ت": "t", "ث": "th", "ج": "j", "ح": "h", "خ": "kh", "د": "d",
  "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh", "ص": "s", "ض": "d",
  "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q", "ك": "k",
  "ل": "l", "م": "m", "ن": "n", "ه": "h", "ة": "a", "و": "w", "ي": "y",
  "ى": "a", "ﻻ": "la",
};
// Strip Arabic diacritics (tashkeel).
const TASHKEEL_RE = /[ً-ْٰ]/g;

function wordToLatin(word: string): string {
  const cleaned = word.replace(TASHKEEL_RE, "");
  let out = "";
  for (const ch of cleaned) {
    out += ch in AR_TO_LATIN ? AR_TO_LATIN[ch] : ch;
  }
  // Tidy: collapse repeats, capitalize.
  out = out.replace(/(.)\1{2,}/g, "$1$1");
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

function transform(name: string, fn: (w: string) => string): string {
  return name
    .split(/(\s+)/)
    .map((part) => (/\s+/.test(part) || part === "" ? part : fn(part)))
    .join("");
}

/** Best-effort Latin → Arabic transliteration. */
export function toArabic(name: string): string {
  return transform(name, wordToArabic);
}

/** Best-effort Arabic → Latin transliteration (Title Case). */
export function toLatin(name: string): string {
  return transform(name, wordToLatin);
}

/**
 * Return `name` in the active locale's script, transliterating if needed.
 * A name already in the target script is returned unchanged.
 */
export function localizeName(name: string | null | undefined, locale: "ar" | "en"): string {
  if (!name) return name ?? "";
  const script = detectScript(name);
  if (script === "other") return name;
  if (locale === "ar") return script === "ar" ? name : toArabic(name);
  return script === "en" ? name : toLatin(name);
}
