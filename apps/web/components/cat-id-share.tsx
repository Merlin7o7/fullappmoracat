"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Copy, Check, FileDown, ImageDown, Printer, Wallet, Share2 } from "lucide-react";
import { Button, Switch, useToast } from "@moraqat/ui";
import { catPossessive } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import type { PortalCat } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { resolvePersonalization } from "@/lib/cat-profile";
import { useShareLink } from "@/lib/share-link";
import { trackCardShared } from "@/lib/track-once";
import { IS_IOS, exportCardPng, exportCardPdf, printCard, renderCardFile, exportSafeSrc } from "@/lib/card-export";
import { StoryPreviewSheet, useStoryShare } from "@/components/story-share";
import { CatIdCard } from "@/components/cat-id-card";
import { CatIdStory } from "@/components/cat-id-story";
import type { HealthRecord } from "@/components/cat-health-record";

/**
 * The Cat ID as a possession: the story frame people post, PDF / PNG / print
 * for the collar and paperwork, and the Wallet pass where the environment can
 * issue one (R034, R040). Opened as a sheet from the card on the profile.
 *
 * The collar edition is PHONE-FREE by default (MRC-UX-AUDIT-2026-10-04
 * Problem 3): cat, name, Cat ID, QR and safety facts. A finder scans the QR
 * and reaches the owner through Moracat's relay (/c/[token]) — the same
 * promise signup makes («رقمك ما يظهر لأحد»). Printing the owner's number is
 * an explicit, honest, per-export opt-in that is never remembered.
 */
