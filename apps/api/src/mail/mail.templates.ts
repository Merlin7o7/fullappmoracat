// ════════════════════════════════════════════════════════════════════════
//  Transactional email templates — bilingual (ar/en), rendered in the user's
//  locale, RTL-aware, inline-styled for email-client safety. Premium Moracat
//  brand: warm paper ground, deep-green chrome, orange accent, the real
//  wordmark. Every email carries a logo, a single clear action, a plain-text
//  fallback, and the brand promise. The cat is the hero.
// ════════════════════════════════════════════════════════════════════════

export type Locale = "ar" | "en";

export interface BuiltEmail {
  subject: string;
  html: string;
  text: string;
}

// Brand tokens — aligned to packages/ui/src/styles/globals.css (not approximations).
const BRAND = {
  paper: "#faf7f1", // warm paper ground
  card: "#ffffff",
  ink: "#14261f", // deep green-black
  muted: "#6f7a73",
  green: "#045b46", // primary chrome
  greenInk: "#f6f4ec", // cream text on green
  accent: "#f86c2f", // orange CTA
  accentInk: "#ffffff",
  hairline: "#ece5d8",
  chipBg: "#f2ede2",
};

// The registered establishment operating the Moracat brand, plus real contact
// channels — named in every email footer for trust and legal clarity.
const LEGAL_ENTITY = {
  ar: "مؤسسة عبدالرحمن منصور الغامدي التجارية",
  en: "Abdulrahman Mansour Alghamdi Trading Establishment",
};
const CONTACT = {
  phone: "+966551094814",
  phoneDisplay: "+966 55 109 4814",
  instagram: "@moracat.sa",
  instagramUrl: "https://instagram.com/moracat.sa",
};

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}
function logoUrl(): string {
  // Green wordmark served from the web app's /public — absolute URL for email.
  return `${siteUrl()}/brand/moracat-logo.png`;
}
function supportUrl(): string {
  return `${siteUrl()}/portal/support`;
}

interface LayoutInput {
  locale: Locale;
  preheader: string;
  heading: string;
  body: string[]; // paragraphs
  extra?: string; // raw HTML block rendered after the paragraphs (e.g. an OTP / chip)
  cta?: { label: string; url: string };
  footnote?: string;
}

/** Shared premium shell: logo header, green-accented card, button, footer. */
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
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:${BRAND.ink};text-align:${align};">${p}</p>`
    )
    .join("");

  const button = i.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;"><tr><td style="border-radius:12px;background:${BRAND.accent};box-shadow:0 2px 6px rgba(248,108,47,0.28);">
         <a href="${i.cta.url}" style="display:inline-block;padding:14px 30px;font-size:15px;font-weight:700;color:${BRAND.accentInk};text-decoration:none;border-radius:12px;">${i.cta.label}</a>
       </td></tr></table>
       <p style="margin:12px 0 0;font-size:12px;line-height:1.6;color:${BRAND.muted};text-align:${align};word-break:break-all;">${i.cta.url}</p>`
    : "";

  const foot = i.footnote
    ? `<p style="margin:18px 0 0;padding-top:16px;border-top:1px solid ${BRAND.hairline};font-size:12px;line-height:1.6;color:${BRAND.muted};text-align:${align};">${i.footnote}</p>`
    : "";

  const promise = rtl ? "مُرقّط — هوية قطك تبدأ من هنا." : "Moracat — where your cat's identity begins.";
  const help = rtl ? "تحتاج مساعدة؟" : "Need a hand?";
  const helpLink = rtl ? "الدعم" : "Contact support";
  const entity = rtl ? LEGAL_ENTITY.ar : LEGAL_ENTITY.en;
  const legalFoot = `<p style="margin:10px 0 0;font-size:11px;line-height:1.6;color:${BRAND.muted};">${entity}</p>
          <p style="margin:4px 0 0;font-size:11px;line-height:1.6;color:${BRAND.muted};" dir="ltr"><a href="tel:${CONTACT.phone}" style="color:${BRAND.muted};text-decoration:none;">${CONTACT.phoneDisplay}</a> · <a href="${CONTACT.instagramUrl}" style="color:${BRAND.muted};text-decoration:none;">${CONTACT.instagram}</a></p>`;

  return `<!doctype html><html dir="${dir}" lang="${i.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"></head>
