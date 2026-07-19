"use client";

/**
 * Clinic application (MRC-VET-001 §01, stage 1).
 *
 * Moracat's network is curated deliberately — the founding registry ships empty
 * rather than padded. So this page is written like a membership invitation, not
 * a signup funnel: it says out loud that we vet every clinic, because that
 * curation is the member's guarantee and the partner's reason to want in.
 *
 * Under three minutes, eight fields, no documents yet, phone-friendly (managers
 * apply from their phones between consults), and the draft is kept on the
 * device so a dropped connection never costs someone their typing (R117).
 */

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Button, Card, cn } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { Field, SelectField } from "@/components/field";
import { IlloCat, IlloPaw } from "@/components/illustrations";
import { submitVetApplication, vetFriendlyError, type VetApplicationInput } from "@/lib/vet-api";

const DRAFT_KEY = "moraqat.vet.applyDraft";

const CITIES: { value: string; en: string; ar: string }[] = [
  { value: "Riyadh", en: "Riyadh", ar: "الرياض" },
  { value: "Jeddah", en: "Jeddah", ar: "جدة" },
  { value: "Makkah", en: "Makkah", ar: "مكة المكرمة" },
  { value: "Madinah", en: "Madinah", ar: "المدينة المنورة" },
  { value: "Dammam", en: "Dammam", ar: "الدمام" },
  { value: "Khobar", en: "Al Khobar", ar: "الخبر" },
  { value: "Dhahran", en: "Dhahran", ar: "الظهران" },
  { value: "Taif", en: "Taif", ar: "الطائف" },
  { value: "Abha", en: "Abha", ar: "أبها" },
  { value: "Tabuk", en: "Tabuk", ar: "تبوك" },
  { value: "Buraydah", en: "Buraydah", ar: "بريدة" },
  { value: "Hail", en: "Hail", ar: "حائل" },
  { value: "Jubail", en: "Jubail", ar: "الجبيل" },
  { value: "Yanbu", en: "Yanbu", ar: "ينبع" },
  { value: "OTHER", en: "Another city", ar: "مدينة أخرى" },
];

type Draft = {
  clinicNameAr: string;
  clinicNameEn: string;
  crNumber: string;
  city: string;
  otherCity: string;
  branchCount: string;
  contactName: string;
  phone: string;
  email: string;
  why: string;
};

const EMPTY: Draft = {
  clinicNameAr: "",
  clinicNameEn: "",
  crNumber: "",
  city: "Riyadh",
  otherCity: "",
  branchCount: "1",
  contactName: "",
  phone: "",
  email: "",
  why: "",
};

