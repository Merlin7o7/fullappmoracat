/**
 * Bilingual dictionary (ar default, en). Voice per the Design Authority:
 * warm, plain, membership-first — never "subscription/box/coupon" framing.
 * Lexicon is fixed: member, Cat ID, benefit (R087). The cat is the hero (P09).
 */
export type Locale = "ar" | "en";

export const dict = {
  ar: {
    dir: "rtl" as const,
    brand: "مرقط",
    nav: { how: "كيف تعمل", plans: "العضوية", products: "المتجر", about: "من نحن", login: "تسجيل الدخول" },
    // Honest, warm, no discount-shouting and no fake urgency (R085, R006).
    announce: "العضوية متاحة الآن في جدة والرياض — نرحّب بالقطط الجديدة 🐾",
    hero: {
      badge: "عضوية لمحبي القطط",
      title: "امنح قطك",
      titleAccent: "هويةً تخصه وحده",
      subtitle:
        "مرقط عضوية لمن يهتمون بقططهم حقاً. هوية رسمية لقطك، وسجلٌّ صحي يرافقه أينما ذهب، وأسعار عضوية لدى العيادات والمتاجر في جدة والرياض.",
      namePrompt: "ما اسم قطك؟",
      namePlaceholder: "مثال: سمسم",
      cta: "أنشئ هوية قطك",
      ctaSecondary: "كيف تعمل العضوية",
      trust: "معاينة مجانية · ألغِ في أي وقت · بلا رسوم خفية",
      previewNote: "هذه معاينة — تُصدر هوية قطك الحقيقية لحظة انضمامك.",
    },
    features: {
      title: "ماذا تعني العضوية",
      lede: "ليست صندوقاً شهرياً — بل علاقة تجعل الاعتناء بقطك أسهل، وتجعله معروفاً.",
      items: [
        { title: "هوية رسمية", body: "لكل قط هوية فريدة تحمل اسمه وصورته ورقمه — الهوية نفسها التي يحملها مدى الحياة." },
        { title: "نتعرّف على قطك", body: "الوزن والعمر والسلالة تُشكّل تغذية ذكية وتذكيرات، فيصبح الاعتناء به أقل عناءً." },
        { title: "قيمة تراها بعينك", body: "أسعار عضوية على الطعام والرمل والأساسيات، مع احتساب كل ريال تُوفّره — دليلٌ لا وعود." },
        { title: "لا نفاد بعد اليوم", body: "يصل الطعام والرمل المناسبان في موعدهما كل شهر. أوقف أو تخطَّ أو غيّر متى تغيّرت حياتك." },
      ],
    },
    plans: {
      title: "اختر عضوية قطك",
      subtitle: "سعر واحد واضح. ألغِ في أي وقت بلا رسوم خفية — التوفير ميزة عضوية، لا الغاية.",
      month: "/ شهرياً",
      popular: "الأكثر اختياراً",
      choose: "ابدأ العضوية",
    },
    voices: { title: "من أعضاء يهتمون فعلاً" },
    footer: "© 2026 مرقط. جميع الحقوق محفوظة.",
  },
  en: {
    dir: "ltr" as const,
    brand: "Moraqat",
    nav: { how: "How it works", plans: "Membership", products: "Shop", about: "About", login: "Log in" },
    announce: "Membership is live in Jeddah & Riyadh — welcoming new cats 🐾",
    hero: {
      badge: "The membership for cat people",
      title: "Give your cat",
      titleAccent: "an identity of their own",
      subtitle:
        "Moraqat is a membership for people who take their cats seriously. An official Cat ID, a health record that follows them anywhere, and member rates at vets and stores across Jeddah & Riyadh.",
      namePrompt: "What's your cat's name?",
      namePlaceholder: "e.g. Simba",
      cta: "Create your cat's ID",
      ctaSecondary: "How membership works",
      trust: "Free to preview · Cancel anytime · No hidden fees",
      previewNote: "This is a preview — your cat's real ID is issued the moment you join.",
    },
    features: {
      title: "What membership means",
      lede: "Not a monthly box — a relationship that makes caring for your cat easier, and makes them known.",
      items: [
        { title: "An identity, officially", body: "Every cat gets a unique Cat ID with their name, photo and number — the same one they'll carry for life." },
        { title: "We learn your cat", body: "Weight, age and breed shape smart feeding and reminders, so caring for them takes less thinking." },
        { title: "Value you can see", body: "Member rates on food, litter and essentials, with every riyal saved tallied for you — proof, not a pitch." },
        { title: "Never run out", body: "The right food and litter arrive on time each month. Pause, skip or change whenever life does." },
      ],
    },
    plans: {
      title: "Choose your cat's membership",
      subtitle: "One clear price. Cancel anytime, no hidden fees — the savings are a member perk, not the pitch.",
      month: "/ month",
      popular: "Most chosen",
      choose: "Start membership",
    },
    voices: { title: "From members who mean it" },
    footer: "© 2026 Moraqat. All rights reserved.",
  },
} as const;

export function getDict(locale: Locale) {
  return dict[locale];
}
