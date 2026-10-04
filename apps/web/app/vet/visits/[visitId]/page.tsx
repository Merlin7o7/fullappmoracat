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
//     workflow imposed on yours. Templates are PROMPTS ("الحرارة: __ °م"),
//     never asserted findings, and they never overwrite what was typed.
//   • The vaccination template opens a pre-filled Vaccination entry, because
//     only a VACCINATION entry schedules the owner's reminder — prose in a
//     SOAP note schedules nothing.
//   • Everything autosaves locally as it is typed, per visit AND per author
//     (a counter terminal changes hands). A dropped clinic Wi-Fi at the end of
//     a consult must never eat a note (R117, R114); the next person at the
//     terminal must never inherit it.
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
import { Badge, Button, Card, Dialog, Input, Skeleton, cn, useToast } from "@moraqat/ui";
import {
  VET_CLOSE_EMPTY_REASONS,
  VET_CLOSE_EMPTY_REASON_LABELS,
  buildEntryPayload,
  composeReason,
  ownerDeliveryNotice,
  requiresCoSign,
  type ClinicalEntryType,
  type VetCloseEmptyReason,
} from "@moraqat/core";
import { useLocale } from "@/app/providers";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { QueryError } from "@/components/query-error";
import { AlertsBand, deriveMissingVaccinations } from "@/components/vet/alerts-band";
import { EntryComposer } from "@/components/vet/entry-composer";
import TimelinePanel from "../../patients/[catId]/timeline-panel";
import {
  useVetActor,
  useVetApi,
  vetDraftKey,
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
  /** Also open this structured entry, pre-filled — the record that does work. */
  opensEntry?: { type: ClinicalEntryType; values: Record<string, string> };
}

/** A request from the SOAP editor to open the structured composer. */
interface EntryRequest {
  type: ClinicalEntryType;
  values: Record<string, string>;
  nonce: number;
}

const EMPTY_SOAP: SoapNote = { subjective: "", objective: "", assessment: "", plan: "" };

/**
 * Shipped starting points. A clinician's own templates sit alongside these.
 *
 * Every line is a PROMPT with a blank to fill ("الحرارة: __ °م"), never a
 * finding. The previous vaccination template asserted "vitals within normal
 * limits" and "healthy" for a cat nobody had examined yet — a template that
 * writes the conclusion for you is how a record ends up saying what was never
 * checked (audit 2026-10-04, #vet P1).
 */
function builtInTemplates(isAr: boolean): SoapTemplate[] {
  const vaxEntry = { type: "VACCINATION" as const, values: { route: "SC" } };
  return isAr
    ? [
        {
          id: "builtin-vax",
          name: "تطعيم روتيني",
          builtIn: true,
          opensEntry: vaxEntry,
          note: {
            subjective: "سبب الحضور: تطعيم دوري\nملاحظات المالك: __\nتفاعل سابق مع اللقاح: __",
            objective: "الحالة العامة: __\nالحرارة: __ °م\nالنبض: __ /د\nالتنفس: __ /د\nالغدد اللمفاوية: __",
            assessment: "مناسب للتطعيم اليوم: __",
            plan: "اللقاح والتشغيلة: يُسجَّلان في إدخال «تطعيم» أدناه\nما شُرح للمالك عن الأعراض المتوقعة: __",
          },
        },
        {
          id: "builtin-sick",
          name: "زيارة مرضية",
          builtIn: true,
          note: {
            subjective: "بداية الأعراض: \nالشهية: \nالماء: \nصندوق الرمل: \nالقيء/الإسهال: ",
            objective: "الحالة العامة: \nالحرارة: __ °م\nالجفاف: \nجسّ البطن: \nالفم والأسنان: ",
            assessment: "",
            plan: "الفحوصات: \nالعلاج: \nالمتابعة: ",
          },
        },
        {
          id: "builtin-dental",
          name: "مراجعة أسنان",
          builtIn: true,
          note: {
            subjective: "ما يلاحظه المالك (رائحة الفم، صعوبة الأكل): __",
            objective: "درجة التهاب اللثة: \nالجير: \nالأسنان المتحركة: ",
            assessment: "",
            plan: "الإجراء: __\nالمتابعة: __",
          },
        },
      ]
    : [
        {
          id: "builtin-vax",
          name: "Routine vaccination",
          builtIn: true,
          opensEntry: vaxEntry,
          note: {
            subjective: "Reason: routine vaccination\nOwner concerns: __\nPrevious vaccine reaction: __",
            objective: "General condition: __\nTemperature: __ °C\nHeart rate: __ /min\nRespiration: __ /min\nLymph nodes: __",
            assessment: "Suitable for vaccination today: __",
            plan: "Vaccine and batch: recorded in the Vaccination entry below\nExpected reactions explained to the owner: __",
          },
        },
        {
          id: "builtin-sick",
          name: "Sick visit",
          builtIn: true,
          note: {
            subjective: "Onset: \nAppetite: \nWater intake: \nLitter box: \nVomiting/diarrhoea: ",
            objective:
              "General condition: \nTemperature: __ °C\nHydration: \nAbdominal palpation: \nOral exam: ",
            assessment: "",
            plan: "Diagnostics: \nTreatment: \nRecheck: ",
          },
        },
        {
          id: "builtin-dental",
          name: "Dental recheck",
          builtIn: true,
          note: {
            subjective: "Owner notices (halitosis, difficulty eating): __",
            objective: "Gingivitis grade: \nCalculus: \nMobile teeth: ",
            assessment: "",
            plan: "Procedure: __\nRecheck: __",
          },
        },
      ];
}