export function CatIdShare({ cat, isAr, showPreview = true }: { cat: PortalCat; isAr: boolean; showPreview?: boolean }) {
  const { user, authedFetch } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "pdf" | "png" | "print">(null);
  const [walletBusy, setWalletBusy] = React.useState(false);
  const [appleBusy, setAppleBusy] = React.useState(false);
  const [cardSheet, setCardSheet] = React.useState<{ file: File; url: string } | null>(null);
  // Off by default, every time: the phone is printed only when asked for now.
  const [withPhone, setWithPhone] = React.useState(false);
  const storyRef = React.useRef<HTMLDivElement>(null);
  // Wallet buttons appear only where the environment can actually issue a
  // pass — no dead controls, no premature promises (R040).
  const wallet = useQuery({
    queryKey: ["wallet-availability"],
    queryFn: () => authedFetch<{ google: boolean; apple: boolean }>("/wallet/availability"),
    staleTime: 5 * 60_000,
  });
  // Allergies travel on the collar edition — the one safety fact a finder or
  // a clinic can act on. Same query (and cache) as the health tab.
  const health = useQuery({
    queryKey: ["cat-health", cat.id],
    queryFn: () => authedFetch<HealthRecord>(`/cats/${cat.id}/health`),
    enabled: !!user,
    staleTime: 60_000,
  });
  // Exports capture a dedicated off-screen node at a fixed 856px width — the
  // on-screen card can be any size (phone drawer, desktop) without changing
  // the exported artwork one pixel (R034).
  const exportRef = React.useRef<HTMLDivElement>(null);
  const copy = () => {
    if (!cat.catIdNumber) return;
    navigator.clipboard?.writeText(cat.catIdNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const ownerName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const breed = cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : null;
  const baseName = `Moracat-${cat.catIdNumber ?? cat.name}`;
  const dispName = localizeName(cat.name, isAr ? "ar" : "en");
  const phoneOn = withPhone && !!user?.phone;

  async function run(kind: "pdf" | "png" | "print") {
    if (!exportRef.current) return;
    setBusy(kind);
    try {
      if (kind === "pdf") await exportCardPdf(exportRef.current, baseName);
      else if (kind === "png" && IS_IOS) {
        // iPhones refuse a download this long after the tap — show the image
        // in a sheet instead (Share / press-and-hold to save).
        const file = await renderCardFile(exportRef.current, baseName);
        setCardSheet({ file, url: URL.createObjectURL(file) });
        return; // counted when it actually leaves the sheet
      } else if (kind === "png") await exportCardPng(exportRef.current, baseName);
      else await printCard(exportRef.current, baseName);
      trackCardShared("card", kind, { phone: phoneOn });
    } catch {
      toast({
        title: isAr ? "تعذّر التصدير" : "Export failed",
        description: isAr ? "قد تكون صورة القط من مصدر خارجي — جرّب بدون صورة." : "The cat photo may be cross-origin — try without a photo.",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  // Shares lead to /i/{slug}?ref=…&src=story: the stranger meets THIS cat,
  // and a signup is credited to the member who shared (audit Problem 9).
  const storyLink = useShareLink(cat.isPublic ? cat.publicSlug : null, "story");
  const cardLink = useShareLink(cat.isPublic ? cat.publicSlug : null, "card");

  // The story renders ahead of time so a single tap opens the share sheet —
  // on iPhone the tap must reach navigator.share directly (see story-share).
  const story = useStoryShare({
    nodeRef: storyRef,
    baseName,
    isAr,
    prerender: true,
    cacheKey: [cat.id, cat.name, cat.photoUrl, cat.catIdNumber, cat.idIssuedAt, cat.membershipStatus, isAr].join("|"),
    shareText: isAr
      ? `هذي هوية ${dispName} في سجل مرقط 🐾 قطك وش رقمه؟ ${storyLink}`
      : `This is ${dispName}'s Moracat ID 🐾 What's your cat's number? ${storyLink}`,
    attribution: { src: "story", kind: "cat_id" },
  });

  async function addToGoogleWallet() {
    setWalletBusy(true);
    try {
      const { saveUrl } = await authedFetch<{ saveUrl: string }>(`/wallet/cats/${cat.id}/google`);
      window.open(saveUrl, "_blank", "noopener");
    } catch {
      toast({
        title: isAr ? "تعذّر إنشاء بطاقة المحفظة" : "Couldn't create the wallet pass",
        description: isAr ? "جرّب مرة ثانية بعد لحظات" : "Give it another try in a moment",
        variant: "error",
      });
    } finally {
      setWalletBusy(false);
    }
  }

  // The owner's personalisation travels with the card — drawer, export, and the
  // shared PNG all render the theme / accent / frame / stickers they chose.
  const rp = resolvePersonalization(cat.profile?.personalization);
  const cardProps = {
    detailed: true,
    catName: cat.name,
    catIdNumber: cat.catIdNumber!,
    catNumber: cat.catNumber,
    foundingClass: isAr ? cat.foundingClass?.ar : cat.foundingClass?.en,
    issuedAt: cat.idIssuedAt,
    isAr,
    membershipActive: cat.membershipStatus === "ACTIVE",
    // Name + number only on the opted-in edition; the collar edition carries neither.
    ownerName: phoneOn ? ownerName : null,
    ownerPhone: phoneOn ? user?.phone ?? null : null,
    allergies: health.data?.cat.allergies ?? [],
    breed,
    favoriteFood: cat.favoriteFoods?.[0] ?? null,
    gender: cat.gender,
    birthDate: cat.birthDate ?? null,
    vaccinationStatus: cat.vaccinationStatus ?? null,
    qrToken: cat.qrToken,
    themeField: rp.themeField,
    themeArt: rp.themeArt,
    accentHsl: rp.accentHsl,
    frame: rp.frame,
    stickers: rp.stickers,
  } as const;

  const thePage = isAr ? catPossessive("صفحة", cat.gender, dispName) : `${dispName}'s page`;

  return (
    <div className="flex flex-col items-center gap-5">
      {showPreview && (
        <div className="w-full max-w-sm">
          <CatIdCard {...cardProps} photoUrl={cat.photoUrl} />
        </div>
      )}

      {/* Hidden fixed-width twin for export — identical composition (cqw units),
          photo routed same-origin so the capture can embed it. The captured node
          must be statically positioned (html-to-image keeps the root's computed
          position, so capturing the fixed wrapper itself would render off-canvas). */}
      {/* Clipped to a zero box at the viewport origin (and LTR): a twin parked
          at left:-4000px is scrollable overflow in RTL and shifted the page. */}
      <div aria-hidden dir="ltr" className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden" style={{ zIndex: -1 }}>
        <div ref={exportRef} style={{ width: 856 }}>
          <CatIdCard {...cardProps} exportMode photoUrl={exportSafeSrc(cat.photoUrl)} className="max-w-none" />
        </div>
      </div>

      {/* 9:16 Instagram-Story frame (540×960 → captured at 1080×1920), in its
          OWN offscreen container sized exactly to the frame: sharing the card
          twin's wider (856px) container let RTL anchor the frame to the
          container's right edge, which WebKit bakes into the capture on iPhone
          (content shifted by the width delta, blank band on the other side).
          The capture's pixel ratio also derives from this node's offsetWidth. */}
      <div aria-hidden dir="ltr" className="pointer-events-none fixed left-0 top-0 h-0 w-0 overflow-hidden" style={{ zIndex: -1 }}>
        <div ref={storyRef} style={{ width: 540 }}>
          <CatIdStory
            catName={cat.name}
            catIdNumber={cat.catIdNumber!}
            issuedAt={cat.idIssuedAt}
            photoUrl={exportSafeSrc(cat.photoUrl)}
            qrToken={cat.qrToken}
            membershipActive={cat.membershipStatus === "ACTIVE"}
            isAr={isAr}
          />
        </div>
      </div>

      {/* The growth moment — a story frame members genuinely want to post (R003).
          One contextual action per view (AD 2.1). */}
      <Button variant="contextual" size="lg" className="w-full max-w-sm" onClick={story.share} disabled={story.busy}>
        {story.busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
        {isAr ? `شارك هوية ${dispName}` : `Share ${dispName}'s ID`}
      </Button>

      {/* For the collar and paperwork — phone-free unless asked for, right now. */}
      <section aria-labelledby="collar-title" className="w-full max-w-sm space-y-3 border-t border-border pt-4">
        <div>
          <h3 id="collar-title" className="font-medium">{isAr ? "نسخة الطوق والأوراق" : "For the collar and paperwork"}</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {isAr
              ? `بدون رقمك: من يجد ${dispName} يمسح الرمز ويوصلك عبر مرقط، وما يشوف رقمك ولا اسمك.`
              : `Without your number: whoever finds ${dispName} scans the code and reaches you through Moracat — they never see your number or name.`}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="secondary" size="md" onClick={() => run("pdf")} disabled={!!busy}>
            {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} PDF
          </Button>
          <Button variant="secondary" size="md" onClick={() => run("png")} disabled={!!busy}>
            {busy === "png" ? <Loader2 className="size-4 animate-spin" /> : <ImageDown className="size-4" />} PNG
          </Button>
          <Button variant="secondary" size="md" onClick={() => run("print")} disabled={!!busy}>
            {busy === "print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />} {isAr ? "طباعة" : "Print"}
          </Button>
        </div>
        {user?.phone && (
          <Switch
            checked={withPhone}
            onCheckedChange={setWithPhone}
            label={isAr ? "اطبع اسمي ورقمي على هذه النسخة" : "Print my name and number on this copy"}
            description={
              withPhone
                ? isAr
                  ? "رقمك يظهر على هذه النسخة — أي شخص يمسك البطاقة يقرأه. للأوراق الخاصة فقط، لا للطوق."
                  : "Your number shows on this copy — anyone holding the card can read it. For private paperwork, not the collar."
                : isAr
                  ? "مطفأ: النسخة بدون رقمك."
                  : "Off: this copy carries no number."
            }
          />
        )}
      </section>

      {/* The card where cards live — shown only when the pass can be issued (R034, R040). */}
      {/* Apple Wallet: a navigation, not a fetch — Safari hands the .pkpass to Wallet. */}
      {wallet.data?.apple && (
        <Button
          variant="secondary"
          className="w-full max-w-sm"
          disabled={appleBusy}
          onClick={async () => {
            setAppleBusy(true);
            try {
              const { url } = await authedFetch<{ url: string }>(`/wallet/cats/${cat.id}/apple`);
              window.location.href = url;
            } catch {
              toast({ title: isAr ? "تعذّر إنشاء البطاقة" : "Couldn't create the pass", variant: "error" });
            } finally {
              setAppleBusy(false);
            }
          }}
        >
          {appleBusy ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
          {isAr ? "أضفها إلى Apple Wallet" : "Add to Apple Wallet"}
        </Button>
      )}
      {wallet.data?.google && (
        <Button variant="secondary" className="w-full max-w-sm" onClick={addToGoogleWallet} disabled={walletBusy}>
          {walletBusy ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
          {isAr ? "أضفها إلى Google Wallet" : "Add to Google Wallet"}
        </Button>
      )}

      {story.sheet}
      {cardSheet && (
        <StoryPreviewSheet
          file={cardSheet.file}
          url={cardSheet.url}
          isAr={isAr}
          shareText={isAr ? `هوية ${dispName} في سجل مرقط ${cardLink}` : `${dispName}'s Moracat ID ${cardLink}`}
          onDelivered={(how) => trackCardShared("card", "png", { phone: phoneOn, via: how })}
          onClose={() => { URL.revokeObjectURL(cardSheet.url); setCardSheet(null); }}
        />
      )}

      <button
        onClick={copy}
        className="inline-flex min-h-11 items-center gap-1.5 font-mono text-sm tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        dir="ltr"
        aria-label={isAr ? "انسخ رقم الهوية" : "Copy the Cat ID"}
      >
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        {cat.catIdNumber}
      </button>
      <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        {isAr
          ? `أي كاميرا جوال تقرأ الرمز وتفتح ${thePage}: الاسم والصورة وما اخترت إظهاره فقط. بياناتك ما تظهر فيها، ورسالة من يجده تصلك عبر مرقط.`
          : `Any phone camera reads the code and opens ${thePage}: name, photo and only what you chose to show. Your details never appear there, and a finder's message reaches you through Moracat.`}
      </p>
    </div>
  );
}
