"use client";

// ════════════════════════════════════════════════════════════════════════
//  TimelinePanel — the append-only clinical spine (MRC-VET-001 §10).
//
//  "One append-only timeline, typed entries, revisions instead of edits."
//  Every decision here defends that sentence:
//
//   • The words "edit" and "delete" do not appear in this UI. The two offered
//     verbs are AMEND (creates revision n+1) and RETRACT (greys the entry,
//     keeps it readable, demands a reason). A retracted entry never
//     disappears — a medico-legal record that can vanish is not a record.
//   • Every entry names the CLINIC that authored it and marks whether that
//     clinic is *this* one. A vet reading a note must know whose judgement
//     it is.
//   • Drafts are visibly provisional. An intern's entry says "waiting on a
//     co-signature" in words, not a colour (R093).
//
//  Paging note: the shared client's `getPatientTimeline` returns the record
//  in one response (no server cursor). Rendering a decade of entries at once
//  would jank a counter tablet, so the panel windows the list — 20 at a time,
//  "load more" — rather than inventing a pagination contract the API doesn't
//  serve. When a cursor lands, only this component changes.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, History, PenLine, RotateCcw, Signature, Undo2, FileText } from "lucide-react";
import { Badge, Button, Card, Dialog, Input, Skeleton, cn, useToast } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { formatDateTime } from "@/lib/datetime";
import { QueryError } from "@/components/query-error";
import { IlloSprig } from "@/components/illustrations";
import { EntryComposer, entryKindLabel } from "@/components/vet/entry-composer";
import {
  useVetActor,
  useVetApi,
  vetFriendlyError,
  type EntryType,
  type MedicalAlert,
  type TimelineEntry,
} from "@/lib/vet-api";

const PAGE = 20;

/** The kinds a clinician actually filters by, in the order they think of them. */
const FILTER_KINDS: EntryType[] = [
  "EXAM",
  "VACCINATION",
  "PRESCRIPTION",
  "LAB",
  "IMAGING",
  "WEIGHT",
  "NOTE",
  "VISIT",
  "ATTACHMENT",
  "CONSENT",
];

export function timelineQueryKey(catId: string) {
  return ["vet-timeline", catId] as const;
}

