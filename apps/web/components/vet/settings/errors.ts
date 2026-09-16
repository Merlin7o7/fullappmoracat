/**
 * One error voice for the settings + go-live surfaces (R084, R112): what
 * happened and exactly what to do next, bilingual, never raw server prose.
 *
 * Order of authority: codes only these screens produce → the portal catalogue
 * (`vetFriendlyError`) → the registration catalogue (`registrationError`, which
 * also covers network/400 fallbacks kindly in Arabic).
 */

import { ApiError } from "@/lib/http";
import type { FriendlyError } from "@/lib/errors";
import { vetErrorCode, vetFriendlyError } from "@/lib/vet-api";
import { registrationError } from "@/lib/vet-registration";

const LOCAL: Record<string, { ar: [string, string]; en: [string, string] }> = {
  VET_PIN_CURRENT_REQUIRED: {
    ar: ["اكتب رمزك الحالي", "لتغيير الرمز السري نحتاج رمزك الحالي أولاً. نسيته؟ مدير العيادة يستطيع مسحه لتعيّن رمزاً جديداً."],
    en: ["Enter your current PIN", "Changing a PIN needs the current one first. Forgotten it? A clinic manager can clear it so you can set a new one."],
  },
  VET_PIN_INVALID: {
    ar: ["الرمز الحالي غير صحيح", "تأكد من الأرقام وحاول مجدداً. نسيته؟ مدير العيادة يستطيع مسحه."],
    en: ["That current PIN isn't right", "Check the digits and try again. Forgotten it? A clinic manager can clear it."],
  },
  VET_INVITE_ALREADY_STAFF: {
    ar: ["الزميل ضمن الفريق", "هذا البريد عضو في فريق العيادة مسبقاً — لا حاجة لدعوة جديدة."],
    en: ["Already on the team", "This email is already part of the clinic team — no new invitation needed."],
  },
  VET_ROLE_NOT_ASSIGNABLE: {
    ar: ["لا يمكنك منح هذا الدور", "كل شخص يمنح أدواراً أدنى من دوره فقط. مالك العيادة يستطيع ذلك."],
    en: ["You can't assign that role", "Everyone can only hand out roles below their own. The clinic owner can do this."],
  },
  VET_SELF_ACTION: {
    ar: ["لا يمكن تنفيذه على حسابك", "هذا الإجراء يُنفَّذ على الزملاء فقط — اطلب من مدير آخر إن احتجت."],
    en: ["Not on your own account", "This action is for colleagues only — ask another manager if you need it."],
  },
  VET_LAST_OWNER: {
    ar: ["العيادة تحتاج مالكاً", "لا يمكن إيقاف آخر مالك للعيادة أو تغيير دوره. أضف مالكاً آخر أولاً."],
    en: ["The clinic needs an owner", "The last owner can't be removed or change role. Add another owner first."],
  },
  VET_STAFF_NOT_FOUND: {
    ar: ["الزميل غير موجود", "ربما تغيّرت القائمة. حدّث الصفحة وحاول مجدداً."],
    en: ["Colleague not found", "The team list may have changed. Refresh and try again."],
  },
};

/** Codes the registration catalogue owns that these screens can receive. */
const REGISTRATION_CODES = new Set([
  "VET_GO_LIVE_NOT_READY",
  "VET_REG_WRONG_STATUS",
  "VET_INVITE_INVALID",
  "VET_INVITE_USED",
  "VET_INVITE_EXPIRED",
  "VET_BRANCH_NOT_FOUND",
]);

export function settingsError(err: unknown, isAr: boolean): FriendlyError {
  const code = err instanceof ApiError ? err.code : undefined;
  if (code && LOCAL[code]) {
    const [title, message] = isAr ? LOCAL[code].ar : LOCAL[code].en;
    return { title, message, code };
  }
  if (vetErrorCode(err)) return vetFriendlyError(err, isAr);
  if (code && REGISTRATION_CODES.has(code)) return registrationError(err, isAr);
  if (err instanceof ApiError && (err.kind === "network" || err.kind === "timeout" || err.status === 400)) {
    return registrationError(err, isAr);
  }
  return vetFriendlyError(err, isAr);
}
