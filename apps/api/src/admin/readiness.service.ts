import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { commerceEnabled } from "../common/config/features";
import { SELLER_CR_NUMBER, SELLER_VAT_NUMBER, VAT_ENABLED, VAT_RATE } from "../common/config/pricing";
import { partnersNotifyRecipients } from "../vet/vet-registration.service";

export type ReadinessLevel = "ok" | "warn" | "block";

export interface ReadinessCheck {
  key: string;
  level: ReadinessLevel;
  titleAr: string;
  titleEn: string;
  /** What to do — written for the founder, not for an engineer. */
  fixAr: string;
  fixEn: string;
  /** Who can resolve it: ops (an env var / a click), counsel, or a vet. */
  owner: "ops" | "counsel" | "vet";
}

/**
 * Launch readiness — every gap that used to fail SILENTLY, in one list.
 *
 * Each of these was found the hard way: health documents in a public bucket,
 * clinic submissions that emailed nobody, a claim salt set to the literal text
 * of the command meant to generate it, a live clinic with no city. The panel
 * never prints a secret or its length — only whether it is set and sane.
 * Professional sign-offs that no code can settle are listed too, so nobody
 * mistakes "the switch exists" for "the decision was made".
 */
@Injectable()
export class AdminReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  async checks(): Promise<{ checks: ReadinessCheck[]; summary: Record<ReadinessLevel, number> }> {
    const checks: ReadinessCheck[] = [];
    const env = process.env;
    const prod = env.NODE_ENV === "production";

    checks.push({
      key: "private_storage",
      level: env.S3_PRIVATE_BUCKET ? "ok" : prod ? "block" : "warn",
      titleAr: "تخزين خاص للمستندات الصحية",
      titleEn: "Private storage for health documents",
      fixAr: env.S3_PRIVATE_BUCKET
        ? "مفعّل. شغّل سكربت نقل المستندات القديمة مرة واحدة إن لم يُشغَّل."
        : "أنشئ حاوية R2 خاصة (غير عامة) وضع اسمها في S3_PRIVATE_BUCKET على Render، ثم شغّل apps/api/scripts/migrate-private-docs.mjs.",
      fixEn: env.S3_PRIVATE_BUCKET
        ? "Set. Run the legacy-document migration script once if it hasn't been."
        : "Create a NON-public R2 bucket, set S3_PRIVATE_BUCKET on Render, then run apps/api/scripts/migrate-private-docs.mjs.",
      owner: "ops",
    });

    const recipients = partnersNotifyRecipients();
    checks.push({
      key: "partners_email",
      level: "ok",
      titleAr: "بريد فريق الشركاء",
      titleEn: "Partner-team inbox",
      fixAr: recipients.length
        ? `يصل إلى ${recipients.length} بريد.`
        : "تصل لبريد حسابات الموظفين نفسها (وداخل التطبيق). لبريد مختلف ضع PARTNERS_NOTIFY_EMAIL.",
      fixEn: recipients.length
        ? `Delivering to ${recipients.length} inbox(es).`
        : "Delivered to the staff accounts' own emails (and in-app). Set PARTNERS_NOTIFY_EMAIL only to use a different inbox.",
      owner: "ops",
    });

    const salt = env.CLAIM_HASH_SALT ?? "";
    const saltLooksLikeACommand = /\s|openssl|rand|base64/i.test(salt);
    checks.push({
      key: "claim_salt",
      level: salt.length >= 16 && !saltLooksLikeACommand ? "ok" : "block",
      titleAr: "ملح تشفير أرقام الملاك (CLAIM_HASH_SALT)",
      titleEn: "Owner-phone hashing salt (CLAIM_HASH_SALT)",
      fixAr: saltLooksLikeACommand
        ? "القيمة الحالية تبدو نصّ الأمر وليست ناتجه. ولّد قيمة عشوائية حقيقية وضعها قبل أن تنشئ العيادات ملفات لقطط غير مسجّلة."
        : "مضبوط.",
      fixEn: saltLooksLikeACommand
        ? "The current value looks like the command text, not its output. Generate a real random value before clinics create walk-in patients."
        : "Set.",
      owner: "ops",
    });