<body style="margin:0;padding:0;background:${BRAND.paper};font-family:${font};-webkit-font-smoothing:antialiased;">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${i.preheader}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.paper};padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:524px;">
        <!-- Logo -->
        <tr><td style="padding:0 4px 20px;text-align:center;">
          <img src="${logoUrl()}" width="132" alt="Moracat" style="display:inline-block;height:auto;width:132px;border:0;outline:none;text-decoration:none;">
        </td></tr>
        <!-- Card with a green brand accent bar on top -->
        <tr><td style="height:4px;background:${BRAND.green};border-radius:20px 20px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
        <tr><td style="background:${BRAND.card};border:1px solid ${BRAND.hairline};border-top:0;border-radius:0 0 20px 20px;padding:34px 30px;">
          <h1 style="margin:0 0 18px;font-size:23px;line-height:1.3;font-weight:800;letter-spacing:-0.01em;color:${BRAND.ink};text-align:${align};">${i.heading}</h1>
          ${paragraphs}
          ${i.extra ?? ""}
          ${button}
          ${foot}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:22px 10px 0;text-align:center;">
          <p style="margin:0 0 6px;font-size:12px;color:${BRAND.muted};">${help} <a href="${supportUrl()}" style="color:${BRAND.green};text-decoration:none;font-weight:600;">${helpLink}</a></p>
          <p style="margin:0;font-size:12px;color:${BRAND.muted};">${promise}</p>
          ${legalFoot}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** A highlighted value chip (Cat ID number, order number) — used inside `extra`. */
function chip(label: string, value: string, align: "center" | "start" = "center"): string {
  const a = align === "center" ? "center" : "inherit";
  return `<div style="margin:6px 0 4px;text-align:${a};"><div style="display:inline-block;padding:12px 20px;border-radius:14px;background:${BRAND.chipBg};border:1px solid ${BRAND.hairline};">
      <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${BRAND.muted};margin-bottom:4px;">${label}</div>
      <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:22px;font-weight:700;letter-spacing:3px;color:${BRAND.green};">${value}</div>
    </div></div>`;
}

