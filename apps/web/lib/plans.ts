/**
 * Plan catalogue — mirrors the seed + financial model so the marketing site
 * renders correct pricing even before the API is wired. Single source: the
 * Moraqat_Financial_Model.xlsx Unit Economics tab.
 */
export type PlanTier = "essential" | "premium" | "complete-care" | "multi-cat";

export interface Plan {
  tier: PlanTier;
  nameEn: string;
  nameAr: string;
  price: number; // SAR / month
  taglineEn: string;
  taglineAr: string;
  featuresEn: string[];
  featuresAr: string[];
  popular?: boolean;
}

export const PLANS: Plan[] = [
  {
    tier: "essential",
    nameEn: "Essential",
    nameAr: "الأساسية",
    price: 179,
    taglineEn: "Everyday nutrition for one happy cat",
    taglineAr: "تغذية يومية لقط سعيد واحد",
    featuresEn: ["2kg everyday dry food", "15 wet pouches", "7kg clumping litter", "1 treat pack"],
    featuresAr: ["٢كجم طعام جاف يومي", "١٥ كيس رطب", "٧كجم رمل متكتل", "علبة مكافآت"],
  },
  {
    tier: "premium",
    nameEn: "Premium",
    nameAr: "المميزة",
    price: 269,
    taglineEn: "Premium food + enrichment",
    taglineAr: "طعام فاخر + إثراء",
    featuresEn: ["2kg premium dry food", "20 premium wet pouches", "7kg litter", "Treats + enrichment toy"],
    featuresAr: ["٢كجم طعام جاف فاخر", "٢٠ كيس رطب فاخر", "٧كجم رمل", "مكافآت + لعبة تفاعلية"],
    popular: true,
  },
  {
    tier: "complete-care",
    nameEn: "Complete Care",
    nameAr: "العناية الكاملة",
    price: 389,
    taglineEn: "The full wellness box",
    taglineAr: "صندوق العناية الكامل",
    featuresEn: ["2.5kg premium dry food", "25 premium wet pouches", "8kg litter", "Dental, supplement & toy"],
    featuresAr: ["٢.٥كجم طعام جاف فاخر", "٢٥ كيس رطب فاخر", "٨كجم رمل", "عناية بالأسنان ومكمل ولعبة"],
  },
  {
    tier: "multi-cat",
    nameEn: "Multi-Cat",
    nameAr: "متعدد القطط",
    price: 329,
    taglineEn: "Scaled for a full household",
    taglineAr: "مصمم لعدة قطط",
    featuresEn: ["3.5kg dry food", "30 wet pouches", "14kg litter", "2 treat packs + toy"],
    featuresAr: ["٣.٥كجم طعام جاف", "٣٠ كيس رطب", "١٤كجم رمل", "علبتا مكافآت + لعبة"],
  },
];
