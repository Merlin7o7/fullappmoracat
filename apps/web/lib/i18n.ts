/**
 * Bilingual dictionary. Arabic voice = Najdi Saudi dialect — warm, premium,
 * a little playful, never stiff MSA nor slang-heavy. Voice per the Design
 * Authority: membership-first (member / Cat ID / benefit, R087); the cat is
 * the hero (P09). Latin brand is "Moracat"; Arabic brand is "مرقط".
 */
export type Locale = "ar" | "en";

export const dict = {
  ar: {
    dir: "rtl" as const,
    brand: "مرقط",
    nav: { how: "كيف تشتغل", plans: "العضوية", products: "المتجر", about: "من احنا", login: "تسجيل الدخول" },
    announce: "عضويتنا صارت في جدة والرياض — حيّا الله قطّطكم 🐾",
    hero: {
      badge: "عضوية خاصة لأهل القطط",
      title: "قطك يستاهل",
      titleAccent: "هوية تخصّه وحده",
      subtitle:
        "مرقط عضوية لكل واحد ياخذ قطه على محمل الجد. هوية رسمية لقطك، وملف صحي يمشي معاه وين ما راح، وأسعار عضوية عند العيادات والمتاجر في جدة والرياض.",
      namePrompt: "وش اسم قطك؟",
      namePlaceholder: "مثلاً: سمسم",
      cta: "سوِّ هوية قطك",
      ctaSecondary: "كيف تشتغل العضوية",
      trust: "معاينة مجانية · ألغِ متى ما تبي · بدون رسوم خفية",
      previewNote: "هذي معاينة — هوية قطك الحقيقية تطلع أول ما تشترك.",
    },
    features: {
      title: "وش تعني العضوية؟",
      lede: "مو مجرد صندوق شهري — علاقة تسهّل عليك العناية بقطك وتخلّيه معروف.",
      items: [
        { title: "هوية رسمية", body: "كل قط له هوية خاصة فيها اسمه وصورته ورقمه — نفس الهوية اللي يحملها طول عمره." },
        { title: "نعرف قطك", body: "الوزن والعمر والفصيلة نسوّي منها تغذية ذكية وتذكيرات، فالعناية فيه تصير أسهل." },
        { title: "قيمة تشوفها بعينك", body: "أسعار عضوية على الأكل والرمل والأساسيات، ونحسب لك كل ريال توفّره — دليل مو وعود." },
        { title: "ما يخلص عليك شي", body: "الأكل والرمل المناسبين يوصلونك بوقتهم كل شهر. أوقف أو تخطّى أو غيّر متى ما احتجت." },
      ],
    },
    plans: {
      title: "اختر عضوية قطك",
      subtitle: "سعر واحد واضح. ألغِ متى ما تبي وبدون رسوم خفية — التوفير ميزة للعضو، مو هدفنا.",
      month: "/ شهرياً",
      popular: "الأكثر طلباً",
      choose: "ابدأ عضويتك",
    },
    voices: { title: "كلام أعضائنا" },
    footer: "© 2026 مرقط. كل الحقوق محفوظة.",
  },
  en: {
    dir: "ltr" as const,
    brand: "Moracat",
    nav: { how: "How it works", plans: "Membership", products: "Shop", about: "About", login: "Log in" },
    announce: "Membership is live in Jeddah & Riyadh — welcoming new cats 🐾",
    hero: {
      badge: "The membership for cat people",
      title: "Give your cat",
      titleAccent: "an identity of their own",
      subtitle:
        "Moracat is a membership for people who take their cats seriously. An official Cat ID, a health record that follows them anywhere, and member rates at vets and stores across Jeddah & Riyadh.",
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
    footer: "© 2026 Moracat. All rights reserved.",
  },
} as const;

export function getDict(locale: Locale) {
  return dict[locale];
}
