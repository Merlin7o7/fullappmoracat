"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, Palette, Repeat2, Share2 } from "lucide-react";
import { Button, Dialog, cn } from "@moraqat/ui";
import type { PortalCat } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { resolvePersonalization } from "@/lib/cat-profile";
import { CatIdCard } from "@/components/cat-id-card";
import { CatIdShare } from "@/components/cat-id-share";

/**
 * The Cat ID as the first thing on the cat's page (audit 2026-10-04: "Card
 * first, a Now ledger, then tabs"). Large and live — the real card in the
 * owner's own design, not a picture of it. Tap turns it over to the collar
 * edition (phone-free, QR + safety facts); "Share" opens the sheet with the
 * story, the exports and Wallet. One invitation to personalise, shown only
 * until the card is personalised; one add-photo action, at the card, only
 * while there is no photo.
 */
export function CardHero({ cat, isAr, allergies }: { cat: PortalCat; isAr: boolean; allergies?: string[] }) {
  const name = localizeName(cat.name, isAr ? "ar" : "en");
  const [back, setBack] = React.useState(false);
  const [sheet, setSheet] = React.useState(false);
  const rp = resolvePersonalization(cat.profile?.personalization);

  // Deep link: /portal/cats/{id}#share opens the sheet (old anchor kept alive).
  React.useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#share") setSheet(true);
  }, []);

  if (!cat.catIdNumber) return null;

  const common = {
    catName: cat.name,
    catIdNumber: cat.catIdNumber,
    catNumber: cat.catNumber,
    issuedAt: cat.idIssuedAt,
    photoUrl: cat.photoUrl,
    isAr,
    membershipActive: cat.membershipStatus === "ACTIVE",
    qrToken: cat.qrToken,
    themeField: rp.themeField,
    themeArt: rp.themeArt,
    accentHsl: rp.accentHsl,
    frame: rp.frame,
    stickers: rp.stickers,
    className: "max-w-none",
  } as const;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setBack((b) => !b)}
        aria-pressed={back}
        aria-label={
          back
            ? isAr ? `اقلب لوجه بطاقة ${name}` : `Turn ${name}'s card to the front`
            : isAr ? `اقلب لظهر البطاقة: نسخة الطوق` : "Turn the card over: the collar edition"
        }
        className="group block w-full rounded-2xl text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <span key={back ? "back" : "front"} className="block motion-safe:animate-fade-in">
          {back ? (
            <CatIdCard
              {...common}
              detailed
              foundingClass={isAr ? cat.foundingClass?.ar : cat.foundingClass?.en}
              gender={cat.gender}
              birthDate={cat.birthDate}
              vaccinationStatus={cat.vaccinationStatus ?? null}
              breed={cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : null}
              allergies={allergies ?? []}
            />
          ) : (
            <CatIdCard {...common} animated />
          )}
        </span>
      </button>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="contextual" onClick={() => setSheet(true)}>
          <Share2 aria-hidden /> {isAr ? "شارك واطبع" : "Share & print"}
        </Button>
        <Button variant="secondary" onClick={() => setBack((b) => !b)} aria-pressed={back}>
          <Repeat2 aria-hidden /> {back ? (isAr ? "الوجه" : "Front") : isAr ? "نسخة الطوق" : "Collar edition"}
        </Button>
      </div>

      {/* At the card, while the card has no face to show. */}
      {!cat.photoUrl && (
        <Link
          href={`/portal/cats/${cat.id}/edit#photos`}
          className="flex min-h-11 items-center gap-3 rounded-md border border-dashed border-primary/40 bg-card px-4 py-2.5 text-sm transition-colors hover:border-primary hover:bg-primary/[0.04]"
        >
          <Camera className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="min-w-0">
            <span className="block font-medium text-primary">{isAr ? `أضف صورة ${name}` : `Add a photo of ${name}`}</span>
            <span className="block text-muted-foreground">
              {isAr ? "هي أول ما يشوفه من يجده — وتظهر على البطاقة." : "It's the first thing a finder sees — and it goes on the card."}
            </span>
          </span>
        </Link>
      )}

      {/* The one invitation to personalise — until the card is theirs. */}
      {!rp.isCustomised && (
        <Link
          href={`/portal/cats/new?cat=${cat.id}&step=design`}
          className={cn("inline-flex min-h-11 items-center gap-2 text-sm font-medium text-primary hover:underline")}
        >
          <Palette className="size-4" aria-hidden />
          {isAr ? `صمّم بطاقة ${name}: الخلفية والإطار والملصقات` : `Design ${name}'s card: theme, frame, stickers`}
        </Link>
      )}

      <Dialog
        open={sheet}
        onClose={() => setSheet(false)}
        title={isAr ? `هوية ${name}` : `${name}'s ID`}
        className="sm:max-w-lg"
      >
        {sheet && <CatIdShare cat={cat} isAr={isAr} />}
      </Dialog>
    </div>
  );
}
