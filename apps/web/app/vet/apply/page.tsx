"use client";

/**
 * Clinic partnerships are by invitation (MRC-VET-002 founder decision,
 * 2026-09-16). This URL used to host a public application form — one whose
 * payload never matched the API, so no application was ever saved. The door is
 * now honest about how clinics really join (R006): Moracat chooses and invites
 * every clinic by hand, because that curation IS the member's guarantee.
 *
 * Kept at the same URL so old links, the footer and the directory still land
 * somewhere useful — a calm explanation and a real contact, never a 404 or a
 * form that quietly goes nowhere (R084, R112).
 */

import * as React from "react";
import Link from "next/link";
import { ArrowRight, AtSign, BadgeCheck, HeartHandshake, Instagram, Mail, ShieldCheck, Stethoscope } from "lucide-react";
import { Button, Card } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { CONTACT } from "@/lib/org";

const PARTNERS_EMAIL = "partners@moracat.co";

export default function VetPartnershipsPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const principles = [
    {
      icon: BadgeCheck,
      ar: {
        title: "نختار كل عيادة بأنفسنا",
        body: "نتحقق من السجل التجاري وترخيص المنشأة البيطرية وتراخيص الأطباء، ونتحدث مع الفريق قبل أن تظهر العيادة لأي عضو.",
      },
      en: {
        title: "We choose every clinic ourselves",
        body: "We check the commercial registration, the veterinary facility licence and each doctor's licence, and talk with the team before a clinic appears to any member.",
      },
    },
    {
      icon: ShieldCheck,
      ar: {
        title: "السجل الطبي أمانة",
        body: "لا تفتح عيادة ملف قطة إلا بإذن مالكها، وكل اطلاع يُسجَّل باسم من فتحه ويراه المالك.",
      },
      en: {
        title: "A medical record is a trust",
        body: "No clinic opens a cat's record without its owner's permission, and every access is logged to a named person the owner can see.",
      },
    },
    {
      icon: HeartHandshake,
      ar: {
        title: "شراكة لا إعلان",
        body: "العيادات الشريكة تكرّم أعضاء مرقط بميزة واضحة ومتفق عليها، وتحصل على بوابة عمل كاملة لفريقها: البحث بالبطاقة، والزيارات، والسجل الطبي بإذن المالك.",
      },
      en: {
        title: "A partnership, not an advert",
        body: "Partner clinics honour a clear, agreed benefit for Moracat members, and their team gets a full working portal: card lookup, visits, and the medical record with the owner's permission.",
      },
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10 sm:py-14">
      <header className="flex flex-col gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary" aria-hidden>
          <Stethoscope className="size-6" />
        </span>
        <h1 className="font-display text-3xl font-semibold leading-tight">
          {isAr ? "شراكات العيادات في مرقط بالدعوة" : "Moracat clinic partnerships are by invitation"}
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          {isAr
            ? "مرقط هوية عضوية لملاك القطط في السعودية، وشبكة العيادات جزء من وعدنا لهم: كل عيادة فيها اخترناها وتحققنا منها. لذلك لا نستقبل طلبات عامة — ندعو كل عيادة بأنفسنا."
            : "Moracat is a membership identity for cat owners in Saudi Arabia, and our clinic network is part of the promise we make them: every clinic in it is one we chose and verified. So there's no public application — we invite each clinic ourselves."}
        </p>
      </header>

      <ul className="flex flex-col gap-3">
        {principles.map((p) => {
          const copy = isAr ? p.ar : p.en;
          return (
            <li key={p.en.title}>
              <Card className="flex items-start gap-3 p-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground" aria-hidden>
                  <p.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold">{copy.title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      <Card className="flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {isAr ? "تدير عيادة وتودّ أن نتعرّف عليها؟" : "Run a clinic and want us to know about it?"}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? "راسلنا باسم العيادة ومدينتها ووسيلة للتواصل. نقرأ كل رسالة، وإن كانت الشراكة مناسبة الآن يصلك منا رابط دعوة للتسجيل."
              : "Write to us with the clinic's name, its city and a way to reach you. We read every message, and if a partnership fits right now, you'll receive an invitation link to register."}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <a href={`mailto:${PARTNERS_EMAIL}`} className="sm:flex-1">
            <Button size="lg" className="w-full">
              <Mail className="size-4" aria-hidden />
              <span dir="ltr">{PARTNERS_EMAIL}</span>
            </Button>
          </a>
          <a href={CONTACT.instagramUrl} target="_blank" rel="noopener noreferrer" className="sm:flex-1">
            <Button size="lg" variant="outline" className="w-full">
              <Instagram className="size-4" aria-hidden />
              <span dir="ltr">{CONTACT.instagramHandle}</span>
            </Button>
          </a>
        </div>
      </Card>

      <div className="flex flex-col gap-2 rounded-2xl border border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <AtSign className="mt-0.5 size-4 shrink-0" aria-hidden />
          {isAr
            ? "وصلتك دعوة لعيادتك أو لفريقها؟ افتح الرابط من البريد، أو ادخل من هنا."
            : "Already invited — your clinic or its team? Open the link in your email, or sign in here."}
        </p>
        <Link
          href="/vet/login"
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {isAr ? "دخول فريق العيادة" : "Clinic team sign-in"}
          <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
