// ════════════════════════════════════════════════════════════════════════
//  Legal content — bilingual (ar/en), written to describe what Moracat
//  actually does today (R006 honest by default, R106 PDPL, AD 2.1 framing:
//  a private company's register — never "official"). Every sentence here is
//  checked against the code that does the thing it describes; when the product
//  changes, this file changes in the same commit. Counsel owns final wording.
//
//  Community Mode: nothing is sold and no payment data is collected. The
//  paid-plan terms render only when commerceEnabled() — before that, the
//  terms say plainly that nothing is for sale.
// ════════════════════════════════════════════════════════════════════════

export interface LegalSection {
  heading: { ar: string; en: string };
  body: { ar: string[]; en: string[] };
}

import { LEGAL_ENTITY, CONTACT } from "./org";
import { commerceEnabled } from "./features";
import { RENEWAL_LEGAL } from "@moraqat/core";

export interface LegalDoc {
  slug: string;
  title: { ar: string; en: string };
  updated: string; // ISO date
  intro: { ar: string; en: string };
  sections: LegalSection[];
}

const UPDATED = "2026-10-04";
const CONTACT_AR = `لأي طلب أو سؤال عن بياناتك (اطّلاع، تصحيح، حذف، سحب موافقة)، راسلنا على ${CONTACT.privacyEmail}، أو عبر إنستقرام ${CONTACT.instagramHandle}، أو هاتفياً على ${CONTACT.phoneDisplay}.`;
const CONTACT_EN = `For any request or question about your data (access, correction, deletion, withdrawing consent), contact us at ${CONTACT.privacyEmail}, on Instagram ${CONTACT.instagramHandle}, or by phone at ${CONTACT.phoneDisplay}.`;

/** Paid-plan terms — shown only once the care plans are actually on sale. */
const PAID_TERMS: LegalSection = {
  heading: { ar: "خطط العناية والدفع", en: "Care plans & payment" },
  body: {
    ar: [
      "الحساب وهوية القط والسجل الصحي والمجتمع مجانية، ولا يتوقف أي منها على شراء خطة عناية. خطط العناية الشهرية (قطتي الصغيرة، الأساسيات، العناية الكاملة، التوقيع) مدفوعة.",
      "الحد الأدنى لمدة الخطة شهر واحد. تختار المدة (1 أو 3 أو 6 أو 12 شهراً) وتدفعها كاملة مقدّماً، ويُوصَّل الصندوق شهرياً طوال المدة. يُعرض السعر الكامل ومدة الخطة وما يشمله قبل الدفع.",
      "الأسعار بالريال السعودي، ويظهر في الفاتورة ما يُستحق عليها من ضريبة.",
      RENEWAL_LEGAL.ar,
    ],
    en: [
      "Your account, Cat ID, health record and the community are free, and none of them depends on buying a care plan. Monthly care plans (Kitten, Essentials, Complete, Signature) are paid.",
      "The minimum plan term is one month. You choose the term (1, 3, 6 or 12 months) and pay it in full upfront; the box is delivered monthly across the term. The full price, term and contents are shown before you pay.",
      "Prices are in Saudi Riyals, and any tax due is shown on the invoice.",
      RENEWAL_LEGAL.en,
    ],
  },
};