export default function VetApplyPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const [draft, setDraft] = React.useState<Draft>(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<{ title: string; message: string } | null>(null);
  const [submitted, setSubmitted] = React.useState<{ reviewDays?: number } | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Partial<Record<keyof Draft, string>>>({});

  // Restore, then keep, the draft — never lose entered data (R117).
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setDraft({ ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) });
    } catch {
      /* ignore */
    }
  }, []);
  React.useEffect(() => {
    if (submitted) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft, submitted]);

  const set = <K extends keyof Draft>(key: K) => (value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validate(): boolean {
    const errs: Partial<Record<keyof Draft, string>> = {};
    if (!draft.clinicNameAr.trim()) errs.clinicNameAr = isAr ? "اسم العيادة بالعربية مطلوب" : "The Arabic clinic name is required";
    if (!draft.clinicNameEn.trim()) errs.clinicNameEn = isAr ? "اسم العيادة بالإنجليزية مطلوب" : "The English clinic name is required";
    if (!/^\d{10}$/.test(draft.crNumber.trim()))
      errs.crNumber = isAr ? "السجل التجاري عشرة أرقام" : "A commercial registration number is 10 digits";
    if (draft.city === "OTHER" && !draft.otherCity.trim())
      errs.otherCity = isAr ? "اكتب اسم المدينة" : "Tell us the city";
    if (!draft.contactName.trim()) errs.contactName = isAr ? "اسم المسؤول مطلوب" : "A contact name is required";
    if (!/^(?:\+?966|0)?5\d{8}$/.test(draft.phone.replace(/[\s-]/g, "")))
      errs.phone = isAr ? "رقم جوال سعودي، مثل 05xxxxxxxx" : "A Saudi mobile number, like 05xxxxxxxx";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))
      errs.email = isAr ? "بريد إلكتروني صالح للتواصل" : "A working email for us to reply to";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!validate()) return;
    setBusy(true);
    try {
      const payload: VetApplicationInput = {
        clinicNameAr: draft.clinicNameAr.trim(),
        clinicNameEn: draft.clinicNameEn.trim(),
        crNumber: draft.crNumber.trim(),
        city: draft.city === "OTHER" ? draft.otherCity.trim() : draft.city,
        branchCount: Math.max(1, Number(draft.branchCount) || 1),
        contactName: draft.contactName.trim(),
        phone: draft.phone.replace(/[\s-]/g, ""),
        email: draft.email.trim(),
        why: draft.why.trim() || undefined,
      };
      const result = await submitVetApplication(payload);
      setSubmitted({ reviewDays: result?.reviewDays });
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(vetFriendlyError(err, isAr));
    } finally {
      setBusy(false);
    }
  }

  /* ── Submitted ──────────────────────────────────────────────────────────── */
  if (submitted) {
    const days = submitted.reviewDays;
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-4 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-success/12 text-success" aria-hidden>
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="font-display text-2xl font-semibold leading-tight">
          {isAr ? "وصلنا طلبكم" : "Your application is with us"}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? `أرسلنا تأكيداً على ${draft.email || "بريدكم"}. نراجع كل عيادة بأنفسنا — التحقق من السجل التجاري ورخصة المهن البيطرية${
                days ? ` — ويأخذ عادة ${days} أيام عمل` : " — وعادة يأخذ خمسة إلى سبعة أيام عمل"
              }. سنكتب لكم في كل خطوة؛ الصمت ليس من عاداتنا.`
            : `We've emailed a confirmation to ${draft.email || "your inbox"}. We review every clinic ourselves — commercial registration and the veterinary practice licence${
                days ? ` — which usually takes ${days} working days` : " — usually five to seven working days"
              }. You'll hear from us at every step; we don't do silence.`}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          <Link href="/vet/login">
            <Button size="sm" variant="outline">
              {isAr ? "دخول فريق العيادة" : "Clinic team sign-in"}
            </Button>
          </Link>
          <Link href="/">
            <Button size="sm" variant="ghost">
              {isAr ? "الرئيسية" : "Back home"}
            </Button>
          </Link>
        </div>
        <IlloCat tone="peach" className="mt-4 h-28 w-auto opacity-90" />
      </div>
    );
  }

  /* ── The form ───────────────────────────────────────────────────────────── */
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-8 sm:py-12">
      <header className="relative">
        <IlloPaw tone="peach" className="pointer-events-none absolute -top-4 end-0 size-10 rotate-12 opacity-30" aria-hidden />
        <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">
          {isAr ? "انضموا إلى شبكة عيادات مرقط" : "Join the Moracat clinic network"}
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "نختار شركاءنا واحداً واحداً — وهذا ما يجعل توصية مرقط تعني شيئاً للعضو. ثمان خانات، أقل من ثلاث دقائق، وبدون مستندات في هذه المرحلة."
            : "We choose our partners one at a time — that's what makes a Moracat recommendation mean something to a member. Eight fields, under three minutes, no documents at this stage."}
        </p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              ar: "نتحقق من السجل والرخصة",
              en: "We verify CR & licence",
            },
            { icon: Sparkles, ar: "شروط المنفعة تُكتب معاً", en: "Benefit terms written together" },
            { icon: CheckCircle2, ar: "لا رسوم اشتراك على العيادة", en: "No subscription fee for clinics" },
          ].map((item) => (
            <li
              key={item.en}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-medium"
            >
              <item.icon className="size-4 shrink-0 text-primary" aria-hidden />
              <span>{isAr ? item.ar : item.en}</span>
            </li>
          ))}
        </ul>
      </header>

      <Card className="p-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={isAr ? "اسم العيادة (عربي)" : "Clinic name (Arabic)"}
              value={draft.clinicNameAr}
              onChange={set("clinicNameAr")}
              error={fieldErrors.clinicNameAr}
              required
            />
            <Field
              label={isAr ? "اسم العيادة (إنجليزي)" : "Clinic name (English)"}
              value={draft.clinicNameEn}
              onChange={set("clinicNameEn")}
              error={fieldErrors.clinicNameEn}
              required
            />
            <Field
              label={isAr ? "رقم السجل التجاري" : "Commercial registration (CR)"}
              value={draft.crNumber}
              onChange={(v) => set("crNumber")(v.replace(/\D/g, "").slice(0, 10))}
              inputMode="numeric"
              hint={isAr ? "نتحقق منه عبر واثق" : "We verify it through Wathq"}
              error={fieldErrors.crNumber}
              required
            />
            <SelectField
              label={isAr ? "المدينة" : "City"}
              value={draft.city}
              onChange={set("city")}
              options={CITIES.map((c) => ({ value: c.value, label: isAr ? c.ar : c.en }))}
            />
            {draft.city === "OTHER" && (
              <Field
                label={isAr ? "اسم المدينة" : "City name"}
                value={draft.otherCity}
                onChange={set("otherCity")}
                error={fieldErrors.otherCity}
                required
              />
            )}
            <Field
              label={isAr ? "عدد الفروع" : "Number of branches"}
              value={draft.branchCount}
              onChange={(v) => set("branchCount")(v.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              hint={isAr ? "مجموعة فروع؟ اتفاقية واحدة تكفي." : "A group? One agreement covers them all."}
            />
            <Field
              label={isAr ? "الشخص المسؤول" : "Contact person"}
              value={draft.contactName}
              onChange={set("contactName")}
              autoComplete="name"
              error={fieldErrors.contactName}
              required
            />
            <Field
              label={isAr ? "جوال التواصل" : "Contact mobile"}
              value={draft.phone}
              onChange={set("phone")}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="05xxxxxxxx"
              error={fieldErrors.phone}
              required
            />
            <Field
              label={isAr ? "البريد الإلكتروني" : "Email"}
              value={draft.email}
              onChange={set("email")}
              type="email"
              autoComplete="email"
              hint={isAr ? "نرسل عليه كل تحديثات الطلب" : "Every update on your application goes here"}
              error={fieldErrors.email}
              className="sm:col-span-2"
              required
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              {isAr ? "لماذا مرقط؟ (اختياري)" : "Why Moracat? (optional)"}
            </span>
            <textarea
              value={draft.why}
              onChange={(e) => set("why")(e.target.value.slice(0, 600))}
              rows={4}
              className={cn(
                "w-full rounded-xl border border-input bg-background p-3 text-sm shadow-e1 outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
              placeholder={
                isAr
                  ? "حدّثنا عن عيادتكم وعن أصحاب القطط الذين تخدمونهم."
                  : "Tell us about your clinic and the cat owners you look after."
              }
            />
            <span className="text-xs text-muted-foreground">
              {isAr
                ? "نقرأ كل إجابة — هي أكثر ما يساعدنا في اتخاذ القرار."
                : "We read every answer — it's the part that helps us decide most."}
            </span>
          </label>

          {error && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/[0.06] px-3 py-2.5">
              <p className="text-sm font-medium text-destructive">{error.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{error.message}</p>
            </div>
          )}

          <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto sm:self-start">
            {isAr ? "أرسلوا الطلب" : "Send our application"}
          </Button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {isAr
              ? "بياناتكم تُحفظ داخل المملكة وتُستخدم لمراجعة الطلب فقط (نظام حماية البيانات الشخصية). "
              : "Your details are stored in-Kingdom and used only to review this application (PDPL). "}
            <Link href="/legal/privacy" className="text-primary underline-offset-4 hover:underline">
              {isAr ? "سياسة الخصوصية" : "Privacy policy"}
            </Link>
          </p>
        </form>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        {isAr ? "عيادتكم شريكة بالفعل؟ " : "Already a partner? "}
        <Link href="/vet/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {isAr ? "دخول فريق العيادة" : "Clinic team sign-in"}
        </Link>
      </p>
    </div>
  );
}