export default function TimelinePanel({
  catId,
  alerts = [],
  /**
   * Visit workspace: entries carry no visit id in the record model, so the
   * visit view narrows honestly by time — everything recorded since the visit
   * opened — and says so, rather than implying a link the data doesn't have.
   */
  sinceAt,
  className,
}: {
  catId: string;
  alerts?: MedicalAlert[];
  sinceAt?: string;
  className?: string;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();
  const [kinds, setKinds] = React.useState<EntryType[]>([]);
  const [shown, setShown] = React.useState(PAGE);

  const canRead = actor.can("record.read");

  const query = useQuery({
    queryKey: timelineQueryKey(catId),
    queryFn: () => api.getPatientTimeline(catId),
    enabled: canRead,
  });

  if (!canRead) return <RecordsWithheld isAr={isAr} className={className} />;

  const all = query.data?.entries ?? [];
  const filtered = all.filter((e) => {
    if (kinds.length && !kinds.includes(e.kind)) return false;
    if (sinceAt && new Date(e.at).getTime() < new Date(sinceAt).getTime()) return false;
    return true;
  });
  const visible = filtered.slice(0, shown);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Kind filters. Multi-select; "All" is the cleared state, not a chip
          that fights the others. */}
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label={isAr ? "تصفية حسب النوع" : "Filter by type"}
      >
        <FilterChip
          active={kinds.length === 0}
          label={isAr ? "الكل" : "All"}
          onClick={() => {
            setKinds([]);
            setShown(PAGE);
          }}
        />
        {FILTER_KINDS.map((k) => (
          <FilterChip
            key={k}
            active={kinds.includes(k)}
            label={entryKindLabel(k, isAr)}
            onClick={() => {
              setKinds((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
              setShown(PAGE);
            }}
          />
        ))}
      </div>

      {query.isLoading ? (
        <TimelineSkeleton />
      ) : query.isError ? (
        <QueryError isAr={isAr} onRetry={() => void query.refetch()} retrying={query.isFetching} />
      ) : visible.length === 0 ? (
        <EmptyTimeline
          isAr={isAr}
          filtered={kinds.length > 0 || !!sinceAt}
          onClear={() => {
            setKinds([]);
            setShown(PAGE);
          }}
        />
      ) : (
        <>
          <ol className="relative space-y-3 border-s border-border ps-4">
            {visible.map((entry) => (
              <TimelineRow key={entry.id} entry={entry} catId={catId} alerts={alerts} />
            ))}
          </ol>
          {filtered.length > visible.length ? (
            <div className="flex justify-center pt-1">
              <Button variant="outline" size="sm" onClick={() => setShown((n) => n + PAGE)}>
                {isAr
                  ? `حمّل المزيد (${filtered.length - visible.length} متبقٍ)`
                  : `Load more (${filtered.length - visible.length} left)`}
              </Button>
            </div>
          ) : (
            visible.length > 6 && (
              <p className="pt-1 text-center text-xs text-muted-foreground">
                {isAr ? "وصلت لبداية السجل." : "That's the beginning of the record."}
              </p>
            )
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "min-h-[44px] rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

// ── one entry ────────────────────────────────────────────────────────────

function TimelineRow({
  entry,
  catId,
  alerts,
}: {
  entry: TimelineEntry;
  catId: string;
  alerts: MedicalAlert[];
}) {
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();
  const qc = useQueryClient();

  const [amending, setAmending] = React.useState(false);
  const [retractOpen, setRetractOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState("");

  const retracted = entry.status === "RETRACTED";
  const isDraft = entry.status === "DRAFT" || entry.status === "AWAITING_COSIGN";
  const isRevision = !!entry.revisionOf;
  const ownClinic = !entry.orgId || entry.orgId === actor.orgId;
  const clinicName = (isAr ? entry.orgNameAr : entry.orgNameEn) ?? "";
  const title = (isAr ? entry.titleAr : entry.titleEn) || entryKindLabel(entry.kind, isAr);
  const body = isAr ? entry.bodyAr : entry.bodyEn;

  const invalidate = () => void qc.invalidateQueries({ queryKey: timelineQueryKey(catId) });

  const cosign = useMutation({
    mutationFn: () => api.cosignRecord(entry.id),
    onSuccess: () => {
      toast({
        variant: "success",
        title: isAr ? "وُقّع الإدخال" : "Co-signed",
        description: isAr
          ? "صار جزءاً نهائياً من السجل، باسم كاتبه وباسمك."
          : "It is now a final part of the record — under its author's name and yours.",
      });
      invalidate();
    },
    onError: (err) => {
      const f = vetFriendlyError(err, isAr);
      toast({ variant: "error", title: f.title, description: f.message });
    },
  });

  const retract = useMutation({
    mutationFn: () => api.retractRecord(entry.id, { reason: reason.trim() }),
    onSuccess: () => {
      setRetractOpen(false);
      setReason("");
      toast({
        variant: "success",
        title: isAr ? "سُحب الإدخال" : "Entry retracted",
        description: isAr
          ? "يبقى مقروءاً في السجل مع سبب السحب — لا شيء يُمحى."
          : "It stays readable in the record with your reason — nothing is erased.",
      });
      invalidate();
    },
    onError: (err) => {
      const f = vetFriendlyError(err, isAr);
      toast({ variant: "error", title: f.title, description: f.message });
    },
  });

  // Amend and retract are only offered on this clinic's own, non-retracted work.
  const canAmend = ownClinic && !retracted && actor.can("record.write");
  const canRetract = ownClinic && !retracted && actor.can("record.retract");
  const canCosign = isDraft && !retracted && actor.can("record.cosign");

  return (
    <li className="relative">
      <span
        aria-hidden
        className={cn(
          "absolute -start-[21px] top-5 size-2.5 rounded-full ring-4 ring-background",
          retracted ? "bg-muted-foreground" : isDraft ? "bg-warning" : "bg-primary"
        )}
      />
      <Card
        className={cn(
          "overflow-hidden",
          retracted && "border-dashed border-muted-foreground/40 bg-muted/40",
          isDraft && !retracted && "border-warning/40"
        )}
      >
        <div className="p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={retracted ? "outline" : "default"}>
              {entryKindLabel(entry.kind, isAr)}
            </Badge>

            {retracted && (
              <Badge variant="destructive">
                <Undo2 className="size-3" aria-hidden />
                {isAr ? "مسحوب" : "Retracted"}
              </Badge>
            )}
            {isDraft && !retracted && (
              <Badge variant="warning">
                {isAr ? "مسودة — بانتظار توقيع" : "Draft — awaiting co-signature"}
              </Badge>
            )}
            {isRevision && (
              <Badge variant="info">
                <History className="size-3" aria-hidden />
                {isAr ? "نسخة معدّلة" : "Revision"}
              </Badge>
            )}
            {entry.cosignedBy && (
              <Badge variant="success">
                <Signature className="size-3" aria-hidden />
                {isAr ? `وقّعه ${entry.cosignedBy}` : `Co-signed by ${entry.cosignedBy}`}
              </Badge>
            )}

            <time dateTime={entry.at} className="ms-auto text-xs tabular-nums text-muted-foreground">
              {formatDateTime(entry.at, locale)}
            </time>
          </div>

          <h4
            className={cn(
              "mt-2 text-sm font-semibold",
              retracted ? "text-muted-foreground line-through decoration-1" : "text-foreground"
            )}
          >
            {title}
          </h4>

          {/* Attribution: person, then clinic. Whose judgement is this? */}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{entry.authorName}</span>
            {entry.authorRole && <span>· {entry.authorRole}</span>}
            {clinicName && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3" aria-hidden />
                {clinicName}
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                ownClinic
                  ? "bg-primary/10 text-primary"
                  : "border border-border bg-muted text-muted-foreground"
              )}
            >
              {ownClinic
                ? isAr
                  ? "عيادتك"
                  : "This clinic"
                : isAr
                  ? "عيادة أخرى"
                  : "Another clinic"}
            </span>
          </p>

          {retracted && (
            <p className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {isAr
                ? "هذا الإدخال مسحوب. محتواه محفوظ للسجل ولا يُعتمد عليه سريرياً."
                : "This entry is retracted. Its content is kept for the record and must not be relied on clinically."}
            </p>
          )}

          {body && (
            <p
              className={cn(
                "mt-2 whitespace-pre-wrap text-sm leading-relaxed",
                retracted ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {body}
            </p>
          )}

          {/* Attachments — thumbnails for images, a labelled chip otherwise. */}
          {(entry.attachments?.length ?? 0) > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {entry.attachments!.map((a) => {
                const isImage = a.mimeType?.startsWith("image/");
                const inner = (
                  <>
                    {isImage && a.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt="" className="size-10 rounded-lg object-cover" loading="lazy" />
                    ) : (
                      <span className="grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                        <FileText className="size-4" aria-hidden />
                      </span>
                    )}
                    <span className="max-w-[10rem] truncate">{a.filename}</span>
                  </>
                );
                return (
                  <li key={a.id}>
                    {a.url ? (
                      <a
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 rounded-xl border border-border bg-background p-1.5 pe-3 text-xs transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {inner}
                      </a>
                    ) : (
                      <span className="flex items-center gap-2 rounded-xl border border-dashed border-border p-1.5 pe-3 text-xs text-muted-foreground">
                        {inner}
                        <span>{isAr ? "قيد الرفع" : "uploading"}</span>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Append-only actions. No "edit". No "delete". */}
          {(canAmend || canRetract || canCosign) && (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">
              {canCosign && (
                <Button size="sm" variant="brand" loading={cosign.isPending} onClick={() => cosign.mutate()}>
                  <Signature className="size-4" />
                  {isAr ? "وقّع بالمشاركة" : "Co-sign"}
                </Button>
              )}
              {canAmend && (
                <Button size="sm" variant="outline" onClick={() => setAmending((v) => !v)}>
                  <PenLine className="size-4" />
                  {amending ? (isAr ? "أغلق التعديل" : "Close amendment") : isAr ? "عدّل" : "Amend"}
                </Button>
              )}
              {canRetract && (
                <Button size="sm" variant="ghost" onClick={() => setRetractOpen(true)}>
                  <RotateCcw className="size-4" />
                  {isAr ? "اسحب" : "Retract"}
                </Button>
              )}
            </div>
          )}

          {amending && (
            <EntryComposer
              className="mt-3"
              catId={catId}
              alerts={alerts}
              amendOf={{
                entryId: entry.id,
                type: entry.kind === "VISIT" || entry.kind === "CONSENT" || entry.kind === "ATTACHMENT"
                  ? "NOTE"
                  : entry.kind,
                note: body ?? undefined,
              }}
              onSaved={() => {
                setAmending(false);
                invalidate();
              }}
              onCancel={() => setAmending(false)}
            />
          )}
        </div>
      </Card>

      <Dialog
        open={retractOpen}
        onClose={() => setRetractOpen(false)}
        title={isAr ? "سحب هذا الإدخال" : "Retract this entry"}
        description={
          isAr
            ? "السحب لا يحذف. الإدخال يبقى في السجل معلَّماً كمسحوب، مع سببك واسمك ووقت السحب."
            : "Retracting does not delete. The entry stays in the record, marked as retracted, with your reason, your name and the time."
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setRetractOpen(false)} disabled={retract.isPending}>
              {isAr ? "تراجع" : "Never mind"}
            </Button>
            <Button
              variant="destructive"
              loading={retract.isPending}
              onClick={() => {
                if (reason.trim().length < 5) {
                  setReasonError(
                    isAr
                      ? "اذكر سبباً واضحاً — يُقرأ لاحقاً في مراجعة السجل."
                      : "Give a clear reason — it will be read later in a record review."
                  );
                  return;
                }
                setReasonError("");
                retract.mutate();
              }}
            >
              {isAr ? "اسحب الإدخال" : "Retract entry"}
            </Button>
          </>
        }
      >
        <label htmlFor={`retract-reason-${entry.id}`} className="block text-xs font-medium text-foreground">
          {isAr ? "سبب السحب" : "Reason"}
        </label>
        <Input
          id={`retract-reason-${entry.id}`}
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            if (reasonError) setReasonError("");
          }}
          invalid={!!reasonError}
          aria-describedby={reasonError ? `retract-reason-err-${entry.id}` : undefined}
          className="mt-1"
        />
        {reasonError && (
          <p id={`retract-reason-err-${entry.id}`} role="alert" className="mt-1 text-xs text-destructive">
            {reasonError}
          </p>
        )}
      </Dialog>
    </li>
  );
}

// ── states ───────────────────────────────────────────────────────────────

function TimelineSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Card key={i} className="p-4">
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="ms-auto h-4 w-28" />
          </div>
          <Skeleton className="mt-3 h-3 w-48" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-1.5 h-4 w-3/5" />
        </Card>
      ))}
    </div>
  );
}

function EmptyTimeline({
  isAr,
  filtered,
  onClear,
}: {
  isAr: boolean;
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <IlloSprig tone="leaf" className="size-10 opacity-70" aria-hidden />
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
        {filtered
          ? isAr
            ? "لا توجد إدخالات مطابقة. جرّب تصفية أوسع."
            : "No entries match. Try a wider filter."
          : isAr
            ? "لا سجل سريري بعد. أول فحص تكتبه هنا يصبح بداية قصة هذا القط الطبية."
            : "No clinical record yet. The first entry you write here becomes the beginning of this cat's medical story."}
      </p>
      {filtered && (
        <Button size="sm" variant="outline" onClick={onClear}>
          {isAr ? "أظهر كل الأنواع" : "Show all types"}
        </Button>
      )}
    </Card>
  );
}

function RecordsWithheld({ isAr, className }: { isAr: boolean; className?: string }) {
  return (
    <Card className={cn("p-6", className)}>
      <h3 className="text-sm font-semibold text-foreground">
        {isAr ? "السجل الطبي خارج نطاق دورك" : "Clinical records aren't part of your role"}
      </h3>
      <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-muted-foreground">
        {isAr
          ? "يمكنك فتح زيارة والاطلاع على التنبيهات الحرجة — أما القراءة والكتابة في السجل الطبي فمقصورة على الطاقم السريري. طبيب أو مدير العيادة يقدر يفتحه."
          : "You can open a visit and see the critical alerts — reading and writing the clinical record is reserved for clinical staff. A veterinarian or the clinic manager can open it."}
      </p>
    </Card>
  );
}
