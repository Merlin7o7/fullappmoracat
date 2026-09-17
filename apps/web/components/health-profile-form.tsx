"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button, Card, useToast } from "@moraqat/ui";
import { ACQUISITION_SOURCE_LABELS } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { Field, SelectField } from "@/components/field";
import type { HealthRecord } from "@/components/cat-health-record";

/**
 * The owner-maintained half of the record (MRC-PROD-001 T3): the facts any
 * treating clinic can read at T0 (chip, allergies, conditions, medication),
 * what the cat eats, and the home clinic reminders route back to. This is the
 * ONE place lists are edited, so sending an empty list here is a decision.
 */
export function HealthProfileForm({ record, isAr }: { record: HealthRecord; isAr: boolean }) {
  const { authedFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const c = record.cat;
  const [editing, setEditing] = React.useState(false);
  const [f, setF] = React.useState(() => toDraft(c));
  React.useEffect(() => { if (!editing) setF(toDraft(c)); }, [c, editing]);

  const clinics = useQuery({
    queryKey: ["vet-directory-picker", "branches"],
    queryFn: () => authedFetch<{ items: { id: string; nameAr: string; nameEn: string; org: { nameAr: string; nameEn: string } }[] }>("/vet/directory?limit=100"),
    enabled: editing,
  });

  const save = useMutation({
    mutationFn: () =>
      authedFetch(`/cats/${c.id}/health-profile`, {
        method: "PATCH",
        body: JSON.stringify({
          microchipNo: f.microchipNo,
          allergies: splitList(f.allergies),
          healthConditions: splitList(f.healthConditions),
          currentMedications: f.currentMedications,
          currentFood: f.currentFood,
          emergencyNotes: f.emergencyNotes,
          acquisitionSource: f.acquisitionSource || null,
          district: f.district,
          homeBranchId: f.homeBranchId || null,
        }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cat-health", c.id] });
      void qc.invalidateQueries({ queryKey: ["cats"] });
      setEditing(false);
      toast({ title: isAr ? `تم تحديث ملف ${c.name}` : `${c.name}'s profile updated`, variant: "success" });
    },
    onError: (err) => { const e = friendlyError(err, isAr); toast({ title: e.title, description: e.message, variant: "error" }); },
  });

  const sources = Object.entries(ACQUISITION_SOURCE_LABELS).map(([value, l]) => ({ value, label: isAr ? l.ar : l.en }));

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold">{isAr ? "ملف السلامة" : "Safety profile"}</h2>
          <p className="text-xs text-muted-foreground">
            {isAr ? "ما تحتاج أي عيادة معرفته فوراً — الحساسيات، الحالات، الأدوية." : "What any treating clinic needs to know immediately — allergies, conditions, medication."}
          </p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="size-4" /> {isAr ? "تعديل" : "Edit"}</Button>
        )}
      </div>

      {!editing ? (
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Item label={isAr ? "الشريحة" : "Microchip"} value={c.microchipNo} mono />
          <Item label={isAr ? "الحساسيات" : "Allergies"} value={c.allergies.join("، ")} />
          <Item label={isAr ? "الحالات الصحية" : "Conditions"} value={c.healthConditions.join("، ")} />
          <Item label={isAr ? "الأدوية الحالية" : "Current medication"} value={c.currentMedications} />
          <Item label={isAr ? "الطعام الحالي" : "Current food"} value={c.currentFood} />
          <Item label={isAr ? "العيادة المعتادة" : "Home clinic"} value={c.homeBranch ? (isAr ? c.homeBranch.clinic.ar : c.homeBranch.clinic.en) : null} />
          <Item label={isAr ? "كيف وصل إليك" : "How they came to you"} value={c.acquisitionSource ? (isAr ? ACQUISITION_SOURCE_LABELS[c.acquisitionSource]?.ar : ACQUISITION_SOURCE_LABELS[c.acquisitionSource]?.en) : null} />
          <Item label={isAr ? "الحي" : "District"} value={c.district} />
          <div className="sm:col-span-2"><Item label={isAr ? "ملاحظات طارئة" : "Emergency notes"} value={c.emergencyNotes} /></div>
        </dl>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-3 sm:grid-cols-2">
          <Field label={isAr ? "رقم الشريحة" : "Microchip number"} value={f.microchipNo} onChange={(v) => setF({ ...f, microchipNo: v })} placeholder="968…" />
          <Field label={isAr ? "الطعام الحالي" : "Current food"} value={f.currentFood} onChange={(v) => setF({ ...f, currentFood: v })} placeholder={isAr ? "الماركة والنوع" : "Brand and product"} />
          <Field label={isAr ? "الحساسيات (افصل بفاصلة)" : "Allergies (comma-separated)"} value={f.allergies} onChange={(v) => setF({ ...f, allergies: v })} />
          <Field label={isAr ? "الحالات الصحية (افصل بفاصلة)" : "Conditions (comma-separated)"} value={f.healthConditions} onChange={(v) => setF({ ...f, healthConditions: v })} />
          <Field label={isAr ? "الأدوية الحالية" : "Current medication"} value={f.currentMedications} onChange={(v) => setF({ ...f, currentMedications: v })} />
          <SelectField
            label={isAr ? "العيادة المعتادة" : "Home clinic"}
            value={f.homeBranchId}
            onChange={(v) => setF({ ...f, homeBranchId: v })}
            options={[{ value: "", label: isAr ? "— لا شيء بعد —" : "— none yet —" }, ...(clinics.data?.items ?? []).map((b) => ({ value: b.id, label: isAr ? `${b.org.nameAr} — ${b.nameAr}` : `${b.org.nameEn} — ${b.nameEn}` }))]}
          />
          <SelectField label={isAr ? "كيف وصل إليك" : "How they came to you"} value={f.acquisitionSource} onChange={(v) => setF({ ...f, acquisitionSource: v })} options={[{ value: "", label: "—" }, ...sources]} />
          <Field label={isAr ? "الحي" : "District"} value={f.district} onChange={(v) => setF({ ...f, district: v })} />
          <div className="sm:col-span-2">
            <Field label={isAr ? "ملاحظات طارئة" : "Emergency notes"} value={f.emergencyNotes} onChange={(v) => setF({ ...f, emergencyNotes: v })} placeholder={isAr ? "ما يجب أن يعرفه طبيب لا يعرف قطك" : "What a vet who has never met your cat should know"} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="sm" loading={save.isPending}>{isAr ? "حفظ الملف" : "Save profile"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function Item({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono" : ""} dir={mono ? "ltr" : undefined}>{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

function toDraft(c: HealthRecord["cat"]) {
  return {
    microchipNo: c.microchipNo ?? "",
    allergies: c.allergies.join(", "),
    healthConditions: c.healthConditions.join(", "),
    currentMedications: c.currentMedications ?? "",
    currentFood: c.currentFood ?? "",
    emergencyNotes: c.emergencyNotes ?? "",
    acquisitionSource: c.acquisitionSource ?? "",
    district: c.district ?? "",
    homeBranchId: c.homeBranch?.id ?? "",
  };
}

function splitList(s: string): string[] {
  return [...new Set(s.split(/[,،]/).map((x) => x.trim()).filter(Boolean))];
}
