"use client";

// ════════════════════════════════════════════════════════════════════════
//  RecordsPanel — the standing clinical picture (MRC-VET-001 §06, §10).
//
//  The timeline answers "what happened, in order". This panel answers the
//  question a vet actually asks in the room: "what is TRUE about this cat
//  right now?" — what does she carry, what is she due, what is she on.
//
//  Modules, in the order a consult needs them:
//    1. Vaccinations — the only module with a summary, because "is she
//       covered?" is a yes/no a vet must get in one glance. Overdue leads.
//    2. Standing conditions & medications — read from the tier-0 alert set,
//       which is the record's own answer to "what is chronic here".
//    3. Prescriptions — with the dispense/complete lifecycle in place.
//    4. Procedures & notes — surgeries, dentals and clinical notes from the
//       timeline, each carrying the clinic that authored it.
//
//  Vaccination status is DERIVED and never invented: a vaccine with no dose
//  on record is shown as "no record", never as "not vaccinated" — we cannot
//  know what another clinic did off-platform (R006).
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Pill,
  ShieldAlert,
  Syringe,
  TriangleAlert,
} from "lucide-react";
import { Badge, Button, Card, Input, Skeleton, cn, useToast } from "@moraqat/ui";
import {
  PRESCRIPTION_ACTION_LABELS,
  latestDosePerVaccine,
  ownerDeliveryNotice,
  type PrescriptionAction,
} from "@moraqat/core";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import { QueryError } from "@/components/query-error";
import { IlloSprig } from "@/components/illustrations";
import { entryKindLabel } from "@/components/vet/entry-composer";
import {
  useVetActor,
  useVetApi,
  vetFriendlyError,
  type EntryType,
  type MedicalAlert,
  type Prescription,
  type PrescriptionStatus,
  type TimelineEntry,
  type Vaccination,
} from "@/lib/vet-api";

const PROCEDURE_KINDS: EntryType[] = ["EXAM", "LAB", "IMAGING", "NOTE"];
const DAY = 86_400_000;

export default function RecordsPanel({
  catId,
  vaccinations = [],
  alerts = [],
  className,
}: {
  catId: string;
  vaccinations?: Vaccination[];
  alerts?: MedicalAlert[];
  className?: string;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();
  const canRead = actor.can("record.read");

  const timeline = useQuery({
    queryKey: ["vet-timeline", catId],
    queryFn: () => api.getPatientTimeline(catId),
    enabled: canRead,
  });

  const prescriptions = useQuery({
    queryKey: ["vet-prescriptions", catId],
    queryFn: () => api.getPatientPrescriptions(catId),
    enabled: canRead,
  });

  if (!canRead) {
    return (
      <Card className={cn("p-6", className)}>
        <h3 className="text-sm font-semibold text-foreground">
          {isAr ? "السجل الطبي خارج نطاق دورك" : "Clinical records aren't part of your role"}
        </h3>
        <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "التنبيهات الحرجة تظهر لك دائماً في أعلى الصفحة. أما التفاصيل الطبية فمقصورة على الطاقم السريري."
            : "The critical alerts are always shown to you at the top of the page. The medical detail is reserved for clinical staff."}
        </p>
      </Card>
    );
  }

  const entries = (timeline.data?.items ?? []).filter((e) => e.status !== "RETRACTED");
  const procedures = entries.filter((e) => PROCEDURE_KINDS.includes(e.kind));

  return (
    <div className={cn("space-y-4", className)}>
      <VaccinationsModule vaccinations={vaccinations} />
      <StandingModule alerts={alerts} />
      <PrescriptionsModule
        catId={catId}
        data={prescriptions.data?.items}
        isLoading={prescriptions.isLoading}
        isError={prescriptions.isError}
        onRetry={() => void prescriptions.refetch()}
      />
      <ProceduresModule
        entries={procedures}
        isLoading={timeline.isLoading}
        isError={timeline.isError}
        onRetry={() => void timeline.refetch()}
      />
    </div>
  );
}

// ── vaccinations ─────────────────────────────────────────────────────────

type VaxState = "OVERDUE" | "DUE_SOON" | "VALID" | "NO_RECORD";

