"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Sparkles, Loader2, Search, Star, IdCard, Settings2, Copy, Check, FileDown, ImageDown, Printer, Stethoscope, Wallet, Share2 } from "lucide-react";
import { Card, Badge, Button, Skeleton, Drawer, Avatar, useToast, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats, type PortalCat } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { exportCardPng, exportCardPdf, printCard, shareStoryPng, exportSafeSrc } from "@/lib/card-export";
import { CatIdCard } from "@/components/cat-id-card";
import { CatIdStory } from "@/components/cat-id-story";
import { CatManageDrawer } from "@/components/cat-manage-drawer";
import { QueryError } from "@/components/query-error";
import { IlloCat, IlloMouse, IlloPaw } from "@/components/illustrations";

interface Recommendation {
  dailyCalories: number;
  dryFoodKgPerMonth: number;
  wetPouchesPerMonth: number;
  litterKgPerMonth: number;
  supplementsPerMonth: number;
  estimatedMonthlyCostSar: number;
  confidence: number;
}

type Filter = "ALL" | "ACTIVE" | "ARCHIVED" | "DECEASED";

export default function CatsPage() {
  const { authedFetch } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { cats, isLoading, isError, refetch, setPrimaryCat } = useCats();

  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [rec, setRec] = React.useState<{ catId: string; data: Recommendation } | null>(null);
  const [idCardCat, setIdCardCat] = React.useState<PortalCat | null>(null);
  const [manageCat, setManageCat] = React.useState<PortalCat | null>(null);

  const feed = useMutation({
    mutationFn: (catId: string) => authedFetch<Recommendation>(`/feeding/cats/${catId}`, { method: "POST", body: "{}" }),
    onSuccess: (data, catId) => setRec({ catId, data }),
  });

  const counts = React.useMemo(() => ({
    ALL: cats.length,
    ACTIVE: cats.filter((c) => c.status === "ACTIVE").length,
    ARCHIVED: cats.filter((c) => c.status === "ARCHIVED").length,
    DECEASED: cats.filter((c) => c.status === "DECEASED").length,
  }), [cats]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return cats.filter((c) => {
      if (filter !== "ALL" && c.status !== filter) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.catIdNumber ?? "").toLowerCase().includes(q);
    });
  }, [cats, filter, search]);

  const filters: { key: Filter; ar: string; en: string }[] = [
    { key: "ALL", ar: "الكل", en: "All" },
    { key: "ACTIVE", ar: "النشطة", en: "Active" },
    { key: "ARCHIVED", ar: "المؤرشفة", en: "Archived" },
    { key: "DECEASED", ar: "في الذاكرة", en: "In memoriam" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{isAr ? "قطط البيت" : "Your household"}</h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "كل قط له هويته وسجله — أضف بلا حدود" : "Every cat, their own ID & record — add as many as you like"}
          </p>
        </div>
        <Link href="/portal/cats/new"><Button size="sm"><Plus className="size-4" /> {isAr ? "إضافة قط" : "Add cat"}</Button></Link>
      </div>

      {/* Search + filter — stays useful whether the household has 2 cats or 20. */}
      {cats.length > 1 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 sm:max-w-xs">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isAr ? "ابحث بالاسم أو رقم الهوية…" : "Search by name or Cat ID…"}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filters.filter((f) => f.key === "ALL" || f.key === "ACTIVE" || counts[f.key] > 0).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {isAr ? f.ar : f.en} <span className="opacity-70">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isError ? (
        /* Never show the "add your first cat" welcome on a failed load — that
           would tell a member with cats they have none (R112). */
        <QueryError isAr={isAr} onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-44 w-full" />)}</div>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {filtered.map((cat) => (
            <CatCard
              key={cat.id}
              cat={cat}
              isAr={isAr}
              rec={rec?.catId === cat.id ? rec.data : null}
              feeding={feed.isPending && feed.variables === cat.id}
              onIdCard={() => setIdCardCat(cat)}
              onFeed={() => feed.mutate(cat.id)}
              onManage={() => setManageCat(cat)}
              onPrimary={() => setPrimaryCat(cat.id)}
            />
          ))}
        </div>
      ) : cats.length === 0 ? (
        /* Empty state = a welcome, not a void (R111). */
        <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <IlloPaw tone="butter" className="pointer-events-none absolute start-8 top-6 size-8 rotate-[-14deg] opacity-60" />
          <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />
          <IlloCat tone="green" className="h-24 w-auto" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {isAr ? "أول قط تضيفه يحصل على هويته الرسمية فوراً" : "The first cat you add gets an official Cat ID, instantly"}
          </p>
          <Link href="/portal/cats/new"><Button size="sm"><Plus className="size-4" /> {isAr ? "أضف قط" : "Add a cat"}</Button></Link>
        </Card>
      ) : (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <IlloMouse tone="sage" className="h-12 w-auto opacity-80" />
          <p className="text-sm text-muted-foreground">{isAr ? "ما لقينا قط بهذا البحث" : "No cats match your search"}</p>
        </div>
      )}

      {/* Cat ID + QR, always in reach (Dossier §04). */}
      <Drawer open={!!idCardCat} onClose={() => setIdCardCat(null)} title={isAr ? "هوية القط" : "Cat ID"}>
        {idCardCat?.catIdNumber && <IdCardBody cat={idCardCat} isAr={isAr} />}
      </Drawer>

      {/* Full management: identity, primary, edit, health, lifecycle. */}
      {manageCat && <CatManageDrawer cat={manageCat} isAr={isAr} onClose={() => setManageCat(null)} />}
    </div>
  );
}

