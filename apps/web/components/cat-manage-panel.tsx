"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Pencil, Archive, RotateCcw, Trash2, Loader2, ArrowRight } from "lucide-react";
import { Badge, Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { SAUDI_CITIES, catPossessive, catVerb } from "@moraqat/core";
import { friendlyError, friendlyMessage } from "@/lib/errors";
import { useCats, type PortalCat } from "@/lib/cat-context";
import { Field, SelectField } from "@/components/field";
import { CatHealthPanel } from "@/components/cat-health-panel";
import { CatPhotosPanel } from "@/components/cat-photos-panel";
import { CatCommunityPanel } from "@/components/cat-community-panel";
import { CatHandoverPanel } from "@/components/cat-handover-panel";
import { ConfirmDialog } from "@/components/confirm-dialog";

/**
 * Everything an owner changes about a cat that isn't health: details, photos,
 * community visibility, handing the cat on, and the lifecycle. Rendered as the
 * cat's /edit page (it used to be a drawer — the only place the cat "lived").
 */
export function CatManagePanel({ cat, isAr, onClose }: { cat: PortalCat; isAr: boolean; onClose: () => void }) {
  const { authedFetch } = useAuth();
  const { setPrimaryCat, refresh } = useCats();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(true);
  const [confirm, setConfirm] = React.useState<null | "archive" | "deceased" | "remove">(null);
  /** «سجله» / «سجلها» / «سجل لولو» — never a silent masculine (core grammar). */
  const his = (noun: string) => catPossessive(noun, cat.gender, cat.name);

  const done = (msg: string) => {
    void qc.invalidateQueries({ queryKey: ["cats"] });
    void qc.invalidateQueries({ queryKey: ["overview"] });
    void qc.invalidateQueries({ queryKey: ["cat", cat.id] });
    // Lifecycle changes (remove / archive / deceased / restore) all change what
    // the community shows — refresh those caches too so a deleted or archived
    // cat disappears from the browse + facets immediately, not on next reload.
    void qc.invalidateQueries({ queryKey: ["community"] });
    void qc.invalidateQueries({ queryKey: ["community-facets"] });
    refresh();
    toast({ title: msg, variant: "success" });
  };

  const action = useMutation({
    mutationFn: ({ path, method = "POST", body }: { path: string; method?: string; body?: string }) =>
      authedFetch(path, { method, body: body ?? "{}" }),
    onError: (e: unknown) => {
      const f = friendlyError(e, isAr);
      toast({ title: f.title, description: f.message, variant: "error" });
    },
  });

  const runLifecycle = (kind: "archive" | "deceased" | "remove") => {
    const map = {
      archive: { path: `/cats/${cat.id}/archive`, msg: isAr ? `${cat.name} في الأرشيف` : `${cat.name} archived` },
      deceased: { path: `/cats/${cat.id}/deceased`, msg: isAr ? `حفظنا سجل ${cat.name}` : `${cat.name}'s record is kept` },
      remove: { path: `/cats/${cat.id}`, msg: isAr ? `تمت إزالة ${cat.name}` : `${cat.name} removed`, method: "DELETE" },
    } as const;
    const it = map[kind]!;
    action.mutate(
      { path: it.path, method: (it as { method?: string }).method ?? "POST" },
      { onSuccess: () => { done(it.msg); setConfirm(null); onClose(); } }
    );
  };

  const restore = () =>
    action.mutate({ path: `/cats/${cat.id}/restore` }, { onSuccess: () => done(isAr ? `استعدنا ملف ${cat.name}` : `${cat.name}'s file is back`) });

  return (
    <div className="space-y-6">
        {/* Status line */}
        <div className="flex flex-wrap items-center gap-2">
          {cat.isPrimary && <Badge variant="secondary"><Star className="me-1 size-3 fill-accent text-accent" /> {isAr ? "القط الأساسي" : "Primary cat"}</Badge>}
          <MembershipBadge status={cat.membershipStatus} isAr={isAr} />
          {cat.status !== "ACTIVE" && (
            <Badge variant={cat.status === "DECEASED" ? "secondary" : "outline"}>
              {cat.status === "DECEASED" ? (isAr ? "في الذاكرة" : "In memoriam") : (isAr ? "مؤرشف" : "Archived")}
            </Badge>
          )}
        </div>

        {/* Primary + edit */}
        {cat.status === "ACTIVE" && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={cat.isPrimary ? "secondary" : "primary"}
              size="sm"
              disabled={cat.isPrimary}
              onClick={() => { void setPrimaryCat(cat.id).then(() => done(isAr ? catVerb(cat.gender, { m: `${cat.name} صار القط الأساسي`, f: `${cat.name} صارت القطة الأساسية`, n: `${cat.name} الحين القط الأساسي` }) : `${cat.name} is now primary`)).catch(() => {}); }}
            >
              <Star className="size-4" /> {cat.isPrimary ? (isAr ? "الأساسي" : "Primary") : (isAr ? catVerb(cat.gender, { m: "اجعله الأساسي", f: "اجعلها الأساسية", n: `اجعل ${cat.name} الأساسي` }) : "Make primary")}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setEditing((v) => !v)}>
              <Pencil className="size-4" /> {isAr ? "تعديل" : "Edit"}
            </Button>
          </div>
        )}

        {editing && <EditForm cat={cat} isAr={isAr} onSaved={() => done(isAr ? "تم الحفظ" : "Saved")} />}

        {/* Photos — profile portrait + gallery */}
        {cat.status === "ACTIVE" && (
          <div id="photos" className="scroll-mt-20">
            <h2 className="mb-2 font-display text-lg">{isAr ? "الصور" : "Photos"}</h2>
            <CatPhotosPanel catId={cat.id} currentPhotoUrl={cat.photoUrl} isAr={isAr} />
          </div>
        )}

        {/* Community sharing + privacy */}
        {cat.status === "ACTIVE" && (
          <CatCommunityPanel catId={cat.id} catName={cat.name} photoUrl={cat.photoUrl} isAr={isAr} />
        )}

        {/* Health record — quick adds here; the full record (what the clinic
            wrote, weight, prescriptions, privacy) has its own page. */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{isAr ? "السجل الصحي" : "Health record"}</h3>
            <Link href={`/portal/cats/${cat.id}/health`} onClick={onClose} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
              {isAr ? "السجل الكامل" : "Full record"} <ArrowRight className="size-4 rtl:rotate-180" />
            </Link>
          </div>
          <CatHealthPanel catId={cat.id} isAr={isAr} />
        </div>

        {/* Handing the cat on — the Cat ID and the record go with them.
            Sits ABOVE lifecycle on purpose: rehoming is not a kind of deletion,
            and a member looking for "how do I pass my cat on" should find it
            before they find "remove" (R010, P09). */}
        {cat.status === "ACTIVE" && (
          <CatHandoverPanel catId={cat.id} catName={cat.name} isAr={isAr} onDone={onClose} />
        )}

        {/* Lifecycle */}
        <div className="space-y-2 rounded-2xl border border-border p-4">
          <h3 className="text-sm font-semibold">{isAr ? "دورة الحياة" : "Lifecycle"}</h3>
          {cat.status === "ACTIVE" ? (
            <div className="flex flex-wrap gap-2">
              <LifecycleButton icon={Archive} label={isAr ? "أرشفة" : "Archive"} onClick={() => setConfirm("archive")} />
              <LifecycleButton icon={null} label={isAr ? "رحل عنّا" : "Passed away"} onClick={() => setConfirm("deceased")} />
              <LifecycleButton icon={Trash2} label={isAr ? "إزالة" : "Remove"} destructive onClick={() => setConfirm("remove")} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={restore} disabled={action.isPending}>
                {action.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                {isAr ? "استعادة" : "Restore"}
              </Button>
              <LifecycleButton icon={Trash2} label={isAr ? "إزالة نهائياً" : "Remove"} destructive onClick={() => setConfirm("remove")} />
            </div>
          )}

          {/* Removal is the one irreversible step: it gets the shared dialog with
              the action named (R116). Archive / passed away stay inline. */}
          <ConfirmDialog
            open={confirm === "remove"}
            onClose={() => setConfirm(null)}
            onConfirm={() => runLifecycle("remove")}
            busy={action.isPending}
            isAr={isAr}
            title={isAr ? `إزالة ${cat.name} نهائياً؟` : `Permanently remove ${cat.name}?`}
            description={isAr ? `ينحذف ${his("ملف")} و${his("صور")} ولا يمكن التراجع.` : `Their file and photos are deleted — this can't be undone.`}
            confirmLabel={isAr ? `احذف ملف ${cat.name}` : `Delete ${cat.name}'s file`}
          />
          {confirm && confirm !== "remove" && (
            <div className="rounded-xl bg-muted/60 p-3 text-sm">
              <p className="mb-2">
                {confirm === "deceased"
                  ? (isAr ? `نحفظ سجل ${cat.name} و${his("هوية")} للأبد.` : `We'll keep ${cat.name}'s record and Cat ID forever.`)
                  : (isAr ? `أرشفة ${cat.name}؟ يبقى ${his("سجل")} محفوظاً.` : `Archive ${cat.name}? Their record stays saved.`)}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" loading={action.isPending} onClick={() => runLifecycle(confirm)}>
                  {confirm === "archive"
                    ? isAr ? `أرشف ${cat.name}` : `Archive ${cat.name}`
                    : isAr ? `احفظ سجل ${cat.name}` : `Keep ${cat.name}'s record`}
                </Button>
                <Button size="sm" variant="tertiary" onClick={() => setConfirm(null)}>{isAr ? "تراجع" : "Cancel"}</Button>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}

function LifecycleButton({ icon: Icon, label, onClick, destructive }: { icon: React.ElementType | null; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <Button variant="secondary" size="sm" onClick={onClick} className={destructive ? "text-destructive hover:bg-destructive/10" : undefined}>
      {Icon && <Icon className="size-4" />} {label}
    </Button>
  );
}

/**
 * The paid care plan's state — shown only when there IS a plan. Every cat with
 * a Cat ID is already a member (R087); "no plan" is the normal state, never an
 * "inactive" badge that reads as if the free ID doesn't work.
 */
function MembershipBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const map: Record<string, { label: [string, string]; variant: "success" | "secondary" | "outline" }> = {
    ACTIVE: { label: ["Care plan active", "خطة العناية فعّالة"], variant: "success" },
    PENDING: { label: ["Care plan starting", "خطة العناية قيد التفعيل"], variant: "outline" },
  };
  const it = map[status];
  if (!it) return null;
  return <Badge variant={it.variant}>{isAr ? it.label[1] : it.label[0]}</Badge>;
}

function EditForm({ cat, isAr, onSaved }: { cat: PortalCat; isAr: boolean; onSaved: () => void }) {
  const { authedFetch } = useAuth();
  const [f, setF] = React.useState({
    name: cat.name,
    weightKg: cat.weightKg?.toString() ?? "",
    activityLevel: cat.activityLevel,
    isIndoor: cat.isIndoor ? "true" : "false",
    gender: cat.gender || "UNKNOWN",
    cityCode: cat.cityCode ?? "",
  });
  const save = useMutation({
    mutationFn: (b: Record<string, unknown>) => authedFetch(`/cats/${cat.id}`, { method: "PATCH", body: JSON.stringify(b) }),
    onSuccess: onSaved,
  });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save.mutate({ name: f.name.trim(), weightKg: f.weightKg ? Number(f.weightKg) : undefined, activityLevel: f.activityLevel, isIndoor: f.isIndoor === "true", gender: f.gender, ...(f.cityCode ? { cityCode: f.cityCode } : {}) }); }}
      className="grid gap-3 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2"
    >
      <Field label={isAr ? "الاسم" : "Name"} required value={f.name} onChange={(v) => setF({ ...f, name: v })} />
      <Field label={isAr ? "الوزن (كغ)" : "Weight (kg)"} inputMode="decimal" value={f.weightKg} onChange={(v) => setF({ ...f, weightKg: v })} />
      <SelectField label={isAr ? "الجنس" : "Sex"} value={f.gender} onChange={(v) => setF({ ...f, gender: v })}
        options={[{ value: "MALE", label: isAr ? "ذكر" : "Male" }, { value: "FEMALE", label: isAr ? "أنثى" : "Female" }, { value: "UNKNOWN", label: isAr ? "غير محدد" : "Unknown" }]} />
      <SelectField label={isAr ? "النشاط" : "Activity"} value={f.activityLevel} onChange={(v) => setF({ ...f, activityLevel: v })}
        options={[{ value: "LOW", label: isAr ? "منخفض" : "Low" }, { value: "MODERATE", label: isAr ? "متوسط" : "Moderate" }, { value: "HIGH", label: isAr ? "عالٍ" : "High" }]} />
      <SelectField
        label={isAr ? "المدينة" : "City"}
        value={f.cityCode}
        onChange={(v) => setF({ ...f, cityCode: v })}
        options={[{ value: "", label: isAr ? "اختر المدينة" : "Choose a city" }, ...SAUDI_CITIES.map((c) => ({ value: c.code, label: isAr ? c.ar : c.en }))]}
      />
      <SelectField label={isAr ? "البيئة" : "Environment"} value={f.isIndoor} onChange={(v) => setF({ ...f, isIndoor: v })}
        options={[{ value: "true", label: isAr ? "داخلي" : "Indoor" }, { value: "false", label: isAr ? "خارجي" : "Outdoor" }]} />
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" loading={save.isPending} disabled={!f.name.trim()}>{isAr ? "حفظ التعديلات" : "Save changes"}</Button>
        {save.error && <p role="alert" className="mt-1 text-xs text-destructive">{friendlyMessage(save.error, isAr)}</p>}
      </div>
    </form>
  );
}