    const vatMismatch = VAT_ENABLED && !SELLER_VAT_NUMBER;
    checks.push({
      key: "vat",
      level: vatMismatch ? "block" : "ok",
      titleAr: "ضريبة القيمة المضافة",
      titleEn: "VAT",
      fixAr: VAT_ENABLED
        ? vatMismatch
          ? `الضريبة مفعّلة (${VAT_RATE * 100}٪) بدون رقم ضريبي صالح في VAT_NUMBER — الفواتير ستصدر بدون رقم.`
          : `مفعّلة بنسبة ${VAT_RATE * 100}٪ مع الرقم الضريبي.`
        : "غير مفعّلة (0٪). لا تذكر أي صفحة ضريبة. عند التسجيل: VAT_RATE=0.15 و VAT_NUMBER.",
      fixEn: VAT_ENABLED
        ? vatMismatch
          ? `VAT is on (${VAT_RATE * 100}%) but VAT_NUMBER is missing or invalid — invoices would go out without it.`
          : `On at ${VAT_RATE * 100}% with a VAT number.`
        : "Off (0%). No page claims VAT. When registered: set VAT_RATE=0.15 and VAT_NUMBER.",
      owner: "ops",
    });

    checks.push({
      key: "cr",
      level: SELLER_CR_NUMBER && env.NEXT_PUBLIC_CR_NUMBER ? "ok" : "warn",
      titleAr: "رقم السجل التجاري",
      titleEn: "Commercial registration (CR)",
      fixAr: "ضع CR_NUMBER على الخادم و NEXT_PUBLIC_CR_NUMBER على الموقع (10 أرقام). لا نخترع أرقاماً.",
      fixEn: "Set CR_NUMBER on the API and NEXT_PUBLIC_CR_NUMBER on the web (10 digits). We never invent numbers.",
      owner: "ops",
    });

    checks.push({
      key: "cron",
      level: env.CRON_SECRET && env.CRON_SECRET.length >= 24 ? "ok" : prod ? "warn" : "ok",
      titleAr: "منبّه المهام المجدولة",
      titleEn: "Scheduled-job wake-up",
      fixAr: "الخادم المجاني ينام فتتأخر التذكيرات. ضع CRON_SECRET على Render وفي أسرار GitHub ليوقظه منبّه كل 30 دقيقة.",
      fixEn: "The free server sleeps and reminders slip. Set CRON_SECRET on Render and as a GitHub secret so the 30-minute wake-up runs.",
      owner: "ops",
    });

    const appleReady = ["APPLE_PASS_TYPE_ID", "APPLE_TEAM_ID", "APPLE_PASS_CERT_PEM_B64", "APPLE_PASS_KEY_PEM_B64", "APPLE_WWDR_PEM_B64"].every((k) => !!env[k]);
    checks.push({
      key: "apple_wallet",
      level: appleReady ? "ok" : "warn",
      titleAr: "بطاقة Apple Wallet",
      titleEn: "Apple Wallet pass",
      fixAr: appleReady ? "مفعّلة." : "تحتاج شهادة Pass Type ID من حساب Apple Developer. ضع APPLE_PASS_* و APPLE_WWDR_PEM_B64 — وإلى ذلك الحين يختفي الزر.",
      fixEn: appleReady ? "Live." : "Needs a Pass Type ID certificate from the Apple Developer account. Set APPLE_PASS_* and APPLE_WWDR_PEM_B64 — until then the button stays hidden.",
      owner: "ops",
    });

