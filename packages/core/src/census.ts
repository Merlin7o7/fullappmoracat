/**
 * The Census — founding status, derived, never stored as a claim.
 *
 * Phase 0 (MRC-GTM-001 §1) frames the pre-launch as «التعداد الوطني للقطط»,
 * the Saudi Cat Census: the site's one job is to count cats. The first 1,000
 * registrations are permanently "Founding Member — Riyadh Class of 2026".
 *
 * That badge is computed from `Cat.catNumber` — the Postgres sequence value
 * assigned when the row was inserted — and from nothing else. There is
 * deliberately NO `isFounding` column, because:
 *
 *   * A flag someone can set is a flag someone can fake. The whole campaign
 *     rests on the numbers being genuinely sequential (R006 — no fake
 *     scarcity), and the only way to keep that true is to make the badge a
 *     restatement of the ordinal rather than an independent fact.
 *   * A stored status can drift from the records; a computed one cannot. Same
 *     reasoning as `deriveVaccinationStatus` — see ./vaccination-status.
 *
 * Note what this deliberately does NOT export: any notion of "spots left".
 * The count of remaining founding places is a scarcity clock, and we do not
 * ship scarcity clocks (R006). We state the true number registered so far and
 * let the reader do the subtraction themselves.
 */

/**
 * The founding cohort size. A cat is a Founding Member iff its census ordinal
 * is at or below this line — a fact about *that cat's number*, not about how
 * many cats are currently alive in the table. Soft-deleting cat #7 does not
 * promote cat #1001, because #1001 still registered one-thousand-and-first.
 */
export const FOUNDING_MEMBER_LIMIT = 1000;

/**
 * The founding cohort's name — assembled from facts, never hard-coded.
 *
 * This used to read "دفعة الرياض ٢٠٢٦ / Riyadh Class of 2026" for everybody,
 * lifted verbatim from the strategy doc, while registration never asked where
 * anyone lived. For a Jeddah owner that was not marketing shorthand — it was a
 * false statement printed on their cat's identity card, which is the one
 * surface that must never lie (R040, and the Cat ID's whole premise).
 *
 * Both halves are now derived:
 *   * the city from what the owner actually told us, and
 *   * the year from when the ID was actually issued.
 *
 * When we don't know the city — an owner who picked "another city", or any of
 * the cats registered before this field existed — the class simply omits it.
 * Saying less is always available; saying something untrue is not.
 */
export function foundingClassLabel(
  catNumber: number | null | undefined,
  cityLabel: string | null,
  issuedAt: Date | string | null | undefined,
  locale: "ar" | "en"
): string | null {
  if (!isFoundingMember(catNumber)) return null;

  const d = issuedAt ? new Date(issuedAt) : null;
  const year = d && !Number.isNaN(d.getTime()) ? d.getFullYear() : null;

  if (locale === "ar") {
    // Arabic-Indic digits for a prose year (this is a phrase, not an
    // identifier — unlike the Cat ID number, which stays Latin, dir=ltr).
    const y = year ? toArabicDigits(year) : null;
    const parts = ["عضو مؤسِّس", ["دفعة", cityLabel, y].filter(Boolean).join(" ")];
    return parts.filter((p) => p && p !== "دفعة").join(" — ");
  }

  const tail = [cityLabel, year ? `Class of ${year}` : null].filter(Boolean).join(" ");
  return tail ? `Founding Member — ${tail}` : "Founding Member";
}

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
function toArabicDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]!);
}

/**
 * Is this census ordinal inside the founding cohort?
 *
 * `catNumber` is non-null for every row created after the census migration.
 * The nullable signature exists only so callers holding a partially-selected
 * cat cannot accidentally coerce `undefined` into a truthy badge.
 */
export function isFoundingMember(catNumber: number | null | undefined): boolean {
  return typeof catNumber === "number" && catNumber >= 1 && catNumber <= FOUNDING_MEMBER_LIMIT;
}

/**
 * The ordinal as people actually say it — «قط رقم ٣٤٧» / "Cat #347".
 *
 * Arabic-Indic digits are NOT used here: the number is an identifier the owner
 * will read aloud, screenshot, and compare with a friend's, and the rest of the
 * Cat ID surface renders identifiers in Latin digits `dir="ltr"` (see the card's
 * mono ID number). Mixing numeral systems for the same identity would be a
 * localisation flourish that costs recognition (R110 is about real localisation,
 * not decoration).
 */
export function censusOrdinalLabel(
  catNumber: number | null | undefined,
  locale: "ar" | "en"
): string | null {
  if (typeof catNumber !== "number" || catNumber < 1) return null;
  return locale === "ar" ? `قط رقم ${catNumber}` : `Cat #${catNumber}`;
}

