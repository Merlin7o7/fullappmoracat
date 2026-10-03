"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Copy, Check, FileDown, ImageDown, Printer, Wallet, Share2 } from "lucide-react";
import { Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import type { PortalCat } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { resolvePersonalization } from "@/lib/cat-profile";
import { IS_IOS, exportCardPng, exportCardPdf, printCard, renderCardFile, exportSafeSrc } from "@/lib/card-export";
import { StoryPreviewSheet, useStoryShare } from "@/components/story-share";
import { CatIdCard } from "@/components/cat-id-card";
import { CatIdStory } from "@/components/cat-id-story";

/**
 * The Cat ID as a possession: the card itself, the story frame people post,
 * PDF / PNG / print for the collar and paperwork, and the Wallet pass where
 * the environment can issue one (R034, R040). Lives in the cat's profile.
 */
export function CatIdShare({ cat, isAr }: { cat: PortalCat; isAr: boolean }) {
  const { user, authedFetch } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "pdf" | "png" | "print">(null);
  const [walletBusy, setWalletBusy] = React.useState(false);
  const [appleBusy, setAppleBusy] = React.useState(false);
  const [cardSheet, setCardSheet] = React.useState<{ file: File; url: string } | null>(null);
  const storyRef = React.useRef<HTMLDivElement>(null);
  // Wallet buttons appear only where the environment can actually issue a
  // pass — no dead controls, no premature promises (R040).
  const wallet = useQuery({
    queryKey: ["wallet-availability"],
    queryFn: () => authedFetch<{ google: boolean; apple: boolean }>("/wallet/availability"),
    staleTime: 5 * 60_000,
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
      } else if (kind === "png") await exportCardPng(exportRef.current, baseName);
      else await printCard(exportRef.current, baseName);
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

  // The story renders ahead of time so a single tap opens the share sheet —
  // on iPhone the tap must reach navigator.share directly (see story-share).
  const dispName = localizeName(cat.name, isAr ? "ar" : "en");
  const story = useStoryShare({
    nodeRef: storyRef,
    baseName,
    isAr,
    prerender: true,
    cacheKey: [cat.id, cat.name, cat.photoUrl, cat.catIdNumber, cat.idIssuedAt, cat.membershipStatus, isAr].join("|"),
    shareText: isAr
      ? `${dispName} صار في عائلة مرقط 🐾 سوّ هوية قطك على moracat.co`
      : `${dispName} is now a Moracat 🐾 Create your cat's ID at moracat.co`,
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
    ownerName,
    ownerPhone: user?.phone ?? null,
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

  return (
    <div className="flex flex-col items-center gap-5 pt-2">
      <div className="w-full max-w-sm">
        <CatIdCard {...cardProps} photoUrl={cat.photoUrl} />
      </div>

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

      {/* The growth moment — a story frame members genuinely want to post (R003). */}
      <Button size="lg" className="w-full max-w-sm" onClick={story.share} disabled={story.busy}>
        {story.busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
        {isAr ? `شارك هوية ${localizeName(cat.name, "ar")} ✨` : `Share ${localizeName(cat.name, "en")}'s ID ✨`}
      </Button>

      {/* #6 Export — PDF / high-res PNG / print, full branding preserved. */}
      <div className="grid w-full max-w-sm grid-cols-3 gap-2">
        <Button variant="secondary" size="sm" onClick={() => run("pdf")} disabled={!!busy}>
          {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} PDF
        </Button>
        <Button variant="secondary" size="sm" onClick={() => run("png")} disabled={!!busy}>
          {busy === "png" ? <Loader2 className="size-4 animate-spin" /> : <ImageDown className="size-4" />} PNG
        </Button>
        <Button variant="secondary" size="sm" onClick={() => run("print")} disabled={!!busy}>
          {busy === "print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />} {isAr ? "طباعة" : "Print"}
        </Button>
      </div>

      {/* The card where cards live — shown only when the pass can be issued (R034, R040). */}
      {/* Apple Wallet: a navigation, not a fetch — Safari hands the .pkpass to Wallet. */}
      {wallet.data?.apple && (
        <Button
          variant="secondary"
          size="sm"
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
        <Button variant="secondary" size="sm" className="w-full max-w-sm" onClick={addToGoogleWallet} disabled={walletBusy}>
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
          shareText={isAr ? `هوية ${dispName} في مرقط` : `${dispName}'s Moracat ID`}
          onClose={() => { URL.revokeObjectURL(cardSheet.url); setCardSheet(null); }}
        />
      )}

      <button onClick={copy} className="inline-flex items-center gap-1.5 font-mono text-sm tracking-wider text-muted-foreground transition-colors hover:text-foreground" dir="ltr">
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        {cat.catIdNumber}
      </button>
      <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        {isAr
          ? `أي كاميرا جوال تقرأ الرمز وتفتح صفحة ${localizeName(cat.name, "ar")}: اسمه وصورته وما اخترت إظهاره فقط — بياناتك أنت ما تظهر فيها. أما PDF وPNG والطباعة فتحمل اسمك ورقمك للطوارئ، فخلّها لطوقه وأوراقه، وللنشر استخدم «شارك الهوية».`
          : `Any phone camera reads the QR and opens ${localizeName(cat.name, "en")}'s page: name, photo and only what you chose to show — none of your own details appear there. The PDF, PNG and print versions do carry your name and emergency number, so keep those for the collar and paperwork, and use "Share" for posting.`}
      </p>
    </div>
  );
}
