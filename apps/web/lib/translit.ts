/**
 * #1 Automatic name localization — dictionary-first, phonetic-fallback
 * transliteration between Arabic and Latin scripts, applied at display time so a
 * member enters a name once and sees the right script per interface.
 *
 * Naïve phonetic mapping mangles the names that matter most here — Saudi given
 * names, and especially the «عبد…» compounds (عبدالرحمن, عبدالله, عبدالعزيز…),
 * whose correct romanization ("Abdulrahman", "Abdullah") no letter-by-letter
 * rule can produce. So we recognise known names first (both scripts, one- and
 * two-token compound spellings) and fall back to the phonetic engine only for
 * names we don't know — which stays instant, free, and respectful (R006).
 */

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const LATIN_RE = /[A-Za-z]/;

export type Script = "ar" | "en" | "other";

export function detectScript(input: string): Script {
  if (ARABIC_RE.test(input)) return "ar";
  if (LATIN_RE.test(input)) return "en";
  return "other";
}

// ── Known-name dictionary ────────────────────────────────────────────────────
// Canonical Arabic ⇄ canonical English. `arAlt`/`enAlt` list accepted input
// spellings that should resolve to the same canonical output. Coverage focuses
// on the most common Saudi given names; unknown names fall through to phonetics.
interface NameEntry {
  ar: string;
  en: string;
  arAlt?: string[]; // extra Arabic spellings that map to `en`
  enAlt?: string[]; // extra Latin spellings that map to `ar`
}

const NAMES: NameEntry[] = [
  // «عبد…» compounds — the headline cases. Two-token forms (عبد الرحمن) are
  // matched by the tokenizer's lookahead; the joined forms live here directly.
  { ar: "عبدالرحمن", en: "Abdulrahman", enAlt: ["abdulrahman", "abdul rahman", "abdelrahman", "abd alrahman", "abdurrahman"] },
  { ar: "عبدالله", en: "Abdullah", enAlt: ["abdullah", "abdallah", "abdulla"] },
  { ar: "عبدالعزيز", en: "Abdulaziz", enAlt: ["abdulaziz", "abdul aziz", "abdelaziz"] },
  { ar: "عبدالرحيم", en: "Abdulrahim", enAlt: ["abdulrahim", "abdul rahim", "abdurrahim"] },
  { ar: "عبدالكريم", en: "Abdulkarim", enAlt: ["abdulkarim", "abdul karim"] },
  { ar: "عبدالمجيد", en: "Abdulmajeed", enAlt: ["abdulmajeed", "abdul majeed", "abdulmajid"] },
  { ar: "عبداللطيف", en: "Abdullatif", enAlt: ["abdullatif", "abdul latif"] },
  { ar: "عبدالوهاب", en: "Abdulwahab", enAlt: ["abdulwahab", "abdul wahab"] },
  { ar: "عبدالمحسن", en: "Abdulmohsen", enAlt: ["abdulmohsen", "abdul mohsen"] },
  { ar: "عبدالإله", en: "Abdulilah", arAlt: ["عبدالاله"], enAlt: ["abdulilah", "abdul ilah"] },
  { ar: "عبدالسلام", en: "Abdulsalam", enAlt: ["abdulsalam", "abdul salam"] },
  { ar: "عبدالمالك", en: "Abdulmalik", arAlt: ["عبدالملك"], enAlt: ["abdulmalik", "abdul malik"] },
  // Male given names
  { ar: "محمد", en: "Mohammed", enAlt: ["mohammed", "mohammad", "muhammad", "mohamed", "muhammed"] },
  { ar: "أحمد", en: "Ahmed", arAlt: ["احمد"], enAlt: ["ahmed", "ahmad"] },
  { ar: "إبراهيم", en: "Ibrahim", arAlt: ["ابراهيم"], enAlt: ["ibrahim", "ebrahim"] },
  { ar: "منصور", en: "Mansour", enAlt: ["mansour", "mansoor"] },
  { ar: "خالد", en: "Khalid", enAlt: ["khalid", "khaled"] },
  { ar: "فيصل", en: "Faisal", enAlt: ["faisal", "faysal"] },
  { ar: "سعود", en: "Saud", enAlt: ["saud", "saoud"] },
  { ar: "سلمان", en: "Salman" },
  { ar: "علي", en: "Ali" },
  { ar: "عمر", en: "Omar", enAlt: ["omar", "umar"] },
  { ar: "عثمان", en: "Othman", enAlt: ["othman", "uthman", "osman"] },
  { ar: "يوسف", en: "Yousef", enAlt: ["yousef", "yusuf", "yousuf", "youssef"] },
  { ar: "سعد", en: "Saad" },
  { ar: "ناصر", en: "Nasser", enAlt: ["nasser", "naser", "nassr"] },
  { ar: "فهد", en: "Fahad", enAlt: ["fahad", "fahd"] },
  { ar: "تركي", en: "Turki" },
  { ar: "بندر", en: "Bandar" },
  { ar: "ماجد", en: "Majed", enAlt: ["majed", "majid"] },
  { ar: "سلطان", en: "Sultan" },
  { ar: "نايف", en: "Naif", enAlt: ["naif", "nayef", "nayif"] },
  { ar: "مشعل", en: "Mishaal", enAlt: ["mishaal", "mishal", "meshal"] },
  { ar: "وليد", en: "Waleed", enAlt: ["waleed", "walid"] },
  { ar: "طلال", en: "Talal" },
  { ar: "سامي", en: "Sami" },
  { ar: "راشد", en: "Rashed", enAlt: ["rashed", "rashid"] },
  { ar: "حمد", en: "Hamad" },
  { ar: "صالح", en: "Saleh", enAlt: ["saleh", "salih"] },
  { ar: "فارس", en: "Faris", enAlt: ["faris", "fares"] },
  { ar: "زياد", en: "Ziyad", enAlt: ["ziyad", "ziad"] },
  { ar: "ريان", en: "Rayan", enAlt: ["rayan", "rayyan"] },
  { ar: "نواف", en: "Nawaf" },
  { ar: "هاني", en: "Hani" },
  { ar: "مازن", en: "Mazen", enAlt: ["mazen", "mazin"] },
  { ar: "باسل", en: "Basel", enAlt: ["basel", "basil"] },
  { ar: "مبارك", en: "Mubarak" },
  { ar: "جابر", en: "Jaber", enAlt: ["jaber", "jabir"] },
  { ar: "طارق", en: "Tariq", enAlt: ["tariq", "tarek", "tarik"] },
  { ar: "أنس", en: "Anas", arAlt: ["انس"] },
  // Female given names
  { ar: "نورة", en: "Noura", arAlt: ["نوره"], enAlt: ["noura", "nora", "norah"] },
  { ar: "سارة", en: "Sara", arAlt: ["ساره"], enAlt: ["sara", "sarah"] },
  { ar: "فاطمة", en: "Fatima", arAlt: ["فاطمه"], enAlt: ["fatima", "fatimah"] },
  { ar: "عائشة", en: "Aisha", arAlt: ["عائشه", "عايشة"], enAlt: ["aisha", "aishah", "ayesha"] },
  { ar: "مريم", en: "Maryam", enAlt: ["maryam", "mariam"] },
  { ar: "هند", en: "Hind" },
  { ar: "لطيفة", en: "Latifa", arAlt: ["لطيفه"] },
  { ar: "منيرة", en: "Munira", arAlt: ["منيره"], enAlt: ["munira", "muneera"] },
  { ar: "ريم", en: "Reem" },
  { ar: "لمى", en: "Lama", arAlt: ["لمي"] },
  { ar: "جواهر", en: "Jawaher" },
  { ar: "العنود", en: "Alanoud", enAlt: ["alanoud", "al anoud"] },
  { ar: "أروى", en: "Arwa", arAlt: ["اروى"] },
  { ar: "دانة", en: "Dana", arAlt: ["دانه"] },
  { ar: "غادة", en: "Ghada", arAlt: ["غاده"] },
  { ar: "رهف", en: "Rahaf" },
  { ar: "شهد", en: "Shahad", enAlt: ["shahad", "shahd"] },
  { ar: "جود", en: "Joud", enAlt: ["joud", "jood"] },
  { ar: "لين", en: "Leen", enAlt: ["leen", "leen", "lin"] },
  { ar: "رزان", en: "Razan" },
  { ar: "حصة", en: "Hessa", arAlt: ["حصه"], enAlt: ["hessa", "hissa"] },
];