/** Bilingual founding badge, or null when the cat is outside the cohort. */
export function foundingBadgeLabel(
  catNumber: number | null | undefined,
  locale: "ar" | "en"
): string | null {
  if (!isFoundingMember(catNumber)) return null;
  return locale === "ar" ? "عضو مؤسِّس" : "Founding Member";
}

/**
 * The founding-member benefits — the real, enforceable promise behind the badge.
 *
 * Marketing (MRC-GTM-001 §1) promises the first 1,000 registrants three things:
 * a founding price locked for life, first-batch physical tag eligibility, and a
 * place on the founders' wall. Those were previously copy with nothing behind
 * them — the audit's "founding perk defined nowhere" finding. This is the single
 * source of truth: the same structure the marketing page renders, the Cat ID
 * surfaces, commerce honours (`isFoundingPriceLocked`), and fulfilment reads for
 * the physical tag run. If a promise isn't in this list, we don't make it (R040).
 *
 * `key` is stable and machine-readable so other systems can branch on it without
 * parsing copy; the labels are display-only.
 */
export type FoundingBenefitKey = "price_lock" | "first_tag" | "founders_wall" | "early_access";

export interface FoundingBenefit {
  key: FoundingBenefitKey;
  title: string;
  detail: string;
}

const FOUNDING_BENEFITS: Record<"ar" | "en", FoundingBenefit[]> = {
  en: [
    { key: "price_lock", title: "Founding price, locked for life", detail: "When memberships open, your rate is the founding rate — for as long as you stay a member." },
    { key: "first_tag", title: "First-batch physical Cat ID tag", detail: "Founding cats are first in line for the engraved metal tag when it ships." },
    { key: "founders_wall", title: "A place on the Founders' Wall", detail: "Your cat's name and number, kept with the first thousand — online and at the first pop-up." },
    { key: "early_access", title: "First access at launch", detail: "Founding members are invited before everyone else when the box goes live." },
  ],
  ar: [
    { key: "price_lock", title: "سعر التأسيس، ثابت مدى العضوية", detail: "عند إطلاق العضويات، سعرك هو سعر المؤسِّسين — ما دمت عضوًا." },
    { key: "first_tag", title: "وسم الهوية المعدني — الدفعة الأولى", detail: "قطط المؤسِّسين أول من يحصل على الوسم المعدني المحفور عند توفّره." },
    { key: "founders_wall", title: "مكان على جدار المؤسِّسين", detail: "اسم قطك ورقمه محفوظان مع أول ألف — على الإنترنت وفي أول فعالية." },
    { key: "early_access", title: "أولوية الوصول عند الإطلاق", detail: "يُدعى الأعضاء المؤسِّسون قبل الجميع عند إطلاق الصندوق." },
  ],
};

/** The founding benefits list — always available (for the marketing promise), locale-aware. */
export function foundingBenefits(locale: "ar" | "en"): FoundingBenefit[] {
  return FOUNDING_BENEFITS[locale];
}

/** The benefits a SPECIFIC cat has actually earned — its real list, or [] when outside the cohort. */
export function foundingBenefitsFor(
  catNumber: number | null | undefined,
  locale: "ar" | "en"
): FoundingBenefit[] {
  return isFoundingMember(catNumber) ? FOUNDING_BENEFITS[locale] : [];
}

/**
 * The commerce hook: is this cat entitled to the locked founding rate?
 *
 * A derived restatement of the ordinal, exactly like the badge — there is no
 * stored "priceLocked" flag to drift or be forged. When memberships launch, the
 * pricing path calls this to honour the promise the census made.
 */
export function isFoundingPriceLocked(catNumber: number | null | undefined): boolean {
  return isFoundingMember(catNumber);
}

/**
 * A registration's source code, normalised.
 *
 * Arrives from `?src=stand-004` on a physical stand's QR/NFC tile. Kept
 * deliberately permissive (any lowercase slug) because stands, creators and
 * partner clinics all mint their own codes and we would rather record an
 * unrecognised code than silently drop the attribution — per-stand yield
 * decides the Year-1 channel strategy and cannot be backfilled later.
 *
 * Returns null for anything that isn't a plausible code, so junk from a crawler
 * or a mangled bookmark never reaches the database.
 */
export const SOURCE_CODE_MAX = 40;

export function normaliseSourceCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > SOURCE_CODE_MAX) return null;
  return /^[a-z0-9][a-z0-9._-]*$/.test(trimmed) ? trimmed : null;
}
