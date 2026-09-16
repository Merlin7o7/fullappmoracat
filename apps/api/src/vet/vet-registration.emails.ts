/**
 * Clinic registration emails — MRC-VET-002.
 *
 * Every status change is an email ("silence is the trust-killer", MRC-VET-001
 * §01). Bilingual in one message, Arabic first (R101), inline-styled for
 * email-client safety, at most one action. Same visual language as the staff
 * invitation in vet-staff.service.ts.
 */

const BRAND = {
  paper: "#faf7f1",
  card: "#ffffff",
  ink: "#14261f",
  muted: "#5c665f",
  green: "#045b46",
  greenInk: "#f6f4ec",
  accent: "#f86c2f",
  accentInk: "#14261f",
  hairline: "#ece5d8",
  noteBg: "#f2ede2",
};

export interface VetNotice {
  subjectAr: string;
  subjectEn: string;
  headingAr: string;
  headingEn: string;
  bodyAr: string[];
  bodyEn: string[];
  /** A quoted block (e.g. the reviewer's note), shown verbatim in both halves. */
  quote?: string | null;
  cta?: { labelAr: string; labelEn: string; url: string } | null;
  footnoteAr?: string;
  footnoteEn?: string;
}

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildVetNoticeEmail(n: VetNotice): { subject: string; html: string; text: string } {
  const subject = `${n.subjectAr} · ${n.subjectEn}`;
  const para = (lines: string[]) =>
    lines
      .map((l) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.75;color:${BRAND.muted};">${escapeHtml(l)}</p>`)
      .join("");
  const quote = (dir: "rtl" | "ltr") =>
    n.quote
      ? `<div dir="auto" style="margin:4px 0 14px;padding:12px 14px;background:${BRAND.noteBg};border-radius:12px;color:${BRAND.ink};font-size:14px;line-height:1.7;white-space:pre-wrap;text-align:${dir === "rtl" ? "right" : "left"};">${escapeHtml(n.quote)}</div>`
      : "";
  const cta = n.cta
    ? `<tr><td align="center" style="padding:12px 28px 18px;">
          <a href="${escapeHtml(n.cta.url)}" style="display:inline-block;background:${BRAND.accent};color:${BRAND.accentInk};text-decoration:none;font-weight:700;font-size:16px;padding:14px 30px;border-radius:12px;">
            ${escapeHtml(n.cta.labelAr)} · ${escapeHtml(n.cta.labelEn)}
          </a>
        </td></tr>`
    : "";

  const html = `<!doctype html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.paper};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${BRAND.card};border:1px solid ${BRAND.hairline};border-radius:18px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;">
        <tr><td style="background:${BRAND.green};padding:22px 28px;color:${BRAND.greenInk};font-size:15px;font-weight:600;letter-spacing:.02em;">
          مرقط · Moracat — بوابة العيادات · Partner portal
        </td></tr>
        <tr><td dir="rtl" align="right" style="padding:28px 28px 4px;color:${BRAND.ink};">
          <h1 style="margin:0 0 12px;font-size:21px;line-height:1.4;font-weight:700;">${escapeHtml(n.headingAr)}</h1>
          ${para(n.bodyAr)}
          ${quote("rtl")}
        </td></tr>
        ${cta}
        <tr><td style="padding:0 28px;"><div style="height:1px;background:${BRAND.hairline};"></div></td></tr>
        <tr><td dir="ltr" align="left" style="padding:22px 28px 4px;color:${BRAND.ink};">
          <h2 style="margin:0 0 12px;font-size:18px;line-height:1.4;font-weight:700;">${escapeHtml(n.headingEn)}</h2>
          ${para(n.bodyEn)}
          ${n.cta ? `<p style="margin:0 0 6px;font-size:13px;line-height:1.7;color:${BRAND.muted};">If the button doesn't work, paste this link into your browser:<br /><a href="${escapeHtml(n.cta.url)}" style="color:${BRAND.green};word-break:break-all;">${escapeHtml(n.cta.url)}</a></p>` : ""}
        </td></tr>
        ${
          n.footnoteAr || n.footnoteEn
            ? `<tr><td style="padding:12px 28px 26px;"><p style="margin:0;font-size:12px;line-height:1.7;color:${BRAND.muted};">${escapeHtml(n.footnoteAr ?? "")}<br />${escapeHtml(n.footnoteEn ?? "")}</p></td></tr>`
            : `<tr><td style="padding:0 0 18px;"></td></tr>`
        }
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    n.headingAr,
    ...n.bodyAr,
    ...(n.quote ? ["", n.quote, ""] : []),
    ...(n.cta ? [`${n.cta.labelAr}: ${n.cta.url}`] : []),
    "",
    "———",
    "",
    n.headingEn,
    ...n.bodyEn,
    ...(n.cta ? [`${n.cta.labelEn}: ${n.cta.url}`] : []),
    ...(n.footnoteAr || n.footnoteEn ? ["", n.footnoteAr ?? "", n.footnoteEn ?? ""] : []),
  ].join("\n");

  return { subject, html, text };
}