/** A simple label/value summary table (orders, receipts). */
function summary(rows: [string, string][], rtl: boolean): string {
  const align = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";
  const body = rows
    .map(
      ([k, v], idx) =>
        `<tr><td style="padding:9px 0;font-size:14px;color:${BRAND.muted};text-align:${align};${idx ? `border-top:1px solid ${BRAND.hairline};` : ""}">${k}</td>
         <td style="padding:9px 0;font-size:14px;font-weight:600;color:${BRAND.ink};text-align:${end};${idx ? `border-top:1px solid ${BRAND.hairline};` : ""}">${v}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border:1px solid ${BRAND.hairline};border-radius:14px;padding:6px 16px;background:${BRAND.paper};">${body}</table>`;
}

function toText(heading: string, body: string[], cta?: { label: string; url: string }, extraLines: string[] = []): string {
  const lines = [heading, "", ...body, ...extraLines];
  if (cta) lines.push("", `${cta.label}: ${cta.url}`);
  lines.push("", "— Moracat", `${LEGAL_ENTITY.en} · ${CONTACT.phoneDisplay} · ${CONTACT.instagram}`);
  return lines.join("\n");
}

const hiName = (ar: boolean, name: string | null) =>
  name ? (ar ? `أهلاً ${name}،` : `Hi ${name},`) : ar ? "أهلاً،" : "Hi there,";

// ── Auth & account ─────────────────────────────────────────────────────────

export function verifyEmailTemplate(locale: Locale, name: string | null, url: string): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "أكّد بريدك الإلكتروني" : "Confirm your email";
  const body = [
    hiName(ar, name),
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

export function otpEmailTemplate(locale: Locale, name: string | null, code: string): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "رمز تأكيد بريدك" : "Your verification code";
  const body = [
    hiName(ar, name),
    ar ? "استخدم هذا الرمز لتأكيد بريدك في مُرقّط. صالح لمدة ١٠ دقائق." : "Use this code to confirm your email on Moracat. It's valid for 10 minutes.",
  ];
  const codeBlock = `<div style="margin:14px 0 4px;text-align:center;"><span style="display:inline-block;padding:14px 22px;border-radius:14px;background:${BRAND.chipBg};border:1px solid ${BRAND.hairline};font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:${BRAND.green};">${code}</span></div>`;
  return {
    subject: ar ? `رمز التأكيد: ${code} — مُرقّط` : `Your code: ${code} — Moracat`,
    html: layout({ locale, preheader: `${heading}: ${code}`, heading, body, extra: codeBlock, footnote: ar ? "إذا لم تطلب ذلك، تجاهل هذه الرسالة." : "If you didn't request this, you can ignore this email." }),
    text: toText(heading, body, undefined, [code]),
  };
}

export function welcomeTemplate(locale: Locale, name: string | null): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "أهلاً بك في مُرقّط 🐾" : "Welcome to Moracat 🐾";
  const body = [
    name ? (ar ? `أهلاً ${name} 🐾` : `Welcome, ${name} 🐾`) : ar ? "أهلاً بك 🐾" : "Welcome 🐾",
    ar
      ? "سعداء بانضمامك. سجّل قطك، أنشئ هويته الرسمية، وشاركه مع مجتمع مُرقّط — كل قط يستاهل هوية تخصّه."
      : "We're glad you're here. Register your cat, issue their official Cat ID, and share it with the Moracat community — every cat deserves an identity of their own.",
  ];
  const cta = { label: ar ? "ابدأ بهوية قطك" : "Create your Cat ID", url: `${siteUrl()}/portal/cats` };
  return {
    subject: heading,
    html: layout({ locale, preheader: ar ? "هوية قطك تبدأ من هنا" : "Your cat's identity starts here", heading, body, cta }),
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

export function passwordChangedTemplate(locale: Locale, name: string | null): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "تم تغيير كلمة المرور" : "Your password was changed";
  const body = [
    hiName(ar, name),
    ar
      ? "نأكّد أنه تم تغيير كلمة مرور حسابك في مُرقّط للتو. إذا كنت أنت من قام بذلك، فلا حاجة لأي إجراء."
      : "We're confirming that your Moracat password was just changed. If this was you, there's nothing else to do.",
  ];
  return {
    subject: ar ? "تم تغيير كلمة المرور — مُرقّط" : "Your password was changed — Moracat",
    html: layout({ locale, preheader: heading, heading, body, footnote: ar ? "إذا لم تكن أنت، غيّر كلمة مرورك فوراً وتواصل مع الدعم." : "If this wasn't you, reset your password immediately and contact support." }),
    text: toText(heading, body),
  };
}

export function twoFactorDisabledTemplate(locale: Locale, name?: string | null): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "تم تعطيل التحقق بخطوتين" : "Two-factor authentication was turned off";
  const body = [
    hiName(ar, name ?? null),
    ar
      ? "نأكّد أنه تم تعطيل التحقق بخطوتين على حسابك في مُرقّط للتو. إذا كنت أنت من قام بذلك، فلا حاجة لأي إجراء."
      : "We're confirming that two-factor authentication was just turned off on your Moracat account. If this was you, there's nothing else to do.",
  ];
  return {
    subject: ar ? "تم تعطيل التحقق بخطوتين — مُرقّط" : "Two-factor authentication turned off — Moracat",
    html: layout({
      locale,
      preheader: heading,
      heading,
      body,
      footnote: ar
        ? "إذا لم تكن أنت، غيّر كلمة مرورك فوراً وأعد تفعيل التحقق بخطوتين، وتواصل مع الدعم."
        : "If this wasn't you, reset your password, re-enable two-factor authentication, and contact support immediately.",
    }),
    text: toText(heading, body),
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

// ── The cat ────────────────────────────────────────────────────────────────

export function catIdIssuedTemplate(locale: Locale, catName: string, catIdNumber: string): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? `هوية ${catName} جاهزة 🎉` : `${catName}'s Cat ID is ready 🎉`;
  const body = [
    ar
      ? `مبروك — أصبح لـ${catName} هوية رسمية موثّقة في مُرقّط. احتفظ بها، اطبعها، أو أضفها إلى محفظتك، وشاركها متى ما أردت.`
      : `Congratulations — ${catName} now has an official, verified identity on Moracat. Keep it, print it, add it to your wallet, and share it whenever you like.`,
  ];
  const cta = { label: ar ? "افتح هوية القط" : "Open the Cat ID", url: `${siteUrl()}/portal/cats` };
  return {
    subject: heading,
    html: layout({ locale, preheader: ar ? `رقم الهوية ${catIdNumber}` : `Cat ID ${catIdNumber}`, heading, body, extra: chip(ar ? "رقم الهوية" : "Cat ID", catIdNumber), cta }),
    text: toText(heading, body, cta, [`${ar ? "رقم الهوية" : "Cat ID"}: ${catIdNumber}`]),
  };
}

// ── Waitlist ─────────────────────────────────────────────────────────────────

export function waitlistJoinedTemplate(locale: Locale, name: string | null): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "أنت على قائمة الإطلاق 🎉" : "You're on the launch list 🎉";
  const body = [
    hiName(ar, name),
    ar
      ? "سجّلناك ضمن أعضاء التأسيس. سنراسلك أول ما تُفتح العضويات، وستكون من أوائل من يحصل عليها. لا حاجة لأي إجراء الآن."
      : "You're in as a founding member. We'll email you the moment memberships open, and you'll be among the first to get in. Nothing to do for now.",
  ];
  const cta = { label: ar ? "عد إلى حسابك" : "Back to your account", url: `${siteUrl()}/portal` };
  return {
    subject: ar ? "أنت على قائمة الإطلاق — مُرقّط" : "You're on the launch list — Moracat",
    html: layout({ locale, preheader: heading, heading, body, cta }),
    text: toText(heading, body, cta),
  };
}