/** Community Mode — the honest version: nothing is for sale today. */
const NOTHING_SOLD_TERMS: LegalSection = {
  heading: { ar: "المجانية والدفع", en: "What's free, and payment" },
  body: {
    ar: [
      "الحساب وهوية القط والسجل الصحي والمجتمع مجانية اليوم ودائماً، ولا تتوقف على شراء أي شيء.",
      "لا تبيع مرقط شيئاً حالياً ولا تجمع أي بيانات دفع. خطط العناية الشهرية المدفوعة تفتح لاحقاً؛ وقبل فتحها نحدّث هذه الشروط ونعرض السعر والمدة وما تشمله قبل أي دفع.",
    ],
    en: [
      "Your account, Cat ID, health record and the community are free, today and always, and never depend on buying anything.",
      "Moracat sells nothing today and collects no payment data. Paid monthly care plans open later; before they do, we will update these terms, and the price, term and contents are always shown before any payment.",
    ],
  },
};

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: { ar: "سياسة الخصوصية", en: "Privacy Policy" },
    updated: UPDATED,
    intro: {
      ar: `تُشغَّل منصة مرقط من قِبل ${LEGAL_ENTITY.ar}، وهي منصة خاصة وليست جهة حكومية. تشرح هذه السياسة بوضوح ما نجمعه من بيانات، ولماذا، ومن يراها، وأين تُحفظ، وحقوقك بموجب نظام حماية البيانات الشخصية في المملكة العربية السعودية.`,
      en: `Moracat is operated by ${LEGAL_ENTITY.en}, a private company — not a government body. This policy explains plainly what data we collect, why, who can see it, where it is kept, and your rights under Saudi Arabia's Personal Data Protection Law (PDPL).`,
    },
    sections: [
      {
        heading: { ar: "البيانات التي نجمعها", en: "Data we collect" },
        body: {
          ar: [
            "بيانات الحساب: اسمك، وبريدك الإلكتروني، ورقم جوالك. الدخول يكون عادةً برمز يصلك على البريد؛ وإذا اخترت كلمة مرور نحفظها مشفّرة فقط.",
            "بيانات قطك: الاسم، والجنس، والعمر أو تاريخ الميلاد، والصور، والفصيلة، والمدينة، وما تضيفه بنفسك إلى سجله: التطعيمات، والوزن، والملاحظات، والمستندات.",
            "ما تكتبه العيادات: إذا زار قطك عيادة في شبكة مرقط، قد تضيف العيادة إلى سجله ما يخص الزيارة (مثل التطعيمات والفحوص والأدوية). هذه السجلات لا تُمحى بل تُصحَّح بإضافة توضّح التعديل، ليبقى السجل موثوقاً.",
            "بيانات تقنية: عنوان IP، ونوع الجهاز والمتصفح، وسجل الدخول — لأغراض الأمان.",
            "بيانات الاستخدام: فقط إذا وافقت على القياس (انظر «القياس» أدناه).",
            "لا نجمع أي بيانات دفع في هذه المرحلة، لأن مرقط لا تبيع شيئاً حالياً.",
          ],
          en: [
            "Account data: your name, email address and mobile number. Sign-in is usually by a code sent to your email; if you choose a password, we store it only in hashed form.",
            "Your cat's data: name, sex, age or date of birth, photos, breed, city, and whatever you add to their record yourself: vaccinations, weight, notes and documents.",
            "What clinics write: if your cat visits a clinic in the Moracat network, that clinic may add visit records to their file (such as vaccinations, examinations and medications). These records are never erased; a correction is added on top, so the record stays trustworthy.",
            "Technical data: IP address, device and browser type, and sign-in history — for security.",
            "Usage data: only if you agree to measurement (see “Measurement” below).",
            "We collect no payment data at this stage, because Moracat sells nothing today.",
          ],
        },
      },
      {
        heading: { ar: "لماذا نطلب رقم جوالك", en: "Why we ask for your mobile number" },
        body: {
          ar: [
            "رقم الجوال مطلوب عند التسجيل لثلاثة أسباب: لنوصل لك رسالة من يلقى قطك، ولإرسال رموز الدخول والتحقق عند تفعيلها، وليتمكّن عيادة سجّلت قطك من دعوتك لاستلام ملفه.",
            "لا نعرض رقمك للعامة: لا يظهر في المجتمع، ولا في صفحة رمز الطوق، ولا في إعلانات «مفقود وموجود». يظهر فقط حيث تختار أنت إظهاره — مثل نسخة بطاقة تطبعها وتختار أن تتضمن رقمك، أو رابط ملخص صحي فعّلت فيه «أضف رقمي».",
            "العيادات في شبكة مرقط ترى رقمك مخفياً جزئياً مع اسمك الأول، ضمن الحد الأدنى لبيانات السلامة (انظر «السجل الصحي والعيادات»).",
          ],
          en: [
            "A mobile number is required at sign-up for three reasons: so a message from whoever finds your cat can reach you, to send sign-in and verification codes when those are switched on, and so a clinic that registered your cat can invite you to claim their file.",
            "We never show your number publicly: not in the community, not on the collar-tag page, and not on Lost & Found notices. It appears only where you choose to show it — such as a printed card you choose to include it on, or a health-summary link where you ticked “include my number”.",
            "Clinics in the Moracat network see your first name and a partly hidden number, as part of the minimum safety data (see “Health records & clinics”).",
          ],
        },
      },
      {
        heading: { ar: "كيف نستخدم بياناتك", en: "How we use your data" },
        body: {
          ar: [
            "لإنشاء حسابك وإصدار هوية قطك وحفظ سجله.",
            "لتذكيرك بمواعيد العناية (التطعيمات والوزن والفحوص) داخل حسابك وبالبريد.",
            "لتشغيل المجتمع و«مفقود وموجود» والتبنّي ونقل الملكية كما هو موضّح أدناه.",
            "لإرسال رسائل ضرورية (رموز الدخول، تنبيهات الحساب). لا نرسل رسائل تسويقية إلا بموافقتك، وتقدر توقفها في أي وقت.",
            "لحماية المنصة من إساءة الاستخدام والاحتيال.",
            "لا نبيع بياناتك الشخصية لأي طرف، ولا نشاركها مع جهات إعلانية.",
          ],
          en: [
            "To create your account, issue your cat's Cat ID and keep their record.",
            "To remind you of care dates (vaccinations, weigh-ins, check-ups) in your account and by email.",
            "To run the community, Lost & Found, adoption and ownership transfer as described below.",
            "To send essential messages (sign-in codes, account alerts). We send marketing messages only with your consent, and you can stop them at any time.",
            "To protect the platform from abuse and fraud.",
            "We never sell your personal data, and never share it with advertisers.",
          ],
        },
      },
      {
        heading: { ar: "ظهور قطك في المجتمع", en: "Your cat in the community" },
        body: {
          ar: [
            "قطك يظهر في مجتمع مرقط من أول يوم — بدون اسمك ومدينتك — إذا كانت له صورة. القط الذي بلا صورة لا يظهر في المجتمع.",
            "يظهر للعامة اسم قطك وصورته، وما تتركه ظاهراً من عمره وفصيلته وشخصيته ومعرض صوره. اسمك ومدينتك مخفيّان ما لم تختر إظهارهما.",
            "تقدر تخفي قطك من المجتمع بضغطة من ملفه في أي وقت، بلا أي شرط. وعند رفع صورة فيها أشخاص، أنت تؤكد أن لديك إذنهم بنشرها.",
            "يراجع فريقنا البلاغات، وقد يُخفي ملفاً عاماً مخالفاً مع إبلاغك بالسبب.",
          ],
          en: [
            "Your cat appears in the Moracat community from day one — without your name or city — once they have a photo. A cat without a photo does not appear.",
            "The public sees your cat's name and photo, plus whichever of their age, breed, personality and photo gallery you leave visible. Your name and city stay hidden unless you choose to show them.",
            "You can hide your cat from the community in one tap from their profile, at any time, with no conditions. When you upload a photo that shows people, you confirm you have their permission to publish it.",
            "Our team reviews reports and may hide a public profile that breaks the rules, telling you why.",
          ],
        },
      },
      {
        heading: { ar: "السجل الصحي والعيادات", en: "Health records & clinics" },
        body: {
          ar: [
            "سجل قطك الصحي خاص بك. العيادات الموثّقة في شبكة مرقط ترى دائماً حداً أدنى للسلامة فقط: صورة قطك واسمه وفصيلته وعمره ووزنه، وتنبيهاته الطبية مثل الحساسية، وأدويته الحالية، وجهات الاتصال للطوارئ، واسمك الأول ورقماً مخفياً جزئياً. هذا الجزء لا يمكن إيقافه، لأن حساسية مخفية قد تكلّف قطك حياته.",
            "ما عدا ذلك يبقى بإذنك: تمنح العيادة إما «ملخّص الرعاية» (التطعيمات، والحالات المعروفة، والأدوية، وسجل الوزن) أو «السجل الكامل» (ويشمل ملاحظات وتقارير العيادات الأخرى)، وتسحب الإذن متى شئت. والعيادة ترى دائماً ما كتبته هي بنفسها.",
            "في الطوارئ فقط، قد تفتح عيادة بيانات السلامة بعد أن تكتب سبباً، دون أن يتجاوز ذلك الحد الأدنى أعلاه، ونبلغك فوراً.",
            "كل مرة تفتح فيها عيادة سجل قطك تُكتب في «سجل الاطلاع» داخل حسابك: من فتحه، ومتى، وبأي مستوى.",
            "روابط الملخص الصحي: تقدر ترسل لأي طبيب رابطاً مؤقتاً لملخص قطك. ينتهي الرابط بعد المدة التي تختارها (يوم، أو أسبوع، أو 30 يوماً، أو 90 يوماً)، وتقدر توقفه قبلها، ويتوقف تلقائياً إذا انتقلت ملكية القط. نعرض لك كم مرة فُتح الرابط، ولا يظهر فيه رقمك إلا إذا اخترت ذلك.",
            "المعلومات الصحية في مرقط للاطلاع ولا تُغني عن رأي الطبيب البيطري.",
          ],
          en: [
            "Your cat's health record is yours. Verified clinics in the Moracat network always see a minimum set of safety data only: your cat's photo, name, breed, age and weight, their medical alerts such as allergies, current medications, emergency contacts, and your first name with a partly hidden number. This part cannot be switched off, because a hidden allergy could cost your cat their life.",
            "Everything else stays under your permission: you grant a clinic either the “care summary” (vaccinations, known conditions, medications and weight history) or the “full history” (which adds other clinics' notes and reports), and you can withdraw it whenever you like. A clinic always sees what it wrote itself.",
            "In an emergency only, a clinic may open the safety data after writing down a reason — never beyond the minimum above — and we tell you straight away.",
            "Every time a clinic opens your cat's record it is written in the access ledger in your account: who opened it, when, and at what level.",
            "Health-summary links: you can send any vet a temporary link to your cat's summary. It expires after the period you choose (one day, a week, 30 days or 90 days), you can stop it sooner, and it stops automatically if the cat changes owner. We show you how many times it was opened, and your number appears on it only if you choose.",
            "Health information on Moracat is for reference and does not replace a veterinarian's judgement.",
          ],
        },
      },
      {
        heading: { ar: "مفقود وموجود ورسائل من يلقى قطك", en: "Lost & Found, and messages from finders" },
        body: {
          ar: [
            "من يمسح رمز طوق قطك يرى قطك فقط — لا اسمك ولا رقمك — ويقدر يترك لك رسالة. نوصل الرسالة لك داخل حسابك وبالبريد (وبرسالة نصية عند تفعيلها). إذا ترك رقمه، نوصله لك أنت فقط.",
            "إعلانات «مفقود وموجود» تعرض القط ومنطقة تقريبية وزر مراسلة. بريدك لا يُنشر أبداً، ورقمك لا يظهر إلا إذا اخترت نشره، وتقدر تغيّر ذلك في أي وقت. يقدر أي شخص يراسلك عبر الإعلان دون أن يعرف من أنت.",
            "الإشعار التلقائي بأن «هذا قد يكون قطك» لا يصدر إلا عند تطابق تام في رقم الشريحة.",
          ],
          en: [
            "Whoever scans your cat's collar tag sees your cat only — not your name or number — and can leave you a message. We relay it to you in your account and by email (and by text message once that is switched on). If they leave their number, we pass it to you alone.",
            "Lost & Found notices show the cat, an approximate area and a message button. Your email is never published, and your number appears only if you choose to publish it — you can change that at any time. Anyone can message you through a notice without learning who you are.",
            "An automatic “this might be your cat” alert is raised only on an exact microchip-number match.",
          ],
        },
      },
      {
        heading: { ar: "نقل الملكية والتبنّي", en: "Ownership transfer & adoption" },
        body: {
          ar: [
            "عند نقل ملكية قطك لشخص آخر، تنتقل معه هويته بنفس رقمها وسجله كاملاً: التطعيمات، والوزن، وسجلات العيادات، والشهادات، والصور. يفقد المالك السابق الوصول فوراً، وتُسحب أذونات العيادات التي منحها، وتعود إعدادات الظهور لوضعها الافتراضي ليقرر المالك الجديد.",
            "نحتفظ بسجل الملكية (من كان يملك القط ومتى)، لأن السجل الصحي لا يكون موثوقاً إلا إذا عُرف من كان مسؤولاً عن القط وقت كتابة كل سطر.",
            "إعلانات التبنّي تعرض القط وملخّص سجله، ولا تعرض بيانات تواصلك. لا تُعطى وسيلة التواصل التي اخترتها إلا لمن توافق أنت على طلبه. مرقط لا تتقاضى عمولة ولا تتولى أي دفع في التبنّي.",
          ],
          en: [
            "When you transfer your cat to someone else, their Cat ID goes with them under the same number, along with the whole record: vaccinations, weights, clinic records, certificates and photos. The previous owner loses access immediately, the clinic permissions they granted are withdrawn, and visibility settings reset to default for the new owner to decide.",
            "We keep the ownership history (who held the cat, and when), because a health record is only trustworthy if you can tell who was responsible for the cat when each line was written.",
            "Adoption listings show the cat and a summary of their record, never your contact details. The contact method you chose is released only to someone whose request you accept. Moracat takes no commission and handles no payment for an adoption.",
          ],
        },
      },
      {
        heading: { ar: "القياس", en: "Measurement" },
        body: {
          ar: [
            "نقيس استخدام الموقع بأنفسنا لنحسّنه (مثلاً: كم زائراً أكمل تسجيل قطه) — فقط إذا ضغطت «موافق» في إشعار القياس. إذا اخترت «بدون قياس»، أو لم تختر بعد، لا نرسل أي حدث قياس.",
            "عند الموافقة نحفظ في متصفحك معرّفاً عشوائياً، وإذا كنت مسجّلاً الدخول ترتبط أحداث القياس بحسابك. لا نرسل فيها اسمك أو بريدك أو رقمك أو اسم قطك، ولا نشاركها مع أي جهة إعلانية.",
            "تقدر تغيّر اختيارك في أي وقت من «إعدادات القياس» أسفل الموقع.",
          ],
          en: [
            "We measure how the site is used, ourselves, to improve it (for example, how many visitors finish registering a cat) — only if you tap “Agree” on the measurement notice. If you choose “No measurement”, or haven't chosen yet, we send no measurement events at all.",
            "If you agree, we keep a random identifier in your browser, and when you are signed in, measurement events are linked to your account. They never carry your name, email, number or your cat's name, and are never shared with advertisers.",
            "You can change your choice at any time from “Measurement settings” at the bottom of the site.",
          ],
        },
      },
      {
        heading: { ar: "مقدّمو الخدمات وأين تُحفظ بياناتك", en: "Service providers & where your data is kept" },
        body: {
          ar: [
            "نستعين بمزوّدين لتشغيل مرقط، يعالجون البيانات بالنيابة عنّا ووفق تعليماتنا فقط:",
            "• استضافة الخادم: Render — في الاتحاد الأوروبي (فرانكفورت، ألمانيا).",
            "• قاعدة البيانات: Neon.",
            "• تخزين الصور والمستندات: Cloudflare R2.",
            "• إرسال البريد: Resend.",
            "• الرسائل النصية (عند تفعيلها): Twilio.",
            "• استضافة الموقع: Vercel.",
            "• رصد الأعطال التقنية (عند تشغيله): Sentry.",
            "بوضوح: بياناتك تُعالَج وتُحفظ خارج المملكة العربية السعودية لدى هؤلاء المزوّدين. نقصر ما يصل لكل مزوّد على ما يحتاجه لأداء خدمته، ونعتمد على ضوابط الحماية التي يلتزمون بها.",
          ],
          en: [
            "We use providers to run Moracat. They process data on our behalf and under our instructions only:",
            "• Server hosting: Render — in the European Union (Frankfurt, Germany).",
            "• Database: Neon.",
            "• Photo and document storage: Cloudflare R2.",
            "• Email delivery: Resend.",
            "• Text messages (when switched on): Twilio.",
            "• Website hosting: Vercel.",
            "• Technical error monitoring (when switched on): Sentry.",
            "Plainly: your data is processed and stored outside Saudi Arabia, with these providers. We limit what reaches each provider to what it needs to do its job, and rely on the safeguards they commit to.",
          ],
        },
      },
      {
        heading: { ar: "الاحتفاظ والحذف", en: "Retention & deletion" },
        body: {
          ar: [
            "نحتفظ ببياناتك طالما حسابك نشط.",
            "تقدر تحذف حسابك في أي وقت. عند الحذف نمسح بياناتك الشخصية من الحساب، ونُخفي قططك ونحذفها من حسابك ومن المجتمع، إلا ما يُلزمنا النظام بالاحتفاظ به.",
          ],
          en: [
            "We keep your data for as long as your account is active.",
            "You can delete your account at any time. On deletion we erase your personal details from the account and hide and remove your cats from your account and the community, except where the law requires us to keep something.",
          ],
        },
      },
      {
        heading: { ar: "أمن البيانات", en: "Security" },
        body: {
          ar: [
            "نؤمّن الاتصال عبر HTTPS، ونشفّر كلمات المرور، ونحدّ من الوصول الداخلي للبيانات، وتُفتح المستندات الصحية بروابط مؤقتة قصيرة المدة.",
          ],
          en: [
            "We secure traffic over HTTPS, hash passwords, limit internal access to data, and open health documents through short-lived temporary links.",
          ],
        },
      },
      {
        heading: { ar: "حقوقك", en: "Your rights" },
        body: {
          ar: [
            "بموجب نظام حماية البيانات الشخصية، لك الحق في معرفة ما نجمعه عنك، والاطلاع على بياناتك، وتصحيحها، وحذفها، وسحب موافقتك.",
            CONTACT_AR,
          ],
          en: [
            "Under the PDPL you have the right to know what we collect about you, and to access, correct and delete your data, and to withdraw your consent.",
            CONTACT_EN,
          ],
        },
      },
    ],
  },
  {
    slug: "terms",
    title: { ar: "الشروط والأحكام", en: "Terms & Conditions" },
    updated: UPDATED,
    intro: {
      ar: `باستخدامك منصة مرقط، التي تُشغّلها ${LEGAL_ENTITY.ar}، فإنك توافق على هذه الشروط. مرقط منصة خاصة وليست جهة حكومية، وهوية القط فيها سجل تحتفظ به مرقط وليست وثيقة رسمية. يرجى قراءة الشروط بعناية.`,
      en: `By using Moracat, operated by ${LEGAL_ENTITY.en}, you agree to these terms. Moracat is a private platform, not a government body, and a Cat ID is a record kept by Moracat — not an official document. Please read these terms carefully.`,
    },
    sections: [
      {
        heading: { ar: "الحساب", en: "Your account" },
        body: {
          ar: [
            "يجب أن تكون المعلومات التي تقدّمها صحيحة، وأنت مسؤول عن الحفاظ على سرية حسابك.",
            "يجب ألا يقل عمرك عن 18 عاماً أو أن يكون لديك إذن وليّ الأمر.",
          ],
          en: [
            "Information you provide must be accurate, and you are responsible for keeping your account secure.",
            "You must be 18 or older, or have a guardian's permission.",
          ],
        },
      },
      commerceEnabled() ? PAID_TERMS : NOTHING_SOLD_TERMS,
      {
        heading: { ar: "السجل الصحي والعيادات", en: "Health records & clinics" },
        body: {
          ar: [
            "ما تضيفه بنفسك إلى سجل قطك يظهر على أنه من إدخالك، وما تكتبه عيادة يظهر باسمها. مرقط لا تتحقق من صحة ما يدخله المالك، والعيادة مسؤولة عمّا تكتبه.",
            "العيادات في شبكة مرقط تنضم بدعوة وبعد مراجعة، وتلتزم بشروط خاصة بها. منحك أو سحبك لإذن الاطلاع يتم من حسابك، كما هو موضّح في سياسة الخصوصية.",
            "مرقط ليست عيادة ولا تقدّم تشخيصاً أو علاجاً، وما فيها من معلومات صحية لا يُغني عن الطبيب البيطري.",
          ],
          en: [
            "Anything you add to your cat's record yourself is shown as entered by you, and anything a clinic writes is shown under that clinic's name. Moracat does not verify owner-entered information, and each clinic is responsible for what it writes.",
            "Clinics join the Moracat network by invitation and after review, and agree to their own terms. You grant and withdraw record access from your account, as described in the Privacy Policy.",
            "Moracat is not a clinic and does not diagnose or treat, and its health information does not replace a veterinarian.",
          ],
        },
      },
      {
        heading: { ar: "نقل الملكية والتبنّي", en: "Ownership transfer & adoption" },
        body: {
          ar: [
            "نقل ملكية القط يحتاج تأكيدين: يبدأه المالك الحالي بكتابة اسم القط، ويقبله المالك الجديد من حسابه. بعد القبول تنتقل الهوية والسجل للمالك الجديد ولا يمكن التراجع إلا بنقل جديد منه.",
            "التبنّي اتفاق بين صاحب القط ومن يتبنّاه. مرقط تعرض الإعلان وتوصل الرسائل وتنقل الهوية، لكنها ليست طرفاً في الاتفاق، ولا تتقاضى عمولة، ولا تتولى أي دفع. أي رسوم يذكرها صاحب الإعلان هي بيانه هو.",
          ],
          en: [
            "Transferring a cat takes two confirmations: the current owner starts it by typing the cat's name, and the new owner accepts it from their own account. Once accepted, the ID and record belong to the new owner and can only move again by a new transfer from them.",
            "An adoption is an agreement between the owner and the adopter. Moracat shows the listing, relays messages and transfers the ID, but is not a party to the agreement, takes no commission and handles no payment. Any fee stated in a listing is the owner's own statement.",
          ],
        },
      },
      {
        heading: { ar: "مفقود وموجود", en: "Lost & Found" },
        body: {
          ar: [
            "انشر فقط ما تعرف أنه صحيح عن قط مفقود أو قط وجدته، ولا تستخدم الرسائل لغير غرضها. لا تضمن مرقط العثور على أي قط، ونخفي الإعلانات المخالفة مع إبلاغ صاحبها بالسبب.",
          ],
          en: [
            "Post only what you know to be true about a lost cat or a cat you found, and use messages only for that purpose. Moracat cannot guarantee any cat will be found, and we hide notices that break the rules, telling the person who posted why.",
          ],
        },
      },
      {
        heading: { ar: "الاستخدام المقبول", en: "Acceptable use" },
        body: {
          ar: [
            "لا تُسِئ استخدام المنصة، ولا تنتحل صفة غيرك، ولا تنشر محتوى مخالفاً (انظر سياسة المحتوى).",
            "يحق لنا تعليق أو إنهاء الحسابات المخالفة لحماية المجتمع.",
          ],
          en: [
            "Do not misuse the platform, impersonate others, or post prohibited content (see the Content Policy).",
            "We may suspend or terminate accounts that violate these terms to protect the community.",
          ],
        },
      },
      {
        heading: { ar: "الملكية الفكرية", en: "Intellectual property" },
        body: {
          ar: [
            "تحتفظ بملكية المحتوى الذي ترفعه، وتمنح مرقط ترخيصاً لعرضه ضمن الخدمة وفق إعداداتك.",
            "علامة مرقط وتصاميمها مملوكة لنا ولا يجوز استخدامها دون إذن.",
          ],
          en: [
            "You keep ownership of content you upload and grant Moracat a license to display it within the service per your settings.",
            "The Moracat brand and designs are ours and may not be used without permission.",
          ],
        },
      },
      {
        heading: { ar: "إخلاء المسؤولية", en: "Disclaimer" },
        body: {
          ar: [
            "تُقدَّم الخدمة «كما هي». حاسبة التغذية والمعلومات إرشادية ولا تُغني عن استشارة الطبيب البيطري.",
          ],
          en: [
            "The service is provided \"as is\". The feeding calculator and information are guidance only and do not replace veterinary advice.",
          ],
        },
      },
    ],
  },
  {
    slug: "cookies",
    title: { ar: "سياسة ملفات الارتباط", en: "Cookie Policy" },
    updated: UPDATED,
    intro: {
      ar: "نستخدم أقل قدر ممكن من ملفات الارتباط والتخزين المحلي لتشغيل مرقط.",
      en: "We use the minimum necessary cookies and local storage to run Moracat.",
    },
    sections: [
      {
        heading: { ar: "ما الذي نستخدمه", en: "What we use" },
        body: {
          ar: [
            "تخزين أساسي: لحفظ تسجيل دخولك ولغتك المفضّلة واختيارك في إشعار القياس — ضروري لعمل الموقع.",
            "قياس خاص بنا، بموافقتك فقط: إذا ضغطت «موافق»، نحفظ معرّفاً عشوائياً في متصفحك لنعرف كيف يُستخدم الموقع، وترتبط الأحداث بحسابك إذا كنت مسجّلاً الدخول. لا تحمل اسمك ولا بريدك ولا رقمك ولا اسم قطك، ولا تُشارك مع أي جهة إعلانية. التفاصيل في سياسة الخصوصية.",
            "لا نستخدم إعلانات تتبّع من أطراف ثالثة.",
          ],
          en: [
            "Essential storage: to keep you signed in, remember your language and your choice on the measurement notice — required for the site to work.",
            "Our own measurement, only with your consent: if you tap “Agree”, we keep a random identifier in your browser to see how the site is used, and events are linked to your account when you are signed in. They carry no name, email, number or cat name, and are never shared with advertisers. Details are in the Privacy Policy.",
            "We do not use third-party advertising trackers.",
          ],
        },
      },
      {
        heading: { ar: "التحكم", en: "Your control" },
        body: {
          ar: [
            "تقدر تغيّر اختيارك في القياس من «إعدادات القياس» أسفل الموقع، وتقدر تمسح التخزين المحلي من إعدادات متصفحك في أي وقت؛ قد يسجّل ذلك خروجك.",
          ],
          en: [
            "You can change your measurement choice from “Measurement settings” at the bottom of the site, and clear local storage from your browser settings at any time; this may sign you out.",
          ],
        },
      },
    ],
  },
  {
    slug: "community-guidelines",
    title: { ar: "إرشادات المجتمع", en: "Community Guidelines" },
    updated: UPDATED,
    intro: {
      ar: "مجتمع مرقط مكان لطيف لمحبّي القطط. هذه الإرشادات تحافظ على ذلك.",
      en: "The Moracat community is a kind place for cat lovers. These guidelines keep it that way.",
    },
    sections: [
      {
        heading: { ar: "كن لطيفاً", en: "Be kind" },
        body: {
          ar: [
            "عامِل الآخرين باحترام. لا تحرّش ولا تنمّر ولا خطاب كراهية.",
            "شارك صور قطط تملكها أنت فقط، ولا تنشر بيانات شخصية لغيرك.",
          ],
          en: [
            "Treat others with respect. No harassment, bullying, or hate speech.",
            "Share photos of cats you own, and never post other people's personal information.",
          ],
        },
      },
      {
        heading: { ar: "محتوى آمن", en: "Safe content" },
        body: {
          ar: [
            "لا محتوى يُظهر إيذاء الحيوان أو إهماله. الإبلاغ عن أي إساءة مسؤولية مشتركة.",
            "يراجع فريقنا البلاغات ويزيل المحتوى المخالف، وقد يعلّق الحسابات المتكررة.",
          ],
          en: [
            "No content depicting animal cruelty or neglect. Reporting abuse is a shared responsibility.",
            "Our team reviews reports and removes violating content, and may suspend repeat offenders.",
          ],
        },
      },
    ],
  },
  {
    slug: "content-policy",
    title: { ar: "سياسة المحتوى", en: "Content Policy" },
    updated: UPDATED,
    intro: {
      ar: "تحدد هذه السياسة المحتوى المسموح والممنوع على مرقط.",
      en: "This policy sets out what content is allowed and prohibited on Moracat.",
    },
    sections: [
      {
        heading: { ar: "المحتوى الممنوع", en: "Prohibited content" },
        body: {
          ar: [
            "المحتوى غير القانوني، أو الجنسي، أو العنيف، أو الذي يحرّض على الكراهية.",
            "إيذاء الحيوانات أو الترويج له، والمعلومات المضلّلة الضارة.",
            "انتحال الهوية، والرسائل المزعجة (سبام)، والروابط الخبيثة.",
          ],
          en: [
            "Illegal, sexual, violent, or hateful content.",
            "Animal cruelty or its promotion, and harmful misinformation.",
            "Impersonation, spam, and malicious links.",
          ],
        },
      },
      {
        heading: { ar: "الإشراف", en: "Moderation" },
        body: {
          ar: [
            "المحتوى العام يظهر مباشرةً، ويحق لفريقنا إخفاؤه أو إزالته إذا خالف هذه السياسة.",
            `للإبلاغ عن محتوى مخالف راسلنا على ${CONTACT.reportEmail}.`,
          ],
          en: [
            "Public content appears immediately; our team may hide or remove it if it violates this policy.",
            `To report content, contact ${CONTACT.reportEmail}.`,
          ],
        },
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
