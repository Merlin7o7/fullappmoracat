"use client";

import Link from "next/link";
import { Camera, MapPin, Phone, Cpu, HeartHandshake, ChevronLeft } from "lucide-react";
import { Card } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import type { PortalCat } from "@/lib/cat-context";
import type { HealthRecord } from "@/components/cat-health-record";

/**
 * "Complete the file" — progressive profiling (W8). Onboarding asked four
 * things; everything else is asked here, after the member has an ID worth
 * completing, each item explaining what it does for the cat. Disappears once
 * the file is whole. Never a gate, never a percentage to feel bad about.
 */
export function CompleteFile({ cat, record, isAr }: { cat: PortalCat; record: HealthRecord; isAr: boolean }) {
  const { user } = useAuth();
  const t = (ar: string, en: string) => (isAr ? ar : en);
  const items = [
    !cat.photoUrl && {
      key: "photo",
      icon: Camera,
      title: t("صورة له", "A photo"),
      why: t("هي أول ما يشوفه من يلقاه لو ضاع.", "It's the first thing a finder sees if they're ever lost."),
      href: `/portal/cats/${cat.id}/edit#photos`,
    },
    !user?.phone && {
      key: "phone",
      icon: Phone,
      title: t("رقم جوالك", "Your mobile number"),
      why: t("نوصل رسالة من يلقاه لك فوراً — ولا يشوف رقمك أحد.", "A finder's message reaches you at once — nobody sees your number."),
      href: "/portal/settings",
    },
    !cat.cityCode && {
      key: "city",
      icon: MapPin,
      title: t("مدينته", "Their city"),
      why: t("تكمّل دفعته على الهوية وتقرّبه من عيادات مدينته.", "Completes their class on the ID and finds clinics nearby."),
      href: `/portal/cats/${cat.id}/edit`,
    },
    !record.cat.microchipNo && {
      key: "chip",
      icon: Cpu,
      title: t("رقم الشريحة", "Microchip number"),
      why: t("أي عيادة تمسح الشريحة توصل القط بسجله.", "Any clinic that scans the chip lands on this record."),
      href: `/portal/cats/${cat.id}/health`,
    },
    !record.cat.emergencyContact && {
      key: "emergency",
      icon: HeartHandshake,
      title: t("جهة اتصال للطوارئ", "An emergency contact"),
      why: t("شخص نوصل له لو ما قدرنا نوصلك.", "Someone we reach if we can't reach you."),
      href: `/portal/cats/${cat.id}/health`,
    },
  ].filter(Boolean) as { key: string; icon: React.ElementType; title: string; why: string; href: string }[];

  if (!items.length) return null;

  return (
    <section aria-labelledby="complete-file" className="space-y-3">
      <h2 id="complete-file" className="font-display text-2xl">{t("كمّل ملفه", "Complete the file")}</h2>
      <Card className="divide-y divide-border overflow-hidden">
        {items.slice(0, 3).map((i) => (
          <Link key={i.key} href={i.href} className="flex items-center gap-3 px-5 py-4 transition-colors hover:bg-muted/50">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <i.icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{i.title}</span>
              <span className="block text-sm text-muted-foreground">{i.why}</span>
            </span>
            <ChevronLeft className="size-4 shrink-0 text-muted-foreground ltr:rotate-180" aria-hidden />
          </Link>
        ))}
      </Card>
    </section>
  );
}