    const [activePlans, citylessLive] = await Promise.all([
      this.prisma.plan.count({ where: { isActive: true } }),
      this.prisma.branch.count({
        where: { cityCode: null, isActive: true, org: { status: "LIVE", isDemo: false } },
      }),
    ]);
    checks.push({
      key: "catalog",
      level: activePlans >= 4 ? "ok" : commerceEnabled() ? "block" : "warn",
      titleAr: "الكتالوج والخطط",
      titleEn: "Catalog + plans",
      fixAr: activePlans >= 4 ? `${activePlans} خطط فعّالة.` : "ضع SEED_CATALOG_ON_BOOT=1 على Render (آمن للتكرار) أو شغّل pnpm db:seed:catalog.",
      fixEn: activePlans >= 4 ? `${activePlans} active plans.` : "Set SEED_CATALOG_ON_BOOT=1 on Render (safe to repeat) or run pnpm db:seed:catalog.",
      owner: "ops",
    });
    checks.push({
      key: "clinic_city",
      level: citylessLive === 0 ? "ok" : "warn",
      titleAr: "مدن فروع العيادات",
      titleEn: "Clinic branch cities",
      fixAr: citylessLive === 0 ? "كل الفروع الفعّالة لها مدينة." : `${citylessLive} فرع فعّال بلا مدينة — لا يظهر في البحث. عدّلها من صفحة العيادة.`,
      fixEn: citylessLive === 0 ? "Every live branch has a city." : `${citylessLive} live branch(es) without a city — hidden from search. Set it on the clinic's page.`,
      owner: "ops",
    });

    // Decisions no deploy can make. Listed so "the switch exists" is never
    // mistaken for "the decision was taken".
    checks.push(
      {
        key: "clinic_terms",
        level: "block",
        titleAr: "شروط العيادات — مراجعة قانونية",
        titleEn: "Clinic terms — legal review",
        fixAr: "النص مسودة. يلزم محامٍ سعودي قبل أن توقّع أول عيادة حقيقية.",
        fixEn: "The text is a draft. Saudi counsel must review it before the first real clinic signs.",
        owner: "counsel",
      },
      {
        key: "claim_sms",
        level: env.CLAIM_SMS_ENABLED === "true" ? "block" : "ok",
        titleAr: "رسائل استلام ملفات العيادات",
        titleEn: "Claim SMS to owners",
        fixAr: env.CLAIM_SMS_ENABLED === "true"
          ? "مفعّلة قبل رأي المحامي في سجلات العيادات قبل الاستلام — أطفئها."
          : "مطفأة حتى يراجع المحامي سجلات العيادات قبل استلام المالك.",
        fixEn: env.CLAIM_SMS_ENABLED === "true"
          ? "Enabled before counsel reviewed pre-claim clinic records — turn it off."
          : "Off until counsel reviews clinic records created before an owner claims the cat.",
        owner: "counsel",
      },
      {
        key: "pdpl",
        level: "warn",
        titleAr: "تقييم نقل البيانات (نظام حماية البيانات الشخصية)",
        titleEn: "PDPL data-transfer assessment",
        fixAr: "لم يُنجز. لا تذكر أي صفحة أنه مكتمل.",
        fixEn: "Outstanding. No page may describe it as complete.",
        owner: "counsel",
      },
      {
        key: "care_protocol",
        level: env.CARE_PROTOCOL_APPROVED === "1" ? "ok" : "warn",
        titleAr: "جدول التطعيمات والرعاية — اعتماد بيطري",
        titleEn: "Vaccination & care schedule — vet sign-off",
        fixAr: env.CARE_PROTOCOL_APPROVED === "1"
          ? "معتمد."
          : "الجدول الطبي المقترح مطفأ. بعد اعتماد طبيب بيطري: CARE_PROTOCOL_APPROVED=1.",
        fixEn: env.CARE_PROTOCOL_APPROVED === "1"
          ? "Approved."
          : "The proposed medical schedule is off. After a vet signs it off: CARE_PROTOCOL_APPROVED=1.",
        owner: "vet",
      }
    );

    const summary = { ok: 0, warn: 0, block: 0 } as Record<ReadinessLevel, number>;
    for (const c of checks) summary[c.level]++;
    return { checks, summary };
  }
}
