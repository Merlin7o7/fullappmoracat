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
    nav: { how: "كيف تشتغل", plans: "العضوية", products: "المتجر", about: "من احنا", login: "تسجيل الدخول", blog: "المدونة", tools: "حاسبة التغذية", community: "المجتمع", benefits: "مزايا الأعضاء" },
    announce: "نرحّب بقططكم في كل مدن السعودية — انضمّ للمجتمع",
    hero: {
      badge: "عضوية خاصة لأهل القطط",
      title: "قطك يستاهل",
      titleAccent: "هوية تخصّه وحده",
      subtitle:
        "مرقط عضوية تعتني بقطك: هوية رسمية تخصّه، وملف صحي يمشي معاه وين ما راح، وعناية شهرية موجّهة من عمره واحتياجه — ومجتمع من أهل القطط في كل السعودية.",
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
        { eyebrow: "عنايته الشهرية", title: "احتياجاته توصل لبابك", body: "خطة شهرية موجّهة من عمر قطك واحتياجه — أكل ورمل واحتياجاته، مختارة له بعناية، توصل لأي مدينة في السعودية." },
        { eyebrow: "ملفه الصحي", title: "سجله يمشي معه", body: "التطعيمات والوزن وملاحظات الطبيب — كلها في هويته، حاضرة معك في كل زيارة للعيادة." },
        { eyebrow: "مجتمعه", title: "معروف ومحبوب", body: "شارك هوية قطك مع مجتمع من أهل القطط في السعودية — أو خلّه خاص. القرار لك دايم." },
      ],
    },
    plans: {
      title: "عضوية وحدة، تنبني من قطك",
      subtitle: "نرشّح خطة قطك من عمره واحتياجه — اختيار موجّه، لا جداول تخمين. سعر واحد واضح من البداية.",
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
      billingNote: "تُدفع المدة مقدماً — أوقف أو ألغِ متى شئت، ولا تجديد تلقائي أبداً.",
      vatNote: "أسعار نهائية — لا رسوم خفية · التوصيل لكل مدن السعودية",
    },
    voices: { title: "كلام أعضائنا" },
    marquee: ["هوية رسمية لقطك", "سجل صحي يمشي معه", "مجتمع من أهل القطط", "إرشاد تغذية ذكي", "الانضمام مجاناً"],
    faq: {
      title: "أسئلة تسألونها كثير",
      items: [
        { q: "هل هوية القط مجانية؟", a: "نعم — مجانية اليوم ودايم. الهوية والمجتمع لك بلا مقابل، والعضوية المدفوعة اختيارك متى ما جهزت." },
        { q: "وش يوصل في الصندوق؟", a: "احتياجات قطك الشهرية: أكل ورمل ومكافآت، مختارة على عمره واحتياجه — تجهّز خياراتك قبل الدفع." },
        { q: "أي المدن تغطّون؟", a: "التوصيل لكل مدن السعودية. الشركاء المؤسسون (عيادات وعناية) يبدؤون في جدة والرياض — ونقول لك بصدق وين وصلنا." },
        { q: "كيف ألغي؟", a: "متى ما تبي وبنقرة وحدة — بلا مكالمات ولا أسئلة. المدة اللي دفعتها تظل لك كاملة، ولا يوجد تجديد تلقائي أصلاً." },
      ],
    },
    closing: {
      title: "قطك جاهز لهويته؟",
      titleNamed: "{name} جاهز لهويته؟",
      sub: "دقيقتين وتكون الهوية بين يديك — ومعاينتها مجاناً.",
    },
    footerNote: "صُنعت بمحبة لأهل القطط في السعودية",
    footer: "© 2026 مؤسسة عبدالرحمن منصور الغامدي التجارية. جميع الحقوق محفوظة.",
  },
  en: {
    dir: "ltr" as const,
    brand: "Moracat",
    nav: { how: "How it works", plans: "Membership", products: "Shop", about: "About", login: "Log in", blog: "Journal", tools: "Feeding calculator", community: "Community", benefits: "Member benefits" },
    announce: "Now welcoming cats across Saudi Arabia — join the community",
    hero: {
      badge: "The membership for cat people",
      title: "Give your cat",
      titleAccent: "an identity of their own",
      subtitle:
        "Moracat is the membership that takes care of your cat: an official Cat ID, a health record that follows them anywhere, monthly care guided by their age and needs — and a community of cat people across Saudi Arabia.",
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
        { eyebrow: "Their monthly care", title: "Care that arrives", body: "A monthly plan guided by your cat's age and needs — food, litter and essentials, chosen carefully for them, delivered to any city in Saudi Arabia." },
        { eyebrow: "Their health record", title: "A record that travels", body: "Vaccinations, weight and vet notes live on their ID — in your pocket at every vet visit." },
        { eyebrow: "Their community", title: "Seen and celebrated", body: "Share your cat's identity in a growing community of Saudi cat people — or keep them private. The choice is always yours." },
      ],
    },
    plans: {
      title: "One membership, built from your cat",
      subtitle: "We guide you to your cat's plan from their age and needs — a guided fit, not guesswork. One clear price from the start.",
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
      billingNote: "Paid upfront per term — pause or cancel anytime, and never an automatic renewal.",
      vatNote: "Final prices — no hidden fees · Delivery across Saudi Arabia",
    },
    voices: { title: "From members who mean it" },
    marquee: ["An official Cat ID", "A health record that travels", "A community of cat people", "Smart feeding guidance", "Free to join"],
    faq: {
      title: "Questions we hear a lot",
      items: [
        { q: "Is the Cat ID free?", a: "Yes — free today and always. The ID and the community cost nothing; the paid membership is your choice, whenever you're ready." },
        { q: "What's in the box?", a: "Your cat's monthly essentials: food, litter and treats, chosen for their age and needs — you set your picks before you pay." },
        { q: "Which cities do you cover?", a: "Delivery reaches every city in Saudi Arabia. Founding partners (vets and grooming) start in Jeddah and Riyadh — and we'll always tell you honestly where we've reached." },
        { q: "How do I cancel?", a: "Anytime, in one tap — no calls, no questions. The term you paid for stays yours in full, and there's never an automatic renewal." },
      ],
    },
    closing: {
      title: "Ready for their ID?",
      titleNamed: "Ready for {name}'s ID?",
      sub: "Two minutes, and it's in your hands — the preview is free.",
    },
    footerNote: "Made with love for Saudi cat people",
    footer: "© 2026 Abdulrahman Mansour Alghamdi Trading Establishment. All rights reserved.",
  },
} as const;

export function getDict(locale: Locale) {
  return dict[locale];
}
