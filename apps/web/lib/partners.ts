/**
 * Founding partners — the businesses that honour a member's rate.
 *
 * REAL, signed partners only. Never invent an entry (the same honesty rule that
 * removed the fabricated testimonials — R006). The network is deliberately small
 * and hand-curated ("ruthless partner curation"), so it lives in code where every
 * addition is reviewed; migrate to a DB + admin CRUD only when the list outgrows
 * that. Add a partner the moment their agreement is signed and their member rate
 * is confirmed — and admit coverage gaps honestly rather than implying breadth.
 *
 * Savings are recognition, not a coupon (R085): benefit copy names the member
 * rate plainly ("member rate at …"), never shouts a discount.
 */

export type PartnerCategory = "VET" | "GROOMING" | "RETAIL" | "BOARDING" | "OTHER";

export interface Partner {
  slug: string;
  nameEn: string;
  nameAr: string;
  category: PartnerCategory;
  cityEn: string;
  cityAr: string;
  /** The member benefit, stated plainly. e.g. "15% off consultations". */
  benefitEn: string;
  benefitAr: string;
  /** Optional honest note / conditions. */
  noteEn?: string;
  noteAr?: string;
  logoUrl?: string | null;
}

/**
 * Populate with real signed partners, e.g.:
 *   {
 *     slug: "example-vet-riyadh",
 *     nameEn: "Example Veterinary Clinic", nameAr: "عيادة … البيطرية",
 *     category: "VET", cityEn: "Riyadh", cityAr: "الرياض",
 *     benefitEn: "Member rate on consultations", benefitAr: "سعر العضو على الاستشارات",
 *   }
 */
export const PARTNERS: Partner[] = [];

export const CATEGORY_LABEL: Record<PartnerCategory, { en: string; ar: string }> = {
  VET: { en: "Veterinary", ar: "عيادات بيطرية" },
  GROOMING: { en: "Grooming", ar: "العناية والتجميل" },
  RETAIL: { en: "Pet retail", ar: "متاجر مستلزمات" },
  BOARDING: { en: "Boarding & care", ar: "إيواء ورعاية" },
  OTHER: { en: "More benefits", ar: "مزايا أخرى" },
};

/** The categories present in the current partner list, in display order. */
export function partnerCategories(partners: Partner[] = PARTNERS): PartnerCategory[] {
  const order: PartnerCategory[] = ["VET", "GROOMING", "RETAIL", "BOARDING", "OTHER"];
  return order.filter((cat) => partners.some((p) => p.category === cat));
}