// ── Support ──────────────────────────────────────────────────────────────────

export function supportTicketOpenedTemplate(locale: Locale, name: string | null, ticketNumber: string, subject: string): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "استلمنا رسالتك" : "We've got your message";
  const body = [
    hiName(ar, name),
    ar
      ? `فتحنا لك تذكرة دعم بخصوص «${subject}». فريقنا يطّلع عليها، وعادة نرد خلال ساعات العمل نفسها.`
      : `We've opened a support ticket about "${subject}". Our team is on it — we usually reply within the same business hours.`,
  ];
  const cta = { label: ar ? "عرض التذكرة" : "View your ticket", url: supportUrl() };
  return {
    subject: ar ? `تذكرتك ${ticketNumber} — مُرقّط` : `Your ticket ${ticketNumber} — Moracat`,
    html: layout({ locale, preheader: heading, heading, body, extra: chip(ar ? "رقم التذكرة" : "Ticket", ticketNumber), cta }),
    text: toText(heading, body, cta, [`${ar ? "رقم التذكرة" : "Ticket"}: ${ticketNumber}`]),
  };
}

export function supportReplyTemplate(locale: Locale, name: string | null, ticketNumber: string): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "لديك رد جديد من الدعم" : "You have a reply from support";
  const body = [
    hiName(ar, name),
    ar
      ? `ردّ فريق مُرقّط على تذكرتك ${ticketNumber}. افتح المحادثة للاطّلاع والرد.`
      : `The Moracat team replied to your ticket ${ticketNumber}. Open the conversation to read it and reply.`,
  ];
  const cta = { label: ar ? "قراءة الرد" : "Read the reply", url: supportUrl() };
  return {
    subject: ar ? `رد جديد على تذكرتك ${ticketNumber} — مُرقّط` : `New reply on ticket ${ticketNumber} — Moracat`,
    html: layout({ locale, preheader: heading, heading, body, cta }),
    text: toText(heading, body, cta),
  };
}

// ── Commerce (fire when COMMERCE_ENABLED; templates ready for launch) ─────────

const sar = (n: number, ar: boolean) => `${n.toFixed(2)} ${ar ? "ر.س" : "SAR"}`;

export function orderConfirmationTemplate(
  locale: Locale, name: string | null, orderNumber: string, total: number, items: { name: string; qty: number }[]
): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "تأكيد طلبك ✅" : "Your order is confirmed ✅";
  const body = [
    hiName(ar, name),
    ar ? `استلمنا طلبك وجارٍ تجهيزه. إليك ملخّصه.` : `We've received your order and it's being prepared. Here's the summary.`,
  ];
  const rows: [string, string][] = [
    ...items.map((it) => [`${it.name} ×${it.qty}`, ""] as [string, string]),
    [ar ? "الإجمالي (شامل الضريبة)" : "Total (VAT incl.)", sar(total, ar)],
  ];
  const cta = { label: ar ? "تتبّع طلبك" : "Track your order", url: `${siteUrl()}/portal/orders` };
  return {
    subject: ar ? `تأكيد الطلب ${orderNumber} — مُرقّط` : `Order ${orderNumber} confirmed — Moracat`,
    html: layout({ locale, preheader: heading, heading, body, extra: chip(ar ? "رقم الطلب" : "Order", orderNumber) + summary(rows, ar), cta }),
    text: toText(heading, body, cta, [`${ar ? "رقم الطلب" : "Order"}: ${orderNumber}`, ...items.map((it) => `- ${it.name} ×${it.qty}`), `${ar ? "الإجمالي" : "Total"}: ${sar(total, ar)}`]),
  };
}

