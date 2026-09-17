import { createElement as h } from "react";
import { join } from "node:path";
import QRCode from "qrcode";
import { Document, Font, Image, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";

/**
 * The Cat ID certificate (MRC-PROD-001 T9) — a printable, verifiable document
 * that a boarding house, a breeder or a travel agent can check in seconds.
 *
 * Rendered server-side with @react-pdf/renderer + bundled Noto fonts (D8): the
 * API image is alpine, so no Chromium. Arabic is shaped by fontkit; every
 * Arabic run is kept SHORT and in its own right-aligned <Text> so it never
 * wraps (RTL line-breaking is the one thing the layout engine gets wrong).
 * Owner-entered doses are marked "self-reported"; clinic-written ones name the
 * clinic — the certificate never overstates what was verified (R006).
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
    family: "Naskh",
    fonts: [
      { src: join(FONT_DIR, "NotoNaskhArabic-Regular.ttf") },
      { src: join(FONT_DIR, "NotoNaskhArabic-Bold.ttf"), fontWeight: 700 },
    ],
  });
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

const GREEN = "#1F5F45";
const INK = "#1C1A17";
const MUTED = "#6B665E";
const PAPER = "#FBF8F2";
const HAIR = "#E4DDD1";

const s = StyleSheet.create({
  page: { backgroundColor: PAPER, padding: 36, fontFamily: "Sans", fontSize: 10, color: INK },
  frame: { borderWidth: 1.5, borderColor: GREEN, borderRadius: 14, padding: 26, flexGrow: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { fontSize: 18, fontWeight: 700, color: GREEN, letterSpacing: 1 },
  brandAr: { fontFamily: "Naskh", fontSize: 16, color: GREEN, textAlign: "right" },
  titleEn: { fontSize: 22, fontWeight: 700, marginTop: 18 },
  titleAr: { fontFamily: "Naskh", fontSize: 20, fontWeight: 700, textAlign: "right", marginTop: 2 },
  sub: { fontSize: 9, color: MUTED, marginTop: 4 },
  hero: { marginTop: 18, padding: 14, borderRadius: 10, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: HAIR },
  catName: { fontSize: 26, fontWeight: 700 },
  catId: { fontSize: 13, fontWeight: 700, color: GREEN, marginTop: 4, letterSpacing: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  cell: { width: "50%", paddingVertical: 4, paddingRight: 10 },
  label: { fontSize: 8, color: MUTED },
  labelAr: { fontFamily: "Naskh", fontSize: 9, color: MUTED, textAlign: "left" },
  value: { fontSize: 11, marginTop: 1 },
  valueAr: { fontFamily: "Naskh", fontSize: 11, marginTop: 1 },
  section: { marginTop: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 700 },
  sectionTitleAr: { fontFamily: "Naskh", fontSize: 12, fontWeight: 700, textAlign: "right", color: MUTED },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: HAIR, paddingVertical: 5 },
  th: { fontSize: 8, color: MUTED, fontWeight: 700 },
  c1: { width: "34%" },
  c2: { width: "20%" },
  c3: { width: "20%" },
  c4: { width: "26%" },
  small: { fontSize: 8, color: MUTED },
  smallAr: { fontFamily: "Naskh", fontSize: 9, color: MUTED, textAlign: "right" },
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

function cell(labelEn: string, labelAr: string, value: string, arabicValue = false) {
  return h(
    View,
    { style: s.cell },
    h(View, { style: { flexDirection: "row", justifyContent: "space-between" } }, h(Text, { style: s.label }, labelEn), h(Text, { style: s.labelAr }, labelAr)),
    h(Text, { style: arabicValue ? s.valueAr : s.value }, value || "—")
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
        h(View, { style: s.header }, h(Text, { style: s.brand }, "MORACAT"), h(Text, { style: s.brandAr }, "مُراقط")),
        h(Text, { style: s.titleEn }, "Cat ID Certificate"),
        h(Text, { style: s.titleAr }, "شهادة هوية القط"),
        h(Text, { style: s.sub }, `Certificate ${input.number} · issued ${fmt(input.issuedAt, "en")}`),

        // Hero: the cat
        h(
          View,
          { style: s.hero },
          h(Text, { style: s.catName }, input.catName),
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
          h(View, { style: { flexDirection: "row", justifyContent: "space-between" } }, h(Text, { style: s.sectionTitle }, "Vaccination record"), h(Text, { style: s.sectionTitleAr }, "سجل التطعيمات")),
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
                  h(Text, { style: s.c1 }, v.name),
                  h(Text, { style: s.c2 }, fmt(v.administeredAt, "en")),
                  h(Text, { style: s.c3 }, fmt(v.dueAt, "en")),
                  h(Text, { style: [s.c4, v.verified ? s.verified : s.selfReported] }, v.verified ? (v.clinic?.en ?? "Partner clinic") : "Self-reported")
                )
              )
            : [h(Text, { style: [s.small, { paddingVertical: 8 }] }, "No vaccinations on record.")]),
          h(
            Text,
            { style: [s.small, { marginTop: 6 }] },
            `${verifiedCount} of ${input.vaccinations.length} entries were written by a licensed partner clinic. Self-reported entries were entered by the owner and are not verified by Moracat.`
          ),
          h(Text, { style: s.smallAr }, "الإدخالات الذاتية أدخلها المالك ولم تتحقق منها مُراقط.")
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
            h(Text, { style: [s.smallAr, { textAlign: "left" }] }, "امسح الرمز للتحقق من صحة الشهادة.")
          ),
          h(Image, { src: qr, style: s.qr })
        )
      )
    )
  );

  return renderToBuffer(doc as never);
}
