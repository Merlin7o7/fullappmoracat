"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { Field, SelectField } from "@/components/field";

/** The owner's own reminders — deworming, flea treatment, a dental check. */
export function AddCareTask({ catId, isAr, invalidate }: { catId: string; isAr: boolean; invalidate: string[][] }) {
  const { authedFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [f, setF] = React.useState({ title: "", dueAt: "", kind: "DEWORM" });
  const create = useMutation({
    mutationFn: () => authedFetch(`/cats/${catId}/care`, { method: "POST", body: JSON.stringify(f) }),
    onSuccess: () => {
      invalidate.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      setOpen(false);
      setF({ title: "", dueAt: "", kind: "DEWORM" });
      toast({ title: isAr ? "أُضيف التذكير" : "Reminder added", variant: "success" });
    },
    onError: (e: unknown) => {
      const x = friendlyError(e, isAr);
      toast({ title: x.title, description: x.message, variant: "error" });
    },
  });

  if (!open) {
    return (
      <Button variant="tertiary" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" aria-hidden /> {isAr ? "أضف تذكيراً" : "Add a reminder"}
      </Button>
    );
  }
  const kinds = [
    { value: "DEWORM", label: isAr ? "ديدان" : "Deworming" },
    { value: "FLEA", label: isAr ? "براغيث وقراد" : "Flea & tick" },
    { value: "DENTAL", label: isAr ? "أسنان" : "Dental" },
    { value: "CHECKUP", label: isAr ? "زيارة عيادة" : "Clinic visit" },
    { value: "CUSTOM", label: isAr ? "أخرى" : "Other" },
  ];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3"
    >
      <SelectField label={isAr ? "النوع" : "Kind"} value={f.kind} onChange={(v) => setF({ ...f, kind: v, title: f.title || kinds.find((k) => k.value === v)?.label || "" })} options={kinds} />
      <Field label={isAr ? "الوصف" : "What"} required value={f.title} onChange={(v) => setF({ ...f, title: v })} />
      <Field label={isAr ? "الموعد" : "When"} type="date" required value={f.dueAt} onChange={(v) => setF({ ...f, dueAt: v })} />
      <div className="flex gap-2 sm:col-span-3">
        <Button type="submit" size="sm" loading={create.isPending} disabled={!f.title.trim() || !f.dueAt}>
          {isAr ? "احفظ" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="tertiary" onClick={() => setOpen(false)}>
          {isAr ? "إلغاء" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}
