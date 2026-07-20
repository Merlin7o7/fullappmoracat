"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, Pencil, Archive, RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Badge, Button, Drawer, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useCats, type PortalCat } from "@/lib/cat-context";
import { Field, SelectField } from "@/components/field";
import { CatIdCard } from "@/components/cat-id-card";
import { CatHealthPanel } from "@/components/cat-health-panel";
import { CatPhotosPanel } from "@/components/cat-photos-panel";
import { CatCommunityPanel } from "@/components/cat-community-panel";

export function CatManageDrawer({ cat, isAr, onClose }: { cat: PortalCat; isAr: boolean; onClose: () => void }) {
  const { authedFetch } = useAuth();
  const { setPrimaryCat, refresh } = useCats();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [confirm, setConfirm] = React.useState<null | "archive" | "deceased" | "remove">(null);

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
    onError: (e: Error) => toast({ title: e.message, variant: "error" }),
  });

  const runLifecycle = (kind: "archive" | "deceased" | "remove") => {
    const map = {
      archive: { path: `/cats/${cat.id}/archive`, msg: isAr ? `${cat.name} في الأرشيف` : `${cat.name} archived` },
      deceased: { path: `/cats/${cat.id}/deceased`, msg: isAr ? `حفظنا سجل ${cat.name} 🤍` : `${cat.name}'s record preserved 🤍` },
      remove: { path: `/cats/${cat.id}`, msg: isAr ? `تمت إزالة ${cat.name}` : `${cat.name} removed`, method: "DELETE" },
    } as const;
    const it = map[kind]!;
    action.mutate(
      { path: it.path, method: (it as { method?: string }).method ?? "POST" },
      { onSuccess: () => { done(it.msg); setConfirm(null); onClose(); } }
    );
  };

  const restore = () =>
    action.mutate({ path: `/cats/${cat.id}/restore` }, { onSuccess: () => done(isAr ? `عاد ${cat.name} 🐈` : `${cat.name} is back 🐈`) });

  const qrValue = cat.qrToken ? `MRCV1:${cat.qrToken}` : null;

  return (
    <Drawer open onClose={onClose} title={isAr ? `إدارة ${cat.name}` : `Manage ${cat.name}`}>
      <div className="space-y-5 pt-1">
        {/* Status line */}
        <div className="flex flex-wrap items-center gap-2">
          {cat.isPrimary && <Badge variant="secondary"><Star className="me-1 size-3 fill-accent text-accent" /> {isAr ? "القط الأساسي" : "Primary cat"}</Badge>}
          <MembershipBadge status={cat.membershipStatus} isAr={isAr} />
          {cat.status !== "ACTIVE" && (
            <Badge variant={cat.status === "DECEASED" ? "secondary" : "outline"}>
              {cat.status === "DECEASED" ? (isAr ? "في الذاكرة 🤍" : "In memoriam 🤍") : (isAr ? "مؤرشف" : "Archived")}
            </Badge>
          )}
        </div>

        {/* Identity + QR (the Cat ID made tangible + scannable) */}
        <div className="flex flex-col items-center gap-4">
          <CatIdCard
            catName={cat.name}
            catIdNumber={cat.catIdNumber ?? "MRC-••••-••••"}
            catNumber={cat.catNumber}
            foundingClass={isAr ? cat.foundingClass?.ar : cat.foundingClass?.en}
            issuedAt={cat.idIssuedAt}
            photoUrl={cat.photoUrl}
            isAr={isAr}
            membershipActive={cat.membershipStatus === "ACTIVE"}
          />
          {qrValue && (
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-2xl bg-white p-3 shadow-e1 ring-hairline">
                <QRCodeSVG value={qrValue} size={112} level="M" bgColor="#ffffff" fgColor="#0b3b30" />
              </div>
              <p className="max-w-[16rem] text-center text-[11px] leading-relaxed text-muted-foreground">
                {isAr ? "رمز تحقق آمن — يُقرأ داخل مرقط أو من شريك معتمد" : "Secure token — read inside Moracat or by an authorized partner"}
              </p>
            </div>
          )}
        </div>

        {/* Primary + edit */}
        {cat.status === "ACTIVE" && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={cat.isPrimary ? "outline" : "primary"}
              size="sm"
              disabled={cat.isPrimary}
              onClick={() => { void setPrimaryCat(cat.id).then(() => done(isAr ? `${cat.name} صار القط الأساسي` : `${cat.name} is now primary`)).catch(() => {}); }}
            >
              <Star className="size-4" /> {cat.isPrimary ? (isAr ? "الأساسي" : "Primary") : (isAr ? "اجعله الأساسي" : "Make primary")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
              <Pencil className="size-4" /> {isAr ? "تعديل" : "Edit"}
            </Button>
          </div>
        )}

        {editing && <EditForm cat={cat} isAr={isAr} onSaved={() => { setEditing(false); done(isAr ? "تم الحفظ" : "Saved"); }} />}

        {/* Photos — profile portrait + gallery */}
        {cat.status === "ACTIVE" && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">{isAr ? "الصور" : "Photos"}</h3>
            <CatPhotosPanel catId={cat.id} currentPhotoUrl={cat.photoUrl} isAr={isAr} />
          </div>
        )}

        {/* Community sharing + privacy */}
        {cat.status === "ACTIVE" && <CatCommunityPanel catId={cat.id} catName={cat.name} isAr={isAr} />}

        {/* Health record */}
        <div>
          <h3 className="mb-2 text-sm font-semibold">{isAr ? "السجل الصحي" : "Health record"}</h3>
          <CatHealthPanel catId={cat.id} isAr={isAr} />
        </div>

        {/* Lifecycle */}
        <div className="space-y-2 rounded-2xl border border-border p-4">
          <h3 className="text-sm font-semibold">{isAr ? "دورة الحياة" : "Lifecycle"}</h3>
          {cat.status === "ACTIVE" ? (
            <div className="flex flex-wrap gap-2">
              <LifecycleButton icon={Archive} label={isAr ? "أرشفة" : "Archive"} onClick={() => setConfirm("archive")} />
              <LifecycleButton icon={null} label={isAr ? "🤍 توفّى" : "🤍 Passed away"} onClick={() => setConfirm("deceased")} />
              <LifecycleButton icon={Trash2} label={isAr ? "إزالة" : "Remove"} destructive onClick={() => setConfirm("remove")} />
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={restore} disabled={action.isPending}>
                {action.isPending ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
                {isAr ? "استعادة" : "Restore"}
              </Button>
              <LifecycleButton icon={Trash2} label={isAr ? "إزالة نهائياً" : "Remove"} destructive onClick={() => setConfirm("remove")} />
            </div>
          )}

          {confirm && (
            <div className="rounded-xl bg-muted/60 p-3 text-sm">
              <p className="mb-2">
                {confirm === "deceased"
                  ? (isAr ? `سنحفظ سجل ${cat.name} وهويته للأبد. تأكيد؟` : `We'll keep ${cat.name}'s record and Cat ID forever. Confirm?`)
                  : confirm === "archive"
                    ? (isAr ? `أرشفة ${cat.name}؟ يبقى سجله محفوظاً.` : `Archive ${cat.name}? Their record stays saved.`)
                    : (isAr ? `إزالة ${cat.name} نهائياً؟ سيُحذف ملفه وصوره ولا يمكن التراجع.` : `Permanently remove ${cat.name}? Their file and photos are deleted — this can't be undone.`)}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant={confirm === "remove" ? "destructive" : "primary"} loading={action.isPending} onClick={() => runLifecycle(confirm)}>
                  {isAr ? "تأكيد" : "Confirm"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>{isAr ? "تراجع" : "Cancel"}</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function LifecycleButton({ icon: Icon, label, onClick, destructive }: { icon: React.ElementType | null; label: string; onClick: () => void; destructive?: boolean }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick} className={destructive ? "text-destructive hover:bg-destructive/10" : undefined}>
      {Icon && <Icon className="size-4" />} {label}
    </Button>
  );
}

function MembershipBadge({ status, isAr }: { status: string; isAr: boolean }) {
  const map: Record<string, { label: [string, string]; variant: "success" | "secondary" | "outline" }> = {
    ACTIVE: { label: ["Member", "عضوية فعّالة"], variant: "success" },
    PENDING: { label: ["Pending", "قيد التفعيل"], variant: "outline" },
    INACTIVE: { label: ["Inactive", "غير فعّالة"], variant: "secondary" },
  };
  const it = map[status] ?? map.INACTIVE!;
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
  });
  const save = useMutation({
    mutationFn: (b: Record<string, unknown>) => authedFetch(`/cats/${cat.id}`, { method: "PATCH", body: JSON.stringify(b) }),
    onSuccess: onSaved,
  });
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); save.mutate({ name: f.name.trim(), weightKg: f.weightKg ? Number(f.weightKg) : undefined, activityLevel: f.activityLevel, isIndoor: f.isIndoor === "true", gender: f.gender }); }}
      className="grid gap-3 rounded-2xl bg-muted/40 p-4 sm:grid-cols-2"
    >
      <Field label={isAr ? "الاسم" : "Name"} required value={f.name} onChange={(v) => setF({ ...f, name: v })} />
      <Field label={isAr ? "الوزن (كجم)" : "Weight (kg)"} type="number" value={f.weightKg} onChange={(v) => setF({ ...f, weightKg: v })} />
      <SelectField label={isAr ? "الجنس" : "Sex"} value={f.gender} onChange={(v) => setF({ ...f, gender: v })}
        options={[{ value: "MALE", label: isAr ? "ذكر" : "Male" }, { value: "FEMALE", label: isAr ? "أنثى" : "Female" }, { value: "UNKNOWN", label: isAr ? "غير محدد" : "Unknown" }]} />
      <SelectField label={isAr ? "النشاط" : "Activity"} value={f.activityLevel} onChange={(v) => setF({ ...f, activityLevel: v })}
        options={[{ value: "LOW", label: isAr ? "منخفض" : "Low" }, { value: "MODERATE", label: isAr ? "متوسط" : "Moderate" }, { value: "HIGH", label: isAr ? "عالٍ" : "High" }]} />
      <SelectField label={isAr ? "البيئة" : "Environment"} value={f.isIndoor} onChange={(v) => setF({ ...f, isIndoor: v })}
        options={[{ value: "true", label: isAr ? "داخلي" : "Indoor" }, { value: "false", label: isAr ? "خارجي" : "Outdoor" }]} />
      <div className="sm:col-span-2">
        <Button type="submit" size="sm" loading={save.isPending} disabled={!f.name.trim()}>{isAr ? "حفظ التعديلات" : "Save changes"}</Button>
        {save.error && <p role="alert" className="mt-1 text-xs text-destructive">{(save.error as Error).message}</p>}
      </div>
    </form>
  );
}
