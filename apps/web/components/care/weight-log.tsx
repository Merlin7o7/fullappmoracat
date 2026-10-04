"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2, Plus, BadgeCheck } from "lucide-react";
import { Button, EmptyState, Skeleton, useToast } from "@moraqat/ui";
import { formatDate, formatWeight } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import { Field } from "@/components/field";
import { WeightChart } from "@/components/cat-profile/weight-chart";
import { ConfirmDialog } from "@/components/confirm-dialog";

interface WeightRow {
  id: string;
  weightKg: number;
  bcs: number | null;
  measuredAt: string;
  source: string;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * The weight log: the trend, the entries, and the owner's hand on their own
 * numbers — add, correct, remove. Clinic weights are part of the medical
 * record: shown with a "clinic" mark and never editable here.
 */
export function WeightLog({ catId, isAr }: { catId: string; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const loc = isAr ? "ar" : "en";
  const key = ["cat-weights", catId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => authedFetch<WeightRow[]>(`/cats/${catId}/weights`),
    enabled: !!user,
  });
  const [form, setForm] = React.useState<{ id: string | null; weightKg: string; measuredAt: string } | null>(null);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    void qc.invalidateQueries({ queryKey: ["cat-health", catId] });
    void qc.invalidateQueries({ queryKey: ["cat-care", catId] });
    void qc.invalidateQueries({ queryKey: ["care-agenda"] });
    void qc.invalidateQueries({ queryKey: ["cats"] });
  };
  const fail = (e: unknown) => {
    const f = friendlyError(e, isAr);
    toast({ title: f.title, description: f.message, variant: "error" });
  };
  const save = useMutation({
    mutationFn: () => {
      const body = JSON.stringify({ weightKg: Number(form!.weightKg), measuredAt: form!.measuredAt });
      return form!.id
        ? authedFetch(`/cats/${catId}/weights/${form!.id}`, { method: "PATCH", body })
        : authedFetch(`/cats/${catId}/weights`, { method: "POST", body });
    },
    onSuccess: () => {
      setForm(null);
      refresh();
      toast({ title: isAr ? "حُفظ الوزن" : "Weight saved", variant: "success" });
    },
    onError: fail,
  });
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => authedFetch(`/cats/${catId}/weights/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setConfirmId(null);
      refresh();
    },
    onError: fail,
  });

  if (q.isLoading) return <Skeleton className="h-40 w-full rounded-md" />;
  const rows = q.data ?? [];
  const n = Number(form?.weightKg);
  const valid = form && form.weightKg !== "" && Number.isFinite(n) && n >= 0.1 && n <= 15 && !!form.measuredAt;

  return (
    <div className="space-y-4">
      {rows.length >= 2 ? (
        <WeightChart points={rows} isAr={isAr} />
      ) : rows.length === 0 && !form ? (
        <EmptyState
          title={isAr ? "لا قياسات بعد" : "No weigh-ins yet"}
          body={isAr ? "وزن واحد كل شهر يكفي ليبان أي تغيّر مبكراً." : "One weigh-in a month is enough to catch a change early."}
        />
      ) : null}

      {form ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) save.mutate();
          }}
          className="grid gap-3 rounded-md border border-border bg-muted/30 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <Field
            label={isAr ? "الوزن (كغ)" : "Weight (kg)"}
            inputMode="decimal"
            required
            value={form.weightKg}
            onChange={(v) => setForm({ ...form, weightKg: v })}
          />
          <Field label={isAr ? "التاريخ" : "Date"} type="date" required value={form.measuredAt} onChange={(v) => setForm({ ...form, measuredAt: v })} />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={save.isPending} disabled={!valid}>
              {isAr ? "احفظ" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="tertiary" onClick={() => setForm(null)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
          </div>
          {form.weightKg !== "" && !valid && (
            <p role="alert" className="text-sm text-destructive sm:col-span-3">
              {isAr ? "اكتب وزناً بين 0.1 و15 كغ." : "Enter a weight between 0.1 and 15 kg."}
            </p>
          )}
        </form>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setForm({ id: null, weightKg: "", measuredAt: today() })}>
          <Plus className="size-4" aria-hidden /> {isAr ? "سجّل وزناً" : "Log a weight"}
        </Button>
      )}

      {rows.length > 0 && (
        <ul className="divide-y divide-border rounded-md border border-border">
          {[...rows].reverse().slice(0, 8).map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0">
                <span className="font-medium">{formatWeight(r.weightKg, loc)}</span>
                <span className="text-sm text-muted-foreground"> · {formatDate(r.measuredAt, loc, "medium")}</span>
              </span>
              {r.source === "owner" ? (
                <span className="flex shrink-0 items-center gap-1">
                  <Button
                    size="icon"
                    variant="tertiary"
                    aria-label={isAr ? "تعديل" : "Edit"}
                    onClick={() => setForm({ id: r.id, weightKg: String(r.weightKg), measuredAt: r.measuredAt.slice(0, 10) })}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    size="icon"
                    variant="tertiary"
                    className="text-destructive"
                    aria-label={isAr ? "حذف" : "Delete"}
                    onClick={() => setConfirmId(r.id)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </span>
              ) : (
                <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                  <BadgeCheck className="size-3.5 text-primary" aria-hidden /> {isAr ? "من العيادة" : "From the clinic"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && remove.mutate(confirmId)}
        busy={remove.isPending}
        isAr={isAr}
        title={isAr ? "تحذف هذا القياس؟" : "Remove this weigh-in?"}
        description={isAr ? "يختفي من السجل ومن منحنى الوزن." : "It leaves the record and the weight chart."}
        confirmLabel={isAr ? "احذف القياس" : "Remove the weigh-in"}
      />
    </div>
  );
}
