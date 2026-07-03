/** Minimal, type-safe bilingual dictionary (ar default, en). */
export type Locale = "ar" | "en";

export const dict = {
  ar: {
    dir: "rtl" as const,
    brand: "مرقط",
    nav: { how: "كيف يعمل", plans: "الباقات", products: "المنتجات", about: "من نحن", login: "تسجيل الدخول" },
    announce: "توصيل مجاني في جدة والرياض على أول صندوق 🐾",
    hero: {
      badge: "اشتراك شهري للقطط",
      title: "كل ما يحتاجه قطك،",
      titleAccent: "يصل تلقائياً كل شهر",
      subtitle: "طعام ورمل ومكافآت مختارة بذكاء حسب وزن قطك وعمره وسلالته — يصل إلى بابك في جدة والرياض.",
      cta: "ابدأ اشتراكك",
      ctaSecondary: "كيف يعمل",
    },
    plans: { title: "باقات تناسب كل قط", subtitle: "أسعار شفافة بالريال السعودي. ألغِ في أي وقت.", month: "/ شهرياً", popular: "الأكثر اختياراً", choose: "اختر الباقة" },
    features: { title: "لماذا مرقط؟" },
    footer: "© 2026 مرقط. جميع الحقوق محفوظة.",
  },
  en: {
    dir: "ltr" as const,
    brand: "Moraqat",
    nav: { how: "How it works", plans: "Plans", products: "Products", about: "About", login: "Log in" },
    announce: "Free delivery in Jeddah & Riyadh on your first box 🐾",
    hero: {
      badge: "Monthly cat subscription",
      title: "Everything your cat needs,",
      titleAccent: "delivered every month",
      subtitle: "Food, litter and treats — intelligently sized to your cat's weight, age and breed. Delivered to your door in Jeddah and Riyadh.",
      cta: "Start your box",
      ctaSecondary: "How it works",
    },
    plans: { title: "A plan for every cat", subtitle: "Transparent SAR pricing. Cancel anytime.", month: "/ month", popular: "Most popular", choose: "Choose plan" },
    features: { title: "Why Moraqat?" },
    footer: "© 2026 Moraqat. All rights reserved.",
  },
} as const;

export function getDict(locale: Locale) {
  return dict[locale];
}
