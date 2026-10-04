#!/usr/bin/env node
/**
 * Copy guard — fails CI when member-facing code claims what Moracat is not.
 *
 * Moracat is a private company's register of cats (Design Authority, AD 2.1
 * framing; R006 honest by default). Words that borrow the state's authority —
 * «رسمي», «وطني», «حكومي» — or vouch for owner-typed data — «موثّق» — must not
 * appear in product copy, except in the narrow contexts where they are true:
 *
 *   • clinic verification (Moracat really does check a clinic's licence):
 *     «عيادة موثّقة», «العيادات الموثّقة», "verified clinic";
 *   • a phone number confirmed by a one-time code («جوال موثّق»);
 *   • Saudi registry field names a clinic fills in («الرقم الوطني الموحد»,
 *     «العنوان الوطني»);
 *   • disclaimers that say what we are NOT («ليست جهة حكومية»,
 *     "not a government body", «ليست وثيقة رسمية»);
 *   • code comments (they explain the rule; they are never rendered).
 *
 * Arabic is matched after stripping diacritics and tatweel, so «رسميّاً»,
 * «رسمياً» and «رسميا» are one word to this script. No dependencies; Node ≥ 18.
 *
 *   node scripts/check-banned-words.mjs      → exit 0 clean, exit 1 with a list
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Where member-facing copy lives. */
const SCAN = ["apps/web", "apps/api/src", "packages/core/src"];
const EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", "coverage", ".turbo", "public", "e2e"]);

/** Arabic diacritics (harakat, shadda, sukun, superscript alef) and tatweel. */
const DIACRITICS = /[ً-ٰٟـ]/g;
const normalize = (s) => s.replace(DIACRITICS, "");

/** Banned stems — matched on the normalized line. */
const BANNED = [
  { id: "ar:rasmi", re: /رسمي/u, hint: "«رسمي/رسمية/رسمياً» — a private register is never «رسمي»" },
  { id: "ar:watani", re: /وطني/u, hint: "«وطني» — never «التعداد الوطني» or any national framing" },
  { id: "ar:hukumi", re: /حكومي/u, hint: "«حكومي» — only in a «ليست جهة حكومية» disclaimer" },
  { id: "ar:muwathaq", re: /موثق/u, hint: "«موثّق/موثّقة» — only for clinic verification or a code-confirmed phone" },
  { id: "en:official", re: /\bofficial(?:ly)?\b/i, hint: '"official/officially" — say "Moracat ID", "issued"' },
  { id: "en:government", re: /\bgovernment\b/i, hint: '"government" — only in a "not a government body" disclaimer' },
  { id: "en:national-registry", re: /\bnational\s+regist(?:ry|er)\b/i, hint: '"national registry" — never' },
  { id: "en:verified-identity", re: /\bverified\s+identit(?:y|ies)\b/i, hint: '"verified identity" — owner-entered data is not verified' },
];

/**
 * Legitimate contexts. A hit is allowed when the (normalized) line matches one
 * of these, optionally only inside the given paths. Keep each entry narrow and
 * say why it is true.
 */
const ALLOW = [
  // Clinic verification is a real check Moracat performs (licence + registry).
  { why: "clinic verification", re: /عياد|clinic|vet-directory/iu, ids: ["ar:muwathaq"] },
  { why: "code-confirmed phone", re: /جوال\s*(?:غير\s*)?موثق/u, ids: ["ar:muwathaq"] },
  // Saudi registry fields a clinic fills in during registration.
  { why: "Saudi registry field name", re: /(?:الرقم|العنوان)\s+الوطني|national (?:short )?address|unified (?:national )?number/iu, ids: ["ar:watani"] },
  // Disclaimers saying what we are NOT.
  { why: "negation disclaimer", re: /(?:ليس|ليست|مو|مب)\s+(?:جهة\s+|وثيقة\s+)?(?:حكومي|رسمي)/u, ids: ["ar:hukumi", "ar:rasmi"] },
  { why: "negation disclaimer", re: /\bnot\s+(?:a|an)\s+(?:government|official)\b/i, ids: ["en:government", "en:official"] },
  // The clinic portal and the staff console speak to professionals about
  // professional facts (a verified clinic, a verified record amendment).
  { why: "clinic / staff surface", path: /^(?:apps\/web\/app\/(?:vet|admin)\/|apps\/web\/components\/(?:vet|admin)\/|apps\/api\/src\/(?:vet|admin)\/|packages\/core\/src\/vet-)/, ids: ["ar:muwathaq", "ar:watani", "en:official"] },
  // The verified-clinic directory and the owner's clinic-access card describe
  // clinic verification (or its absence: «غير موثّق» for a pending clinic).
  { why: "clinic directory / clinic consent card", path: /^apps\/web\/(?:app\/vet-directory\/|components\/vet-consent-card\.tsx)/, ids: ["ar:muwathaq"] },
  // Third-party product names ("official Google button" etc.) live in code, not copy.
  { why: "third-party integration", re: /google|apple|identity services/i, ids: ["en:official"] },
];

/** Strip comments from one line, leaving string contents alone as best we can. */
function stripComments(line, state) {
  let out = "";
  let i = 0;
  while (i < line.length) {
    if (state.inBlock) {
      const end = line.indexOf("*/", i);
      if (end === -1) return out;
      state.inBlock = false;
      i = end + 2;
      continue;
    }
    const block = line.indexOf("/*", i);
    // `//` that isn't part of a URL scheme (https://).
    let lineC = -1;
    for (let j = i; j < line.length - 1; j++) {
      if (line[j] === "/" && line[j + 1] === "/" && line[j - 1] !== ":") {
        lineC = j;
        break;
      }
    }
    if (block !== -1 && (lineC === -1 || block < lineC)) {
      out += line.slice(i, block);
      state.inBlock = true;
      i = block + 2;
      continue;
    }
    if (lineC !== -1) return out + line.slice(i, lineC);
    return out + line.slice(i);
  }
  return out;
}

function* walk(dir) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) yield* walk(path.join(dir, e.name));
    } else if (EXTENSIONS.has(path.extname(e.name)) && !e.name.endsWith(".d.ts")) {
      yield path.join(dir, e.name);
    }
  }
}

const violations = [];
for (const base of SCAN) {
  for (const file of walk(path.join(ROOT, base))) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
    const state = { inBlock: false };
    lines.forEach((raw, idx) => {
      const code = normalize(stripComments(raw, state));
      if (!code.trim()) return;
      for (const b of BANNED) {
        if (!b.re.test(code)) continue;
        const allowed = ALLOW.some(
          (a) => a.ids.includes(b.id) && (!a.path || a.path.test(rel)) && (!a.re || a.re.test(code))
        );
        if (!allowed) violations.push({ rel, line: idx + 1, rule: b, text: raw.trim().slice(0, 160) });
      }
    });
  }
}

if (violations.length) {
  console.error(`✗ check:copy — ${violations.length} banned claim(s) in product copy:\n`);
  for (const v of violations) {
    console.error(`  ${v.rel}:${v.line}  [${v.rule.id}] ${v.rule.hint}\n      ${v.text}`);
  }
  console.error(
    "\nFix the copy (design/voice.md, AD 2.1 framing). If the context is genuinely legitimate," +
      "\nadd a narrow, explained entry to ALLOW in scripts/check-banned-words.mjs."
  );
  process.exit(1);
}
console.log(`✓ check:copy — no banned claims in ${SCAN.join(", ")}`);
