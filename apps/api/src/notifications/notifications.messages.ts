/**
 * Bilingual catalogue for in-app notifications. Text is built here at write
 * time for BOTH languages and stored on the row (`data.i18n`), so the portal
 * feed renders in the member's current locale (Arabic-default, R101) without
 * the web needing per-type code — and older rows still fall back to the stored
 * `title`/`body`. Add a case here and every surface localizes automatically.
 */
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
  | "payment_received"
  | "payment_failed";

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

export function buildNotificationText(
  type: NotificationType,
  params: NotificationParams = {}
): NotificationText {
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
    case "cat_id_issued":
      return {
        ar: {
          title: `هوية ${p(params, "name")} جاهزة`,
          body: `تم تسجيل ${p(params, "name")} رسمياً برقم ${p(params, "catIdNumber")}. اضغط لعرض البطاقة.`,
        },
        en: {
          title: `${p(params, "name")}'s Cat ID is ready`,
          body: `${p(params, "name")} is now officially registered as ${p(params, "catIdNumber")}. Tap to view the card.`,
        },
      };
    case "cat_made_public":
      return {
        ar: {
          title: `${p(params, "name")} أصبح في المجتمع`,
          body: "ملفه العام صار ظاهراً للجميع. شارك الرابط واجمع الإعجابات.",
        },
        en: {
          title: `${p(params, "name")} is live in the community`,
          body: "Their public profile is now discoverable. Share the link and collect some love.",
        },
      };
    case "cat_first_like":
      return {
        ar: {
          title: `${p(params, "name")} حصل على أول إعجاب ❤️`,
          body: `أحدهم أحب ${p(params, "name")} في المجتمع.`,
        },
        en: {
          title: `${p(params, "name")} got their first like ❤️`,
          body: `Someone loved ${p(params, "name")} in the community.`,
        },
      };
    case "cat_like_milestone":
      return {
        ar: {
          title: `${p(params, "name")} وصل إلى ${p(params, "likeCount")} إعجاب ❤️`,
          body: `${p(params, "name")} محبوب — ${p(params, "likeCount")} عضو وأكثر.`,
        },
        en: {
          title: `${p(params, "name")} reached ${p(params, "likeCount")} likes ❤️`,
          body: `${p(params, "name")} is being loved — ${p(params, "likeCount")} members and counting.`,
        },
      };
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
          title: `${p(params, "name")} مميّز ⭐`,
          body: `اختار أحد المشرفين ${p(params, "name")} ليكون مميّزاً في المجتمع. صار في الواجهة الآن.`,
        },
        en: {
          title: `${p(params, "name")} is featured ⭐`,
          body: `A moderator featured ${p(params, "name")} in the community. They're front and centre now.`,
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
  }
}
