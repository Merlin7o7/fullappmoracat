// ════════════════════════════════════════════════════════════════════════
//  Transactional email templates — bilingual (ar/en), rendered in the user's
//  locale, RTL-aware, inline-styled for email-client safety. On-brand: warm
//  paper, orange accent, Moracat wordmark. The cat is the hero everywhere.
// ════════════════════════════════════════════════════════════════════════

export type Locale = "ar" | "en";

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

const BRAND = {
  paper: "#FBF7F0",
  card: "#FFFFFF",
  ink: "#2A2320",
  muted: "#8A7F76",
  accent: "#E8632A",
  accentInk: "#FFFFFF",
  hairline: "#EFE7DB",
};

interface LayoutInput {
  locale: Locale;
  preheader: string;
  heading: string;
  body: string[]; // paragraphs
  cta?: { label: string; url: string };
  footnote?: string;
}

/** Shared shell: header wordmark, card, optional button, footer. */
function layout(i: LayoutInput): string {
  const rtl = i.locale === "ar";
  const dir = rtl ? "rtl" : "ltr";
  const align = rtl ? "right" : "left";
  const font = rtl
    ? "'Segoe UI', Tahoma, Arial, sans-serif"
    : "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif";

  const paragraphs = i.body
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${BRAND.ink};text-align:${align};">${p}</p>`
    )
    .join("");

  const button = i.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;"><tr><td style="border-radius:12px;background:${BRAND.accent};">
         <a href="${i.cta.url}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:600;color:${BRAND.accentInk};text-decoration:none;border-radius:12px;">${i.cta.label}</a>
       </td></tr></table>
       <p style="margin:14px 0 0;font-size:12px;line-height:1.6;color:${BRAND.muted};text-align:${align};word-break:break-all;">${i.cta.url}</p>`
    : "";

  const foot = i.footnote
    ? `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${BRAND.muted};text-align:${align};">${i.footnote}</p>`
    : "";

  const footer = rtl
    ? "مُرقّط — هوية قطك تبدأ من هنا."
    : "Moracat — where your cat's identity begins.";

  return `<!doctype html><html dir="${dir}" lang="${i.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${BRAND.paper};font-family:${font};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${i.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="padding:4px 6px 18px;text-align:${align};">
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${BRAND.ink};">Mora<span style="color:${BRAND.accent};">cat</span></span>
        </td></tr>
        <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.hairline};border-radius:20px;padding:30px 28px;">
          <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;font-weight:700;color:${BRAND.ink};text-align:${align};">${i.heading}</h1>
          ${paragraphs}
          ${button}
          ${foot}
        </td></tr>
        <tr><td style="padding:18px 6px 0;text-align:${align};">
          <p style="margin:0;font-size:12px;color:${BRAND.muted};">${footer}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function toText(heading: string, body: string[], cta?: { label: string; url: string }): string {
  const lines = [heading, "", ...body];
  if (cta) lines.push("", `${cta.label}: ${cta.url}`);
  lines.push("", "— Moracat");
  return lines.join("\n");
}

// ── Templates ─────────────────────────────────────────────────────────────

export function verifyEmailTemplate(locale: Locale, name: string | null, url: string): BuiltEmail {
  const ar = locale === "ar";
  const hi = name ? (ar ? `أهلاً ${name}،` : `Hi ${name},`) : ar ? "أهلاً بك،" : "Hi there,";
  const heading = ar ? "أكّد بريدك الإلكتروني" : "Confirm your email";
  const body = [
    hi,
    ar
      ? "خطوة أخيرة صغيرة لتأمين حسابك في مُرقّط — أكّد بريدك بالضغط على الزر أدناه. الرابط صالح لمدة ٢٤ ساعة."
      : "One small step to secure your Moracat account — confirm your email using the button below. This link is valid for 24 hours.",
  ];
  const cta = { label: ar ? "تأكيد البريد" : "Confirm email", url };
  return {
    subject: ar ? "أكّد بريدك — مُرقّط" : "Confirm your email — Moracat",
    html: layout({ locale, preheader: heading, heading, body, cta, footnote: ar ? "إذا لم تنشئ هذا الحساب، تجاهل هذه الرسالة." : "If you didn't create this account, you can safely ignore this email." }),
    text: toText(heading, body, cta),
  };
}

export function welcomeTemplate(locale: Locale, name: string | null): BuiltEmail {
  const ar = locale === "ar";
  const hi = name ? (ar ? `أهلاً ${name} 🐾` : `Welcome, ${name} 🐾`) : ar ? "أهلاً بك 🐾" : "Welcome 🐾";
  const heading = ar ? "أهلاً بك في مُرقّط" : "Welcome to Moracat";
  const body = [
    hi,
    ar
      ? "سعداء بانضمامك. سجّل قطك، أنشئ هوية القط الخاصة به، وشاركها مع مجتمع مُرقّط. العضويات والمزايا قادمة قريباً — وسنخبرك أول ما تُفتح."
      : "We're glad you're here. Register your cat, create their Cat ID, and share it with the Moracat community. Memberships and perks are coming soon — we'll tell you the moment they open.",
  ];
  const cta = { label: ar ? "ابدأ بهوية قطك" : "Create your Cat ID", url: `${siteUrl()}/portal/cats` };
  return {
    subject: ar ? "أهلاً بك في مُرقّط 🐾" : "Welcome to Moracat 🐾",
    html: layout({ locale, preheader: heading, heading, body, cta }),
    text: toText(heading, body, cta),
  };
}

export function passwordResetTemplate(locale: Locale, url: string): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "إعادة تعيين كلمة المرور" : "Reset your password";
  const body = [
    ar
      ? "طلبت إعادة تعيين كلمة المرور لحسابك في مُرقّط. اضغط الزر أدناه لاختيار كلمة مرور جديدة. الرابط صالح لمدة ساعة واحدة."
      : "You asked to reset your Moracat password. Use the button below to choose a new one. This link is valid for one hour.",
  ];
  const cta = { label: ar ? "إعادة تعيين كلمة المرور" : "Reset password", url };
  return {
    subject: ar ? "إعادة تعيين كلمة المرور — مُرقّط" : "Reset your password — Moracat",
    html: layout({ locale, preheader: heading, heading, body, cta, footnote: ar ? "إذا لم تطلب ذلك، تجاهل هذه الرسالة وستبقى كلمة مرورك كما هي." : "If you didn't request this, ignore this email and your password stays unchanged." }),
    text: toText(heading, body, cta),
  };
}

export function emailChangeTemplate(locale: Locale, url: string): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "أكّد بريدك الجديد" : "Confirm your new email";
  const body = [
    ar
      ? "طلبت تغيير البريد الإلكتروني لحسابك في مُرقّط إلى هذا العنوان. أكّد للمتابعة. الرابط صالح لمدة ٢٤ ساعة."
      : "You requested to change your Moracat account email to this address. Confirm to continue. This link is valid for 24 hours.",
  ];
  const cta = { label: ar ? "تأكيد البريد الجديد" : "Confirm new email", url };
  return {
    subject: ar ? "أكّد بريدك الجديد — مُرقّط" : "Confirm your new email — Moracat",
    html: layout({ locale, preheader: heading, heading, body, cta, footnote: ar ? "إذا لم تطلب ذلك، تجاهل هذه الرسالة." : "If you didn't request this, you can safely ignore this email." }),
    text: toText(heading, body, cta),
  };
}

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}
