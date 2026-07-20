"use client";

// ════════════════════════════════════════════════════════════════════════
//  The visit workspace (MRC-VET-001 §09, mode B "the spine").
//
//  Target from the dossier: "vet types < 90s for a routine vax". Everything
//  here is arranged around that number.
//
//   • The alerts band rides at the top of the workspace too, not just the
//     profile. A vet who navigated straight from the queue into a chart must
//     not have to go looking for the penicillin allergy.
//   • SOAP is four boxes and a template picker. Templates are the difference
//     between 90 seconds and four minutes, so they are editable and savable
//     by the clinician — a template you cannot shape is someone else's
//     workflow imposed on yours.
//   • Everything autosaves locally as it is typed. A dropped clinic Wi-Fi at
//     the end of a consult must never eat a note (R117, R114).
//   • The owner summary is DRAFTED for the clinician, not demanded of them.
//     §09 stage 5 is the pitch line for partner acquisition — "work the
//     clinic no longer does" — so the product writes the first version from
//     the entries already recorded, and the vet edits a sentence if they
//     care to. Sending is always their explicit act, never automatic.
//   • Closing a visit is confirmable and honest about what happens next.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  BookmarkPlus,
  Cat,
  CheckCheck,
  ClipboardList,
  Loader2,
  Plus,
  Save,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, Dialog, Input, Skeleton, useToast } from "@moraqat/ui";
import { requiresCoSign } from "@moraqat/core";
import { useLocale } from "@/app/providers";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { QueryError } from "@/components/query-error";
import { AlertsBand, deriveMissingVaccinations } from "@/components/vet/alerts-band";
import { EntryComposer } from "@/components/vet/entry-composer";
import TimelinePanel from "../../patients/[catId]/timeline-panel";
import {
  useVetActor,
  useVetApi,
  vetFriendlyError,
  vetVisitStateLabel,
  type MedicalAlert,
  type TimelineEntry,
  flattenTier0Alerts,
} from "@/lib/vet-api";

// ── SOAP templates ───────────────────────────────────────────────────────

interface SoapNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface SoapTemplate {
  id: string;
  name: string;
  note: SoapNote;
  builtIn?: boolean;
}

const EMPTY_SOAP: SoapNote = { subjective: "", objective: "", assessment: "", plan: "" };

/** Shipped starting points. A clinician's own templates sit alongside these. */
function builtInTemplates(isAr: boolean): SoapTemplate[] {
  return isAr
    ? [
        {
          id: "builtin-vax",
          name: "تحصين روتيني",
          builtIn: true,
          note: {
            subjective: "قط سليم ظاهرياً، حضر للتحصين الدوري. لا شكوى من المالك.",
            objective: "نشِط ومتيقّظ. الحرارة والنبض والتنفس ضمن الطبيعي. الغدد اللمفاوية سليمة.",
            assessment: "سليم — مناسب للتحصين اليوم.",
            plan: "أُعطي اللقاح. الجرعة القادمة مجدولة. المالك أُبلغ بالأعراض المتوقعة خلال ٢٤ ساعة.",
          },
        },
        {
          id: "builtin-sick",
          name: "زيارة مرضية",
          builtIn: true,
          note: {
            subjective: "بداية الأعراض: \nالشهية: \nالماء: \nصندوق الرمل: \nالقيء/الإسهال: ",
            objective: "الحالة العامة: \nالحرارة: \nالجفاف: \nجسّ البطن: \nالفم والأسنان: ",
            assessment: "",
            plan: "الفحوصات: \nالعلاج: \nالمتابعة: ",
          },
        },
        {
          id: "builtin-dental",
          name: "مراجعة أسنان",
          builtIn: true,
          note: {
            subjective: "المالك يلاحظ رائحة الفم / صعوبة في الأكل.",
            objective: "درجة التهاب اللثة: \nالجير: \nالأسنان المتحركة: ",
            assessment: "",
            plan: "تنظيف تحت التخدير / متابعة بعد ٦ أشهر.",
          },
        },
      ]
    : [
        {
          id: "builtin-vax",
          name: "Routine vaccination",
          builtIn: true,
          note: {
            subjective: "Apparently healthy cat presented for routine vaccination. No owner concerns.",
            objective:
              "Bright, alert, responsive. Temperature, pulse and respiration within normal limits. Lymph nodes unremarkable.",
            assessment: "Healthy — suitable for vaccination today.",
            plan: "Vaccine administered. Next dose scheduled. Owner advised on expected 24-hour reactions.",
          },
        },
        {
          id: "builtin-sick",
          name: "Sick visit",
          builtIn: true,
          note: {
            subjective: "Onset: \nAppetite: \nWater intake: \nLitter box: \nVomiting/diarrhoea: ",
            objective:
              "General condition: \nTemperature: \nHydration: \nAbdominal palpation: \nOral exam: ",
            assessment: "",
            plan: "Diagnostics: \nTreatment: \nRecheck: ",
          },
        },
        {
          id: "builtin-dental",
          name: "Dental recheck",
          builtIn: true,
          note: {
            subjective: "Owner reports halitosis / difficulty eating.",
            objective: "Gingivitis grade: \nCalculus: \nMobile teeth: ",
            assessment: "",
            plan: "Scale and polish under GA / recheck in 6 months.",
          },
        },
      ];
}

