"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cat as CatIcon, Plus, Sparkles, Loader2, X } from "lucide-react";
import { Card, Badge, Button, Skeleton, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field, SelectField } from "@/components/field";

interface Cat {
  id: string;
  name: string;
  weightKg: number | null;
  activityLevel: string;
  isIndoor: boolean;
  breed: { nameEn: string; nameAr: string } | null;
}

interface Recommendation {
  dailyCalories: number;
  dryFoodKgPerMonth: number;
  wetPouchesPerMonth: number;
  litterKgPerMonth: number;
  supplementsPerMonth: number;
  estimatedMonthlyCostSar: number;
  confidence: number;
}

export default function CatsPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [rec, setRec] = React.useState<{ catId: string; data: Recommendation } | null>(null);

  const { data: cats, isLoading } = useQuery({
    queryKey: ["cats", user?.id],
    queryFn: () => authedFetch<Cat[]>("/cats"),
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch<{ name: string }>("/cats", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (cat) => {
      qc.invalidateQueries({ queryKey: ["cats"] });
      setShowForm(false);
      toast({ title: isAr ? `تمت إضافة ${cat.name}` : `${cat.name} added`, variant: "success" });
    },
    onError: (e) => toast({ title: isAr ? "تعذّرت الإضافة" : "Couldn't add cat", description: e.message, variant: "error" }),
  });

  const feed = useMutation({
    mutationFn: (catId: string) => authedFetch<Recommendation>(`/feeding/cats/${catId}`, { method: "POST", body: "{}" }),
    onSuccess: (data, catId) => setRec({ catId, data }),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "قططي" : "My Cats"}</h1>
          <p className="text-sm text-muted-foreground">{isAr ? "أضف قططك للحصول على توصيات تغذية ذكية" : "Add cats for smart feeding recommendations"}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> {isAr ? "إضافة قط" : "Add cat"}</Button>
      </div>

      {showForm && <CatForm isAr={isAr} onSubmit={(b) => create.mutate(b)} pending={create.isPending} error={create.error?.message} onClose={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-40 w-full" />)}</div>
      ) : cats && cats.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {cats.map((cat) => (
            <Card key={cat.id} className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-accent/15 text-accent-foreground"><CatIcon className="size-5" /></span>
                <div>
                  <p className="font-display font-semibold">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat.breed ? (isAr ? cat.breed.nameAr : cat.breed.nameEn) : (isAr ? "سلالة غير محددة" : "Unknown breed")}
                    {cat.weightKg ? ` · ${cat.weightKg} ${isAr ? "كجم" : "kg"}` : ""}
                  </p>
                </div>
              </div>
              <div className="mb-4 flex gap-2">
                <Badge variant="secondary">{cat.isIndoor ? (isAr ? "داخلي" : "Indoor") : (isAr ? "خارجي" : "Outdoor")}</Badge>
                <Badge variant="secondary">{activityLabel(cat.activityLevel, isAr)}</Badge>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={() => feed.mutate(cat.id)} disabled={feed.isPending}>
                {feed.isPending && feed.variables === cat.id ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {isAr ? "توصية التغذية" : "Feeding recommendation"}
              </Button>

              {rec?.catId === cat.id && <RecCard rec={rec.data} isAr={isAr} />}
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-muted"><CatIcon className="size-7 text-muted-foreground" /></span>
          <p className="text-sm text-muted-foreground">{isAr ? "لم تُضف أي قط بعد" : "No cats added yet"}</p>
        </Card>
      )}
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
  const [f, setF] = React.useState({ name: "", weightKg: "", activityLevel: "MODERATE", isIndoor: "true" });
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display font-semibold">{isAr ? "إضافة قط جديد" : "Add a new cat"}</h3>
        <button onClick={onClose} aria-label="close"><X className="size-4 text-muted-foreground" /></button>
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit({ name: f.name, weightKg: f.weightKg ? Number(f.weightKg) : undefined, activityLevel: f.activityLevel, isIndoor: f.isIndoor === "true" }); }}
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label={isAr ? "الاسم" : "Name"} required value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder="Simba" />
        <Field label={isAr ? "الوزن (كجم)" : "Weight (kg)"} type="number" value={f.weightKg} onChange={(v) => setF({ ...f, weightKg: v })} placeholder="4.5" />
        <SelectField label={isAr ? "مستوى النشاط" : "Activity"} value={f.activityLevel} onChange={(v) => setF({ ...f, activityLevel: v })}
          options={[{ value: "LOW", label: isAr ? "منخفض" : "Low" }, { value: "MODERATE", label: isAr ? "متوسط" : "Moderate" }, { value: "HIGH", label: isAr ? "عالٍ" : "High" }]} />
        <SelectField label={isAr ? "البيئة" : "Environment"} value={f.isIndoor} onChange={(v) => setF({ ...f, isIndoor: v })}
          options={[{ value: "true", label: isAr ? "داخلي" : "Indoor" }, { value: "false", label: isAr ? "خارجي" : "Outdoor" }]} />
        {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending || !f.name}>{pending && <Loader2 className="size-4 animate-spin" />} {isAr ? "حفظ" : "Save cat"}</Button>
        </div>
      </form>
    </Card>
  );
}

function activityLabel(level: string, isAr: boolean) {
  const map: Record<string, [string, string]> = { LOW: ["Low", "منخفض"], MODERATE: ["Moderate", "متوسط"], HIGH: ["High", "عالٍ"] };
  const [en, ar] = map[level] ?? [level, level];
  return isAr ? ar : en;
}
