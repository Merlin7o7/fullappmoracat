"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Syringe, Stethoscope, Scale, Bug, Sparkles, CircleDot, Check, Undo2, Info } from "lucide-react";
import { Button, StatusTag, useToast, type StatusTone } from "@moraqat/ui";
import { CARE_STATE_LABELS, formatDate, formatRelative, type CareState } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";

export interface CareTaskView {
  id: string;
  catId: string;
  kind: string;
  title: { ar: string; en: string };
  dueAt: string;
  state: CareState;
  source: string;
  proposed: boolean;
  completedAt: string | null;
  cat?: { id: string; name: string; photoUrl: string | null } | null;
}

const ICON: Record<string, React.ElementType> = {
  VACCINE: Syringe,
  CHECKUP: Stethoscope,
  WEIGH_IN: Scale,
  DEWORM: Bug,
  FLEA: Bug,
  DENTAL: Sparkles,
  CUSTOM: CircleDot,
};

const TONE: Record<CareState, StatusTone> = {
  overdue: "critical",
  due: "attention",
  upcoming: "neutral",
  done: "positive",
  skipped: "neutral",
};

/**
 * One care list for the profile and the «العناية» agenda. Each row says what,
 * for whom, when, and its state in words (R093); the one action is the
 * honest next step — record the dose, log the weight, or mark it done.
 */
export function CareList({
  tasks,
  isAr,
  showCat,
  invalidate,
}: {
  tasks: CareTaskView[];
  isAr: boolean;
  /** On the agenda (several cats) each row names its cat. */
  showCat?: boolean;
  invalidate: string[][];
}) {
  const { authedFetch } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const loc = isAr ? "ar" : "en";

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "DONE" | "SKIPPED" | "OPEN" }) =>
      authedFetch(`/care/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: () => invalidate.forEach((k) => void qc.invalidateQueries({ queryKey: k })),
    onError: (e: unknown) => {
      const f = friendlyError(e, isAr);
      toast({ title: f.title, description: f.message, variant: "error" });
    },
  });

  return (
    <ul className="divide-y divide-border">
      {tasks.map((t) => {
        const Icon = ICON[t.kind] ?? CircleDot;
        const title = isAr ? t.title.ar : t.title.en;
        const closed = t.state === "done" || t.state === "skipped";
        const catName = t.cat?.name;
        // The honest next step for each kind of task.
        const next =
          t.kind === "VACCINE" && !closed ? (
            <Link
              href={`/portal/cats/${t.catId}/health`}
              className="inline-flex h-10 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
            >
              {isAr ? "سجّل الجرعة" : "Record dose"}
            </Link>
          ) : t.kind === "WEIGH_IN" && !closed ? (
            <Link
              href={`/portal/cats/${t.catId}#weight`}
              className="inline-flex h-10 items-center rounded-md border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
            >
              {isAr ? "سجّل الوزن" : "Log weight"}
            </Link>
          ) : !closed ? (
            <Button size="sm" variant="secondary" loading={setStatus.isPending && setStatus.variables?.id === t.id} onClick={() => setStatus.mutate({ id: t.id, status: "DONE" })}>
              <Check className="size-4" aria-hidden /> {isAr ? "تم" : "Done"}
            </Button>
          ) : (
            <Button size="sm" variant="tertiary" onClick={() => setStatus.mutate({ id: t.id, status: "OPEN" })}>
              <Undo2 className="size-4" aria-hidden /> {isAr ? "تراجع" : "Undo"}
            </Button>
          );

        return (
          <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className={closed ? "truncate font-medium text-muted-foreground line-through decoration-1" : "truncate font-medium"}>
                {title}
                {showCat && catName ? <span className="font-normal text-muted-foreground"> · {catName}</span> : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatDate(t.dueAt, loc, "medium")}
                {t.state === "overdue" || t.state === "upcoming" ? ` · ${formatRelative(t.dueAt, loc)}` : ""}
              </p>
              {t.proposed && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="size-3.5" aria-hidden />
                  {isAr ? "مقترح — راجع طبيبك قبل الموعد" : "Suggested — check with your vet first"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <StatusTag tone={TONE[t.state]}>{CARE_STATE_LABELS[t.state][loc]}</StatusTag>
              {next}
              {!closed && t.kind !== "VACCINE" && t.kind !== "WEIGH_IN" && (
                <Button size="sm" variant="tertiary" onClick={() => setStatus.mutate({ id: t.id, status: "SKIPPED" })}>
                  {isAr ? "تخطّ" : "Skip"}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
