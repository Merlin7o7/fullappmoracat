"use client";

/**
 * Clinic settings (MRC-VET-001 §16) — the "right wing" of the portal: visited
 * weekly, never in the counter's way.
 *
 * Capability-aware in the same spirit as nav.ts (§14): a section the actor
 * can't use is not rendered, never greyed out. Everything here belongs to a
 * personal session — a shared terminal holds no settings, staff or device
 * power (§02) — so Counter Mode gets one calm explanation instead of a page of
 * refusals.
 */

import * as React from "react";
import Link from "next/link";
import { Lock, Settings } from "lucide-react";
import { useLocale } from "@/app/providers";
import { useVetActor, vetOrgName } from "@/lib/vet-api";
import { EmptyState } from "@/components/vet/vet-shell-bits";
import { BranchesSection } from "@/components/vet/settings/branches-section";
import { DevicesSection } from "@/components/vet/settings/devices-section";
import { PinSection } from "@/components/vet/settings/pin-section";
import { TeamSection } from "@/components/vet/settings/team-section";

export default function VetSettingsPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { org, can, counterMode } = useVetActor();

  const sections = [
    {
      id: "branches",
      show: can("branch.manage") || can("settings.manage"),
      ar: "الفروع",
      en: "Branches",
      node: <BranchesSection />,
    },
    { id: "devices", show: can("device.manage"), ar: "أجهزة الكاونتر", en: "Counter devices", node: <DevicesSection /> },
    { id: "pin", show: !counterMode, ar: "رمزي السري", en: "My PIN", node: <PinSection /> },
    { id: "team", show: can("staff.manage"), ar: "الفريق", en: "Team", node: <TeamSection /> },
  ].filter((s) => s.show);

  // Arriving from the checklist (/vet/settings#devices) — the anchor exists on
  // first render, but client navigation doesn't always scroll to it.
  React.useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <header>
        <h1 className="flex items-center gap-2 font-display text-xl font-semibold leading-tight sm:text-2xl">
          <Settings className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          {isAr ? "إعدادات العيادة" : "Clinic settings"}
        </h1>
        {org && <p className="mt-1 text-xs text-muted-foreground">{vetOrgName(org, isAr)}</p>}
      </header>

      {counterMode ? (
        <EmptyState
          icon={Lock}
          tone="boundary"
          title={isAr ? "الإعدادات لا تُفتح على جهاز الكاونتر" : "Settings don't open on a counter"}
          body={
            isAr
              ? "الجهاز المشترك مخصص للعمل اليومي فقط. أقفل الكاونتر، أو افتح الإعدادات من حسابك على جهازك."
              : "The shared terminal is for the day's work only. Lock the counter, or open settings from your own account on your own device."
          }
          action={
            <Link href="/vet" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
              {isAr ? "العودة إلى اليوم" : "Back to Today"}
            </Link>
          }
        />
      ) : (
        <>
          {sections.length > 1 && (
            <nav aria-label={isAr ? "أقسام الإعدادات" : "Settings sections"} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="inline-flex min-h-[40px] shrink-0 items-center rounded-full border border-border px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {isAr ? s.ar : s.en}
                </a>
              ))}
            </nav>
          )}
          {sections.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-32">
              {s.node}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