function CatCard({
  cat, isAr, rec, feeding, onIdCard, onFeed, onManage, onPrimary,
}: {
  cat: PortalCat; isAr: boolean; rec: Recommendation | null; feeding: boolean;
  onIdCard: () => void; onFeed: () => void; onManage: () => void; onPrimary: () => void;
}) {
  const inactive = cat.status !== "ACTIVE";
  return (
    <Card className={cn("p-5", inactive && "opacity-90")}>
      <div className="mb-3 flex items-start gap-3">
        <Avatar name={cat.name} src={cat.photoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-display font-semibold">{localizeName(cat.name, isAr ? "ar" : "en")}</p>
            {cat.isPrimary && <Star className="size-3.5 shrink-0 fill-accent text-accent" aria-label={isAr ? "الأساسي" : "Primary"} />}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {cat.catIdNumber && <span className="font-mono tracking-wider tabular" dir="ltr">{cat.catIdNumber}</span>}
            {(() => {
              const meta = [
                cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : null,
                cat.weightKg ? `${cat.weightKg} ${isAr ? "كجم" : "kg"}` : null,
              ].filter(Boolean).join(" · ");
              return meta ? `${cat.catIdNumber ? " · " : ""}${meta}` : "";
            })()}
          </p>
        </div>
        {!cat.isPrimary && cat.status === "ACTIVE" && (
          <button
            type="button"
            onClick={onPrimary}
            title={isAr ? "اجعله الأساسي" : "Make primary"}
            aria-label={isAr ? "اجعله الأساسي" : "Make primary"}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/15 hover:text-accent-foreground"
          >
            <Star className="size-4" />
          </button>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {inactive ? (
          <Badge variant={cat.status === "DECEASED" ? "secondary" : "outline"}>
            {cat.status === "DECEASED" ? (isAr ? "في الذاكرة 🤍" : "In memoriam 🤍") : (isAr ? "مؤرشف" : "Archived")}
          </Badge>
        ) : (
          <>
            <Badge variant={cat.membershipStatus === "ACTIVE" ? "success" : "secondary"}>
              {cat.membershipStatus === "ACTIVE" ? (isAr ? "عضوية فعّالة" : "Member") : (isAr ? "غير فعّالة" : "Inactive")}
            </Badge>
            <Badge variant="secondary">{cat.isIndoor ? (isAr ? "داخلي" : "Indoor") : (isAr ? "خارجي" : "Outdoor")}</Badge>
          </>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={onIdCard} disabled={!cat.catIdNumber}>
          <IdCard className="size-4" /> {isAr ? "الهوية" : "ID"}
        </Button>
        <Button variant="outline" size="sm" onClick={onFeed} disabled={feeding || inactive}>
          {feeding ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {isAr ? "التغذية" : "Feeding"}
        </Button>
        <Button variant="outline" size="sm" onClick={onManage}>
          <Settings2 className="size-4" /> {isAr ? "إدارة" : "Manage"}
        </Button>
      </div>

      {/* The postponed profile, invited later as a benefit to the cat (R002/R017). */}
      {!inactive && !cat.breed && !cat.weightKg && (
        <Link
          href={`/portal/cats/new?cat=${cat.id}`}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <Stethoscope className="size-3.5" />
          {isAr
            ? `أكمل ملف ${localizeName(cat.name, "ar")} — يساعد أي عيادة تساعده أسرع`
            : `Complete ${localizeName(cat.name, "en")}'s file — it helps any clinic help faster`}
        </Link>
      )}

      {rec && <RecCard rec={rec} isAr={isAr} />}
    </Card>
  );
}

function IdCardBody({ cat, isAr }: { cat: PortalCat; isAr: boolean }) {
  const { user, authedFetch } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState<null | "pdf" | "png" | "print">(null);
  const [walletBusy, setWalletBusy] = React.useState(false);
  const [shareBusy, setShareBusy] = React.useState(false);
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
      else if (kind === "png") await exportCardPng(exportRef.current, baseName);
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

  async function shareStory() {
    if (!storyRef.current) return;
    setShareBusy(true);
    try {
      const dispName = localizeName(cat.name, isAr ? "ar" : "en");
      const outcome = await shareStoryPng(
        storyRef.current,
        baseName,
        isAr
          ? `${dispName} رسمياً في عائلة مرقط 🐾 سوّ هوية قطك على moracat.co`
          : `${dispName} is officially a Moracat 🐾 Create your cat's ID at moracat.co`
      );
      if (outcome === "downloaded") {
        toast({
          title: isAr ? "جاهزة للستوري ✨" : "Story ready ✨",
          description: isAr ? "حفظناها لك — ارفعها على انستقرام" : "Saved for you — post it to your Story",
          variant: "success",
        });
      }
    } catch {
      toast({
        title: isAr ? "تعذّر إنشاء الستوري" : "Couldn't create the story",
        description: isAr ? "جرّب مرة ثانية بعد لحظات" : "Give it another try in a moment",
        variant: "error",
      });
    } finally {
      setShareBusy(false);
    }
  }

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

  const cardProps = {
    detailed: true,
    catName: cat.name,
    catIdNumber: cat.catIdNumber!,
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
      <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -4000, zIndex: -1 }}>
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
      <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -4000, zIndex: -1, width: 540 }}>
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
      <Button size="lg" className="w-full max-w-sm" onClick={shareStory} disabled={shareBusy}>
        {shareBusy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
        {isAr ? `شارك هوية ${localizeName(cat.name, "ar")} ✨` : `Share ${localizeName(cat.name, "en")}'s ID ✨`}
      </Button>

      {/* #6 Export — PDF / high-res PNG / print, full branding preserved. */}
      <div className="grid w-full max-w-sm grid-cols-3 gap-2">
        <Button variant="outline" size="sm" onClick={() => run("pdf")} disabled={!!busy}>
          {busy === "pdf" ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} PDF
        </Button>
        <Button variant="outline" size="sm" onClick={() => run("png")} disabled={!!busy}>
          {busy === "png" ? <Loader2 className="size-4 animate-spin" /> : <ImageDown className="size-4" />} PNG
        </Button>
        <Button variant="outline" size="sm" onClick={() => run("print")} disabled={!!busy}>
          {busy === "print" ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />} {isAr ? "طباعة" : "Print"}
        </Button>
      </div>

      {/* The card where cards live — shown only when the pass can be issued (R034, R040). */}
      {wallet.data?.google && (
        <Button variant="outline" size="sm" className="w-full max-w-sm" onClick={addToGoogleWallet} disabled={walletBusy}>
          {walletBusy ? <Loader2 className="size-4 animate-spin" /> : <Wallet className="size-4" />}
          {isAr ? "أضفها إلى Google Wallet" : "Add to Google Wallet"}
        </Button>
      )}

      <button onClick={copy} className="inline-flex items-center gap-1.5 font-mono text-sm tracking-wider text-muted-foreground transition-colors hover:text-foreground" dir="ltr">
        {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
        {cat.catIdNumber}
      </button>
      <p className="max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
        {isAr
          ? `الرمز رمز تحقق آمن — يُقرأ فقط داخل تطبيق مرقط أو من شريك معتمد للتأكد من الهوية والعضوية، بدون كشف أي بيانات عامة.`
          : `The QR is a secure token — read only inside the Moracat app or by an authorized partner to confirm identity & membership. No public profile is exposed.`}
      </p>
    </div>
  );
}

function RecCard({ rec, isAr }: { rec: Recommendation; isAr: boolean }) {
  const rows = [
    [isAr ? "سعرات يومية" : "Daily calories", `${rec.dailyCalories} kcal`],
    [isAr ? "طعام جاف/شهر" : "Dry food/mo", `${rec.dryFoodKgPerMonth} kg`],
    [isAr ? "أكياس رطبة/شهر" : "Wet pouches/mo", `${rec.wetPouchesPerMonth}`],
    [isAr ? "رمل/شهر" : "Litter/mo", `${rec.litterKgPerMonth} kg`],
    [isAr ? "التكلفة/شهر" : "Est. cost/mo", `${rec.estimatedMonthlyCostSar} SAR`],
  ];
  return (
    <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">{isAr ? "توصية التغذية الذكية" : "Smart Feeding"}</span>
        <Badge variant="success">{Math.round(rec.confidence * 100)}% {isAr ? "ثقة" : "confidence"}</Badge>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium">{v}</dd></div>
        ))}
      </dl>
    </div>
  );
}

