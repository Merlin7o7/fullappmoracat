// ════════════════════════════════════════════════════════════════════════
//  Legal content — bilingual (ar/en). Real, launch-ready policies aligned with
//  Saudi PDPL (Personal Data Protection Law) and consumer-protection norms.
//  Community Mode: no payments are processed, so no payment/financial data is
//  collected — reflected below. Review with counsel before scaling.
// ════════════════════════════════════════════════════════════════════════

export interface LegalSection {
  heading: { ar: string; en: string };
  body: { ar: string[]; en: string[] };
}

import { LEGAL_ENTITY, CONTACT } from "./org";

export interface LegalDoc {
  slug: string;
  title: { ar: string; en: string };
  updated: string; // ISO date
  intro: { ar: string; en: string };
  sections: LegalSection[];
}

const UPDATED = "2026-07-08";
const CONTACT_AR = `للاستفسارات المتعلقة بالخصوصية أو بياناتك، راسلنا على ${CONTACT.privacyEmail}، أو عبر إنستقرام ${CONTACT.instagramHandle}، أو هاتفياً على ${CONTACT.phone}.`;
const CONTACT_EN = `For privacy questions or requests about your data, contact us at ${CONTACT.privacyEmail}, on Instagram ${CONTACT.instagramHandle}, or by phone at ${CONTACT.phone}.`;

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "privacy",
    title: { ar: "سياسة الخصوصية", en: "Privacy Policy" },
    updated: UPDATED,
    intro: {
      ar: `تُشغَّل منصة مرقط من قِبل ${LEGAL_ENTITY.ar}. تصف هذه السياسة كيف تجمع مرقط بياناتك الشخصية وتستخدمها وتحميها، وحقوقك بموجب نظام حماية البيانات الشخصية في المملكة العربية السعودية.`,
      en: `Moracat is operated by ${LEGAL_ENTITY.en}. This policy explains how Moracat collects, uses, and protects your personal data, and your rights under Saudi Arabia's Personal Data Protection Law (PDPL).`,
    },
    sections: [
      {
        heading: { ar: "البيانات التي نجمعها", en: "Data we collect" },
        body: {
          ar: [
            "بيانات الحساب: الاسم، البريد الإلكتروني، ورقم الجوال (اختياري)، وكلمة المرور المشفّرة.",
            "بيانات القطط: الاسم، الصور، الفصيلة، العمر، والملاحظات الصحية التي تدخلها بنفسك.",
            "بيانات تقنية: عنوان IP، نوع الجهاز والمتصفح، وسجل الدخول لأغراض الأمان.",
            "لا نجمع أي بيانات دفع في هذه المرحلة، إذ إن المدفوعات غير مفعّلة بعد.",
          ],
          en: [
            "Account data: your name, email, optional mobile number, and a hashed password.",
            "Cat data: name, photos, breed, age, and any health notes you choose to add.",
            "Technical data: IP address, device/browser type, and login history for security.",
            "We collect no payment data at this stage — payments are not yet enabled.",
          ],
        },
      },
      {
        heading: { ar: "كيف نستخدم بياناتك", en: "How we use your data" },
        body: {
          ar: [
            "لإنشاء حسابك وإصدار هوية القط وتشغيل خدمات المجتمع.",
            "لإرسال رسائل ضرورية (تأكيد البريد، إعادة تعيين كلمة المرور، تنبيهات الحساب).",
            "لحماية المنصة من إساءة الاستخدام والاحتيال وتحسين التجربة.",
            "لا نبيع بياناتك الشخصية لأي طرف ثالث.",
          ],
          en: [
            "To create your account, issue Cat IDs, and run community features.",
            "To send essential emails (email confirmation, password reset, account alerts).",
            "To protect the platform from abuse and fraud, and to improve the experience.",
            "We do not sell your personal data to any third party.",
          ],
        },
      },
      {
        heading: { ar: "المشاركة العامة والخصوصية", en: "Public sharing & privacy" },
        body: {
          ar: [
            "ملف قطك خاص افتراضياً. لا يظهر في المجتمع إلا إذا اخترت مشاركته صراحةً.",
            "أنت تتحكم في كل حقل يظهر للعامة (الاسم، المدينة، الفصيلة، العمر، المعرض).",
            "يمكنك جعل الملف خاصاً مرة أخرى في أي وقت من إعدادات القط.",
          ],
          en: [
            "Your cat's profile is private by default. It appears in the community only if you explicitly share it.",
            "You control every field shown publicly (owner name, city, breed, age, gallery).",
            "You can make a profile private again at any time from your cat's settings.",
          ],
        },
      },
      {
        heading: { ar: "مقدّمو الخدمات", en: "Service providers" },
        body: {
          ar: [
            "نستعين بمزوّدين موثوقين لتشغيل الخدمة: استضافة التطبيق، تخزين الصور، وإرسال البريد الإلكتروني.",
            "يعالج هؤلاء البيانات بالنيابة عنّا ووفق تعليماتنا فقط، وبضوابط حماية مناسبة.",
          ],
          en: [
            "We use trusted providers to operate the service: application hosting, image storage, and email delivery.",
            "They process data on our behalf and under our instructions only, with appropriate safeguards.",
          ],
        },
      },
      {
        heading: { ar: "حقوقك", en: "Your rights" },
        body: {
          ar: [
            "بموجب نظام حماية البيانات الشخصية، لك الحق في الوصول إلى بياناتك وتصحيحها وحذفها وسحب موافقتك.",
            "يمكنك حذف حسابك وبياناته في أي وقت. تُحفظ سجلات محدودة عند الضرورة القانونية أو الأمنية.",
            CONTACT_AR,
          ],
          en: [
            "Under the PDPL you have the right to access, correct, and delete your data, and to withdraw consent.",
            "You may delete your account and its data at any time. Limited records may be retained where legally or security-required.",
            CONTACT_EN,
          ],
        },
      },
      {
        heading: { ar: "أمن البيانات والاحتفاظ", en: "Security & retention" },
        body: {
          ar: [
            "نشفّر كلمات المرور، ونؤمّن الاتصال عبر HTTPS، ونحدّ من الوصول الداخلي للبيانات.",
            "نحتفظ ببياناتك طالما حسابك نشط، ثم نحذفها أو نجعلها مجهولة المصدر خلال مدة معقولة.",
          ],
          en: [
            "We hash passwords, secure traffic over HTTPS, and limit internal access to data.",
            "We keep your data while your account is active, then delete or anonymize it within a reasonable period.",
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
      ar: `باستخدامك منصة مرقط، التي تُشغّلها ${LEGAL_ENTITY.ar}، فإنك توافق على هذه الشروط. يرجى قراءتها بعناية.`,
      en: `By using Moracat, operated by ${LEGAL_ENTITY.en}, you agree to these terms. Please read them carefully.`,
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
      {
        heading: { ar: "الاشتراكات والدفع", en: "Subscriptions & payment" },
        body: {
          ar: [
            "الحساب وهوية القط والمجتمع مجانية. اشتراكات العناية الشهرية (المبتدئة، القياسية، المميّزة) مدفوعة.",
            "الحد الأدنى لمدة الاشتراك شهر واحد (١). تختار مدة الالتزام (١ أو ٣ أو ٦ أو ١٢ شهراً) وتدفع كامل المدة مقدّماً عبر تمارا (دفعة واحدة أو أقساط)، ويُوصَّل الصندوق شهرياً طوال المدة.",
            "الأسعار بالريال السعودي. مرقط غير مسجّلة في ضريبة القيمة المضافة حالياً، فلا تُضاف ضريبة على الأسعار.",
            "يتجدّد الاشتراك في نهاية المدة، ونذكّرك قبل التجديد. يمكنك إيقاف التجديد أو الإلغاء قبل نهاية المدة الحالية.",
          ],
          en: [
            "Your account, Cat ID, and the community are free. Monthly care subscriptions (Starter, Standard, Premium) are paid.",
            "The minimum subscription term is one (1) month. You choose your commitment (1, 3, 6, or 12 months) and pay the full term upfront via Tamara (in full or in instalments); the box is delivered monthly across the term.",
            "Prices are in Saudi Riyals. Moracat is not currently VAT-registered, so no VAT is added to prices.",
            "Subscriptions renew at the end of the term, and we remind you before renewal. You may stop renewal or cancel before the current term ends.",
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
            "تخزين محلي أساسي: لحفظ تسجيل دخولك ولغتك المفضّلة — ضروري لعمل الموقع.",
            "لا نستخدم إعلانات تتبّع من أطراف ثالثة.",
          ],
          en: [
            "Essential local storage: to keep you signed in and remember your language — required for the site to work.",
            "We do not use third-party advertising trackers.",
          ],
        },
      },
      {
        heading: { ar: "التحكم", en: "Your control" },
        body: {
          ar: ["يمكنك مسح التخزين المحلي من إعدادات متصفحك في أي وقت؛ قد يسجّل ذلك خروجك."],
          en: ["You can clear local storage from your browser settings at any time; this may sign you out."],
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
            "للإبلاغ عن محتوى مخالف راسلنا على report@moracat.co.",
          ],
          en: [
            "Public content appears immediately; our team may hide or remove it if it violates this policy.",
            "To report content, contact report@moracat.co.",
          ],
        },
      },
    ],
  },
];

export function getLegalDoc(slug: string): LegalDoc | undefined {
  return LEGAL_DOCS.find((d) => d.slug === slug);
}
