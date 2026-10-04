"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ArrowRightLeft, MapPin, Settings, LifeBuoy, ShieldCheck, LogOut } from "lucide-react";
import { Card, Ledger, LedgerRow } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { commerceEnabled } from "@/lib/features";
import { HubLink } from "@/components/hub-link";
import { ThemeToggle, LangToggle } from "@/components/toggles";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";

/**
 * «حسابي» — the person, not the cat: who you are on Moracat, how we reach
 * you, hand-overs in flight, and help. Log out lives here (and on the desktop
 * rail) so the phone bar can stay four honest tabs.
 *
 * One identifier per cat, and it's the Cat ID (R087, audit 2026-10-04
 * Problem 5): the account-level "member number" (MRC-M-…) is an internal
 * key and is never shown to owners — two numbers read as two memberships.
 */
export default function AccountPage() {
  const { user, logout } = useAuth();
  const { activeCats } = useCats();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const commerce = commerceEnabled();
  if (!user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-1">
        <h1 className="font-display text-4xl">{isAr ? "حسابي" : "Account"}</h1>
        {name && <p className="text-lg text-muted-foreground">{name}</p>}
      </header>

      <Card className="px-5 py-1">
        <Ledger>
          <LedgerRow label={isAr ? "البريد" : "Email"} value={<span dir="ltr">{user.email}</span>} />
          {user.phone && <LedgerRow label={isAr ? "الجوال" : "Mobile"} value={<span dir="ltr">{user.phone}</span>} />}
          {activeCats
            .filter((c) => c.catIdNumber)
            .map((c) => (
              <LedgerRow
                key={c.id}
                label={isAr ? `هوية ${localizeName(c.name, "ar")}` : `${localizeName(c.name, "en")}'s Cat ID`}
                value={<span dir="ltr" className="font-mono">{c.catIdNumber}</span>}
              />
            ))}
          <LedgerRow
            label={isAr ? "اللغة والمظهر" : "Language & theme"}
            value={
              <span className="inline-flex items-center gap-1">
                <LangToggle />
                <ThemeToggle />
              </span>
            }
          />
        </Ledger>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <HubLink href="/portal/notifications" icon={Bell} title={isAr ? "الإشعارات" : "Notifications"} body={isAr ? "كل ما وصلك عن قططك" : "Everything sent to you about your cats"} />
        <HubLink href="/portal/transfers" icon={ArrowRightLeft} title={isAr ? "نقل الملكية" : "Hand-overs"} body={isAr ? "قطط تنتقل منك أو إليك" : "Cats moving to you, or from you"} />
        {commerce && <HubLink href="/portal/addresses" icon={MapPin} title={isAr ? "العناوين" : "Addresses"} body={isAr ? "وين نوصّل الصناديق" : "Where boxes are delivered"} />}
        <HubLink href="/portal/settings" icon={Settings} title={isAr ? "الإعدادات" : "Settings"} body={isAr ? "الأمان، الإشعارات، التقويم، بياناتك" : "Security, notifications, calendar, your data"} />
        <HubLink href="/portal/support" icon={LifeBuoy} title={isAr ? "المساعدة" : "Help"} body={isAr ? "اكتب لنا، ونرد عليك" : "Write to us and we'll answer"} />
        {user.isStaff && <HubLink href="/admin" icon={ShieldCheck} title={isAr ? "لوحة الإدارة" : "Admin console"} body={isAr ? "للموظفين فقط" : "Staff only"} />}
      </div>

      <button
        type="button"
        onClick={() => {
          void logout();
          router.push("/login");
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        <LogOut className="size-4" aria-hidden /> {isAr ? "تسجيل الخروج" : "Log out"}
      </button>

      <p className="text-xs text-muted-foreground">
        <Link href="/legal/privacy" className="underline underline-offset-4">{isAr ? "سياسة الخصوصية" : "Privacy policy"}</Link>
        {" · "}
        <Link href="/legal/terms" className="underline underline-offset-4">{isAr ? "الشروط" : "Terms"}</Link>
      </p>
    </div>
  );
}