const TEMPLATE_STORE = "moraqat.vet.soapTemplates";
const draftKey = (visitId: string) => `moraqat.vet.visitDraft.${visitId}`;

// ── page ─────────────────────────────────────────────────────────────────

export default function VisitWorkspacePage({ params }: { params: { visitId: string } }) {
  const { visitId } = params;
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();

  const visit = useQuery({
    queryKey: ["vet-visit", visitId],
    queryFn: () => api.getVisit(visitId),
    enabled: actor.ready && !!actor.orgId,
  });

  const catId = visit.data?.visit.catId;
  // Alerts live on the patient, not the visit — but a vet in a chart needs
  // them even more than a vet on a profile, so we fetch them here too.
  const patient = useQuery({
    queryKey: ["vet-patient", catId],
    queryFn: () => api.getPatient(catId!),
    enabled: !!catId,
  });

  if (!actor.ready || visit.isLoading) return <VisitSkeleton />;
  if (visit.isError)
    return (
      <div className="mx-auto max-w-4xl p-4">
        <QueryError isAr={isAr} onRetry={() => void visit.refetch()} retrying={visit.isFetching} />
      </div>
    );

  const v = visit.data!.visit;
  // OPEN | CLOSED — the old comparison against "COMPLETED"/"CANCELLED" was
  // ALWAYS false, so a closed chart rendered as editable and every save 409d.
  const closed = v.state === "CLOSED";
  const canWrite = actor.can("record.write") && !closed;
  // The API groups tier-0 data ({allergies, conditions, currentMedications, …});
  // the band renders a flat list. One adapter, so no screen re-derives it.
  const alerts: MedicalAlert[] = flattenTier0Alerts(patient.data?.alerts);
  const missing = deriveMissingVaccinations(patient.data?.vaccinations, isAr);
  const reason = v.reason ?? "";
  const branch = (isAr ? v.branch?.ar : v.branch?.en) ?? "";

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-3 pb-24 sm:p-5">
      {/* Header — who, why, since when. */}
      <Card className="p-4 sm:p-5">
        <Link
          href={`/vet/patients/${v.catId}`}
          className="inline-flex min-h-[44px] items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {isAr ? <ArrowRight className="size-4" aria-hidden /> : <ArrowLeft className="size-4" aria-hidden />}
          {isAr ? `ملف ${v.cat.name}` : `${v.cat.name}'s profile`}
        </Link>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {v.cat.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.cat.photoUrl} alt="" className="size-14 rounded-2xl object-cover ring-1 ring-border" />
          ) : (
            <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Cat className="size-6" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl font-semibold tracking-tight">{v.cat.name}</h1>
            <p className="font-mono text-xs text-muted-foreground">{v.cat.catIdNumber}</p>
          </div>
          <Badge variant={closed ? "secondary" : "success"} dot>
            {vetVisitStateLabel(v.state, isAr)}
          </Badge>
        </div>

        <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{isAr ? "سبب الحضور" : "Presenting complaint"}</dt>
            <dd className="font-medium text-foreground">{reason || (isAr ? "غير مذكور" : "not stated")}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-muted-foreground">{isAr ? "الحضور" : "Checked in"}</dt>
            <dd className="font-medium tabular-nums text-foreground">
              {formatDateTime(v.checkedInAt, locale)}
            </dd>
          </div>
          {v.openedBy?.name && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{isAr ? "الطبيب" : "Clinician"}</dt>
              <dd className="font-medium text-foreground">{v.openedBy.name}</dd>
            </div>
          )}
          {branch && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{isAr ? "الفرع" : "Branch"}</dt>
              <dd className="font-medium text-foreground">{branch}</dd>
            </div>
          )}
          {closed && v.closedAt && (
            <div className="flex gap-2">
              <dt className="text-muted-foreground">{isAr ? "أُغلقت" : "Closed"}</dt>
              <dd className="font-medium tabular-nums text-foreground">
                {formatDateTime(v.closedAt, locale)}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {/* The alerts travel with the vet into the chart. */}
      {patient.isSuccess && (
        <AlertsBand alerts={alerts} missingVaccinations={missing} catName={v.cat.name} />
      )}

      {canWrite && <SoapEditor visitId={visitId} catId={v.catId} />}

      {canWrite && <AddEntry visitId={visitId} catId={v.catId} alerts={alerts} />}

      {/* This visit's entries — narrowed by time since check-in. */}
      <Card className="p-4 sm:p-5">
        <h2 className="font-display text-base font-semibold tracking-tight">
          {isAr ? "ما سُجّل منذ بداية الزيارة" : "Recorded since this visit began"}
        </h2>
        <p className="mb-3 mt-0.5 text-xs text-muted-foreground">
          {isAr
            ? `كل إدخال مؤرَّخ بعد ${formatDateTime(v.checkedInAt, locale)}.`
            : `Every entry dated after ${formatDateTime(v.checkedInAt, locale)}.`}
        </p>
        <TimelinePanel catId={v.catId} sinceAt={v.checkedInAt} alerts={alerts} />
      </Card>

      <OwnerSummary visitId={visitId} catId={v.catId} catName={v.cat.name} checkedInAt={v.checkedInAt} />

      {!closed && actor.can("visit.close") && <CloseVisit visitId={visitId} catName={v.cat.name} />}
    </div>
  );
}

