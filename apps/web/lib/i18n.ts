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
      badge: "التعداد الوطني للقطط",
      // The headline is the census question, and nothing else. `titleAccent` is
      // the tail of that same sentence rather than a second line: it carries the
      // marker-underline signature, and the two always render as one phrase —
      // "كم قط يعيش في السعودية؟" — including where auth-shell concatenates them.
      title: "كم قط يعيش",
      titleAccent: "في السعودية؟",
      subtitle:
        "إحنا نعدّهم، قط قط. سجّل قطك وياخذ هوية رسمية باسمه ورقمه — مجاناً، في أقل من دقيقتين. سجله الصحي ومجتمع أهل القطط يجون معها.",
      namePrompt: "وش اسم قطك؟",
      namePlaceholder: "مثلاً: سمسم",
      cta: "سجّل قطك",
      ctaSecondary: "وش يعني التعداد؟",
      trust: "مجاناً · أقل من دقيقتين · بدون بطاقة",
      previewNote: "هذي معاينة — رقم قطك الحقيقي يطلع لحظة التسجيل.",
    },
    features: {
      title: "وش تعني العضوية؟",
      lede: "عضوية وحدة تجمع كل شي يخص قطك — هويته، وعنايته الشهرية، وناسه.",
      items: [
        { eyebrow: "هويته", title: "هوية رسمية", body: "كل قط له هوية خاصة فيها اسمه وصورته ورقمه — نفس الهوية اللي يحملها طول عمره." },
        { eyebrow: "عنايته الشهرية — قريباً", title: "عناية شهرية، لسّا ما فتحت", body: "نجهّز خطة شهرية موجّهة من عمر قطك واحتياجه. ما فتحنا الاشتراكات بعد، وما نبيع شي اليوم — نعدّ القطط أولاً. أول ما تفتح، أهل التعداد أول من يدري." },
        { eyebrow: "ملفه الصحي", title: "سجله يمشي معه", body: "التطعيمات والوزن وملاحظات الطبيب — كلها في هويته، حاضرة معك في كل زيارة للعيادة." },
        { eyebrow: "مجتمعه", title: "معروف ومحبوب", body: "قطك ينضم لمجتمع أهل القطط في السعودية من أول يوم — وتقدر تخليه خاص بضغطة. القرار لك دايم." },
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
      billingNote: "شهراً بشهر أو مدة مدفوعة مقدماً — خصم على مدتَي ٦ و١٢ شهراً. أوقف أو ألغِ متى شئت، ولا تجديد بدون علمك.",
      vatNote: "أسعار نهائية — لا رسوم خفية · التوصيل لكل مدن السعودية",
    },
    /**
     * The Census (MRC-GTM-001 §1). Every number shown here comes from the
     * database — never rounded, never seeded, never projected (R040/R006).
     * There is deliberately no "N places left" line: we publish the true count
     * and the true cohort size and let the reader subtract.
     */
    census: {
      eyebrow: "التعداد الوطني للقطط",
      counterLabel: "قط مسجّل في السعودية",
      counterLabelOne: "قط مسجّل في السعودية",
      counterLoading: "نحسب…",
      counterUnavailable: "العدّاد مو متاح الحين",
      title: "العدّ بدأ",
      body:
        "ما فيه سجل وطني للقطط في السعودية. إحنا نبنيه — وقطك يقدر يكون فيه. كل تسجيل ياخذ رقمه بالترتيب، ورقمك هو رقمك للأبد.",
      foundingTitle: "الأعضاء المؤسِّسون",
      foundingBody:
        "أول ١٠٠٠ قط يتسجّل يحمل صفة «عضو مؤسِّس — دفعة الرياض ٢٠٢٦» في هويته، دايماً. الأرقام متسلسلة فعلاً: رقم قطك هو ترتيبه الحقيقي في التعداد.",
      foundingClosed:
        "اكتملت دفعة الأعضاء المؤسِّسين (أول ١٠٠٠ قط). التسجيل مستمر — وكل قط يظل ياخذ رقمه بالترتيب.",
      latestPrefix: "آخر تسجيل:",
      soonTitle: "وش الجاي؟",
      soonBody:
        "الاشتراك الشهري لعناية قطك يفتح بعد التعداد. ما نبيع شي اليوم، وما نطلب بطاقة. تسجيل قطك يحجز لك مكانك في قائمة الانتظار — وبس.",
    },
    /**
     * Joining the waitlist is a *consequence* of registering, so it is stated
     * plainly at the moment of registration and never pre-ticked (PDPL, R106).
     */
    waitlist: {
      consentLabel: "أبلغوني بالإيميل أول ما تفتح العضويات",
      consentHelp:
        "تسجيل قطك يضيفك لقائمة انتظار العضوية. ما نرسل لك شي إلا إذا وافقت هنا، وتقدر توقف الرسائل في أي وقت. بياناتك محفوظة داخل السعودية.",
      positionLabel: "ترتيبك في القائمة",
      positionNote: "ترتيبك حسب وقت انضمامك — ما فيه شي يقدّمك أو يأخّرك.",
    },
    voices: { title: "كلام أعضائنا" },
    marquee: ["هوية رسمية لقطك", "سجل صحي يمشي معه", "مجتمع من أهل القطط", "إرشاد تغذية ذكي", "الانضمام مجاناً"],
    faq: {
      title: "أسئلة تسألونها كثير",
      items: [
        { q: "هل هوية القط مجانية؟", a: "نعم — مجانية اليوم ودايم. الهوية والسجل الصحي والمجتمع لك بلا مقابل، وما نطلب بطاقة." },
        { q: "وش تبيعون الحين؟", a: "ولا شي. إحنا في مرحلة التعداد — نسجّل القطط بس. الاشتراك الشهري للعناية يفتح بعدين، ونبلّغ المسجّلين أول ما يصير." },
        { q: "لما تفتح العضويات، لازم أدفع عشان أحتفظ بالهوية؟", a: "لا. حسابك وهوية قطك وسجله والمجتمع تظل مجانية — هذا مكتوب في شروطنا. الاشتراك الشهري للعناية شي اختياري منفصل، وتسجيلك اليوم يحجز مكانك في قائمة الانتظار بس." },
        { q: "وش يعني «عضو مؤسِّس»؟", a: "أول ١٠٠٠ قط يتسجّل. الصفة تجي من رقم قطك المتسلسل نفسه — مو شي نعطيه أو نسحبه، ورقمه يظل رقمه." },
        { q: "من يقدر يشوف سجل قطك الصحي؟", a: "أنت بس — إلا إذا منحت عيادة موثّقة إذن الاطلاع وقت الزيارة، وتقدر تسحبه بعدها بضغطة. كل مرة يُفتح فيها السجل تجدها مكتوبة في سجل الاطلاع داخل حسابك." },
        { q: "وش تسوون ببياناتي؟", a: "نحفظها داخل السعودية ونستخدمها لهوية قطك وسجله. ما نرسل لك إيميل تسويقي إلا بموافقتك، وتقدر توقفها أو تحذف بياناتك متى ما تبي." },
      ],
      /**
       * Rendered ONLY when commerceEnabled() — in the visible FAQ and in the
       * FAQPage JSON-LD alike. During the Census nothing is for sale, and no
       * markup may reveal the paid product before launch (R040/R006).
       */
      commerceItems: [
        { q: "كيف يشتغل اشتراك العناية؟", a: "خطة شهرية تُحسب من ملف قطك نفسه — وزنه وعمره وبيته — مو جدول فئات تختار منه. شهراً بشهر أو مدة مدفوعة مقدماً، مع خصم على مدتَي ٦ و١٢ شهراً." },
        { q: "أقدر ألغي أو أوقف الاشتراك؟", a: "متى ما تبي، وبضغطة — إيقاف مؤقت أو إلغاء كامل. ولا تجديد بدون علمك: نذكّرك قبل أي خصم." },
        { q: "وين توصّلون؟", a: "التوصيل لكل مدن السعودية، والأسعار نهائية بلا رسوم خفية." },
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
      badge: "The Saudi Cat Census",
      title: "How many cats live in",
      titleAccent: "Saudi Arabia?",
      subtitle:
        "We're counting them, one cat at a time. Register your cat and they get an official Cat ID with their name and their own number — free, in under two minutes. Their health record and the community come with it.",
      namePrompt: "What's your cat's name?",
      namePlaceholder: "e.g. Simba",
      cta: "Register your cat",
      ctaSecondary: "What is the census?",
      trust: "Free · Under two minutes · No card needed",
      previewNote: "This is a preview — your cat's real number is issued the moment you register.",
    },
    features: {
      title: "What membership means",
      lede: "One membership that carries everything about your cat — their identity, their monthly care, and their people.",
      items: [
        { eyebrow: "Their identity", title: "An identity, officially", body: "Every cat gets a unique Cat ID with their name, photo and number — the same one they'll carry for life." },
        { eyebrow: "Their monthly care — coming", title: "Monthly care, not open yet", body: "We're building a monthly plan guided by your cat's age and needs. Subscriptions aren't open and nothing is for sale today — we're counting cats first. When it opens, the census cats hear first." },
        { eyebrow: "Their health record", title: "A record that travels", body: "Vaccinations, weight and vet notes live on their ID — in your pocket at every vet visit." },
        { eyebrow: "Their community", title: "Seen and celebrated", body: "Your cat joins a growing community of Saudi cat people from day one — and one tap keeps them private. The choice is always yours." },
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
      billingNote: "Month to month, or prepay a term — 6 and 12-month terms carry a discount. Pause or cancel anytime; nothing ever renews without you knowing.",
      vatNote: "Final prices — no hidden fees · Delivery across Saudi Arabia",
    },
    census: {
      eyebrow: "The Saudi Cat Census",
      counterLabel: "cats registered in Saudi Arabia",
      counterLabelOne: "cat registered in Saudi Arabia",
      counterLoading: "Counting…",
      counterUnavailable: "The counter is unavailable right now",
      title: "The count has started",
      body:
        "There is no national register of cats in Saudi Arabia. We're building one — and your cat can be in it. Every registration takes the next number in order, and your number is yours for good.",
      foundingTitle: "Founding Members",
      foundingBody:
        "The first 1,000 cats registered carry “Founding Member — Riyadh Class of 2026” on their ID, permanently. The numbers are genuinely sequential: your cat's number is their real place in the count.",
      foundingClosed:
        "The founding cohort (the first 1,000 cats) is complete. Registration continues — every cat still takes the next number in order.",
      latestPrefix: "Most recent:",
      soonTitle: "What's next",
      soonBody:
        "The monthly care subscription opens after the census. Nothing is for sale today and we never ask for a card. Registering your cat holds your place on the waitlist — that's all it does.",
    },
    waitlist: {
      consentLabel: "Email me when memberships open",
      consentHelp:
        "Registering your cat adds you to the membership waitlist. We won't email you unless you agree here, and you can stop the emails at any time. Your data is stored inside Saudi Arabia.",
      positionLabel: "Your place in line",
      positionNote: "Your place is simply when you joined — nothing moves you up or down.",
    },
    voices: { title: "From members who mean it" },
    marquee: ["An official Cat ID", "A health record that travels", "A community of cat people", "Smart feeding guidance", "Free to join"],
    faq: {
      title: "Questions we hear a lot",
      items: [
        { q: "Is the Cat ID free?", a: "Yes — free today and always. The ID, the health record and the community cost nothing, and we never ask for a card." },
        { q: "What are you selling right now?", a: "Nothing. We're in the census phase — we're only registering cats. The monthly care subscription opens later, and registered cats hear first." },
        { q: "When memberships open, do I have to pay to keep the ID?", a: "No. Your account, your cat's ID, their record and the community stay free — it's written in our terms. The monthly care subscription is a separate, optional thing; registering today only holds your place on the waitlist." },
        { q: "What does “Founding Member” mean?", a: "The first 1,000 cats registered. The status comes from your cat's sequential number itself — it isn't something we hand out or take away, and their number stays theirs." },
        { q: "Who can see my cat's health record?", a: "Only you — unless you grant a verified clinic access at the time of a visit, and you can take it back in one tap afterwards. Every time the record is opened, you'll find it written in the access ledger inside your account." },
        { q: "What do you do with my data?", a: "We store it inside Saudi Arabia and use it for your cat's ID and record. We don't send marketing email without your consent, and you can withdraw it or delete your data at any time." },
      ],
      /**
       * Rendered ONLY when commerceEnabled() — in the visible FAQ and in the
       * FAQPage JSON-LD alike. During the Census nothing is for sale, and no
       * markup may reveal the paid product before launch (R040/R006).
       */
      commerceItems: [
        { q: "How does the care subscription work?", a: "A monthly plan computed from your cat's own profile — their weight, age and household — never picked from a tier table. Month to month, or prepay a term; 6 and 12-month terms carry a discount." },
        { q: "Can I cancel or pause?", a: "Anytime, in one tap — pause for a while or cancel outright. And nothing ever renews without you knowing: we remind you before any charge." },
        { q: "Where do you deliver?", a: "Every city in Saudi Arabia — and prices are final, with no hidden fees." },
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
