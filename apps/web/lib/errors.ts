/**
 * friendlyError — the ONLY way member-facing code should render an API failure.
 *
 * The API throws `{ code, message, ...extras }` bodies (see apps/api/src/common/
 * errors.ts and the subscriptions service). The English `message` is a debug
 * fallback; members must never see it raw (R084/R101/R113 — an Arabic member
 * mistyping her password must not be scolded in English). This maps every code
 * to warm, bilingual, recovery-oriented copy, and falls back to a generic
 * no-blame message for anything unmapped.
 */

import { ApiError } from "./http";

export interface FriendlyError {
  title: string;
  message: string;
  /** The structured code, when the API sent one — for UI branching. */
  code?: string;
}

type Copy = { ar: { title: string; message: string }; en: { title: string; message: string } };

const MAP: Record<string, Copy> = {
  // ── auth / identity ────────────────────────────────────────────────────────
  EMAIL_TAKEN: {
    ar: { title: "هذا البريد مسجّل من قبل", message: "عندك حساب بهذا البريد. سجّل دخولك، أو استخدم «نسيت كلمة المرور» إذا ما تذكرها." },
    en: { title: "This email is already registered", message: "You already have an account with this email. Sign in, or use “Forgot password” if you don't remember it." },
  },
  PHONE_TAKEN: {
    ar: { title: "هذا الرقم مسجّل من قبل", message: "عندك حساب بهذا الرقم. سجّل دخولك بدلاً من إنشاء حساب جديد." },
    en: { title: "This number is already registered", message: "You already have an account with this number. Sign in instead of creating a new one." },
  },
  BAD_CREDENTIALS: {
    ar: { title: "البيانات غير صحيحة", message: "البريد أو كلمة المرور غير متطابقين. جرّب مرة ثانية، أو استخدم «نسيت كلمة المرور»." },
    en: { title: "That didn't match", message: "The email or password doesn't match. Try again, or use “Forgot password”." },
  },
  LOCKED_OUT: {
    ar: { title: "محاولات كثيرة", message: "لحماية حسابك أوقفنا المحاولات مؤقتاً. جرّب بعد قليل، أو أعد تعيين كلمة المرور الآن." },
    en: { title: "Too many attempts", message: "To protect your account we've paused sign-in attempts. Try again shortly, or reset your password now." },
  },
  TOTP_REQUIRED: {
    ar: { title: "رمز التحقق مطلوب", message: "أدخل الرمز من تطبيق المصادقة لإكمال الدخول." },
    en: { title: "Verification code needed", message: "Enter the code from your authenticator app to finish signing in." },
  },
  TOTP_INVALID: {
    ar: { title: "الرمز غير صحيح", message: "رمز المصادقة ما تطابق. تأكد من الوقت في جهازك وجرّب الرمز الجديد." },
    en: { title: "That code didn't match", message: "The authenticator code didn't match. Check your device clock and try the newest code." },
  },
  OTP_EXPIRED: {
    ar: { title: "انتهت صلاحية الرمز", message: "الرمز ما عاد صالحاً. اطلب رمزاً جديداً وسنرسله فوراً." },
    en: { title: "That code expired", message: "The code is no longer valid. Request a new one and we'll send it right away." },
  },
  OTP_INVALID: {
    ar: { title: "الرمز غير صحيح", message: "الرمز ما تطابق. تأكد من آخر رسالة وصلتك وجرّب مرة ثانية." },
    en: { title: "That code didn't match", message: "The code didn't match. Check the latest message you received and try again." },
  },
  OTP_RATE_LIMITED: {
    ar: { title: "تمهّل قليلاً", message: "طلبت رموزاً كثيرة خلال وقت قصير. انتظر دقيقة ثم اطلب رمزاً جديداً." },
    en: { title: "One moment", message: "A few too many codes in a short time. Wait a minute, then request a fresh one." },
  },
  EMAIL_NOT_VERIFIED: {
    ar: { title: "أكّد بريدك أولاً", message: "هذه الخطوة تحتاج بريداً مؤكداً. أرسلنا لك رمز التأكيد — دقيقة وحدة وتخلص." },
    en: { title: "Confirm your email first", message: "This step needs a confirmed email. We've sent you the code — it takes under a minute." },
  },
  ACCOUNT_NOT_FOUND: {
    ar: { title: "ما لقينا الحساب", message: "لا يوجد حساب بهذه البيانات. تأكد منها أو أنشئ حساباً جديداً — يأخذ دقيقة." },
    en: { title: "We couldn't find that account", message: "No account matches those details. Double-check them, or create a new account — it takes a minute." },
  },
  WEAK_PASSWORD: {
    ar: { title: "كلمة مرور أقوى تحميك أكثر", message: "استخدم ٨ أحرف على الأقل، فيها حرف ورقم." },
    en: { title: "A stronger password keeps you safer", message: "Use at least 8 characters, with a letter and a number." },
  },
  TOKEN_INVALID: {
    ar: { title: "الرابط غير صالح", message: "هذا الرابط ما عاد يعمل. اطلب رابطاً جديداً وسنرسله فوراً." },
    en: { title: "That link isn't valid", message: "This link no longer works. Request a fresh one and we'll send it right away." },
  },
  TOKEN_EXPIRED: {
    ar: { title: "انتهت صلاحية الرابط", message: "الرابط انتهت مدته. اطلب رابطاً جديداً — يوصلك خلال ثوانٍ." },
    en: { title: "That link expired", message: "The link timed out. Request a new one — it arrives in seconds." },
  },
  GOOGLE_NOT_CONFIGURED: {
    ar: { title: "الدخول بقوقل غير متاح حالياً", message: "استخدم البريد الإلكتروني في الوقت الحالي." },
    en: { title: "Google sign-in isn't available right now", message: "Use email for now." },
  },
  // ── membership / money ─────────────────────────────────────────────────────
  CAT_ALREADY_COVERED: {
    ar: { title: "قطك مشمول بعضوية", message: "عند هذا القط عضوية قائمة أو بانتظار الدفع. أدرها من صفحة اشتراكاتك — ما انخصم منك شيء الآن." },
    en: { title: "This cat already has a membership", message: "This cat has an existing or awaiting-payment membership. Manage it from your subscriptions page — nothing was charged just now." },
  },
  INVALID_TERM: {
    ar: { title: "المدة غير متاحة", message: "اختر مدة اشتراك من الخيارات المعروضة." },
    en: { title: "That term isn't available", message: "Choose a subscription length from the options shown." },
  },
  PROVIDER_NOT_CONFIGURED: {
    ar: { title: "الدفع غير متاح مؤقتاً", message: "نجهّز بوابة الدفع حالياً. ما انخصم منك شيء — جرّب بعد قليل، وهوية قطك بأمان." },
    en: { title: "Payments are briefly unavailable", message: "We're finishing payment setup. Nothing was charged — try again shortly; your cat's ID is safe." },
  },
  MEMBERSHIPS_COMING_SOON: {
    ar: { title: "العضويات قريباً", message: "العضويات المدفوعة لم تفتح بعد. هوية قطك جاهزة الآن، وسنخبرك أول ما تفتح." },
    en: { title: "Memberships are coming soon", message: "Paid memberships haven't opened yet. Your cat's ID is ready now, and we'll tell you the moment they do." },
  },
  SUBSCRIPTION_NOT_FOUND: {
    ar: { title: "ما لقينا الاشتراك", message: "هذا الاشتراك غير موجود في حسابك. حدّث الصفحة أو تواصل مع العناية." },
    en: { title: "We couldn't find that subscription", message: "That subscription isn't on your account. Refresh the page or contact Care." },
  },
  ALREADY_PAUSED: {
    ar: { title: "الاشتراك موقوف بالفعل", message: "اشتراكك موقوف حالياً. تقدر تستأنفه متى ما حبيت — أيامك محفوظة." },
    en: { title: "Already paused", message: "Your membership is already paused. Resume whenever you like — your days are saved." },
  },
  NOT_PAUSED: {
    ar: { title: "الاشتراك غير موقوف", message: "هذا الاشتراك يعمل حالياً، فما يحتاج استئنافاً." },
    en: { title: "Not paused", message: "This membership is currently active, so there's nothing to resume." },
  },
  NOT_ACTIVE: {
    ar: { title: "الاشتراك غير نشط", message: "هذا الإجراء متاح للاشتراكات النشطة فقط." },
    en: { title: "Membership isn't active", message: "This action is only available on an active membership." },
  },
  ALREADY_CANCELLED: {
    ar: { title: "الاشتراك ملغى بالفعل", message: "هذا الاشتراك ملغى. إذا حبيت ترجع، مكان قطك محفوظ دائماً." },
    en: { title: "Already cancelled", message: "This membership is already cancelled. If you'd like to return, your cat's place is always saved." },
  },
  NOT_RESUMABLE: {
    ar: { title: "لا يوجد دفع معلّق", message: "هذا الاشتراك ليس بانتظار الدفع." },
    en: { title: "No payment to resume", message: "This membership isn't awaiting payment." },
  },
  DRAFT_EXPIRED: {
    ar: { title: "انتهت جلسة الدفع", message: "جلسة الدفع السابقة انتهت — ما انخصم منك شيء. ابدأ الدفع من جديد ويأخذ دقيقة." },
    en: { title: "That payment session expired", message: "The previous payment session timed out — nothing was charged. Start checkout again; it takes a minute." },
  },
  REFUND_ALREADY_REQUESTED: {
    ar: { title: "طلبك مسجّل عندنا", message: "استلمنا طلب الاسترداد سابقاً وفريق العناية يتابعه. سيتواصلون معك قريباً." },
    en: { title: "Your request is already logged", message: "We've received your refund request and the care team is on it. They'll reach out soon." },
  },
  INVALID_SELECTION: {
    ar: { title: "اختيار غير متاح", message: "أحد اختيارات الصندوق ما عاد متاحاً. حدّث الصفحة واختر بديلاً." },
    en: { title: "That pick isn't available", message: "One of your box picks is no longer available. Refresh and choose an alternative." },
  },
};

