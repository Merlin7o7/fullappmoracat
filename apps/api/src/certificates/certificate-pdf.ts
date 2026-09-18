import { createElement as h, type ReactElement } from "react";
import { join } from "node:path";
import QRCode from "qrcode";
import fontkit, { type Font as ShapingFont } from "fontkit";
import { Document, Font, Image, Page, Path, StyleSheet, Svg, Text, View, renderToBuffer } from "@react-pdf/renderer";

/**
 * The Cat ID certificate (MRC-PROD-001 T9) — a printable, verifiable document
 * that a boarding house, a breeder or a travel agent can check in seconds.
 *
 * Rendered server-side with @react-pdf/renderer + bundled Noto fonts (D8): the
 * API image is alpine, so no Chromium.
 *
 * Arabic is NOT laid out by react-pdf's text engine — textkit drops the last
 * glyphs of every Arabic run (verified on 3.4 and 4.9). Instead every Arabic
 * run is shaped with fontkit (joining forms, mark attachment) and drawn as
 * SVG glyph paths, which is deterministic and complete. Latin/digits still go
 * through <Text>. Owner-entered doses are marked "self-reported"; clinic-written
 * ones name the clinic — the certificate never overstates what was verified (R006).
 */

export interface CertificateVaccination {
  name: string;
  administeredAt: string; // ISO
  dueAt: string | null;
  clinic: { ar: string; en: string } | null;
  /** Written by a partner clinic (true) vs. entered by the owner (false). */
  verified: boolean;
}

export interface CertificateSnapshot {
  catName: string;
  catIdNumber: string;
  breed: { ar: string; en: string } | null;
  gender: string | null;
  birthDate: string | null;
  microchipNo: string | null;
  coatColor: string | null;
  vaccinations: CertificateVaccination[];
  issuedBy: { ar: string; en: string } | null;
}

export interface CertificateRenderInput extends CertificateSnapshot {
  number: string;
  issuedAt: string;
  verifyUrl: string;
}

