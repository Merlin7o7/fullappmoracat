/**
 * Bilingual catalogue for in-app notifications. Text is built here at write
 * time for BOTH languages and stored on the row (`data.i18n`), so the portal
 * feed renders in the member's current locale (Arabic-default, R101) without
 * the web needing per-type code — and older rows still fall back to the stored
 * `title`/`body`. Add a case here and every surface localizes automatically.
 */
import { catPossessive, catPronoun, catVerb, countLabel, formatNumber } from "@moraqat/core";

export type NotificationType =
  | "password_reset_requested"
  | "password_changed"
  | "cat_id_issued"
  | "cat_made_public"
  | "cat_first_like"
  | "cat_like_milestone"
  | "cat_hidden"
  | "cat_featured"
  | "support_replied"
  | "support_resolved"
  | "order_confirmed"
  | "order_pending"
  | "order_refunded"
  | "payment_received"
  | "payment_failed"
  // lifecycle engine — the machinery that keeps the "we never charge silently"
  // promise and turns stored dates into acts of care (R025/R049/R064).
  | "term_ending"
  | "renewal_upcoming"
  | "membership_renewed"
  | "renewal_final_notice"
  | "renewal_payment_failed"
  | "membership_lapsed"
  | "vaccination_due"
  | "cat_found_report"
  | "cat_birthday"
  | "member_anniversary"
  | "refund_requested"
  | "refund_requested_staff"
  // ── The cat's life beyond one household (2026-09-20) ────────────────────
  // Rehoming, the hand-over of the Cat ID, and the reunion board.
  | "ownership_transfer_offered"
  | "ownership_transfer_cancelled"
  | "ownership_transfer_declined"
  | "ownership_transfer_completed_from"
  | "ownership_transfer_completed_to"
  | "adoption_request_received"
  | "adoption_request_accepted"
  | "adoption_request_declined"
  | "lost_found_message"
  | "lost_found_possible_match"
  // Moderation on the new public boards. A hidden post is never a silent
  // disappearance — the person who wrote it hears what happened, and why.
  | "listing_hidden"
  // Ops: a clinic is waiting for a human (registration submitted, go-live
  // requested). Written to staff accounts so it is never only an email.
  | "partner_needs_review"
  // A prepaid box (2…N of a term) is being packed.
  | "box_scheduled"
  // The care engine (W9): a routine/owner task is due, anything overdue, and
  // the weekly digest's in-app twin.
  | "care_due"
  | "care_overdue"
  | "weekly_digest";

export type NotificationParams = Record<string, string | number>;

export interface LocalizedText {
  title: string;
  body: string;
}
export interface NotificationText {
  ar: LocalizedText;
  en: LocalizedText;
}

const p = (params: NotificationParams, key: string) => String(params[key] ?? "");

/*
 * Grammar (MRC-UX audit 2026-10-04, Part 08). Callers that know the cat's
 * gender pass `params.gender` ("MALE" | "FEMALE" | "UNKNOWN"); without it the
 * copy falls back to neutral phrasing around the cat's name — never a silent
 * masculine. Lexicon (R087): «عضو» = has a Cat ID; the paid product is
 * «خطة العناية» — never «عضوية» / «اشتراك» / «باقة». No emoji in titles.
 */
const LIKE_FORMS = {
  ar: { one: "إعجاب واحد", two: "إعجابين", few: "إعجابات", many: "إعجاباً" },
  en: { one: "like", other: "likes" },
};
/** «100 إعجاب» — round hundreds and thousands take the singular, not «إعجاباً». */
function likesLabel(n: number, locale: "ar" | "en"): string {
  if (locale === "ar" && n >= 100 && n % 100 === 0) return `${formatNumber(n, "ar")} إعجاب`;
  return countLabel(n, locale, LIKE_FORMS);
}
const YEAR_FORMS = {
  ar: { one: "سنة", two: "سنتين", few: "سنوات", many: "سنة" },
  en: { one: "year", other: "years" },
};
const yearsLabel = (n: number, locale: "ar" | "en") => countLabel(n, locale, YEAR_FORMS);