const TEMPLATE_STORE = "moraqat.vet.soapTemplates";

/** Does a stored draft for this visit+author hold any typed text? */
function readDraft(key: string): SoapNote | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SoapNote>;
    if (!parsed || typeof parsed !== "object") return null;
    const note = { ...EMPTY_SOAP, ...parsed };
    return Object.values(note).some((x) => typeof x === "string" && x.trim()) ? note : null;
  } catch {
    return null;
  }
}

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
  const [entryRequest, setEntryRequest] = React.useState<EntryRequest | null>(null);

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
  // Stored as a code; the server sends the label in both languages.
  const reason = (isAr ? v.reasonLabel?.ar : v.reasonLabel?.en) ?? v.reason ?? "";
  const branch = (isAr ? v.branch?.ar : v.branch?.en) ?? "";
  const draftKeyNow = vetDraftKey(visitId, actor.actingStaffId ?? "me");

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
          <Badge variant={closed ? "outline" : "success"} dot>
            {vetVisitStateLabel(v.state, isAr)}
          </Badge>
          {v.stale && !closed && (
            <Badge variant="warning">{isAr ? "مفتوحة منذ يوم سابق" : "Open since an earlier day"}</Badge>
          )}
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

      {canWrite && (
        <SoapEditor
          key={draftKeyNow}
          visitId={visitId}
          catId={v.catId}
          draftKey={draftKeyNow}
          onRequestEntry={(type, values) => setEntryRequest({ type, values, nonce: Date.now() })}
        />
      )}

      {canWrite && <AddEntry visitId={visitId} catId={v.catId} alerts={alerts} request={entryRequest} />}

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

      {!closed && actor.can("visit.close") && (
        <CloseVisit
          visitId={visitId}
          catName={v.cat.name}
          entryCount={v.entryCount}
          draftKey={draftKeyNow}
        />
      )}
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