/** Normalize Arabic for dictionary matching: drop tashkeel/tatweel, unify
 *  alef & ya variants, and collapse spaces so «عبد الرحمن» == «عبدالرحمن». */
function normAr(s: string): string {
  return s
    .replace(/[ً-ْٰـ]/g, "") // tashkeel + tatweel
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, "");
}

/** Normalize Latin for dictionary matching: lowercase, strip spaces/hyphens/'. */
function normEn(s: string): string {
  return s.toLowerCase().replace(/[\s\-']/g, "");
}

// Reverse lookups, built once. Keys are normalized; values are canonical output.
const AR_TO_EN = new Map<string, string>();
const EN_TO_AR = new Map<string, string>();
for (const n of NAMES) {
  for (const ar of [n.ar, ...(n.arAlt ?? [])]) AR_TO_EN.set(normAr(ar), n.en);
  for (const en of [n.en, ...(n.enAlt ?? [])]) EN_TO_AR.set(normEn(en), n.ar);
}

// ── Latin → Arabic (phonetic fallback) ───────────────────────────────────────
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
  const s = word.toLowerCase();
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

// ── Arabic → Latin (phonetic fallback) ───────────────────────────────────────
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
  // Tidy: collapse long repeats, capitalize.
  out = out.replace(/(.)\1{2,}/g, "$1$1");
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

/**
 * Tokenize on whitespace and transliterate token-by-token, consulting the
 * known-name dictionary first (with a two-token lookahead so split «عبد X»
 * compounds resolve), and only falling back to the phonetic engine for the
 * rest. Whitespace between tokens is preserved verbatim.
 */
function transform(
  name: string,
  lookup: (norm: string) => string | undefined,
  norm: (s: string) => string,
  phonetic: (w: string) => string
): string {
  const parts = name.split(/(\s+)/); // keep separators
  const out: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === undefined) continue;
    if (part === "" || /^\s+$/.test(part)) {
      out.push(part);
      continue;
    }
    // Two-token compound (e.g. «عبد الرحمن» / «Abdul Rahman»): try joining this
    // token with the next non-space token before falling back to single tokens.
    const nextIdx = i + 2; // parts[i+1] is the separator
    const next = parts[nextIdx];
    if (next && !/^\s+$/.test(next)) {
      const joined = lookup(norm(part + next));
      if (joined) {
        out.push(joined);
        i = nextIdx; // consume the separator + next token
        continue;
      }
    }
    out.push(lookup(norm(part)) ?? phonetic(part));
  }
  return out.join("");
}

/** Best-effort Latin → Arabic transliteration (dictionary-first). */
export function toArabic(name: string): string {
  return transform(name, (n) => EN_TO_AR.get(n), normEn, wordToArabic);
}

/** Best-effort Arabic → Latin transliteration (dictionary-first, Title Case). */
export function toLatin(name: string): string {
  return transform(name, (n) => AR_TO_EN.get(n), normAr, wordToLatin);
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
