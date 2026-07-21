/**
 * Referral recognition — «عزيمة» (the invitation), MRC-GTM-001 §9.
 *
 * The design authority is explicit: recognition and tenure, NOT a points game,
 * and NO buyable queue position (R006 — "a position you can buy with referrals
 * is not a position"). So this models the ONE honest thing a referral produces:
 * a real cat that joined the census because you invited its owner. We recognise
 * that contribution warmly; we never turn it into a leaderboard, a coupon, or a
 * line-jump.
 *
 * The number that counts is `brought` — friends whose cats actually registered,
 * not accounts created. That makes the recognition both truthful and
 * fraud-resistant (an empty throwaway account brings nothing).
 */

/** Gentle progress thresholds — for a "cats you've helped join" bar, never a score. */
export const REFERRAL_MILESTONES = [1, 3, 5, 10] as const;

export interface ReferralRecognition {
  /** Friends' cats registered into the census via this member's invite. */
  brought: number;
  /**
   * Recognised at launch: a member who brought at least one cat into the census
   * is a founding supporter. Derived, never a stored flag that could be forged —
   * same discipline as the founding badge.
   */
  isFoundingSupporter: boolean;
  /** The next threshold, or null once past the last one. */
  nextMilestone: number | null;
  /** How many more cats to reach `nextMilestone` (0 when there is none). */
  toNext: number;
  /** A warm, honest recognition label. */
  title: string;
  /** One true line about the contribution. */
  detail: string;
}

export function referralRecognition(
  brought: number,
  locale: "ar" | "en"
): ReferralRecognition {
  const safe = Number.isFinite(brought) && brought > 0 ? Math.floor(brought) : 0;
  const nextMilestone = REFERRAL_MILESTONES.find((m) => m > safe) ?? null;
  const toNext = nextMilestone ? nextMilestone - safe : 0;
  const isFoundingSupporter = safe >= 1;

  if (locale === "ar") {
    const title = !isFoundingSupporter ? "ادعُ صديقاً للتعداد" : "داعم التعداد";
    const detail = !isFoundingSupporter
      ? "شارك رابطك — كل قط ينضم بدعوتك يُحتسب لك."
      : `ساعدت ${toArabicDigits(safe)} ${safe === 1 ? "قطاً" : "قطط"} على الانضمام للتعداد.`;
    return { brought: safe, isFoundingSupporter, nextMilestone, toNext, title, detail };
  }

  const title = !isFoundingSupporter ? "Invite a friend to the census" : "Census Supporter";
  const detail = !isFoundingSupporter
    ? "Share your link — every cat that joins through you is credited to you."
    : `You've helped ${safe} ${safe === 1 ? "cat" : "cats"} join the census.`;
  return { brought: safe, isFoundingSupporter, nextMilestone, toNext, title, detail };
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function toArabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]!);
}