function SoapEditor({
  visitId,
  catId,
  draftKey,
  onRequestEntry,
}: {
  visitId: string;
  catId: string;
  /** `${visitId}:${staffId}` — re-keyed (and re-mounted) when the terminal changes hands. */
  draftKey: string;
  onRequestEntry: (type: ClinicalEntryType, values: Record<string, string>) => void;
}) {
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
  const savesAsDraft = actor.role ? requiresCoSign(actor.role, actor.licence ?? undefined) : false;

  // Restore THIS author's in-progress note, and the clinician's own templates.
  React.useEffect(() => {
    const draft = readDraft(draftKey);
    if (draft) {
      setNote(draft);
      setRestored(true);
    }
    try {
      const t = localStorage.getItem(TEMPLATE_STORE);
      if (t) setCustom(JSON.parse(t) as SoapTemplate[]);
    } catch {
      /* storage unavailable — templates simply start empty */
    }
  }, [draftKey]);

  // Autosave, debounced. Nothing typed is ever at risk. An empty note removes
  // the key, so "unsaved note" warnings never fire on nothing.
  React.useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (Object.values(note).some((x) => x.trim())) localStorage.setItem(draftKey, JSON.stringify(note));
        else localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(id);
  }, [note, draftKey]);

  /**
   * Apply a template WITHOUT destroying typed work: it fills empty boxes only,
   * and replaces typed text only after an explicit yes. The old behaviour —
   * overwrite all four boxes on one tap — silently erased a consult's notes.
   */
  function applyTemplate(t: SoapTemplate) {
    const clashes = SOAP_FIELDS.filter((f) => note[f.key].trim() && t.note[f.key].trim() && note[f.key] !== t.note[f.key]);
    let replace = false;
    if (clashes.length) {
      replace = window.confirm(
        isAr
          ? `في ${clashes.length === 1 ? "خانة" : "خانات"} كتبت فيها بالفعل. استبدل ما كتبته بنص القالب؟\n«موافق» يستبدل · «إلغاء» يملأ الخانات الفارغة فقط.`
          : `You've already typed in ${clashes.length} box${clashes.length === 1 ? "" : "es"}. Replace your text with the template?\nOK replaces · Cancel fills only the empty boxes.`
      );
    }
    setNote((prev) => {
      const next = { ...prev };
      for (const f of SOAP_FIELDS) {
        if (!t.note[f.key].trim()) continue;
        if (!prev[f.key].trim() || replace) next[f.key] = t.note[f.key];
      }
      return next;
    });
    if (t.opensEntry) onRequestEntry(t.opensEntry.type, t.opensEntry.values);
  }

  function persistTemplates(next: SoapTemplate[]) {
    setCustom(next);
    try {
      localStorage.setItem(TEMPLATE_STORE, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  const save = useMutation({
    mutationFn: async () => {
      // Built by the shared contract: exactly the EXAM fields the API declares.
      // (This used to send `clinicalType`, which the API rejects — every SOAP
      // save was a 400.)
      const built = buildEntryPayload("EXAM", { ...note });
      if (!built.ok) throw new Error(Object.values(built.errors)[0]?.[isAr ? "ar" : "en"] ?? "invalid");
      return api.createRecord({
        catId,
        visitId,
        type: "EXAM",
        payload: built.payload,
        occurredAt: new Date().toISOString(),
      });
    },
    onSuccess: (saved) => {
      setNote(EMPTY_SOAP);
      setRestored(false);
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      void qc.invalidateQueries({ queryKey: ["vet-timeline", catId] });
      void qc.invalidateQueries({ queryKey: ["vet-visit", visitId] });
      toast({
        variant: "success",
        title: saved.coSign.required
          ? isAr
            ? "حُفظ الفحص كمسودة"
            : "Examination saved as a draft"
          : isAr
            ? "أُضيف الفحص للسجل"
            : "Examination added to the record",
        description: saved.coSign.notice ? (isAr ? saved.coSign.notice.ar : saved.coSign.notice.en) : undefined,
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
                onClick={() => applyTemplate(t)}
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
            <Button size="sm" variant="tertiary" onClick={() => setSaveTplOpen(true)}>
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
        <Button variant="primary" loading={save.isPending} disabled={!hasContent} onClick={() => save.mutate()}>
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
            <Button variant="tertiary" onClick={() => setSaveTplOpen(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="primary"
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
  request,
}: {
  visitId: string;
  catId: string;
  alerts: MedicalAlert[];
  /** Set by a template: open the composer on this type, pre-filled. */
  request: EntryRequest | null;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!request) return;
    setOpen(true);
    // Bring it into view — the template's whole point is the entry below.
    requestAnimationFrame(() => ref.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
  }, [request]);

  return (
    <Card className="scroll-mt-4 p-4 sm:p-5" ref={ref}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-base font-semibold tracking-tight">
          {isAr ? "أضف إدخالاً" : "Add an entry"}
        </h2>
        <p className="text-xs text-muted-foreground">
          {isAr ? "تطعيم، وصفة، مختبر، جراحة، وزن…" : "Vaccination, prescription, lab, surgery, weight…"}
        </p>
        <Button
          size="sm"
          variant={open ? "tertiary" : "secondary"}
          className="ms-auto"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? null : <Plus className="size-4" />}
          {open ? (isAr ? "أغلق" : "Close") : isAr ? "إدخال جديد" : "New entry"}
        </Button>
      </div>

      {open && (
        <EntryComposer
          key={request?.nonce ?? "manual"}
          className="mt-4"
          catId={catId}
          visitId={visitId}
          alerts={alerts}
          initialType={request?.type}
          initialValues={request?.values}
          onSaved={() => {
            void qc.invalidateQueries({ queryKey: ["vet-timeline", catId] });
            void qc.invalidateQueries({ queryKey: ["vet-prescriptions", catId] });
            void qc.invalidateQueries({ queryKey: ["vet-visit", visitId] });
            void qc.invalidateQueries({ queryKey: ["vet-patient", catId] });
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
        lines.push(isAr ? `التطعيم: ${title} (${when}).` : `Vaccination: ${title} (${when}).`);
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
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ["vet-visit", visitId] });
      // Say what actually happened. An unclaimed cat has no owner to reach;
      // "the owner has it" would be a lie told at the counter.
      if (!res.delivered) {
        const why = res.ownerNotification ? ownerDeliveryNotice(res.ownerNotification) : null;
        toast({
          variant: "info",
          title: isAr ? "حُفظ الملخّص — لم يصل لأحد بعد" : "Summary saved — it hasn't reached anyone yet",
          description: why ? (isAr ? why.ar : why.en) : undefined,
        });
        return;
      }
      setSentAt(new Date().toISOString());
      toast({
        variant: "success",
        title: isAr ? "وصل الملخّص لتطبيق المالك" : "It's in the owner's app",
        description: isAr
          ? `ملخّص زيارة ${catName} عند مالكه الآن.`
          : `${catName}'s visit summary is with the owner now.`,
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
              ? "يصل لتطبيق المالك داخل التطبيق. التذكيرات تُجدول من إدخالات التطعيم نفسها."
              : "Arrives in the owner's app. Reminders are scheduled by the vaccination entries themselves."}
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
          variant="secondary"
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
        variant="primary"
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

function CloseVisit({
  visitId,
  catName,
  entryCount,
  draftKey,
}: {
  visitId: string;
  catName: string;
  /** An EMPTY visit must say why it is closing (the API refuses otherwise). */
  entryCount: number;
  draftKey: string;
}) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const router = useRouter();
  const isAr = locale === "ar";
  const api = useVetApi();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [preset, setPreset] = React.useState<VetCloseEmptyReason | "">("");
  const [other, setOther] = React.useState("");
  const [reasonError, setReasonError] = React.useState("");
  const [unsavedNote, setUnsavedNote] = React.useState(false);

  const needsReason = entryCount === 0;
  const reason = !needsReason
    ? undefined
    : preset === "other"
      ? other.trim()
        ? composeReason("other", other)
        : ""
      : preset;

  const close = useMutation({
    mutationFn: () => api.closeVisit(visitId, { reason: reason || undefined }),
    onSuccess: (res) => {
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["vet-visit", visitId] });
      void qc.invalidateQueries({ queryKey: ["vet", "visits"] });
      const next = res.nextStep ? (isAr ? res.nextStep.ar : res.nextStep.en) : null;
      const debt =
        res.pendingCoSign > 0
          ? isAr
            ? `${res.pendingCoSign} ${res.pendingCoSign === 1 ? "إدخال ينتظر" : "إدخالات تنتظر"} توقيع طبيب — لن تصل تذكيراتها للمالك قبل التوقيع.`
            : `${res.pendingCoSign} ${res.pendingCoSign === 1 ? "entry is" : "entries are"} still awaiting a co-signature — no owner reminder goes out until signed.`
          : null;
      toast({
        variant: debt ? "info" : "success",
        title: isAr ? "أُغلقت الزيارة" : "Visit closed",
        description:
          [debt, next].filter(Boolean).join(" ") ||
          (isAr
            ? "السجل محفوظ، ويبقى مفتوحاً للإضافة بتعديل موثّق."
            : "The record is saved, and stays open to documented amendments."),
      });
      router.refresh();
    },
    onError: (err) => {
      const f = vetFriendlyError(err, isAr);
      toast({ variant: "error", title: f.title, description: f.message });
    },
  });

  function openDialog() {
    // An exam note typed but never saved would be stranded by a close.
    setUnsavedNote(!!readDraft(draftKey));
    setReasonError("");
    setOpen(true);
  }

  function confirm() {
    if (needsReason && !reason) {
      setReasonError(
        preset === "other"
          ? isAr
            ? "اكتب السبب في سطر واحد."
            : "Write the reason in one line."
          : isAr
            ? "اختر سبب إغلاق زيارة بلا سجلات."
            : "Choose why a visit with no records is closing."
      );
      return;
    }
    close.mutate();
  }

  return (
    <>
      <div className="flex justify-end">
        <Button variant="primary" size="lg" onClick={openDialog}>
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
            ? "الإغلاق يُخرج الزيارة من قائمة الانتظار. السجل لا يُقفل: أي إضافة لاحقة تُسجَّل كتعديل موثّق باسمك."
            : "Closing takes the visit off the queue. The record itself doesn't lock: anything added later is recorded as a documented amendment under your name."
        }
        footer={
          <>
            <Button variant="tertiary" onClick={() => setOpen(false)} disabled={close.isPending}>
              {isAr ? "ليس بعد" : "Not yet"}
            </Button>
            <Button variant="primary" loading={close.isPending} onClick={confirm}>
              {isAr ? "أغلق الزيارة" : "Close the visit"}
            </Button>
          </>
        }
      >
        {unsavedNote && (
          <p role="alert" className="rounded-xl border border-warning/50 bg-warning/10 px-3 py-2.5 text-sm text-foreground">
            {isAr
              ? "في ملاحظة فحص مكتوبة لم تُحفظ في السجل. احفظها أولاً — الإغلاق لا يحفظها عنك."
              : "There's an examination note that hasn't been saved to the record. Save it first — closing won't save it for you."}
          </p>
        )}
        {needsReason && (
          <fieldset className={cn(unsavedNote && "mt-3")}>
            <legend className="text-sm font-medium text-foreground">
              {isAr ? "لا يوجد سجل في هذه الزيارة — لماذا تُغلق؟" : "Nothing was recorded in this visit — why is it closing?"}
              <span className="ms-1 text-destructive" aria-hidden>
                *
              </span>
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {VET_CLOSE_EMPTY_REASONS.map((code) => (
                <button
                  key={code}
                  type="button"
                  aria-pressed={preset === code}
                  onClick={() => {
                    setPreset(code);
                    setReasonError("");
                  }}
                  className={cn(
                    "min-h-[44px] rounded-xl border px-3 text-start text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    preset === code
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isAr ? VET_CLOSE_EMPTY_REASON_LABELS[code].ar : VET_CLOSE_EMPTY_REASON_LABELS[code].en}
                </button>
              ))}
            </div>
            {preset === "other" && (
              <Input
                aria-label={isAr ? "السبب" : "Reason"}
                value={other}
                maxLength={400}
                onChange={(e) => {
                  setOther(e.target.value);
                  setReasonError("");
                }}
                className="mt-2"
              />
            )}
            {reasonError && (
              <p role="alert" className="mt-1.5 text-xs font-medium text-destructive">
                {reasonError}
              </p>
            )}
          </fieldset>
        )}
      </Dialog>
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
