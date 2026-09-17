"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PhoneCall, Pencil } from "lucide-react";
import { Button, Card, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { Field } from "@/components/field";
import type { HealthRecord } from "@/components/cat-health-record";

/**
 * The person a clinic can reach when the owner can't be reached — readable by
 * any treating clinic (T0), because at 3am a second number is the whole point.
 */
export function EmergencyContactForm({ record, isAr }: { record: HealthRecord; isAr: boolean }) {
  const { authedFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const current = record.cat.emergencyContact;
  const [editing, setEditing] = React.useState(false);
  const [f, setF] = React.useState({ name: current?.name ?? "", phone: current?.phone ?? "", relation: current?.relation ?? "" });
  React.useEffect(() => { if (!editing) setF({ name: current?.name ?? "", phone: current?.phone ?? "", relation: current?.relation ?? "" }); }, [current, editing]);

  const save = useMutation({
    mutationFn: () =>
      authedFetch(`/cats/${record.cat.id}/emergency-contact`, {
        method: "PUT",
        body: JSON.stringify({ name: f.name, phone: f.phone.replace(/[\s-]/g, ""), relation: f.relation || null }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["cat-health", record.cat.id] });
      setEditing(false);
      toast({ title: isAr ? "تم حفظ جهة الاتصال" : "Emergency contact saved", variant: "success" });
    },
    onError: (err) => { const e = friendlyError(err, isAr); toast({ title: e.title, description: e.message, variant: "error" }); },
  });

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><PhoneCall className="size-4 text-primary" /> {isAr ? "جهة اتصال للطوارئ" : "Emergency contact"}</h2>
          <p className="text-xs text-muted-foreground">{isAr ? "من تتصل به العيادة إذا لم تصل إليك." : "Who the clinic calls if they can't reach you."}</p>
        </div>
        {!editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}><Pencil className="size-4" /> {current ? (isAr ? "تعديل" : "Edit") : (isAr ? "إضافة" : "Add")}</Button>
        )}
      </div>
      {!editing ? (
        current ? (
          <p className="text-sm">{current.name}{current.relation ? ` (${current.relation})` : ""} · <span dir="ltr" className="font-mono">{current.phone}</span></p>
        ) : (
          <p className="text-sm text-muted-foreground">{isAr ? "لا توجد جهة اتصال بعد." : "No emergency contact yet."}</p>
        )
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid gap-3 sm:grid-cols-3">
          <Field label={isAr ? "الاسم" : "Name"} required value={f.name} onChange={(v) => setF({ ...f, name: v })} />
          <Field label={isAr ? "الجوال" : "Mobile"} required type="tel" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} placeholder="+9665…" />
          <Field label={isAr ? "الصلة" : "Relation"} value={f.relation} onChange={(v) => setF({ ...f, relation: v })} placeholder={isAr ? "أخت، صديق…" : "Sister, friend…"} />
          <div className="flex gap-2 sm:col-span-3">
            <Button type="submit" size="sm" loading={save.isPending} disabled={!f.name || f.phone.replace(/\D/g, "").length < 8}>{isAr ? "حفظ جهة الاتصال" : "Save contact"}</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>{isAr ? "إلغاء" : "Cancel"}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}
