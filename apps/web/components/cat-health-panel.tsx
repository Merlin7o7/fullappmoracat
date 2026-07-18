"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Syringe, Stethoscope, FileText, Plus, Loader2, Camera } from "lucide-react";
import { Badge, Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { formatDate } from "@/lib/datetime";
import { formatSAR } from "@/lib/money";
import { Field, SelectField } from "@/components/field";

/**
 * A cat's health record — the "hold the record" job of the Cat ID (R058).
 * Vaccinations, vet visits and documents live under the cat's identity, per cat.
 */

interface Vaccination {
  id: string; name: string; administeredAt: string; dueAt: string | null; vetName: string | null; clinic: string | null;
}
interface VetVisit {
  id: string; visitedAt: string; reason: string; clinic: string | null; vetName: string | null; diagnosis: string | null; cost: number | null;
}
interface CatDoc {
  id: string; title: string; kind: string; url: string;
}
interface CatDetail {
  vaccinations: Vaccination[];
  vetVisits: VetVisit[];
  documents: CatDoc[];
}

type Tab = "vaccinations" | "visits" | "documents";

export function CatHealthPanel({ catId, isAr }: { catId: string; isAr: boolean }) {
  const { authedFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<Tab>("vaccinations");
  const [adding, setAdding] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cat", catId],
    queryFn: () => authedFetch<CatDetail>(`/cats/${catId}`),
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["cat", catId] });
    setAdding(false);
  };

  const addVax = useMutation({
    mutationFn: (b: Record<string, unknown>) => authedFetch(`/cats/${catId}/vaccinations`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: e.message, variant: "error" }),
  });
  const addVisit = useMutation({
    mutationFn: (b: Record<string, unknown>) => authedFetch(`/cats/${catId}/vet-visits`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: e.message, variant: "error" }),
  });
  const addDoc = useMutation({
    mutationFn: (b: Record<string, unknown>) => authedFetch(`/cats/${catId}/documents`, { method: "POST", body: JSON.stringify(b) }),
    onSuccess: invalidate,
    onError: (e: Error) => toast({ title: e.message, variant: "error" }),
  });

  const fmt = (d: string | null) =>
    d ? formatDate(d, isAr ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" }) : "—";

  const tabs: { key: Tab; icon: typeof Syringe; ar: string; en: string; count: number }[] = [
    { key: "vaccinations", icon: Syringe, ar: "التطعيمات", en: "Vaccinations", count: data?.vaccinations.length ?? 0 },
    { key: "visits", icon: Stethoscope, ar: "زيارات العيادة", en: "Vet visits", count: data?.vetVisits.length ?? 0 },
    { key: "documents", icon: FileText, ar: "المستندات", en: "Documents", count: data?.documents.length ?? 0 },
  ];

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="mb-3 flex items-center gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setAdding(false); }}
            aria-pressed={tab === t.key}
            aria-label={isAr ? t.ar : t.en}
            className={`flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${tab === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}
          >
            <t.icon className="size-3.5" />
            <span className="hidden sm:inline">{isAr ? t.ar : t.en}</span>
            <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{t.count}</Badge>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-6"><Loader2 className="size-4 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="space-y-2">
            {tab === "vaccinations" && (data?.vaccinations.length
              ? data.vaccinations.map((v) => (
                  <Row key={v.id} title={v.name} meta={[fmt(v.administeredAt), v.dueAt ? `${isAr ? "التالي" : "next"} ${fmt(v.dueAt)}` : "", v.clinic ?? v.vetName ?? ""].filter(Boolean).join(" · ")} />
                ))
              : <Empty isAr={isAr} label={isAr ? "لا توجد تطعيمات بعد — سجّل الأول وسنذكّرك قبل موعد التالي" : "No vaccinations yet — record the first and we'll remind you before the next one"} />)}

            {tab === "visits" && (data?.vetVisits.length
              ? data.vetVisits.map((v) => (
                  <Row key={v.id} title={v.reason} meta={[fmt(v.visitedAt), v.clinic ?? v.vetName ?? "", v.cost ? formatSAR(v.cost, isAr) : ""].filter(Boolean).join(" · ")} sub={v.diagnosis} />
                ))
              : <Empty isAr={isAr} label={isAr ? "لا زيارات بعد — سجّل أول زيارة ويبقى التاريخ الصحي كاملاً هنا" : "No visits yet — record the first and the full health story lives here"} />)}

            {tab === "documents" && (data?.documents.length
              ? data.documents.map((d) => (
                  <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-border p-3 transition-colors hover:bg-muted">
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">{docKindLabel(d.kind, isAr)}</p>
                  </a>
                ))
              : <Empty isAr={isAr} label={isAr ? "لا مستندات بعد — صوّر دفتر التطعيم وسنحفظه للأبد" : "No documents yet — photograph the vaccine book and we'll keep it forever"} />)}
          </div>

          {!adding ? (
            <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> {isAr ? "إضافة" : "Add"}
            </Button>
          ) : (
            <div className="mt-3 rounded-xl bg-muted/40 p-3">
              {tab === "vaccinations" && <VaxForm isAr={isAr} pending={addVax.isPending} onSubmit={(b) => addVax.mutate(b)} onCancel={() => setAdding(false)} />}
              {tab === "visits" && <VisitForm isAr={isAr} pending={addVisit.isPending} onSubmit={(b) => addVisit.mutate(b)} onCancel={() => setAdding(false)} />}
              {tab === "documents" && <DocForm isAr={isAr} pending={addDoc.isPending} onSubmit={(b) => addDoc.mutate(b)} onCancel={() => setAdding(false)} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Row({ title, meta, sub }: { title: string; meta: string; sub?: string | null }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-xs text-muted-foreground">{meta}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground/80">{sub}</p>}
    </div>
  );
}

function Empty({ label }: { isAr: boolean; label: string }) {
  return <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted-foreground">{label}</p>;
}

function VaxForm({ isAr, pending, onSubmit, onCancel }: FormProps) {
  const [f, setF] = React.useState({ name: "", administeredAt: "", dueAt: "", clinic: "" });
  return (
    <FormShell isAr={isAr} pending={pending} disabled={!f.name || !f.administeredAt} onCancel={onCancel}
      submitLabel={isAr ? "سجّل اللقاح" : "Record vaccine"}
      onSubmit={() => onSubmit({ name: f.name, administeredAt: f.administeredAt, dueAt: f.dueAt || undefined, clinic: f.clinic || undefined })}>
      <Field label={isAr ? "اللقاح" : "Vaccine"} required value={f.name} onChange={(v) => setF({ ...f, name: v })} placeholder={isAr ? "الحمى الثلاثية" : "Tricat"} />
      <Field label={isAr ? "تاريخ الإعطاء" : "Given on"} type="date" required value={f.administeredAt} onChange={(v) => setF({ ...f, administeredAt: v })} />
      <Field label={isAr ? "الجرعة القادمة" : "Next due"} type="date" value={f.dueAt} onChange={(v) => setF({ ...f, dueAt: v })} />
      <Field label={isAr ? "العيادة" : "Clinic"} value={f.clinic} onChange={(v) => setF({ ...f, clinic: v })} />
    </FormShell>
  );
}

function VisitForm({ isAr, pending, onSubmit, onCancel }: FormProps) {
  const [f, setF] = React.useState({ visitedAt: "", reason: "", clinic: "", diagnosis: "", cost: "" });
  return (
    <FormShell isAr={isAr} pending={pending} disabled={!f.reason || !f.visitedAt} onCancel={onCancel}
      submitLabel={isAr ? "سجّل الزيارة" : "Record visit"}
      onSubmit={() => onSubmit({ visitedAt: f.visitedAt, reason: f.reason, clinic: f.clinic || undefined, diagnosis: f.diagnosis || undefined, cost: f.cost ? Number(f.cost) : undefined })}>
      <Field label={isAr ? "سبب الزيارة" : "Reason"} required value={f.reason} onChange={(v) => setF({ ...f, reason: v })} placeholder={isAr ? "فحص دوري" : "Check-up"} />
      <Field label={isAr ? "التاريخ" : "Date"} type="date" required value={f.visitedAt} onChange={(v) => setF({ ...f, visitedAt: v })} />
      <Field label={isAr ? "العيادة" : "Clinic"} value={f.clinic} onChange={(v) => setF({ ...f, clinic: v })} />
      <Field label={isAr ? "التشخيص" : "Diagnosis"} value={f.diagnosis} onChange={(v) => setF({ ...f, diagnosis: v })} />
      <Field label={isAr ? "التكلفة" : "Cost (SAR)"} type="number" value={f.cost} onChange={(v) => setF({ ...f, cost: v })} />
    </FormShell>
  );
}

function DocForm({ isAr, pending, onSubmit, onCancel }: FormProps) {
  const { authedUpload } = useAuth();
  const [f, setF] = React.useState({ title: "", kind: "other", url: "" });
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [showLink, setShowLink] = React.useState(false);

  // Real members hold a *photo* of the vaccine card, not a hosted URL — so the
  // primary path is "photograph it" (camera on mobile), uploaded to storage and
  // attached automatically (R002). A paste-a-link field stays as the fallback.
  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const res = await authedUpload<{ url: string }>("/uploads/image", form);
      setF((prev) => ({ ...prev, url: res.url }));
    } catch {
      setUploadError(
        isAr
          ? "تعذّر رفع الصورة — جرّب مرة أخرى، مستندك ما زال معك."
          : "The photo didn't upload — try again; your document is still with you."
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <FormShell isAr={isAr} pending={pending} disabled={!f.title || !f.url || uploading} onCancel={onCancel}
      submitLabel={isAr ? "أضف المستند" : "Add document"}
      onSubmit={() => onSubmit({ title: f.title, kind: f.kind, url: f.url })}>
      <Field label={isAr ? "العنوان" : "Title"} required value={f.title} onChange={(v) => setF({ ...f, title: v })} />
      <SelectField label={isAr ? "النوع" : "Kind"} value={f.kind} onChange={(v) => setF({ ...f, kind: v })}
        options={[
          { value: "adoption", label: isAr ? "تبنّي" : "Adoption" },
          { value: "pedigree", label: isAr ? "نسب" : "Pedigree" },
          { value: "lab", label: isAr ? "مختبر" : "Lab" },
          { value: "insurance", label: isAr ? "تأمين" : "Insurance" },
          { value: "other", label: isAr ? "أخرى" : "Other" },
        ]} />
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="text-sm font-medium">{isAr ? "المستند" : "The document"}</span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label={isAr ? "صوّر المستند أو ارفعه" : "Photograph or upload the document"}
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        {f.url ? (
          <div className="flex items-center gap-2 rounded-xl border border-input bg-muted/40 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt="" className="size-12 rounded-lg object-cover" />
            <span className="flex-1 text-xs text-muted-foreground">
              {isAr ? "تم الحفظ — أكمل وأضف المستند" : "Saved — finish and add the document"}
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setF({ ...f, url: "" })}>
              {isAr ? "تغيير" : "Change"}
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={uploading}
            onClick={() => fileRef.current?.click()}
            className="w-fit"
          >
            <Camera className="size-4" /> {isAr ? "صوّر المستند أو ارفعه" : "Photograph or upload it"}
          </Button>
        )}
        {uploadError && <p role="alert" className="text-xs text-destructive">{uploadError}</p>}
        {!f.url && (
          showLink ? (
            <Field label={isAr ? "أو ألصق رابطاً" : "Or paste a link"} value={f.url} onChange={(v) => setF({ ...f, url: v })} placeholder="https://…" />
          ) : (
            <button
              type="button"
              onClick={() => setShowLink(true)}
              className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {isAr ? "عندي رابط جاهز" : "I have a link instead"}
            </button>
          )
        )}
      </div>
    </FormShell>
  );
}

interface FormProps {
  isAr: boolean;
  pending: boolean;
  onSubmit: (b: Record<string, unknown>) => void;
  onCancel: () => void;
}

function FormShell({ isAr, pending, disabled, submitLabel, onCancel, onSubmit, children }: {
  isAr: boolean; pending: boolean; disabled: boolean; submitLabel: string; onCancel: () => void; onSubmit: () => void; children: React.ReactNode;
}) {
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="grid gap-3 sm:grid-cols-2">
      {children}
      <div className="flex gap-2 sm:col-span-2">
        {/* Buttons name the action, never "Save" (R086). */}
        <Button type="submit" size="sm" loading={pending} disabled={disabled}>{submitLabel}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>{isAr ? "إلغاء" : "Cancel"}</Button>
      </div>
    </form>
  );
}

function docKindLabel(kind: string, isAr: boolean) {
  const map: Record<string, [string, string]> = {
    adoption: ["Adoption", "تبنّي"], pedigree: ["Pedigree", "نسب"], lab: ["Lab", "مختبر"], insurance: ["Insurance", "تأمين"], other: ["Other", "أخرى"],
  };
  const [en, ar] = map[kind] ?? [kind, kind];
  return isAr ? ar : en;
}
