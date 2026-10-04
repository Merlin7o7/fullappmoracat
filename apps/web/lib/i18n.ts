/**
 * Bilingual dictionary. Arabic voice = Najdi Saudi dialect — warm, premium,
 * a little playful, never stiff MSA nor slang-heavy. Voice per the Design
 * Authority: membership-first (member / Cat ID / benefit, R087); the cat is
 * the hero (P09). Latin brand is "Moracat"; Arabic brand is "مرقط".
 */
import { RENEWAL_BILLING_NOTE, RENEWAL_FAQ_ANSWER } from "@moraqat/core";
export type Locale = "ar" | "en";

export const dict = {
  ar: {
    dir: "rtl" as const,
    brand: "مرقط",
    nav: { how: "كيف تشتغل", plans: "خطط العناية", products: "المتجر", about: "من احنا", login: "تسجيل الدخول", blog: "المدونة", tools: "حاسبة التغذية", community: "المجتمع", benefits: "مزايا الأعضاء", adopt: "تبنَّ قطاً", lostFound: "مفقود وموجود" },
    announce: "نرحّب بقططكم في كل مدن السعودية — انضمّ للمجتمع",
    hero: {
      badge: "سجل مرقط — لقطط السعودية",
      // The headline says what the owner gets, in the brand line's own words
      // ("لِحياة قطّك كلّها"); the census is the proof underneath, not the pitch.
      // `titleAccent` is the tail of the same sentence: it carries the
      // marker-underline signature, and the two always render as one phrase —
      // "هوية لقطك، لحياته كلّها" — including where auth-shell concatenates them.
      // "رسمية" and "الوطني" are deliberately absent from marketing claims: those
      // words belong to the state, and a private register must not borrow them.
      title: "هوية لقطك،",
      titleAccent: "لحياته كلّها",
      subtitle:
        "لو ضاع، اللي يلقاه يوصلك — بدون ما ينكشف رقمك. وسجله الصحي معه في أي عيادة. سجّل قطك وياخذ هويته باسمه ورقمه — مجاناً، في أقل من دقيقتين.",
      namePrompt: "وش اسم قطك؟",
      namePlaceholder: "مثلاً: سمسم",
      cta: "سجّل قطك",
      ctaSecondary: "وش هي هوية مرقط؟",
      trust: "مجاناً · أقل من دقيقتين · بدون بطاقة",
      previewNote: "هذي معاينة — رقم قطك الحقيقي يطلع لحظة التسجيل.",
      // Mobile-first hero (audit 2026-10-04 Problem 4): one sentence under the
      // card; the rest of `subtitle` moves into the first story chapter.
      subtitleShort: "لو ضاع، اللي يلقاه يوصلك بدون ما ينكشف رقمك — وسجله الصحي معه في أي عيادة.",
      subtitleRest: "سجّل قطك وياخذ هويته باسمه ورقمه — مجاناً، في أقل من دقيقتين.",
    },
    features: {
      title: "وش تسوّي الهوية؟",
      lede: "هوية وحدة تمشي مع قطك طول عمره — ترجّعه لك لو ضاع، وتحفظ سجله، وتعرّف الناس عليه.",
      items: [
        { eyebrow: "هويته", title: "هوية باسمه ورقمه", body: "كل قط له هوية خاصة فيها اسمه وصورته ورقمه — نفس الهوية اللي يحملها طول عمره." },
        { eyebrow: "عنايته الشهرية — لاحقاً", title: "خطة عناية شهرية، لسّا ما فتحت", body: "نجهّز خطة عناية شهرية مبنية على عمر قطك واحتياجه. ما نبيع شي اليوم — نسجّل القطط أولاً. نعلن موعدها هنا وبالإيميل لمن وافق." },
        { eyebrow: "ملفه الصحي", title: "سجله يمشي معه", body: "التطعيمات والوزن وملاحظات الطبيب — كلها في هويته، حاضرة معك في كل زيارة للعيادة." },
        { eyebrow: "مجتمعه", title: "معروف ومحبوب", body: "قطك ينضم لمجتمع أهل القطط في السعودية من أول يوم — وتقدر تخليه خاص بضغطة. القرار لك دايم." },
      ],
    },
    plans: {
      title: "خطة عناية وحدة، تنبني من قطك",
      subtitle: "نرشّح خطة قطك من عمره واحتياجه — اختيار موجّه، لا جداول تخمين. سعر واحد واضح من البداية.",
      from: "تبدأ من",
      month: "/ شهرياً",
      cta: "ابنِ خطة قطك",
      soonBadge: "لاحقاً",
      soonNote: "خطط العناية الشهرية تفتح لاحقاً — نعلن موعدها هنا وبالإيميل لمن وافق. هوية قطك مجانية من اليوم.",
      includes: [
        "عناية شهرية على مقاس قطك — أكل ورمل ومكافآت",
        "هوية دائمة وسجل صحي يمشي معه",
        "خطة مبنية من عمر قطك ووزنه وعدد قطط البيت",
        "مجتمع أهل القطط — وقطك نجمه",
      ],
      billingNote: RENEWAL_BILLING_NOTE.ar,
      vatNote: "أسعار نهائية — لا رسوم خفية · التوصيل حالياً في الرياض وجدة",
    },
    /**
     * The Census (MRC-GTM-001 §1). Every number shown here comes from the
     * database — never rounded, never seeded, never projected (R040/R006).
     * There is deliberately no "N places left" line: we publish the true count
     * and the true cohort size and let the reader subtract.
     */
    census: {
      eyebrow: "سجل مرقط",
      counterLabel: "قطة مسجّلة في مرقط",
      counterLabelOne: "قطة مسجّلة في مرقط",
      counterLoading: "نحسب…",
      counterUnavailable: "العدّاد مو متاح الحين",
      title: "العدّ بدأ",
      body:
        "مرقط سجل خاص بقطط السعودية تديره شركة سعودية — ليس جهة حكومية. كل قط ينضم ياخذ رقمه بالترتيب، ورقمه له للأبد.",
      foundingTitle: "الأعضاء المؤسِّسون",
      foundingBody:
        "أول 1000 قط ينضم يحمل صفة «عضو مؤسِّس» في هويته، مع دفعة مدينته وسنة انضمامه — دايماً. الأرقام متسلسلة فعلاً: رقم قطك هو ترتيبه الحقيقي في السجل.",
      foundingClosed:
        "اكتملت دفعة الأعضاء المؤسِّسين (أول 1000 قط). التسجيل مستمر — وكل قط يظل ياخذ رقمه بالترتيب.",
      latestPrefix: "آخر تسجيل:",
      soonTitle: "وش الجاي؟",
      soonBody:
        "خطط العناية الشهرية تفتح لاحقاً — نعلن موعدها هنا وبالإيميل لمن وافق. ما نبيع شي اليوم، وما نطلب بطاقة.",
    },
    /**
     * Joining the waitlist is a *consequence* of registering, so it is stated
     * plainly at the moment of registration and never pre-ticked (PDPL, R106).
     */
    waitlist: {
      consentLabel: "أبغى أعرف أول ما تفتح خطط العناية",
      consentHelp:
        "ما نرسل لك شي عن خطط العناية إلا إذا وافقت هنا، وتقدر توقف الرسائل في أي وقت. نحمي بياناتك وفق نظام حماية البيانات الشخصية — التفاصيل في سياسة الخصوصية.",
      positionLabel: "ترتيبك في القائمة",
      positionNote: "ترتيبك حسب وقت انضمامك — ما فيه شي يقدّمك أو يأخّرك.",
    },
    voices: { title: "كلام أعضائنا" },
    marquee: ["هوية لقطك باسمه ورقمه", "تذكير بتطعيماته ووزنه", "ملخص صحي لأي عيادة", "ألبوم لحياته كلها", "مجتمع من أهل القطط", "الانضمام مجاناً"],
    faq: {
      title: "أسئلة تسألونها كثير",
      items: [
        { q: "هل هوية القط مجانية؟", a: "نعم — مجانية اليوم ودايم. الهوية والسجل الصحي والمجتمع لك بلا مقابل، وما نطلب بطاقة." },
        { q: "وش تبيعون الحين؟", a: "ولا شي. إحنا في مرحلة التسجيل — نسجّل القطط بس. خطط العناية الشهرية تفتح لاحقاً — نعلن موعدها هنا وبالإيميل لمن وافق." },
        { q: "لما تفتح خطط العناية، لازم أدفع عشان أحتفظ بالهوية؟", a: "لا. حسابك وهوية قطك وسجله والمجتمع تظل مجانية — هذا مكتوب في شروطنا. خطة العناية الشهرية شي اختياري منفصل." },
        { q: "وش يعني «عضو مؤسِّس»؟", a: "أول 1000 قط يتسجّل. الصفة تجي من رقم قطك المتسلسل نفسه — مو شي نعطيه أو نسحبه، ورقمه يظل رقمه." },
        { q: "من يقدر يشوف سجل قطك الصحي؟", a: "أنت. العيادات الموثّقة تشوف بس حداً أدنى للسلامة — مثل الحساسية والأدوية الحالية — لأن حساسية مخفية ممكن تكلّف قطك حياته. الباقي ما تشوفه عيادة إلا إذا منحتها الإذن، وتسحبه بضغطة. وكل مرة يُفتح فيها السجل تلقاها مكتوبة في سجل الاطلاع داخل حسابك." },
        { q: "وش تسوون ببياناتي؟", a: "نستخدمها لهوية قطك وسجله، وما نبيعها لأحد. نحمي بياناتك وفق نظام حماية البيانات الشخصية — التفاصيل في سياسة الخصوصية. ما نرسل لك إيميل تسويقي إلا بموافقتك، وتقدر توقفه أو تحذف بياناتك متى ما تبي." },
      ],
      /**
       * Rendered ONLY when commerceEnabled() — in the visible FAQ and in the
       * FAQPage JSON-LD alike. During the Census nothing is for sale, and no
       * markup may reveal the paid product before launch (R040/R006).
       */
      commerceItems: [
        { q: "كيف تشتغل خطة العناية؟", a: "أربع خطط شهرية، ونقترح عليك الأنسب من ملف قطك — عمره ووزنه وعدد قطط البيت. شهر واحد أو مدة مدفوعة مقدّماً، مع خصم على مدتَي 6 و12 شهراً." },
        { q: "أقدر ألغي أو أوقف خطة العناية؟", a: RENEWAL_FAQ_ANSWER.ar },
        { q: "وين توصّلون؟", a: "حالياً في الرياض وجدة، وبقية المدن تباعاً — وهوية قطك وسجله متاحة في كل مكان من اليوم. الأسعار نهائية بلا رسوم خفية." },
      ],
    },
    closing: {
      title: "قطك جاهز لهويته؟",
      titleNamed: "{name} جاهز لهويته؟",
      sub: "أقل من دقيقتين وتكون الهوية بين يديك — ومجانية دايم.",
    },
    footerNote: "صُنعت بمحبة لأهل القطط في السعودية",
    footer: "© 2026 مؤسسة عبدالرحمن منصور الغامدي التجارية. جميع الحقوق محفوظة.",
  },
  en: {
    dir: "ltr" as const,
    brand: "Moracat",
    nav: { how: "How it works", plans: "Care plans", products: "Shop", about: "About", login: "Log in", blog: "Journal", tools: "Feeding calculator", community: "Community", benefits: "Member benefits", adopt: "Adopt", lostFound: "Lost & Found" },
    announce: "Now welcoming cats across Saudi Arabia — join the community",
    hero: {
      badge: "The Moracat register — for Saudi cats",
      title: "An ID for your cat,",
      titleAccent: "for their whole life",
      subtitle:
        "If they're ever lost, whoever finds them can reach you — without seeing your number. And their health record walks into any clinic with them. Register your cat and they get a Cat ID with their name and their own number — free, in under two minutes.",
      namePrompt: "What's your cat's name?",
      namePlaceholder: "e.g. Simba",
      cta: "Register your cat",
      ctaSecondary: "What is a Moracat ID?",
      trust: "Free · Under two minutes · No card needed",
      previewNote: "This is a preview — your cat's real number is issued the moment you register.",
      subtitleShort: "If they're ever lost, whoever finds them reaches you without seeing your number — and their health record walks into any clinic with them.",
      subtitleRest: "Register your cat and they get a Cat ID with their name and their own number — free, in under two minutes.",
    },
    features: {
      title: "What the Cat ID does",
      lede: "One identity that stays with your cat for life — it brings them home if they're lost, keeps their record, and tells people who they are.",
      items: [
        { eyebrow: "Their identity", title: "An ID with their name and number", body: "Every cat gets a unique Cat ID with their name, photo and number — the same one they'll carry for life." },
        { eyebrow: "Their monthly care — later", title: "A monthly care plan, not open yet", body: "We're building a monthly care plan shaped by your cat's age and needs. Nothing is for sale today — we're registering cats first. We'll announce the date here, and by email to those who agreed." },
        { eyebrow: "Their health record", title: "A record that travels", body: "Vaccinations, weight and vet notes live on their ID — in your pocket at every vet visit." },
        { eyebrow: "Their community", title: "Seen and celebrated", body: "Your cat joins a growing community of Saudi cat people from day one — and one tap keeps them private. The choice is always yours." },
      ],
    },
    plans: {
      title: "One care plan, built from your cat",
      subtitle: "We guide you to your cat's plan from their age and needs — a guided fit, not guesswork. One clear price from the start.",
      from: "From",
      month: "/ month",
      cta: "Build your cat's plan",
      soonBadge: "Later",
      soonNote: "Monthly care plans open later — we'll announce the date here, and by email to those who agreed. Your cat's ID is free from today.",
      includes: [
        "Monthly care sized to your cat — food, litter and treats",
        "A permanent Cat ID and a health record that travels",
        "A plan shaped by your cat's age, weight and household",
        "A community of cat people — starring your cat",
      ],
      billingNote: RENEWAL_BILLING_NOTE.en,
      vatNote: "Final prices — no hidden fees · Delivering in Riyadh and Jeddah for now",
    },
    census: {
      eyebrow: "The Moracat register",
      counterLabel: "cats registered on Moracat",
      counterLabelOne: "cat registered on Moracat",
      counterLoading: "Counting…",
      counterUnavailable: "The counter is unavailable right now",
      title: "The count has started",
      body:
        "Moracat is a private register for Saudi cats, run by a Saudi company — not a government body. Every cat who joins takes the next number in order, and that number is theirs for good.",
      foundingTitle: "Founding Members",
      foundingBody:
        "The first 1,000 cats to join carry “Founding Member” on their ID — with their own city's class and year — permanently. The numbers are genuinely sequential: your cat's number is their real place in the register.",
      foundingClosed:
        "The founding cohort (the first 1,000 cats) is complete. Registration continues — every cat still takes the next number in order.",
      latestPrefix: "Most recent:",
      soonTitle: "What's next",
      soonBody:
        "Monthly care plans open later — we'll announce the date here, and by email to those who agreed. Nothing is for sale today, and we never ask for a card.",
    },
    waitlist: {
      consentLabel: "Tell me as soon as care plans open",
      consentHelp:
        "We won't email you about care plans unless you agree here, and you can stop the emails at any time. We protect your data under Saudi PDPL — details in our Privacy Policy.",
      positionLabel: "Your place in line",
      positionNote: "Your place is simply when you joined — nothing moves you up or down.",
    },
    voices: { title: "From members who mean it" },
    marquee: ["A Cat ID with their name and number", "Reminders for vaccines and weigh-ins", "A health summary for any clinic", "An album for their whole life", "A community of cat people", "Free to join"],
    faq: {
      title: "Questions we hear a lot",
      items: [
        { q: "Is the Cat ID free?", a: "Yes — free today and always. The ID, the health record and the community cost nothing, and we never ask for a card." },
        { q: "What are you selling right now?", a: "Nothing. We're in the registration phase — we're only registering cats. Monthly care plans open later — we'll announce the date here, and by email to those who agreed." },
        { q: "When care plans open, do I have to pay to keep the ID?", a: "No. Your account, your cat's ID, their record and the community stay free — it's written in our terms. The monthly care plan is a separate, optional thing." },
        { q: "What does “Founding Member” mean?", a: "The first 1,000 cats registered. The status comes from your cat's sequential number itself — it isn't something we hand out or take away, and their number stays theirs." },
        { q: "Who can see my cat's health record?", a: "You. Verified clinics see only a minimum of safety data — like allergies and current medications — because a hidden allergy could cost your cat their life. Everything else stays closed to a clinic unless you grant access, and you take it back in one tap. Every time the record is opened, you'll find it written in the access ledger inside your account." },
        { q: "What do you do with my data?", a: "We use it for your cat's ID and record, and never sell it. We protect your data under Saudi PDPL — details in our Privacy Policy. We don't send marketing email without your consent, and you can withdraw it or delete your data at any time." },
      ],
      /**
       * Rendered ONLY when commerceEnabled() — in the visible FAQ and in the
       * FAQPage JSON-LD alike. During the Census nothing is for sale, and no
       * markup may reveal the paid product before launch (R040/R006).
       */
      commerceItems: [
        { q: "How does the care plan work?", a: "Four monthly plans — we suggest the right one from your cat's own profile: age, weight and how many cats share the home. One month or a prepaid term; 6 and 12-month terms carry a discount." },
        { q: "Can I cancel or pause?", a: RENEWAL_FAQ_ANSWER.en },
        { q: "Where do you deliver?", a: "Riyadh and Jeddah for now, more cities in turn — the Cat ID and health record work everywhere today. Prices are final, with no hidden fees." },
      ],
    },
    closing: {
      title: "Ready for their ID?",
      titleNamed: "Ready for {name}'s ID?",
      sub: "Under two minutes, and it's in your hands — free, always.",
    },
    footerNote: "Made with love for Saudi cat people",
    footer: "© 2026 Abdulrahman Mansour Alghamdi Trading Establishment. All rights reserved.",
  },
} as const;

export function getDict(locale: Locale) {
  return dict[locale];
}