export function buildNotificationText(
  type: NotificationType,
  params: NotificationParams = {}
): NotificationText {
  const name = p(params, "name");
  const gender = params.gender;
  /** «رقمه» / «رقمها» / «رقم لولو». */
  const his = (noun: string) => catPossessive(noun, gender, name);
  const their = catPronoun(gender, "en", { case: "possessive" });
  const Their = their.charAt(0).toUpperCase() + their.slice(1);
  const them = catPronoun(gender, "en", { case: "object" });
  switch (type) {
    case "password_reset_requested":
      return {
        ar: {
          title: "طلب إعادة تعيين كلمة المرور",
          body: "طلبت إعادة تعيين كلمة المرور. الرابط صالح لمدة ساعة.",
        },
        en: {
          title: "Password reset requested",
          body: "You requested a password reset. The link is valid for one hour.",
        },
      };
    case "password_changed":
      return {
        ar: {
          title: "تم تغيير كلمة المرور",
          body: "تم تحديث كلمة مرور حسابك. إذا لم تكن أنت، تواصل معنا فوراً.",
        },
        en: {
          title: "Password changed",
          body: "Your account password was updated. If this wasn't you, contact us immediately.",
        },
      };
    case "cat_id_issued": {
      // The register is Moracat's own — a private company's archive, never an
      // official one (AD 2.1 framing, R006).
      const id = p(params, "catIdNumber");
      return {
        ar: {
          title: `هوية ${name} جاهزة`,
          body: catVerb(gender, {
            m: `${name} صار له رقمه في سجل مرقط: ${id}. افتح هويته.`,
            f: `${name} صار لها رقمها في سجل مرقط: ${id}. افتح هويتها.`,
            n: `صار لـ${name} رقم في سجل مرقط: ${id}. افتح الهوية.`,
          }),
        },
        en: {
          title: `${name}'s Cat ID is ready`,
          body: `${name} now has ${their} own number in the Moracat register: ${id}. Open ${their} Cat ID.`,
        },
      };
    }
    case "cat_made_public":
      // The opt-out receipt (amendment 2026-08-14): say what is shown, what is
      // not, that a photo is required, and where the off switch is.
      return {
        ar: {
          title: catVerb(gender, {
            m: `${name} صار في مجتمع مرقط`,
            f: `${name} صارت في مجتمع مرقط`,
            n: `ملف ${name} صار في مجتمع مرقط`,
          }),
          body: catVerb(gender, {
            m: "يظهر في المجتمع متى ما كانت له صورة — واسمك ومدينتك ما يظهرون إلا إذا اخترت. تخفيه بضغطة من ملفه متى ما تبي.",
            f: "تظهر في المجتمع متى ما كانت لها صورة — واسمك ومدينتك ما يظهرون إلا إذا اخترت. تخفيها بضغطة من ملفها متى ما تبي.",
            n: `ملف ${name} يظهر في المجتمع متى ما كانت فيه صورة — واسمك ومدينتك ما يظهرون إلا إذا اخترت. تخفيه بضغطة من الملف متى ما تبي.`,
          }),
        },
        en: {
          title: `${name} is in the Moracat community`,
          body: `${Their} profile shows in the community once it has a photo — your name and city only show if you choose. One tap on ${their} profile hides ${them} again.`,
        },
      };
    case "cat_first_like":
      return {
        ar: {
          title: `أول إعجاب لـ${name}`,
          body: `أحد أهل القطط حبّ ${name} في المجتمع.`,
        },
        en: {
          title: `${name}'s first like`,
          body: `Someone loved ${name} in the community.`,
        },
      };
    case "cat_like_milestone": {
      const likes = Number(params.likeCount) || 0;
      return {
        ar: {
          title: `${likesLabel(likes, "ar")} لـ${name}`,
          body: catVerb(gender, {
            m: `${name} محبوب في المجتمع.`,
            f: `${name} محبوبة في المجتمع.`,
            n: `أهل المجتمع يحبّون ${name}.`,
          }),
        },
        en: {
          title: `${name} reached ${likesLabel(likes, "en")}`,
          body: `${name} is being loved in the community.`,
        },
      };
    }
    case "cat_hidden":
      return {
        ar: {
          title: `تم إخفاء ${p(params, "name")} من المجتمع`,
          body: params.reason
            ? `أخفى أحد المشرفين هذا الملف العام. السبب: ${p(params, "reason")}. تواصل مع الدعم لأي استفسار.`
            : "أخفى أحد المشرفين هذا الملف العام. تواصل مع الدعم لأي استفسار.",
        },
        en: {
          title: `${p(params, "name")} was hidden from the community`,
          body: params.reason
            ? `A moderator hid this public profile. Reason: ${p(params, "reason")}. Contact support if you have questions.`
            : "A moderator hid this public profile. Contact support if you have questions.",
        },
      };
    case "cat_featured":
      return {
        ar: {
          title: catVerb(gender, {
            m: `${name} مميّز في المجتمع`,
            f: `${name} مميّزة في المجتمع`,
            n: `${name} في واجهة المجتمع`,
          }),
          body: `اختار أحد المشرفين ${name} لواجهة المجتمع.`,
        },
        en: {
          title: `${name} is featured`,
          body: `A moderator featured ${name} at the front of the community.`,
        },
      };
    case "support_replied":
      return {
        ar: {
          title: "رد الدعم على تذكرتك",
          body: `${p(params, "ticketNumber")}: ${p(params, "subject")}`,
        },
        en: {
          title: "Support replied to your ticket",
          body: `${p(params, "ticketNumber")}: ${p(params, "subject")}`,
        },
      };
    case "support_resolved":
      return {
        ar: {
          title: "تم حل تذكرتك",
          body: `${p(params, "ticketNumber")}: ${p(params, "subject")}`,
        },
        en: {
          title: "Your ticket was resolved",
          body: `${p(params, "ticketNumber")}: ${p(params, "subject")}`,
        },
      };
    case "order_confirmed":
      return {
        ar: {
          title: "تم تأكيد الطلب",
          body: `${p(params, "orderNumber")} — ${p(params, "total")} ${p(params, "currency")}. نجهّز صندوقك!`,
        },
        en: {
          title: "Order confirmed",
          body: `${p(params, "orderNumber")} — ${p(params, "total")} ${p(params, "currency")}. We're preparing your box!`,
        },
      };
    case "renewal_upcoming":
      return {
        ar: {
          title: `تجديد خطة عناية ${name} قريب`,
          body: `خطة عناية ${name} تنتهي في ${p(params, "endsAt")}، ونجدّدها تلقائياً بمبلغ ${p(params, "total")} ${p(params, "currency")}. ما تبي التجديد؟ أوقفه بضغطة وحدة قبل التاريخ.`,
        },
        en: {
          title: `${name}'s care plan renews soon`,
          body: `${name}'s care plan ends ${p(params, "endsAt")}, and we'll renew it automatically for ${p(params, "total")} ${p(params, "currency")}. Don't want it? Stop it in one tap before then.`,
        },
      };
    case "membership_renewed":
      return {
        ar: {
          title: `تجدّدت خطة عناية ${name}`,
          body: `جدّدنا خطة عناية ${name} — ${p(params, "total")} ${p(params, "currency")}. مدفوعة حتى ${p(params, "endsAt")}، وتقدر توقفها في أي وقت.`,
        },
        en: {
          title: `${name}'s care plan renewed`,
          body: `We renewed ${name}'s care plan — ${p(params, "total")} ${p(params, "currency")}. Paid through ${p(params, "endsAt")}, and you can stop it any time.`,
        },
      };
    case "renewal_payment_failed":
      return {
        ar: {
          title: "ما نجح تجديد خطة العناية",
          body: `ما قدرنا نكمل تجديد خطة عناية ${name} على البطاقة المنتهية بـ ${p(params, "last4")}. هوية ${name} و${his("سجل")} ما زالت معك — حدّث طريقة الدفع ونكمل.`,
        },
        en: {
          title: "We couldn't renew the care plan",
          body: `The renewal for ${name} didn't go through on the card ending ${p(params, "last4")}. ${name}'s ID and record are still yours — update your payment method and we'll finish it.`,
        },
      };
    case "renewal_final_notice":
      // The last rung of the dunning ladder (T7): benefits stay on through the
      // grace week, the record is never taken away, the fix is one tap (R068).
      return {
        ar: {
          title: `آخر محاولة لتجديد خطة عناية ${name}`,
          body: `حاولنا ثلاث مرات ولم تنجح الدفعة على البطاقة المنتهية بـ ${p(params, "last4")}. خطة عناية ${name} مستمرة حتى ${p(params, "graceUntil")} — حدّث البطاقة قبلها ونكمل من حيث توقفنا. ${his("سجل")} و${his("هوية")} معك في كل الأحوال.`,
        },
        en: {
          title: `Last try renewing ${name}'s care plan`,
          body: `We tried three times and the card ending ${p(params, "last4")} didn't go through. ${name}'s care plan continues until ${p(params, "graceUntil")} — update the card before then and we'll pick up where we left off. ${Their} record and ID stay yours either way.`,
        },
      };
    case "order_refunded":
      return {
        ar: {
          title: "رجّعنا لك المبلغ",
          body: `${p(params, "orderNumber")} — ${p(params, "total")} ${p(params, "currency")}. يوصل حسابك خلال 5 إلى 10 أيام عمل حسب بنكك.`,
        },
        en: {
          title: "Your refund is on its way",
          body: `${p(params, "orderNumber")} — ${p(params, "total")} ${p(params, "currency")}. It reaches your account within 5–10 business days, depending on your bank.`,
        },
      };
    case "order_pending":
      return {
        ar: {
          title: "الطلب بانتظار الدفع",
          body: `${p(params, "orderNumber")} — أكمل الدفع لتأكيد طلبك.`,
        },
        en: {
          title: "Order awaiting payment",
          body: `${p(params, "orderNumber")} — complete payment to confirm your order.`,
        },
      };
    case "payment_received":
      return {
        ar: {
          title: "تم استلام الدفع — تأكد الطلب",
          body: `${p(params, "orderNumber")} مؤكد. نجهّز صندوقك!`,
        },
        en: {
          title: "Payment received — order confirmed",
          body: `${p(params, "orderNumber")} is confirmed. We're preparing your box!`,
        },
      };
    case "payment_failed":
      // Never blame the member; say exactly what happened + the way forward
      // (R113/R118). Nothing was charged, and the Cat ID is untouched.
      return {
        ar: {
          title: "ما اكتملت عملية الدفع",
          body: `${p(params, "orderNumber")} — ما انخصم منك شيء وهوية قطك بأمان. تقدر تجرّب مرة ثانية متى ما تحب.`,
        },
        en: {
          title: "Your payment didn't complete",
          body: `${p(params, "orderNumber")} — nothing was charged and your cat's ID is safe. You can try again whenever you're ready.`,
        },
      };
    case "term_ending":
      // An INVITATION, never a charge warning — nothing renews automatically.
      return {
        ar: {
          title: `خطة عناية ${name} تقترب من نهايتها`,
          body: `تنتهي مدة الخطة بتاريخ ${p(params, "endsAt")}. ما نجدّد تلقائياً — جدّد بضغطة متى ما حبيت وتستمر العناية.`,
        },
        en: {
          title: `${name}'s care plan is nearly up`,
          body: `The term ends ${p(params, "endsAt")}. We never renew automatically — renew in a tap whenever you're ready.`,
        },
      };
    case "membership_lapsed":
      return {
        ar: {
          title: `خطة عناية ${name} انتهت — وكل شي محفوظ`,
          body: `سجلّ ${name} و${his("هوية")} و${his("صور")} محفوظة كما هي. ترجع لخطة العناية متى ما حبيت.`,
        },
        en: {
          title: `${name}'s care plan has ended — everything's saved`,
          body: `${name}'s record, ID and photos are all kept. The care plan is there whenever you'd like to return.`,
        },
      };
    case "vaccination_due": {
      // Named clinic when the dose was written by one (T5): the reminder
      // returns the patient to the clinic that cares for them.
      const clinic = p(params, "clinic");
      return {
        ar: {
          title: `تطعيم ${p(params, "name")} يقترب`,
          body: clinic
            ? `تذكير من ${clinic}: موعد «${p(params, "vaccine")}» لـ${p(params, "name")} بتاريخ ${p(params, "dueAt")}.`
            : `موعد «${p(params, "vaccine")}» بتاريخ ${p(params, "dueAt")}. تذكير منّا — عناية بـ${p(params, "name")}.`,
        },
        en: {
          title: `${p(params, "name")}'s vaccination is coming up`,
          body: clinic
            ? `A reminder from ${clinic}: ${p(params, "name")}'s ${p(params, "vaccine")} is due ${p(params, "dueAt")}.`
            : `${p(params, "vaccine")} is due ${p(params, "dueAt")}. A reminder from us — looking after ${p(params, "name")}.`,
        },
      };
    }
    case "cat_found_report":
      return {
        ar: {
          title: `شخص وجد ${p(params, "name")}`,
          body: `مسح أحدهم رمز ${p(params, "name")} وترك رسالة: «${p(params, "message")}»${p(params, "phone") ? ` — تواصل معه على ${p(params, "phone")}` : ""}.`,
        },
        en: {
          title: `Someone found ${p(params, "name")}`,
          body: `Someone scanned ${p(params, "name")}'s tag and left a message: “${p(params, "message")}”${p(params, "phone") ? ` — reach them on ${p(params, "phone")}` : ""}.`,
        },
      };
    case "cat_birthday":
      // Only claim what exists: the birthday frame is a personalization option
      // the member can apply in one tap — we point at it, never pretend it
      // auto-applied (R006).
    {
      const years = Number(params.age) || 0;
      const ageAr = yearsLabel(years, "ar");
      return {
        ar: {
          title: catVerb(gender, {
            m: `${name} يكمل ${ageAr} اليوم`,
            f: `${name} تكمل ${ageAr} اليوم`,
            n: `عيد ميلاد ${name} اليوم — ${ageAr}`,
          }),
          body: `كل عام و${name} بخير. جرّب إطار عيد الميلاد على ${his("بطاقة")} وشاركها مع أهل البيت.`,
        },
        en: {
          title: `${name} turns ${years} today`,
          body: `Happy birthday, ${name}! Try the birthday frame on ${their} card and share it with the family.`,
        },
      };
    }
    case "member_anniversary": {
      const years = Number(params.years) || 1;
      return {
        ar: {
          title: `${yearsLabel(years, "ar")} مع مرقط`,
          body: `اليوم صار لـ${name} ${yearsLabel(years, "ar")} في سجل مرقط. شكراً لأنك جزء من العائلة.`,
        },
        en: {
          title: years === 1 ? "A year with Moracat" : `${yearsLabel(years, "en")} with Moracat`,
          body: `Today ${name} has been in the Moracat register for ${yearsLabel(years, "en")}. Thank you for being family.`,
        },
      };
    }
    case "refund_requested":
      return {
        ar: {
          title: "استلمنا طلب الاسترداد",
          body: "سيتواصل معك فريق العناية خلال 24 ساعة عمل. طلبك مسجّل ومحفوظ.",
        },
        en: {
          title: "We've received your refund request",
          body: "Our care team will reach out within one business day. Your request is logged and safe.",
        },
      };
    case "refund_requested_staff":
      // Staff-voiced: who asked and why — actioned via the admin refund tooling.
      return {
        ar: {
          title: "طلب استرداد جديد",
          body: params.reason
            ? `${p(params, "who")} طلب استرداد المتبقّي من اشتراكه. السبب: ${p(params, "reason")}`
            : `${p(params, "who")} طلب استرداد المتبقّي من اشتراكه.`,
        },
        en: {
          title: "New refund request",
          body: params.reason
            ? `${p(params, "who")} requested a refund of their remaining term. Reason: ${p(params, "reason")}`
            : `${p(params, "who")} requested a refund of their remaining term.`,
        },
      };

    // ── The cat's life beyond one household (2026-09-20) ──────────────────
    // Every line here is about a cat moving between people. The voice stays
    // warm and factual: a hand-over is not a transaction to congratulate, and
    // a lost cat is not a moment for exclamation marks (R081, R087).
    case "care_due":
      return {
        ar: { title: `${p(params, "task")} — ${p(params, "name")}`, body: `موعده ${p(params, "dueAt")}. علّمه «تم» بعد ما تخلّصه، أو أجّله.` },
        en: { title: `${p(params, "task")} — ${p(params, "name")}`, body: `Due ${p(params, "dueAt")}. Mark it done when it's done, or move it.` },
      };
    case "care_overdue":
      return {
        ar: { title: `فات موعد ${p(params, "task")} لـ${p(params, "name")}`, body: `كان موعده ${p(params, "dueAt")}. لو تم، سجّله — ولو لا، هذا تذكير لطيف.` },
        en: { title: `${p(params, "name")}'s ${p(params, "task")} is overdue`, body: `It was due ${p(params, "dueAt")}. If it's done, record it — if not, this is a gentle nudge.` },
      };
    case "weekly_digest":
      return {
        ar: { title: "هذا الأسبوع مع قططك", body: p(params, "summaryAr") },
        en: { title: "This week with your cats", body: p(params, "summaryEn") },
      };
    case "box_scheduled":
      return {
        ar: {
          title: `صندوق ${p(params, "name") || "قطّك"} يُجهَّز`,
          body: `الصندوق ${p(params, "box")} من ${p(params, "of")} — مدفوع مسبقاً مع خطة العناية، ونبلغك إذا خرج للتوصيل.`,
        },
        en: {
          title: `${p(params, "name") || "Your cat"}'s box is being packed`,
          body: `Box ${p(params, "box")} of ${p(params, "of")} — already paid with your care plan. We'll tell you when it's out for delivery.`,
        },
      };
    case "partner_needs_review":
      return {
        ar: {
          title: `عيادة بانتظار المراجعة: ${p(params, "clinic")}`,
          body: `${p(params, "whatAr")} — افتح ملف العيادة في لوحة الشركاء.`,
        },
        en: {
          title: `Clinic waiting for review: ${p(params, "clinic")}`,
          body: `${p(params, "whatEn")} — open the clinic in the partners console.`,
        },
      };
    case "ownership_transfer_offered":
      return {
        ar: {
          title: `${p(params, "from") || "أحد الأعضاء"} يسلّمك ${p(params, "name")}`,
          body: `لو وافقت، تنتقل لك هوية ${p(params, "name")} بنفس رقمها — ومعها سجلها كامل. شوف الملف قبل ما تقرّر.`,
        },
        en: {
          title: `${p(params, "from") || "A member"} is handing you ${p(params, "name")}`,
          body: `If you accept, ${p(params, "name")}'s Cat ID comes to you with the same number — and the whole record with it. Look before you decide.`,
        },
      };
    case "ownership_transfer_cancelled":
      return {
        ar: {
          title: `تم سحب عرض نقل ${p(params, "name")}`,
          body: "صاحب القط سحب العرض. ما انتقل شي، والملف باقٍ عنده.",
        },
        en: {
          title: `The offer for ${p(params, "name")} was withdrawn`,
          body: "The owner took the offer back. Nothing moved — the record stayed with them.",
        },
      };
    case "ownership_transfer_declined":
      return {
        ar: {
          title: catVerb(gender, {
            m: `${name} باقٍ عندك`,
            f: `${name} باقية عندك`,
            n: `${name} عندك — ما تغيّر شي`,
          }),
          body: `العضو الآخر اعتذر عن الاستلام. هوية ${name} و${his("سجل")} ما تغيّر فيهم شي.`,
        },
        en: {
          title: `${name} is staying with you`,
          body: `The other member declined. Nothing about ${their} Cat ID or record changed.`,
        },
      };
    case "ownership_transfer_completed_from":
      return {
        ar: {
          title: `تم نقل ${name}`,
          body: `${p(params, "to") || "العضو الجديد"} استلم ${name} و${his("سجل")} كامل. سنوات عنايتك محفوظة في ${his("سجل ملكية")}.`,
        },
        en: {
          title: `${name} has moved`,
          body: `${p(params, "to") || "Their new owner"} now holds ${name} and the full record. Your years of care stay in ${their} ownership history.`,
        },
      };
    case "ownership_transfer_completed_to":
      return {
        ar: {
          title: catVerb(gender, { m: `${name} صار لك`, f: `${name} صارت لك`, n: `${name} عندك الحين` }),
          body: `${his("هوية")} ${p(params, "id")} انتقلت لك بنفس الرقم، ومعها السجل الصحي كامل. ابدأ بجهات الطوارئ ومن يقدر يشوف السجل.`,
        },
        en: {
          title: `${name} is yours`,
          body: `Cat ID ${p(params, "id")} came to you with the same number, and the health record with it. Start with emergency contacts and record access.`,
        },
      };
    case "adoption_request_received":
      return {
        ar: {
          title: `طلب تبنٍّ لـ${p(params, "name")}`,
          body: `${p(params, "who") || "أحد الأعضاء"} يسأل عن ${p(params, "name")}. اقرأ رسالته وقرّر على راحتك — ما في استعجال.`,
        },
        en: {
          title: `An adoption enquiry for ${p(params, "name")}`,
          body: `${p(params, "who") || "A member"} asked about ${p(params, "name")}. Read what they wrote and take your time.`,
        },
      };
    case "adoption_request_accepted":
      return {
        ar: {
          title: `تمت الموافقة على طلبك لـ${p(params, "name")}`,
          body: `صاحب ${p(params, "name")} وافق. اتفقوا على التفاصيل، وبعدها يرسل لك نقل الهوية.`,
        },
        en: {
          title: `Your enquiry about ${p(params, "name")} was accepted`,
          body: `${p(params, "name")}'s owner said yes. Agree the details between you, then they'll send the Cat ID transfer.`,
        },
      };
    case "adoption_request_declined":
      return {
        ar: {
          title: catVerb(gender, { m: `${name} لقى بيت ثاني`, f: `${name} لقت بيت ثاني`, n: `${name} راح لبيت ثاني` }),
          body: params.note
            ? `صاحب القط ردّ: «${p(params, "note")}». في قطط ثانية تنتظر بيت — شوف الباقي.`
            : "في قطط ثانية تنتظر بيتاً — شوف الباقي متى ما حبيت.",
        },
        en: {
          title: `${p(params, "name")} found another home`,
          body: params.note
            ? `The owner wrote: “${p(params, "note")}”. Other cats are still waiting for a home.`
            : "Other cats are still waiting for a home — have a look whenever you like.",
        },
      };
    case "lost_found_message":
      return {
        ar: {
          title: params.name ? `رسالة عن ${p(params, "name")}` : "رسالة على إعلانك",
          body: `«${p(params, "message")}»${p(params, "phone") ? ` — تواصل على ${p(params, "phone")}` : ""}`,
        },
        en: {
          title: params.name ? `A message about ${p(params, "name")}` : "A message on your notice",
          body: `“${p(params, "message")}”${p(params, "phone") ? ` — reach them on ${p(params, "phone")}` : ""}`,
        },
      };
    case "listing_hidden":
      return {
        ar: {
          title: params.name ? `أخفينا إعلان ${p(params, "name")}` : "أخفينا إعلانك",
          body: params.reason
            ? `أخفى أحد المشرفين هذا الإعلان. السبب: ${p(params, "reason")}. تواصل مع الدعم لأي استفسار.`
            : "أخفى أحد المشرفين هذا الإعلان. تواصل مع الدعم لأي استفسار.",
        },
        en: {
          title: params.name ? `${p(params, "name")}'s listing was hidden` : "Your listing was hidden",
          body: params.reason
            ? `A moderator took this down. Reason: ${p(params, "reason")}. Contact support if you have questions.`
            : "A moderator took this down. Contact support if you have questions.",
        },
      };
    case "lost_found_possible_match":
      // Only ever raised on an exact microchip match — a guess dressed as a
      // reunion would be cruel (R006).
      return {
        ar: {
          title: "قد يكون هذا قطك",
          body: `أحدهم نشر إعلان «وجدت قطاً» برقم شريحة يطابق ${p(params, "name")}. افتح الإعلان وتأكد.`,
        },
        en: {
          title: "This might be your cat",
          body: `Someone posted a found-cat notice with a microchip number matching ${p(params, "name")}. Open it and check.`,
        },
      };
  }
}