export function paymentReceiptTemplate(
  locale: Locale, name: string | null, orderNumber: string, total: number, tax: number, method: string
): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "إيصال الدفع" : "Your payment receipt";
  const body = [hiName(ar, name), ar ? "تم استلام دفعتك بنجاح. هذا إيصالك." : "Your payment was received successfully. Here's your receipt."];
  const net = total - tax;
  const rows: [string, string][] = [
    [ar ? "المبلغ قبل الضريبة" : "Subtotal", sar(net, ar)],
    [ar ? "ضريبة القيمة المضافة (١٥٪)" : "VAT (15%)", sar(tax, ar)],
    [ar ? "الإجمالي المدفوع" : "Total paid", sar(total, ar)],
    [ar ? "طريقة الدفع" : "Payment method", method],
  ];
  return {
    subject: ar ? `إيصال الطلب ${orderNumber} — مُرقّط` : `Receipt for order ${orderNumber} — Moracat`,
    html: layout({ locale, preheader: heading, heading, body, extra: chip(ar ? "رقم الطلب" : "Order", orderNumber) + summary(rows, ar) }),
    text: toText(heading, body, undefined, rows.map(([k, v]) => `${k}: ${v}`)),
  };
}

export function paymentFailedTemplate(locale: Locale, name: string | null, retryUrl: string): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "تعذّر إتمام الدفع" : "We couldn't complete your payment";
  const body = [
    hiName(ar, name),
    ar
      ? "لم تكتمل عملية الدفع الأخيرة. لا تقلق — لم يُخصم أي مبلغ. جرّب مرة ثانية متى ما ناسبك."
      : "Your last payment didn't go through. Don't worry — nothing was charged. You can try again whenever suits you.",
  ];
  const cta = { label: ar ? "إعادة المحاولة" : "Try again", url: retryUrl };
  return {
    subject: ar ? "تعذّر إتمام الدفع — مُرقّط" : "Payment couldn't be completed — Moracat",
    html: layout({ locale, preheader: heading, heading, body, cta, footnote: ar ? "إن استمرت المشكلة، تواصل معنا وسنساعدك." : "If the problem continues, contact us and we'll help." }),
    text: toText(heading, body, cta),
  };
}

export function subscriptionConfirmedTemplate(locale: Locale, name: string | null, planName: string, nextChargeAt: string): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "عضويتك مفعّلة 🎉" : "Your membership is active 🎉";
  const body = [
    hiName(ar, name),
    ar
      ? `أهلاً بك في باقة «${planName}». عضويتك مفعّلة الآن، وهوية قطك أصبحت مفعّلة بكامل مزايا الأعضاء.`
      : `Welcome to the ${planName} plan. Your membership is now active, and your Cat ID is live with full member benefits.`,
  ];
  const rows: [string, string][] = [
    [ar ? "الباقة" : "Plan", planName],
    [ar ? "التجديد القادم" : "Next renewal", nextChargeAt],
  ];
  const cta = { label: ar ? "إدارة العضوية" : "Manage membership", url: `${siteUrl()}/portal/subscriptions` };
  return {
    subject: ar ? "عضويتك مفعّلة — مُرقّط" : "Your membership is active — Moracat",
    html: layout({ locale, preheader: heading, heading, body, extra: summary(rows, ar), cta }),
    text: toText(heading, body, cta, rows.map(([k, v]) => `${k}: ${v}`)),
  };
}

export function subscriptionRenewalTemplate(locale: Locale, name: string | null, planName: string, amount: number, chargeAt: string): BuiltEmail {
  const ar = locale === "ar";
  const heading = ar ? "تذكير بتجديد عضويتك" : "Your membership renews soon";
  const body = [
    hiName(ar, name),
    ar
      ? `نذكّرك أن باقة «${planName}» ستتجدّد بتاريخ ${chargeAt} بمبلغ ${sar(amount, ar)}. لا حاجة لأي إجراء إذا رغبت بالاستمرار.`
      : `A friendly heads-up: your ${planName} plan renews on ${chargeAt} for ${sar(amount, ar)}. No action needed if you'd like to continue.`,
  ];
  const cta = { label: ar ? "إدارة أو إيقاف مؤقت" : "Manage or pause", url: `${siteUrl()}/portal/subscriptions` };
  return {
    subject: ar ? "تذكير بتجديد عضويتك — مُرقّط" : "Your membership renews soon — Moracat",
    html: layout({ locale, preheader: heading, heading, body, cta, footnote: ar ? "يمكنك الإيقاف المؤقت أو الإلغاء في أي وقت قبل التجديد." : "You can pause or cancel anytime before it renews." }),
    text: toText(heading, body, cta),
  };
}
