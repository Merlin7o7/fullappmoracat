"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Cat as CatIcon, Plus, Sparkles, Loader2, X, Search, Star, IdCard, Settings2, Copy, Check } from "lucide-react";
import { Card, Badge, Button, Skeleton, Drawer, Avatar, useToast, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats, type PortalCat } from "@/lib/cat-context";
import { Field, SelectField } from "@/components/field";
import { CatIdCard } from "@/components/cat-id-card";
import { CatIdCeremony } from "@/components/cat-id-ceremony";
import { CatManageDrawer } from "@/components/cat-manage-drawer";

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
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const { cats, isLoading, setPrimaryCat } = useCats();

  const [showForm, setShowForm] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [rec, setRec] = React.useState<{ catId: string; data: Recommendation } | null>(null);
  const [ceremonyCat, setCeremonyCat] = React.useState<PortalCat | null>(null);
  const [idCardCat, setIdCardCat] = React.useState<PortalCat | null>(null);
  const [manageCat, setManageCat] = React.useState<PortalCat | null>(null);

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch<PortalCat>("/cats", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["cats"] });
      qc.invalidateQueries({ queryKey: ["overview"] });
      setShowForm(false);
      // The reveal IS the confirmation — a ceremony, not a toast (R031, R080).
      setCeremonyCat(cat);
    },
    onError: (e: Error) => toast({ title: isAr ? "تعذّر إصدار الهوية" : "Couldn't issue the Cat ID", description: e.message, variant: "error" }),
  });

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
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "قطط البيت" : "Your household"}</h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "كل قط له هويته وسجله — أضف بلا حدود" : "Every cat, their own ID & record — add as many as you like"}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> {isAr ? "إضافة قط" : "Add cat"}</Button>
      </div>

      {showForm && <CatForm isAr={isAr} onSubmit={(b) => create.mutate(b)} pending={create.isPending} error={create.error?.message} onClose={() => setShowForm(false)} />}

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

      {isLoading ? (
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
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-muted"><CatIcon className="size-7 text-muted-foreground" /></span>
          <p className="text-sm text-muted-foreground">
            {isAr ? "أول قط تضيفه يحصل على هويته الرسمية فوراً" : "The first cat you add gets an official Cat ID, instantly"}
          </p>
          <Button size="sm" onClick={() => setShowForm(true)}><Plus className="size-4" /> {isAr ? "أضف قط" : "Add a cat"}</Button>
        </Card>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">{isAr ? "ما لقينا قط بهذا البحث" : "No cats match your search"}</p>
      )}

      {/* The reveal ceremony — the peak moment (Dossier Stage 4). */}
      {ceremonyCat?.catIdNumber && (
        <CatIdCeremony
          cat={{ name: ceremonyCat.name, catIdNumber: ceremonyCat.catIdNumber, idIssuedAt: ceremonyCat.idIssuedAt, photoUrl: ceremonyCat.photoUrl }}
          isAr={isAr}
          onClose={() => setCeremonyCat(null)}
        />
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
            <p className="truncate font-display font-semibold">{cat.name}</p>
            {cat.isPrimary && <Star className="size-3.5 shrink-0 fill-accent text-accent" aria-label={isAr ? "الأساسي" : "Primary"} />}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {cat.catIdNumber && <span className="font-mono tracking-wider tabular" dir="ltr">{cat.catIdNumber}</span>}
            {cat.catIdNumber && (cat.breed || cat.weightKg) ? " · " : ""}
            {cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : ""}
            {cat.weightKg ? ` · ${cat.weightKg} ${isAr ? "كجم" : "kg"}` : ""}
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

      {rec && <RecCard rec={rec} isAr={isAr} />}
    </Card>
  );
}

function IdCardBody({ cat, isAr }: { cat: PortalCat; isAr: boolean }) {
  const { user } = useAuth();
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    if (!cat.catIdNumber) return;
    navigator.clipboard?.writeText(cat.catIdNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const ownerName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null;
  const breed = cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : null;
  return (
    <div className="flex flex-col items-center gap-5 pt-2">
      <CatIdCard
        detailed
        catName={cat.name}
        catIdNumber={cat.catIdNumber!}
        issuedAt={cat.idIssuedAt}
        photoUrl={cat.photoUrl}
        isAr={isAr}
        membershipActive={cat.membershipStatus === "ACTIVE"}
        ownerName={ownerName}
        ownerPhone={user?.phone ?? null}
        breed={breed}
        favoriteFood={cat.favoriteFoods?.[0] ?? null}
        qrToken={cat.qrToken}
      />
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

function CatForm({ isAr, onSubmit, pending, error, onClose }: { isAr: boolean; onSubmit: (b: Record<string, unknown>) => void; pending: boolean; error?: string; onClose: () => void }) {
  const [f, setF] = React.useState({ name: "", weightKg: "", gender: "UNKNOWN", activityLevel: "MODERATE", isIndoor: "true" });
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display font-semibold">{isAr ? "إضافة قط جديد" : "Add a new cat"}</h3>
        <button onClick={onClose} aria-label="close"><X className="size-4 text-muted-foreground" /></button>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit({ name: f.name, weightKg: f.weightKg ? Number(f.weightKg) : undefined, gender: f.gender, activityLevel: f.activityLevel, isIndoor: f.isIndoor === "true" }); }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label={isAr ? "الاسم" : "Name"} required value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder={isAr ? "مثلاً: مشمش" : "e.g. Simba"} />
        <Field label={isAr ? "الوزن (كجم)" : "Weight (kg)"} type="number" value={f.weightKg} onChange={(v) => setF({ ...f, weightKg: v })} placeholder="4.5" />
        <SelectField label={isAr ? "الجنس" : "Sex"} value={f.gender} onChange={(v) => setF({ ...f, gender: v })}
          options={[{ value: "MALE", label: isAr ? "ذكر" : "Male" }, { value: "FEMALE", label: isAr ? "أنثى" : "Female" }, { value: "UNKNOWN", label: isAr ? "غير محدد" : "Unknown" }]} />
        <SelectField label={isAr ? "مستوى النشاط" : "Activity"} value={f.activityLevel} onChange={(v) => setF({ ...f, activityLevel: v })}
          options={[{ value: "LOW", label: isAr ? "منخفض" : "Low" }, { value: "MODERATE", label: isAr ? "متوسط" : "Moderate" }, { value: "HIGH", label: isAr ? "عالٍ" : "High" }]} />
        <SelectField label={isAr ? "البيئة" : "Environment"} value={f.isIndoor} onChange={(v) => setF({ ...f, isIndoor: v })}
          options={[{ value: "true", label: isAr ? "داخلي" : "Indoor" }, { value: "false", label: isAr ? "خارجي" : "Outdoor" }]} className="sm:col-span-2" />
        {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" loading={pending} disabled={!f.name}>
            {pending
              ? (isAr ? (f.name ? `جارٍ إصدار هوية ${f.name}…` : "جارٍ إصدار الهوية…") : (f.name ? `Issuing ${f.name}'s Cat ID…` : "Issuing the Cat ID…"))
              : (isAr ? "أصدر هوية القط" : "Issue the Cat ID")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