const GENERIC: Copy = {
  ar: { title: "صار خطأ بسيط", message: "ما قدرنا نكمل الطلب. جرّب مرة ثانية، وإذا تكرر تواصل مع العناية — نحن هنا." },
  en: { title: "Something went wrong", message: "We couldn't complete that. Try again, and if it keeps happening contact Care — we're here." },
};

/**
 * Map any thrown error to warm bilingual copy. Timeout/network errors keep the
 * already-localized message from lib/http.ts; coded API errors get the catalogue
 * above; everything else gets the generic no-blame fallback — never the raw
 * English server string.
 */
export function friendlyError(err: unknown, isAr: boolean): FriendlyError {
  const loc = isAr ? "ar" : "en";
  if (err instanceof ApiError) {
    if (err.kind === "timeout" || err.kind === "network") {
      return { title: isAr ? "مشكلة في الاتصال" : "Connection trouble", message: err.message };
    }
    if (err.code && MAP[err.code]) {
      const copy = MAP[err.code][loc];
      // LOCKED_OUT carries minutes — make the copy specific when we have them.
      if (err.code === "LOCKED_OUT" && typeof err.extras?.retryAfterMinutes === "number") {
        const m = err.extras.retryAfterMinutes;
        return {
          code: err.code,
          title: copy.title,
          message: isAr
            ? `لحماية حسابك أوقفنا المحاولات ${m} دقيقة. تقدر تعيد تعيين كلمة المرور الآن بدل الانتظار.`
            : `To protect your account, attempts are paused for ${m} minute${m === 1 ? "" : "s"}. You can reset your password now instead of waiting.`,
        };
      }
      return { code: err.code, ...copy };
    }
    return { code: err.code, ...GENERIC[loc] };
  }
  return { ...GENERIC[loc] };
}

/** Convenience: one string for toast bodies. */
export function friendlyMessage(err: unknown, isAr: boolean): string {
  return friendlyError(err, isAr).message;
}
