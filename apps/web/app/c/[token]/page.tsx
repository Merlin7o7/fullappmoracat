import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FoundCatForm, FoundCatCTA } from "./found-cat-form";
import { Illo3D } from "@/components/illo-3d";
import { Siren, Syringe } from "lucide-react";
import { IdBand, Seal, StatusTag } from "@moraqat/ui";
import { vaccinationStandingLabel, type VaccinationStanding } from "@moraqat/core";

/**
 * The page a phone camera opens from the collar QR (MRC-PROD-001 T6).
 *
 * The Safety job of the Cat ID (R040): whoever finds the cat learns its name,
 * that it is registered, and — in lost mode — how to reach the owner without
 * ever learning who the owner is. One invitation at the bottom; nothing else.
 * Not indexed: this is a tag, not a profile.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface PublicCard {
  name: string;
  photoUrl: string | null;
  breed: { ar: string; en: string } | null;
  registered: boolean;
  catIdMasked: string | null;
  vaccinationStanding: string;
  isLost: boolean;
  lifecycle: string;
}

async function fetchCard(token: string): Promise<PublicCard | null> {
  try {
    const res = await fetch(`${BASE}/api/public/cats/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicCard;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const card = await fetchCard(params.token);
  return {
    title: card ? `${card.name} · Moracat` : "Moracat",
    robots: { index: false, follow: false },
  };
}

export default async function PublicCatPage({ params }: { params: { token: string } }) {
  const card = await fetchCard(params.token);
  if (!card) notFound();
  const isAr = cookies().get("locale")?.value !== "en";
  const standing =
    card.vaccinationStanding && card.vaccinationStanding !== "UNKNOWN"
      ? vaccinationStandingLabel(card.vaccinationStanding as VaccinationStanding)
      : null;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      {/* pb-28: room above the sticky thumb-zone action on phones. */}
      <main id="main" className="mx-auto w-full max-w-md px-4 pb-28 pt-6 sm:pb-10">
        {card.isLost && (
          <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl bg-destructive px-4 py-3 text-destructive-foreground">
            <Siren className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p className="font-medium">
              {isAr ? `${card.name} مفقود — عائلته تدوّره الآن. لو هو عندك، أرسل لهم بضغطة.` : `${card.name} is lost — the family is looking right now. If they're with you, tell them in one tap.`}
            </p>
          </div>
        )}

        <article className="overflow-hidden rounded-2xl border border-border bg-card">
          <IdBand
            tone="emerald"
            kind={isAr ? "هوية مرقط" : "Moracat ID"}
            serial={card.catIdMasked ?? undefined}
            seal={<Seal label={isAr ? "مسجّل في مرقط" : "Registered with Moracat"} className="border-white/40 text-white" />}
          />
          <div className="relative aspect-square w-full bg-[hsl(var(--cream))]">
            {card.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.photoUrl} alt={isAr ? `صورة ${card.name}` : `Photo of ${card.name}`} className="size-full object-cover" />
            ) : (
              // No playful 3D object on a lost cat's page (AD 2.1: never in distress contexts).
              card.isLost ? (
                <div className="grid size-full place-items-center font-display text-8xl text-muted-foreground/50">{card.name.slice(0, 1)}</div>
              ) : (
                <div className="grid size-full place-items-center"><Illo3D name="cat" className="size-44" px={176} priority /></div>
              )
            )}
          </div>
          <div className="space-y-3 p-6 text-center">
            <h1 className="font-display text-5xl leading-tight">{card.name}</h1>
            <p className="text-muted-foreground">
              {[card.breed ? (isAr ? card.breed.ar : card.breed.en) : null, isAr ? "له بيت وسجل صحي" : "Has a home and a health record"].filter(Boolean).join(" · ")}
            </p>
            {/* The one clinical fact a stranger can use: safe to handle? Shown
                only when the record actually says something. */}
            {standing && (
              <p className="flex justify-center">
                <StatusTag tone={card.vaccinationStanding === "UP_TO_DATE" ? "positive" : card.vaccinationStanding === "OVERDUE" ? "attention" : "neutral"} icon={<Syringe className="size-3.5" aria-hidden />}>
                  {isAr ? `التطعيمات: ${standing.ar}` : `Vaccinations: ${standing.en}`}
                </StatusTag>
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {isAr ? "بيانات المالك لا تظهر هنا أبداً — رسالتك تصله عبر مرقط." : "The owner's details are never shown here — your message reaches them through Moracat."}
            </p>
          </div>
          <div id="found" className="border-t border-border p-6">
            <FoundCatForm token={params.token} catName={card.name} isLost={card.isLost} isAr={isAr} />
          </div>
        </article>

        {/* What this tag is, in one line — then one quiet invitation. */}
        <section className="mt-6 space-y-3 rounded-2xl border border-border bg-card p-5 text-center">
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "هوية مرقط رقم دائم للقط: يوصل من يجده بأهله، ويحمل سجله الصحي لأي عيادة."
              : "A Moracat ID is a cat's permanent number: it connects whoever finds them with their family, and carries their health record to any clinic."}
          </p>
          <Link href="/register?src=qr" className="inline-flex h-11 items-center rounded-md border border-border bg-card px-5 text-sm font-medium hover:bg-muted">
            {isAr ? "سجّل قطك مجاناً" : "Register your cat — free"}
          </Link>
        </section>
      </main>
      <FoundCatCTA catName={card.name} isLost={card.isLost} isAr={isAr} />
      <SiteFooter />
    </div>
  );
}
