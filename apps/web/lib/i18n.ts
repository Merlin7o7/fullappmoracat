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
    nav: { how: "كيف تشتغل", plans: "العضوية", products: "المتجر", about: "من احنا", login: "تسجيل الدخول", blog: "المدونة", tools: "حاسبة التغذية", community: "المجتمع" },
    announce: "نرحّب بقطّطكم في كل مدن السعودية — انضمّ للمجتمع",
    hero: {
      badge: "عضوية خاصة لأهل القطط",
      title: "قطك يستاهل",
      titleAccent: "هوية تخصّه وحده",
      subtitle:
        "مرقط عضوية تعتني بقطك: هوية رسمية تخصّه، وملف صحي يمشي معاه وين ما راح، وعناية شهرية تنبني من وزنه وعمره — ومجتمع من أهل القطط في كل السعودية.",
      namePrompt: "وش اسم قطك؟",
      namePlaceholder: "مثلاً: سمسم",
      cta: "سوِّ هوية قطك",
      ctaSecondary: "كيف تشتغل العضوية",
      trust: "معاينة مجانية · ألغِ متى ما تبي · بدون رسوم خفية",
      previewNote: "هذي معاينة — هوية قطك الحقيقية تطلع أول ما تشترك.",
    },
    features: {
      title: "وش تعني العضوية؟",
      lede: "عضوية وحدة تجمع كل شي يخص قطك — هويته، وعنايته الشهرية، وناسه.",
      items: [
        { eyebrow: "هويته", title: "هوية رسمية", body: "كل قط له هوية خاصة فيها اسمه وصورته ورقمه — نفس الهوية اللي يحملها طول عمره." },
        { eyebrow: "عنايته الشهرية", title: "احتياجاته توصل لبابك", body: "خطة شهرية تنبني من وزن قطك وعمره — أكل ورمل واحتياجاته، محسوبة عليه بالضبط، توصل لأي مدينة في السعودية." },
        { eyebrow: "ملفه الصحي", title: "سجله يمشي معه", body: "التطعيمات والوزن وملاحظات الطبيب — كلها في هويته، حاضرة معك في كل زيارة للعيادة." },
        { eyebrow: "مجتمعه", title: "معروف ومحبوب", body: "شارك هوية قطك مع مجتمع من أهل القطط في السعودية — أو خلّه خاص. القرار لك دايم." },
      ],
    },
    plans: {
      title: "عضوية وحدة، تنبني من قطك",
      subtitle: "ما تختار من جدول — احنا نحسب خطة قطك من وزنه وعمره. سعر واحد واضح شامل الضريبة، أوقّف أو ألغِ متى ما تبي، ونذكّرك قبل أي تجديد.",
      from: "تبدأ من",
      month: "/ شهرياً",
      cta: "ابنِ خطة قطك",
      soonBadge: "قريب",
      soonNote: "العضويات قريب — سوِّ هوية قطك اليوم وتكون من أول الأعضاء المؤسسين.",
      includes: [
        "عناية شهرية على مقاس قطك — أكل ورمل ومكافآت",
        "الهوية الرسمية وسجل صحي يمشي معه",
        "سعر الأعضاء عند شركائنا المؤسسين",
        "مجتمع أهل القطط — وقطك نجمه",
      ],
      vatNote: "الأسعار شاملة ضريبة القيمة المضافة · التوصيل لكل مدن السعودية",
    },
    voices: { title: "كلام أعضائنا" },
    marquee: ["هوية رسمية لقطك", "سجل صحي يمشي معه", "مجتمع من أهل القطط", "إرشاد تغذية ذكي", "الانضمام مجاناً"],
    closing: {
      title: "قطك جاهز لهويته؟",
      sub: "دقيقتين وتكون الهوية بين يديك — ومعاينتها مجاناً.",
    },
    footerNote: "صُنعت بمحبة لأهل القطط في السعودية",
    footer: "© 2026 مؤسسة عبدالرحمن منصور الغامدي التجارية. جميع الحقوق محفوظة.",
  },
  en: {
    dir: "ltr" as const,
    brand: "Moracat",
    nav: { how: "How it works", plans: "Membership", products: "Shop", about: "About", login: "Log in", blog: "Blog", tools: "Feeding calculator", community: "Community" },
    announce: "Now welcoming cats across Saudi Arabia — join the community",
    hero: {
      badge: "The membership for cat people",
      title: "Give your cat",
      titleAccent: "an identity of their own",
      subtitle:
        "Moracat is the membership that takes care of your cat: an official Cat ID, a health record that follows them anywhere, monthly care built from their weight and age — and a community of cat people across Saudi Arabia.",
      namePrompt: "What's your cat's name?",
      namePlaceholder: "e.g. Simba",
      cta: "Create your cat's ID",
      ctaSecondary: "How membership works",
      trust: "Free to preview · Cancel anytime · No hidden fees",
      previewNote: "This is a preview — your cat's real ID is issued the moment you join.",
    },
    features: {
      title: "What membership means",
      lede: "One membership that carries everything about your cat — their identity, their monthly care, and their people.",
      items: [
        { eyebrow: "Their identity", title: "An identity, officially", body: "Every cat gets a unique Cat ID with their name, photo and number — the same one they'll carry for life." },
        { eyebrow: "Their monthly care", title: "Care that arrives", body: "A monthly plan built from your cat's weight and age — food, litter and essentials, sized exactly to them, delivered to any city in Saudi Arabia." },
        { eyebrow: "Their health record", title: "A record that travels", body: "Vaccinations, weight and vet notes live on their ID — in your pocket at every vet visit." },
        { eyebrow: "Their community", title: "Seen and celebrated", body: "Share your cat's identity in a growing community of Saudi cat people — or keep them private. The choice is always yours." },
      ],
    },
    plans: {
      title: "One membership, built from your cat",
      subtitle: "You don't pick from a table — we compute your cat's plan from their weight and age. One clear price, VAT included; pause or cancel anytime, and we remind you before every renewal.",
      from: "From",
      month: "/ month",
      cta: "Build your cat's plan",
      soonBadge: "Soon",
      soonNote: "Memberships open soon — create your cat's ID today and you'll be first in line as a founding member.",
      includes: [
        "Monthly care sized to your cat — food, litter and treats",
        "The official Cat ID and a health record that travels",
        "Member rates at our founding partners",
        "A community of cat people — starring your cat",
      ],
      vatNote: "Prices include VAT · Delivery across Saudi Arabia",
    },
    voices: { title: "From members who mean it" },
    marquee: ["An official Cat ID", "A health record that travels", "A community of cat people", "Smart feeding guidance", "Free to join"],
    closing: {
      title: "Ready for their ID?",
      sub: "Two minutes, and it's in your hands — the preview is free.",
    },
    footerNote: "Made with love for Saudi cat people",
    footer: "© 2026 Abdulrahman Mansour Alghamdi Trading Establishment. All rights reserved.",
  },
} as const;

export function getDict(locale: Locale) {
  return dict[locale];
}