// ── SOAP editor ──────────────────────────────────────────────────────────

const SOAP_FIELDS: { key: keyof SoapNote; ar: string; en: string; rows: number }[] = [
  { key: "subjective", ar: "الشكوى — ما يرويه المالك", en: "Subjective — what the owner reports", rows: 3 },
  { key: "objective", ar: "الفحص — ما وجدتَه", en: "Objective — what you found", rows: 4 },
  { key: "assessment", ar: "التقييم", en: "Assessment", rows: 2 },
  { key: "plan", ar: "الخطة", en: "Plan", rows: 3 },
];

function SoapEditor({ visitId, catId }: { visitId: string; catId: string }) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();
  const qc = useQueryClient();

  const [note, setNote] = React.useState<SoapNote>(EMPTY_SOAP);
  const [custom, setCustom] = React.useState<SoapTemplate[]>([]);
  const [saveTplOpen, setSaveTplOpen] = React.useState(false);
  const [tplName, setTplName] = React.useState("");
  const [restored, setRestored] = React.useState(false);

  const templates = React.useMemo(() => [...builtInTemplates(isAr), ...custom], [isAr, custom]);
  const savesAsDraft = actor.role ? requiresCoSign(actor.role) : false;

  // Restore an in-progress note and the clinician's own templates.
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(visitId));
      if (raw) {
        const parsed = JSON.parse(raw) as SoapNote;
        if (parsed && typeof parsed === "object") {
          setNote({ ...EMPTY_SOAP, ...parsed });
          if (Object.values(parsed).some((x) => typeof x === "string" && x.trim())) setRestored(true);
        }
      }
      const t = localStorage.getItem(TEMPLATE_STORE);
      if (t) setCustom(JSON.parse(t) as SoapTemplate[]);
    } catch {
      /* storage unavailable — the note simply starts empty */
    }
  }, [visitId]);

  // Autosave, debounced. Nothing typed is ever at risk.
  React.useEffect(() => {
    const id = setTimeout(() => {
      try {
        localStorage.setItem(draftKey(visitId), JSON.stringify(note));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [note, visitId]);

  function persistTemplates(next: SoapTemplate[]) {
    setCustom(next);
    try {
      localStorage.setItem(TEMPLATE_STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const save = useMutation({
    mutationFn: () =>
      api.createRecord({
        catId,
        visitId,
        type: "EXAM",
        payload: {
          clinicalType: "EXAM",
          subjective: note.subjective.trim() || undefined,
          objective: note.objective.trim() || undefined,
          assessment: note.assessment.trim() || undefined,
          plan: note.plan.trim() || undefined,
        },
        occurredAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      setNote(EMPTY_SOAP);
      setRestored(false);
      try {
        localStorage.removeItem(draftKey(visitId));
      } catch {
        /* ignore */
      }
      void qc.invalidateQueries({ queryKey: ["vet-timeline", catId] });
      toast({
        variant: "success",
        title: savesAsDraft
          ? isAr
            ? "حُفظ الفحص كمسودة"
            : "Examination saved as a draft"
          : isAr
            ? "أُضيف الفحص للسجل"
            : "Examination added to the record",
      });
    },
    onError: (err) => {
      const f = vetFriendlyError(err, isAr);
      toast({ variant: "error", title: f.title, description: f.message });
    },
  });

  const hasContent = Object.values(note).some((v) => v.trim());

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-semibold tracking-tight">
          {isAr ? "ملاحظة الفحص (SOAP)" : "Examination note (SOAP)"}
        </h2>
        {restored && (
          <Badge variant="info">{isAr ? "استُعيدت مسودة محفوظة" : "Restored an unsaved draft"}</Badge>
        )}
        {savesAsDraft && <Badge variant="warning">{isAr ? "تُحفظ كمسودة" : "Saves as draft"}</Badge>}
      </div>

      <div className="mt-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {isAr ? "قوالب" : "Templates"}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {templates.map((t) => (
            <span key={t.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => setNote({ ...t.note })}
                className="min-h-[44px] rounded-full border border-border bg-background px-3.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {t.name}
              </button>
              {!t.builtIn && (
                <button
                  type="button"
                  onClick={() => persistTemplates(custom.filter((c) => c.id !== t.id))}
                  aria-label={isAr ? `احذف قالب ${t.name}` : `Delete template ${t.name}`}
                  className="grid size-11 place-items-center rounded-full text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              )}
            </span>
          ))}
          {hasContent && (
            <Button size="sm" variant="ghost" onClick={() => setSaveTplOpen(true)}>
              <BookmarkPlus className="size-4" />
              {isAr ? "احفظ كقالب" : "Save as template"}
            </Button>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {SOAP_FIELDS.map((f) => (
          <div key={f.key}>
            <label htmlFor={`soap-${f.key}`} className="block text-xs font-medium text-foreground">
              {isAr ? f.ar : f.en}
            </label>
            <textarea
              id={`soap-${f.key}`}
              rows={f.rows}
              value={note[f.key]}
              onChange={(e) => setNote((p) => ({ ...p, [f.key]: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="brand" loading={save.isPending} disabled={!hasContent} onClick={() => save.mutate()}>
          <Save className="size-4" />
          {isAr ? "احفظ الفحص" : "Save examination"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {isAr ? "يُحفظ تلقائياً على هذا الجهاز أثناء الكتابة." : "Autosaved on this device as you type."}
        </p>
      </div>

      <Dialog
        open={saveTplOpen}
        onClose={() => setSaveTplOpen(false)}
        title={isAr ? "احفظ كقالب" : "Save as a template"}
        description={
          isAr
            ? "يُحفظ على هذا الجهاز لاستخدامك، ولا يُشارك مع زملائك."
            : "Saved on this device for you — it isn't shared with colleagues."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveTplOpen(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="brand"
              onClick={() => {
                const name = tplName.trim();
                if (!name) return;
                persistTemplates([...custom, { id: `tpl-${Date.now()}`, name, note: { ...note } }]);
                setTplName("");
                setSaveTplOpen(false);
              }}
            >
              {isAr ? "احفظ القالب" : "Save template"}
            </Button>
          </>
        }
      >
        <label htmlFor="tpl-name" className="block text-xs font-medium text-foreground">
          {isAr ? "اسم القالب" : "Template name"}
        </label>
        <Input id="tpl-name" value={tplName} onChange={(e) => setTplName(e.target.value)} className="mt-1" />
      </Dialog>
    </Card>
  );
}

// ── add entry ────────────────────────────────────────────────────────────

function AddEntry({
  visitId,
  catId,
  alerts,
}: {
  visitId: string;
  catId: string;
  alerts: MedicalAlert[];
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-semibold tracking-tight">
          {isAr ? "أضف إدخالاً" : "Add an entry"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {isAr ? "تحصين، وصفة، مختبر، جراحة، وزن…" : "Vaccination, prescription, lab, surgery, weight…"}
        </p>
        <Button
          size="sm"
          variant={open ? "ghost" : "outline"}
          className="ms-auto"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? null : <Plus className="size-4" />}
          {open ? (isAr ? "أغلق" : "Close") : isAr ? "إدخال جديد" : "New entry"}
        </Button>
      </div>

      {open && (
        <EntryComposer
          className="mt-4"
          catId={catId}
          visitId={visitId}
          alerts={alerts}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["vet-timeline", catId] });
            void qc.invalidateQueries({ queryKey: ["vet-prescriptions", catId] });
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </Card>
  );
}

// ── owner summary ────────────────────────────────────────────────────────

/**
 * Draft the owner's message from what was actually recorded. Deliberately
 * plain and warm — this lands in a member's app next to their cat's photo, so
 * it is written the way a person talks, and it never states a finding the
 * record doesn't contain.
 */
function draftSummary(
  entries: TimelineEntry[],
  catName: string,
  isAr: boolean,
  locale: "ar" | "en"
): string {
  const lines: string[] = [];
  const live = entries.filter((e) => e.status !== "RETRACTED");

  lines.push(
    isAr
      ? `زيارة ${catName} انتهت — وهذي خلاصتها.`
      : `${catName}'s visit is done — here's the short version.`
  );

  for (const e of live) {
    const title = (isAr ? e.titleAr : e.titleEn)?.trim();
    if (!title) continue;
    const when = formatDate(e.at, locale);
    switch (e.kind) {
      case "VACCINATION":
        lines.push(isAr ? `التحصين: ${title} (${when}).` : `Vaccination: ${title} (${when}).`);
        break;
      case "PRESCRIPTION":
        lines.push(isAr ? `الدواء: ${title}.` : `Medication: ${title}.`);
        break;
      case "LAB":
      case "IMAGING":
        lines.push(isAr ? `الفحوصات: ${title}.` : `Tests: ${title}.`);
        break;
      case "WEIGHT":
        lines.push(isAr ? `الوزن: ${title}.` : `Weight: ${title}.`);
        break;
      case "EXAM":
        lines.push(isAr ? `الفحص: ${title}.` : `Examination: ${title}.`);
        break;
      default:
        break;
    }
  }

  lines.push(
    isAr
      ? "إذا لاحظت أي شيء غير معتاد، تواصل معنا — نحن هنا."
      : "If anything seems off, get in touch — we're here."
  );

  return lines.join("\n");
}

function OwnerSummary({
  visitId,
  catId,
  catName,
  checkedInAt,
}: {
  visitId: string;
  catId: string;
  catName: string;
  checkedInAt: string;
}) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();
  const qc = useQueryClient();

  const [text, setText] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const [sentAt, setSentAt] = React.useState<string | null>(null);

  const timeline = useQuery({
    queryKey: ["vet-timeline", catId],
    queryFn: () => api.getPatientTimeline(catId),
    enabled: actor.can("record.read"),
  });

  const send = useMutation({
    mutationFn: () => api.sendOwnerSummary(visitId, text.trim()),
    onSuccess: () => {
      setSentAt(new Date().toISOString());
      void qc.invalidateQueries({ queryKey: ["vet-visit", visitId] });
      toast({
        variant: "success",
        title: isAr ? "وصل الملخّص للمالك" : "The owner has it",
        description: isAr
          ? `${catName} صار عندها سجل يقرأه مالكها — وتذكيراتها مجدولة.`
          : `${catName} now has a record her owner can read — and her reminders are scheduled.`,
      });
    },
    onError: (err) => {
      const f = vetFriendlyError(err, isAr);
      toast({ variant: "error", title: f.title, description: f.message });
    },
  });

  function generate() {
    const items = (timeline.data?.items ?? []).filter(
      (e) => new Date(e.at).getTime() >= new Date(checkedInAt).getTime()
    );
    setText(draftSummary(items, catName, isAr, locale));
    setTouched(true);
  }

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-[hsl(var(--accent-ink))]">
          <ClipboardList className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold tracking-tight">
            {isAr ? "ملخّص للمالك" : "Summary for the owner"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {isAr
              ? "يصل لتطبيق المالك بلغته، ويجدول التذكيرات تلقائياً."
              : "Lands in the owner's app in their language, and schedules the reminders."}
          </p>
        </div>
        {sentAt && (
          <Badge variant="success" className="ms-auto">
            <CheckCheck className="size-3" aria-hidden />
            {isAr ? `أُرسل ${formatDateTime(sentAt, locale)}` : `Sent ${formatDateTime(sentAt, locale)}`}
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={generate}
          disabled={timeline.isLoading || timeline.isError}
        >
          {timeline.isLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {touched
            ? isAr
              ? "أعد الصياغة من السجل"
              : "Redraft from the record"
            : isAr
              ? "اكتب لي مسودة"
              : "Draft it for me"}
        </Button>
      </div>

      <label htmlFor="owner-summary" className="mt-3 block text-xs font-medium text-foreground">
        {isAr ? "نص الرسالة" : "Message"}
      </label>
      <textarea
        id="owner-summary"
        rows={7}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setTouched(true);
        }}
        placeholder={
          isAr
            ? "اضغط «اكتب لي مسودة» — أو اكتبها بكلماتك."
            : "Tap “Draft it for me” — or write it in your own words."
        }
        className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm leading-relaxed text-foreground shadow-e1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      />

      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {isAr
          ? "اقرأها قبل الإرسال. المالك سيقرأ هذه الكلمات بالضبط، ولن تُرسل إلا بضغطك."
          : "Read it before sending. The owner reads these exact words, and nothing goes out until you press send."}
      </p>

      <Button
        className="mt-3"
        variant="brand"
        loading={send.isPending}
        disabled={text.trim().length < 10}
        onClick={() => send.mutate()}
      >
        <Send className="size-4" />
        {sentAt ? (isAr ? "أرسل تحديثاً" : "Send an update") : isAr ? "أرسل للمالك" : "Send to the owner"}
      </Button>
    </Card>
  );
}

// ── close visit ──────────────────────────────────────────────────────────

function CloseVisit({ visitId, catName }: { visitId: string; catName: string }) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const isAr = locale === "ar";
  const api = useVetApi();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);

  const close = useMutation({
    mutationFn: () => api.closeVisit(visitId),
    onSuccess: () => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["vet-visit", visitId] });
      toast({
        variant: "success",
        title: isAr ? "أُغلقت الزيارة" : "Visit closed",
        description: isAr
          ? "التذكيرات مجدولة، والسجل محفوظ. السجل يبقى مفتوحاً للإضافة بتعديل موثّق."
          : "Reminders are scheduled and the record is saved. It stays open to documented amendments.",
      });
      router.refresh();
    },
    onError: (err) => {
      const f = vetFriendlyError(err, isAr);
      toast({ variant: "error", title: f.title, description: f.message });
    },
  });

  return (
    <>
      <div className="flex justify-end">
        <Button variant="brand" size="lg" onClick={() => setOpen(true)}>
          <CheckCheck className="size-4" />
          {isAr ? "أغلق الزيارة" : "Close the visit"}
        </Button>
      </div>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={isAr ? `أغلق زيارة ${catName}` : `Close ${catName}'s visit`}
        description={
          isAr
            ? "الإغلاق يجدول تذكيرات المالك ويقفل قائمة الانتظار. السجل لا يُقفل: أي إضافة لاحقة تُسجَّل كتعديل موثّق باسمك."
            : "Closing schedules the owner's reminders and clears the queue. The record itself doesn't lock: anything added later is recorded as a documented amendment under your name."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={close.isPending}>
              {isAr ? "ليس بعد" : "Not yet"}
            </Button>
            <Button variant="brand" loading={close.isPending} onClick={() => close.mutate()}>
              {isAr ? "أغلق الزيارة" : "Close the visit"}
            </Button>
          </>
        }
      />
    </>
  );
}

// ── skeleton ─────────────────────────────────────────────────────────────

function VisitSkeleton() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-3 sm:p-5" aria-hidden>
      <Card className="p-5">
        <Skeleton className="h-4 w-28" />
        <div className="mt-3 flex gap-3">
          <Skeleton className="size-14 rounded-2xl" />
          <div className="flex-1">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        </div>
        <Skeleton className="mt-4 h-10" />
      </Card>
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}