const FONT_DIR = join(__dirname, "..", "..", "assets", "fonts");
let fontsRegistered = false;
function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "Sans",
    fonts: [
      { src: join(FONT_DIR, "NotoSans-Regular.ttf") },
      { src: join(FONT_DIR, "NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
  // No hyphenation — names and ID numbers must never be split.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

// ── Arabic runs: shaped by fontkit, drawn as glyph paths ─────────────────────

const naskh: { regular?: ShapingFont; bold?: ShapingFont } = {};
function naskhFont(bold: boolean): ShapingFont {
  const key = bold ? "bold" : "regular";
  if (!naskh[key]) naskh[key] = fontkit.openSync(join(FONT_DIR, bold ? "NotoNaskhArabic-Bold.ttf" : "NotoNaskhArabic-Regular.ttf")) as ShapingFont;
  return naskh[key]!;
}

const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
export function hasArabic(s: string | null | undefined): boolean {
  return !!s && ARABIC.test(s);
}

/**
 * One Arabic line as an <Svg> of glyph paths. fontkit returns the shaped run in
 * VISUAL (left-to-right) order with mark offsets, so glyphs are simply placed
 * left to right. Width is the run's advance; height spans ascent + descent so
 * the line boxes stack like text would.
 */
function ArabicText({ text, size, color = INK, bold = false, maxWidth }: { text: string; size: number; color?: string; bold?: boolean; maxWidth?: number }): ReactElement {
  const font = naskhFont(bold);
  const run = font.layout(text);
  let scale = size / font.unitsPerEm;
  let width = run.advanceWidth * scale;
  // A run that would overflow its cell is scaled down rather than clipped —
  // a certificate must never lose the end of a name.
  if (maxWidth && width > maxWidth) {
    scale *= maxWidth / width;
    width = maxWidth;
  }
  const parts: string[] = [];
  let pen = 0;
  run.glyphs.forEach((g: { path: { scale(x: number, y: number): { translate(x: number, y: number): { toSVG(): string } } } }, i: number) => {
    const p = run.positions[i]!;
    const d = g.path.scale(scale, -scale).translate(pen + p.xOffset * scale, -p.yOffset * scale).toSVG();
    if (d) parts.push(d);
    pen += p.xAdvance * scale;
  });
  const ascent = font.ascent * scale;
  const descent = -font.descent * scale;
  const height = ascent + descent;
  return h(Svg, { width, height, viewBox: `0 ${-ascent} ${width} ${height}` }, h(Path, { d: parts.join(" "), fill: color }));
}

/** Arabic → glyph paths; anything else → a normal <Text>. */
function smart(value: string, style: Record<string, unknown>, opts: { size: number; color?: string; bold?: boolean; maxWidth?: number }): ReactElement {
  if (hasArabic(value)) return h(ArabicText, { text: value, ...opts });
  return h(Text, { style: style as never }, value);
}

const GREEN = "#1F5F45";
const INK = "#1C1A17";
const MUTED = "#6B665E";
const PAPER = "#FBF8F2";
const HAIR = "#E4DDD1";

const s = StyleSheet.create({
  page: { backgroundColor: PAPER, padding: 36, fontFamily: "Sans", fontSize: 10, color: INK },
  frame: { borderWidth: 1.5, borderColor: GREEN, borderRadius: 14, padding: 26, flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontSize: 18, fontWeight: 700, color: GREEN, letterSpacing: 1 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18 },
  titleEn: { fontSize: 22, fontWeight: 700 },
  sub: { fontSize: 9, color: MUTED, marginTop: 4 },
  hero: { marginTop: 18, padding: 14, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: HAIR },
  catName: { fontSize: 26, fontWeight: 700 },
  catId: { fontSize: 13, fontWeight: 700, color: GREEN, marginTop: 4, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  cell: { width: "50%", paddingVertical: 4, paddingRight: 10 },
  labelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  label: { fontSize: 8, color: MUTED },
  value: { fontSize: 11, marginTop: 1 },
  section: { marginTop: 16 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 12, fontWeight: 700 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: HAIR, paddingVertical: 5, alignItems: "center" },
  th: { fontSize: 8, color: MUTED, fontWeight: 700 },
  c1: { width: "34%" },
  c2: { width: "20%" },
  c3: { width: "20%" },
  c4: { width: "26%" },
  small: { fontSize: 8, color: MUTED },
  footer: { marginTop: "auto", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 14, borderTopWidth: 1, borderTopColor: HAIR },
  qr: { width: 84, height: 84 },
  verified: { color: GREEN, fontWeight: 700 },
  selfReported: { color: MUTED },
});

function fmt(iso: string | null, locale: "en" | "ar"): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Riyadh" });
}

const GENDER: Record<string, { en: string; ar: string }> = {
  MALE: { en: "Male", ar: "ذكر" },
  FEMALE: { en: "Female", ar: "أنثى" },
};

/** A hero cell: English label left, Arabic label right, value below (in whichever script it is). */
function cell(labelEn: string, labelAr: string, value: string) {
  return h(
    View,
    { style: s.cell },
    h(View, { style: s.labelRow }, h(Text, { style: s.label }, labelEn), h(ArabicText, { text: labelAr, size: 8, color: MUTED })),
    h(View, { style: { marginTop: 2, alignItems: hasArabic(value) ? "flex-end" : "flex-start" } }, smart(value || "—", s.value, { size: 11, maxWidth: 200 }))
  );
}

export async function renderCertificatePdf(input: CertificateRenderInput): Promise<Buffer> {
  registerFonts();
  const qr = await QRCode.toDataURL(input.verifyUrl, { margin: 0, width: 256, color: { dark: INK, light: "#FFFFFF" } });
  const gender = input.gender ? GENDER[input.gender] : null;
  const vaccinations = input.vaccinations.slice(0, 12);
  const verifiedCount = input.vaccinations.filter((v) => v.verified).length;

  const doc = h(
    Document,
    { title: `Moracat Cat ID Certificate ${input.number}`, author: "Moracat", creator: "Moracat" },
    h(
      Page,
      { size: "A4", style: s.page },
      h(
        View,
        { style: s.frame },
        // Header
        h(View, { style: s.header }, h(Text, { style: s.brand }, "MORACAT"), h(ArabicText, { text: "مُراقط", size: 16, color: GREEN, bold: true })),
        h(View, { style: s.titleRow }, h(Text, { style: s.titleEn }, "Cat ID Certificate"), h(ArabicText, { text: "شهادة هوية القط", size: 20, bold: true })),
        h(Text, { style: s.sub }, `Certificate ${input.number} · issued ${fmt(input.issuedAt, "en")}`),

        // Hero: the cat
        h(
          View,
          { style: s.hero },
          h(View, { style: { alignItems: hasArabic(input.catName) ? "flex-end" : "flex-start" } }, smart(input.catName, s.catName, { size: 26, bold: true, maxWidth: 440 })),
          h(Text, { style: s.catId }, input.catIdNumber),
          h(
            View,
            { style: s.grid },
            cell("Breed", "السلالة", input.breed?.en ?? "—"),
            cell("Sex", "الجنس", gender?.en ?? "—"),
            cell("Date of birth", "تاريخ الميلاد", fmt(input.birthDate, "en")),
            cell("Microchip", "الشريحة", input.microchipNo ?? "—"),
            cell("Coat", "اللون", input.coatColor ?? "—"),
            cell("Issued by", "جهة الإصدار", input.issuedBy?.en ?? "Moracat (owner-requested)")
          )
        ),

        // Vaccinations
        h(
          View,
          { style: s.section },
          h(View, { style: s.sectionRow }, h(Text, { style: s.sectionTitle }, "Vaccination record"), h(ArabicText, { text: "سجل التطعيمات", size: 12, color: MUTED, bold: true })),
          h(
            View,
            { style: s.row },
            h(Text, { style: [s.th, s.c1] }, "Vaccine"),
            h(Text, { style: [s.th, s.c2] }, "Given"),
            h(Text, { style: [s.th, s.c3] }, "Next due"),
            h(Text, { style: [s.th, s.c4] }, "Recorded by")
          ),
          ...(vaccinations.length
            ? vaccinations.map((v, i) =>
                h(
                  View,
                  { style: s.row, key: String(i) },
                  h(View, { style: s.c1 }, smart(v.name, {}, { size: 10, maxWidth: 150 })),
                  h(Text, { style: s.c2 }, fmt(v.administeredAt, "en")),
                  h(Text, { style: s.c3 }, fmt(v.dueAt, "en")),
                  h(
                    View,
                    { style: s.c4 },
                    v.verified
                      ? smart(v.clinic?.en ?? "Partner clinic", s.verified, { size: 10, color: GREEN, bold: true, maxWidth: 110 })
                      : h(Text, { style: s.selfReported }, "Self-reported")
                  )
                )
              )
            : [h(Text, { style: [s.small, { paddingVertical: 8 }] }, "No vaccinations on record.")]),
          h(
            Text,
            { style: [s.small, { marginTop: 6 }] },
            `${verifiedCount} of ${input.vaccinations.length} entries were written by a licensed partner clinic. Self-reported entries were entered by the owner and are not verified by Moracat.`
          ),
          h(View, { style: { alignItems: "flex-end", marginTop: 2 } }, h(ArabicText, { text: "الإدخالات الذاتية أدخلها المالك ولم تتحقق منها مُراقط.", size: 9, color: MUTED }))
        ),

        // Footer: verification
        h(
          View,
          { style: s.footer },
          h(
            View,
            { style: { maxWidth: 360 } },
            h(Text, { style: [s.small, { fontWeight: 700, color: INK }] }, "Verify this certificate"),
            h(Text, { style: s.small }, input.verifyUrl),
            h(Text, { style: [s.small, { marginTop: 4 }] }, "Scan the code or open the link. A revoked or altered certificate will not verify."),
            h(View, { style: { alignItems: "flex-start", marginTop: 2 } }, h(ArabicText, { text: "امسح الرمز للتحقق من صحة الشهادة.", size: 9, color: MUTED }))
          ),
          h(Image, { src: qr, style: s.qr })
        )
      )
    )
  );

  return renderToBuffer(doc as never);
}