function vaxState(v: Vaccination, superseded: boolean): { state: VaxState; overdueDays?: number } {
  const now = Date.now();
  if (!v.givenAt) return { state: "NO_RECORD" };
  // A dose replaced by a later dose of the same vaccine is history: its old
  // dueAt has passed by design and must never read as overdue.
  if (superseded) return { state: "VALID" };
  if (!v.dueAt) return { state: "VALID" };
  const due = new Date(v.dueAt).getTime();
  if (!Number.isFinite(due)) return { state: "VALID" };
  if (due < now) return { state: "OVERDUE", overdueDays: Math.floor((now - due) / DAY) };
  if (due - now < 30 * DAY) return { state: "DUE_SOON" };
  return { state: "VALID" };
}

function VaccinationsModule({ vaccinations }: { vaccinations: Vaccination[] }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  const rows = React.useMemo(() => {
    const rank: Record<VaxState, number> = { OVERDUE: 0, DUE_SOON: 1, NO_RECORD: 2, VALID: 3 };
    // Server-computed `isLatest` wins; older payloads fall back to the shared
    // core reduction (latest dose per coded vaccine).
    const latest = new Set(
      latestDosePerVaccine(
        vaccinations.map((v) => ({ ...v, name: v.nameEn, administeredAt: v.givenAt })),
      ).map((d) => d.id),
    );
    return vaccinations
      .map((v) => ({ v, ...vaxState(v, v.isLatest === false || (v.isLatest === undefined && !latest.has(v.id))) }))
      .sort((a, b) => rank[a.state] - rank[b.state]);
  }, [vaccinations]);

  const counts = rows.reduce<Record<VaxState, number>>(
    (acc, r) => ({ ...acc, [r.state]: acc[r.state] + 1 }),
    { OVERDUE: 0, DUE_SOON: 0, VALID: 0, NO_RECORD: 0 }
  );

  const chips: { state: VaxState; ar: string; en: string; tone: string }[] = [
    { state: "OVERDUE", ar: "متأخر", en: "Overdue", tone: "bg-destructive text-destructive-foreground" },
    {
      state: "DUE_SOON",
      ar: "يستحق قريباً",
      en: "Due soon",
      tone: "bg-warning/20 text-[hsl(38_92%_26%)] dark:text-warning-ink",
    },
    { state: "VALID", ar: "سارٍ", en: "Up to date", tone: "bg-success/15 text-success" },
    { state: "NO_RECORD", ar: "لا يوجد سجل", en: "No record", tone: "bg-muted text-muted-foreground" },
  ];

  return (
    <Section
      icon={Syringe}
      title={isAr ? "التطعيمات" : "Vaccinations"}
      subtitle={
        isAr
          ? "محسوبة من الجرعات المسجّلة ومواعيدها القادمة."
          : "Derived from recorded doses and their next-due dates."
      }
    >
      {rows.length === 0 ? (
        <Empty
          isAr={isAr}
          ar="لا سجل تطعيم بعد. أول جرعة تُسجَّل هنا تُجدول تذكير المالك تلقائياً."
          en="No vaccination record yet. The first dose recorded here schedules the owner's reminder automatically."
        />
      ) : (
        <>
          <ul className="mb-3 flex flex-wrap gap-2">
            {chips
              .filter((c) => counts[c.state] > 0)
              .map((c) => (
                <li key={c.state} className={cn("rounded-full px-3 py-1 text-xs font-semibold", c.tone)}>
                  <span className="tabular-nums">{counts[c.state]}</span> {isAr ? c.ar : c.en}
                </li>
              ))}
          </ul>

          <ul className="divide-y divide-border rounded-xl border border-border">
            {rows.map(({ v, state, overdueDays }) => (
              <li key={v.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <VaxIcon state={state} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{isAr ? v.nameAr : v.nameEn}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.givenAt
                      ? isAr
                        ? `آخر جرعة ${formatDate(v.givenAt, locale)}`
                        : `last dose ${formatDate(v.givenAt, locale)}`
                      : isAr
                        ? "لم تُسجَّل جرعة"
                        : "no dose recorded"}
                    {v.administeredBy ? ` · ${v.administeredBy}` : ""}
                  </p>
                </div>
                <VaxStatusWord state={state} dueAt={v.dueAt} overdueDays={overdueDays} />
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

function VaxIcon({ state }: { state: VaxState }) {
  if (state === "OVERDUE") return <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden />;
  if (state === "DUE_SOON") return <CalendarClock className="size-4 shrink-0 text-warning-ink" aria-hidden />;
  if (state === "VALID") return <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />;
  return <CircleDashed className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}

function VaxStatusWord({
  state,
  dueAt,
  overdueDays,
}: {
  state: VaxState;
  dueAt: string | null;
  overdueDays?: number;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  if (state === "OVERDUE")
    return (
      <Badge variant="destructive">
        {isAr
          ? `متأخر${typeof overdueDays === "number" ? ` ${overdueDays} يوم` : ""}`
          : `overdue${typeof overdueDays === "number" ? ` ${overdueDays}d` : ""}`}
      </Badge>
    );
  if (state === "DUE_SOON")
    return (
      <Badge variant="warning">
        {dueAt
          ? isAr
            ? `يستحق ${formatDate(dueAt, locale)}`
            : `due ${formatDate(dueAt, locale)}`
          : isAr
            ? "يستحق قريباً"
            : "due soon"}
      </Badge>
    );
  if (state === "VALID")
    return (
      <Badge variant="success">
        {dueAt
          ? isAr
            ? `سارٍ حتى ${formatDate(dueAt, locale)}`
            : `valid to ${formatDate(dueAt, locale)}`
          : isAr
            ? "سارٍ"
            : "up to date"}
      </Badge>
    );
  return <Badge variant="outline">{isAr ? "لا يوجد سجل" : "no record"}</Badge>;
}

// ── standing conditions & medications ────────────────────────────────────

function StandingModule({ alerts }: { alerts: MedicalAlert[] }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const conditions = alerts.filter((a) => a.kind === "CONDITION");
  const meds = alerts.filter((a) => a.kind === "MEDICATION");

  const severityBadge: Record<MedicalAlert["severity"], "destructive" | "warning" | "info"> = {
    CRITICAL: "destructive",
    IMPORTANT: "warning",
    INFO: "info",
  };
  const severityWord: Record<MedicalAlert["severity"], { ar: string; en: string }> = {
    CRITICAL: { ar: "حرِج", en: "Critical" },
    IMPORTANT: { ar: "مهم", en: "Important" },
    INFO: { ar: "للعلم", en: "Info" },
  };

  return (
    <Section
      icon={ShieldAlert}
      title={isAr ? "حالات قائمة وأدوية" : "Standing conditions & medications"}
      subtitle={
        isAr
          ? "ما تحمله هذه القطة اليوم — وهو نفسه ما يظهر في شريط التنبيهات."
          : "What this cat carries today — the same set the alerts band shows."
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { title: isAr ? "الحالات" : "Conditions", items: conditions },
          { title: isAr ? "الأدوية" : "Medications", items: meds },
        ].map((col) => (
          <div key={col.title} className="rounded-xl border border-border p-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {col.title}
            </h4>
            {col.items.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {isAr ? "لا شيء مسجّل." : "Nothing recorded."}
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {col.items.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {isAr ? a.labelAr : a.labelEn}
                    </span>
                    <Badge variant={severityBadge[a.severity]}>
                      {isAr ? severityWord[a.severity].ar : severityWord[a.severity].en}
                    </Badge>
                    {a.notedAt && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatDate(a.notedAt, locale)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── prescriptions ────────────────────────────────────────────────────────

// The ACTIONS the API accepts from each status — mirrors RX_TRANSITIONS +
// ACTION_TARGET in vet-records.service.ts. The portal used to send `{status}`,
// which the API never accepted, so no prescription could ever be dispensed.
const ACTION_FLOW: Record<PrescriptionStatus, PrescriptionAction[]> = {
  ISSUED: ["dispense", "complete", "cancel"],
  COLLECTED: ["refill", "complete", "cancel"],
  REFILLED: ["refill", "complete", "cancel"],
  COMPLETED: [],
  CANCELLED: [],
  EXPIRED: [],
};

const STATUS_LABEL: Record<PrescriptionStatus, { ar: string; en: string }> = {
  ISSUED: { ar: "صدرت", en: "Issued" },
  COLLECTED: { ar: "استُلمت", en: "Collected" },
  REFILLED: { ar: "أُعيد صرفها", en: "Refilled" },
  COMPLETED: { ar: "اكتملت", en: "Completed" },
  CANCELLED: { ar: "أُلغيت", en: "Cancelled" },
  EXPIRED: { ar: "منتهية", en: "Expired" },
};

const STATUS_BADGE: Record<PrescriptionStatus, "success" | "info" | "outline"> = {
  ISSUED: "info",
  COLLECTED: "success",
  REFILLED: "success",
  COMPLETED: "outline",
  CANCELLED: "outline",
  EXPIRED: "outline",
};

function PrescriptionsModule({
  catId,
  data,
  isLoading,
  isError,
  onRetry,
}: {
  catId: string;
  data?: Prescription[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();
  const qc = useQueryClient();
  const canDispense = actor.can("prescription.dispense");
  // Cancelling needs a reason — the owner deserves one, and the API requires it.
  const [cancelFor, setCancelFor] = React.useState<string | null>(null);
  const [cancelReason, setCancelReason] = React.useState("");
  const [cancelError, setCancelError] = React.useState("");

  const advance = useMutation({
    mutationFn: (v: { id: string; action: PrescriptionAction; reason?: string }) =>
      api.setPrescriptionStatus(v.id, { action: v.action, reason: v.reason, notifyOwner: true }),
    onSuccess: (res, v) => {
      void qc.invalidateQueries({ queryKey: ["vet-prescriptions", catId] });
      if (v.action === "cancel") {
        setCancelFor(null);
        setCancelReason("");
      }
      const missed = res.ownerNotification && !res.ownerNotification.delivered ? ownerDeliveryNotice(res.ownerNotification) : null;
      toast({
        variant: missed ? "info" : "success",
        title: isAr ? "حُدّثت الوصفة" : "Prescription updated",
        description: missed
          ? isAr
            ? missed.ar
            : missed.en
          : res.ownerNotification?.delivered
            ? isAr
              ? "وصل المالك إشعار داخل التطبيق."
              : "The owner was notified in the app."
            : undefined,
      });
    },
    onError: (err) => {
      const f = vetFriendlyError(err, isAr);
      toast({ variant: "error", title: f.title, description: f.message });
    },
  });

  return (
    <Section
      icon={Pill}
      title={isAr ? "الوصفات" : "Prescriptions"}
      subtitle={
        isAr
          ? "دورة الوصفة كاملة، وكل تغيير مسجّل باسم من أجراه."
          : "The full prescription lifecycle — every change recorded under the name that made it."
      }
    >
      {isLoading ? (
        <div className="space-y-2" aria-hidden>
          <Skeleton className="h-16 rounded-xl" />
          <Skeleton className="h-16 rounded-xl" />
        </div>
      ) : isError ? (
        <QueryError isAr={isAr} onRetry={onRetry} />
      ) : !data || data.length === 0 ? (
        <Empty isAr={isAr} ar="لا وصفات مسجّلة." en="No prescriptions recorded." />
      ) : (
        <ul className="space-y-2">
          {data.map((rx) => {
            const next = (ACTION_FLOW[rx.status] ?? []).filter((a) => a !== "cancel" || cancelFor !== rx.id);
            const notes = isAr ? rx.notesAr : rx.notesEn;
            return (
              <li key={rx.id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {isAr ? rx.drugNameAr : rx.drugNameEn}
                  </p>
                  <Badge variant={STATUS_BADGE[rx.status]}>
                    {isAr ? STATUS_LABEL[rx.status].ar : STATUS_LABEL[rx.status].en}
                  </Badge>
                  <time dateTime={rx.startedAt} className="ms-auto text-xs tabular-nums text-muted-foreground">
                    {formatDate(rx.startedAt, locale)}
                  </time>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[
                    rx.dose,
                    isAr ? rx.frequencyAr : rx.frequencyEn,
                    typeof rx.durationDays === "number"
                      ? isAr
                        ? `${rx.durationDays} يوم`
                        : `${rx.durationDays} days`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isAr ? "وصفها" : "Prescribed by"} {rx.prescribedByName}
                  {rx.dispensedByName
                    ? ` · ${isAr ? "صرفها" : "dispensed by"} ${rx.dispensedByName}`
                    : ""}
                  {rx.dispensedAt ? ` · ${formatDate(rx.dispensedAt, locale)}` : ""}
                </p>
                {notes && <p className="mt-1.5 text-sm leading-relaxed text-foreground">{notes}</p>}
                {canDispense && next.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {next.map((a) => (
                      <Button
                        key={a}
                        size="sm"
                        variant={a === "cancel" ? "tertiary" : a === "dispense" ? "primary" : "secondary"}
                        loading={
                          advance.isPending &&
                          advance.variables?.id === rx.id &&
                          advance.variables?.action === a
                        }
                        onClick={() => {
                          if (a === "cancel") {
                            setCancelFor(rx.id);
                            setCancelReason("");
                            setCancelError("");
                            return;
                          }
                          advance.mutate({ id: rx.id, action: a });
                        }}
                      >
                        {isAr ? PRESCRIPTION_ACTION_LABELS[a].ar : PRESCRIPTION_ACTION_LABELS[a].en}
                      </Button>
                    ))}
                  </div>
                )}
                {canDispense && cancelFor === rx.id && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
                    <label htmlFor={`rx-cancel-${rx.id}`} className="block text-xs font-medium text-foreground">
                      {isAr ? "سبب الإلغاء (يصل للمالك)" : "Reason for cancelling (the owner sees it)"}
                      <span className="ms-1 text-destructive" aria-hidden>
                        *
                      </span>
                    </label>
                    <Input
                      id={`rx-cancel-${rx.id}`}
                      value={cancelReason}
                      maxLength={500}
                      onChange={(e) => {
                        setCancelReason(e.target.value);
                        setCancelError("");
                      }}
                      invalid={!!cancelError}
                      className="mt-1"
                    />
                    {cancelError && (
                      <p role="alert" className="mt-1 text-xs text-destructive">
                        {cancelError}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        loading={advance.isPending && advance.variables?.action === "cancel"}
                        onClick={() => {
                          if (cancelReason.trim().length < 3) {
                            setCancelError(isAr ? "اكتب سبباً واضحاً." : "Write a clear reason.");
                            return;
                          }
                          advance.mutate({ id: rx.id, action: "cancel", reason: cancelReason.trim() });
                        }}
                      >
                        {isAr ? "ألغِ الوصفة" : "Cancel prescription"}
                      </Button>
                      <Button size="sm" variant="tertiary" onClick={() => setCancelFor(null)}>
                        {isAr ? "تراجع" : "Never mind"}
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

// ── procedures & clinical notes ──────────────────────────────────────────

function ProceduresModule({
  entries,
  isLoading,
  isError,
  onRetry,
}: {
  entries: TimelineEntry[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";

  return (
    <Section
      icon={ClipboardList}
      title={isAr ? "الفحوصات والإجراءات" : "Examinations & procedures"}
      subtitle={
        isAr
          ? "كل إدخال يحمل اسم من كتبه والعيادة التي كتبته."
          : "Every entry carries who wrote it and the clinic that wrote it."
      }
    >
      {isLoading ? (
        <div className="space-y-2" aria-hidden>
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : isError ? (
        <QueryError isAr={isAr} onRetry={onRetry} />
      ) : entries.length === 0 ? (
        <Empty isAr={isAr} ar="لا فحوصات أو إجراءات مسجّلة." en="No examinations or procedures recorded." />
      ) : (
        <ul className="space-y-2">
          {entries.slice(0, 12).map((e) => (
            <li key={e.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{entryKindLabel(e.kind, isAr)}</Badge>
                {e.status === "DRAFT" && (
                  <Badge variant="warning">{isAr ? "مسودة" : "Draft"}</Badge>
                )}
                <time dateTime={e.at} className="ms-auto text-xs tabular-nums text-muted-foreground">
                  {formatDate(e.at, locale)}
                </time>
              </div>
              <p className="mt-2 text-sm font-medium text-foreground">
                {isAr ? e.titleAr : e.titleEn}
              </p>
              {(isAr ? e.bodyAr : e.bodyEn) && (
                <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {isAr ? e.bodyAr : e.bodyEn}
                </p>
              )}
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{e.authorName}</span>
                {(e.orgNameEn || e.orgNameAr) && (
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="size-3" aria-hidden />
                    {(isAr ? e.orgNameAr : e.orgNameEn) ?? ""}
                  </span>
                )}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

// ── shared bits ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-4" />
        </span>
        <div>
          <h3 className="font-display text-base font-semibold tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}

function Empty({ isAr, ar, en }: { isAr: boolean; ar: string; en: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-5">
      <IlloSprig tone="leaf" className="size-7 shrink-0 opacity-60" aria-hidden />
      <p className="text-sm leading-relaxed text-muted-foreground">{isAr ? ar : en}</p>
    </div>
  );
}
