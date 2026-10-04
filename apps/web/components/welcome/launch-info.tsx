"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants, cn } from "@moraqat/ui";
import { catPossessive, catVerb } from "@moraqat/core";
import { commerceEnabled } from "@/lib/features";

/**
 * "What's next" — the one screen between the Cat ID ceremony and the card
 * designer. Product UI, so AD 2.1: one rounded-2xl card, one primary button,
 * no mesh / sparkles / shine (the glitter amendment covers marketing pages
 * only).
 *
 * Three lines, all true today (R006/R040, audit 2026-10-04 Problem 5):
 *   1. what the cat now has — free, for good;
 *   2. the one next step — make the card theirs;
 *   3. care plans: open later, announced here and by email to those who
 *      agreed. No price grid, no "most chosen", no 1,000-cat trigger while
 *      commerce is off — prices appear only when they can be bought.
 * No referral ask here: inviting a friend comes after the member has had
 * some value, not on minute one.
 */
export function LaunchInfo({
  catId,
  catName,
  catGender,
  isAr,
}: {
  catId: string | null;
  catName: string | null;
  catGender?: string | null;
  isAr: boolean;
}) {
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const name = catName ?? t("قطك", "your cat");
  const g = catName ? catGender : "MALE"; // «قطك» is grammatically masculine
  const designHref = catId ? `/portal/cats/new?cat=${catId}&step=design` : "/portal";
  const profileHref = catId ? `/portal/cats/${catId}` : "/portal";
  const commerce = commerceEnabled();

  const headline = t(
    catVerb(g, {
      m: `${name} صار له رقمه في سجل مرقط`,
      f: `${name} صار لها رقمها في سجل مرقط`,
      n: `صار لـ${name} رقم في سجل مرقط`,
    }),
    `${name} has a number in the Moracat register`
  );

  const lines = [
    t(
      "الهوية والسجل الصحي ومكان في مجتمع مرقط — مجانية دايم.",
      "The ID, the health record and a place in the Moracat community — free, for good."
    ),
    t(
      `الخطوة الجاية: صمّم ${catPossessive("بطاقة", g, name)} — تظهر في المجتمع وفي كل مشاركة.`,
      `Next: design ${catName ? `${catName}'s` : "their"} card — it shows in the community and in every share.`
    ),
    commerce
      ? t("خطط العناية الشهرية مفتوحة — تقدر تشوفها من حسابك متى ما حبيت.", "Monthly care plans are open — you'll find them in your account whenever you like.")
      : t(
          "خطط العناية الشهرية تفتح لاحقاً — نعلن موعدها هنا وبالإيميل لمن وافق.",
          "Monthly care plans open later — we'll announce the date here, and by email to those who agreed."
        ),
  ];

  return (
    <div className="mx-auto max-w-xl pb-16 pt-4">
      <section aria-labelledby="welcome-h" className="space-y-6 rounded-2xl border border-border bg-card p-6 shadow-e1 sm:p-8">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">{t("أهلاً بك في مرقط", "Welcome to Moracat")}</p>
          <h1 id="welcome-h" className="font-display text-3xl leading-tight sm:text-4xl">
            {headline}
          </h1>
        </div>

        <ul className="space-y-3 text-base leading-relaxed">
          {lines.map((line) => (
            <li key={line} className="border-s-2 border-border ps-3">
              {line}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href={designHref} className={cn(buttonVariants({ variant: "primary", size: "lg" }), "w-full sm:w-auto")}>
            {t(`صمّم ${catPossessive("بطاقة", g, name)}`, `Design ${catName ? `${catName}'s` : "the"} card`)}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
          </Link>
          <Link href={profileHref} className={cn(buttonVariants({ variant: "tertiary", size: "md" }), "w-full sm:w-auto")}>
            {t(`بعدين — روح ل${catPossessive("ملف", g, name)}`, "Later — go to their profile")}
          </Link>
        </div>
      </section>
    </div>
  );
}
