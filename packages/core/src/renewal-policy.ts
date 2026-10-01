/**
 * What happens at the end of a paid term — said ONE way, everywhere.
 *
 * The same question used to get three answers: the plan picker and product
 * page said "never auto-renewed", checkout offered an opt-in auto-renew toggle,
 * and the terms said subscriptions renew by default. A member who reads two of
 * those has been misled by one (R021/R025). The founder decision (2026-09-17)
 * is the policy below; every surface imports these strings instead of writing
 * its own.
 *
 *   • A term is paid upfront and simply ends — nothing renews by default.
 *   • Auto-renew is OPTIONAL and OFF until the member switches it on, and only
 *     with a saved card (never on Tamara).
 *   • Before any renewal charge we send a reminder; it can be switched off any
 *     time before the term ends.
 */

import type { Bilingual } from "./owner-health";

/** One line under a price — before checkout ever shows a total. */
export const RENEWAL_SHORT: Bilingual = {
  ar: "تُدفع المدة مقدّماً وتنتهي في وقتها — لا تتجدّد إلا إذا فعّلت التجديد التلقائي بنفسك.",
  en: "Paid upfront; the term simply ends — it renews only if you switch auto-renew on yourself.",
};

/** The billing note on plan cards and the membership page. */
export const RENEWAL_BILLING_NOTE: Bilingual = {
  ar: "شهر واحد أو مدة مدفوعة مقدّماً — خصم على مدتَي 6 و12 شهراً. لا تجديد إلا باختيارك، ونذكّرك قبل أي خصم.",
  en: "One month or a prepaid term — 6 and 12-month terms carry a discount. Nothing renews unless you choose it, and we remind you before any charge.",
};

/** FAQ: "Can I cancel or pause?" */
export const RENEWAL_FAQ_ANSWER: Bilingual = {
  ar: "متى ما تبي — إيقاف مؤقت أو إلغاء. والإلغاء ما يأخذ منك أيام دفعتها: الصناديق المدفوعة توصلك حتى نهاية المدة. ولا شيء يتجدّد إلا إذا فعّلت التجديد التلقائي، ونذكّرك قبل أي خصم.",
  en: "Anytime — pause or cancel. Cancelling never takes back days you paid for: your prepaid boxes keep arriving to the end of the term. Nothing renews unless you switched auto-renew on, and we remind you before any charge.",
};

/** The terms-of-service paragraph. */
export const RENEWAL_LEGAL: Bilingual = {
  ar: "ينتهي الاشتراك في نهاية المدة المدفوعة ما لم تجدّده. التجديد التلقائي اختياري ومُطفأ افتراضياً، ولا يُفعَّل إلا بطلبك ومع بطاقة محفوظة (غير متاح عبر تمارا). نرسل لك تذكيراً قبل أي خصم تجديد، ويمكنك إيقاف التجديد التلقائي أو إلغاء الاشتراك في أي وقت قبل نهاية المدة الحالية، دون أن تفقد الصناديق المدفوعة.",
  en: "A subscription ends at the end of its paid term unless you renew it. Auto-renewal is optional and off by default; it is enabled only at your request and only with a saved card (not available with Tamara). We remind you before any renewal charge, and you may switch auto-renewal off or cancel at any time before the current term ends without losing boxes you have paid for.",
};

/** Next to the auto-renew toggle at checkout. */
export const RENEWAL_TOGGLE_HINT: Bilingual = {
  ar: "اختياري ومُطفأ افتراضياً. نذكّرك قبل أي خصم، وتقدر توقفه متى شئت.",
  en: "Optional and off by default. We remind you before any charge, and you can switch it off anytime.",
};
