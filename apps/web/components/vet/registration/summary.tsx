"use client";

/**
 * Read-only views of what the clinic has entered. Used three ways: the review
 * step (with Edit links), a step that is locked while other steps are reopened
 * for changes, and the "under review" screen (what exactly was sent).
 */

import * as React from "react";
import { AlertCircle, CheckCircle2, Eye, Pencil } from "lucide-react";
import { Button, Card, cn } from "@moraqat/ui";
import { REGISTRATION_STEPS, VET_ROLE_LABELS, isDoctorRole } from "@moraqat/core";
import { formatBytes, openPrivateDocument, type RegDocument, type RegistrationApi, type RegistrationState } from "@/lib/vet-registration";
import { DAY_NAMES } from "./hours-editor";
import { osmUrl } from "./location-picker";
import { formatDate } from "./ui";
import type { WizardStep } from "./types";

type Row = { label: string; value: React.ReactNode; ltr?: boolean };

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {rows.map((r) => (
        <div key={r.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{r.label}</dt>
          <dd className="mt-0.5 break-words text-sm font-medium" dir={r.ltr ? "ltr" : undefined}>
            <span className={cn(r.ltr && "inline-block text-start")}>{r.value || "—"}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function SummaryCard({
  step,
  isAr,
  state,
  onEdit,
  children,
}: {
  step: WizardStep;
  isAr: boolean;
  state: RegistrationState;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  const meta = REGISTRATION_STEPS.find((s) => s.key === step);
  const gaps = state.gaps.filter((g) => g.step === step).length;
  return (
    <Card className="flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          {gaps === 0 ? (
            <CheckCircle2 className="size-4 text-success" aria-hidden />
          ) : (
            <AlertCircle className="size-4 text-[hsl(38_92%_32%)] dark:text-warning" aria-hidden />
          )}
          {meta ? (isAr ? meta.ar : meta.en) : step}
          {gaps > 0 && (
            <span className="text-xs font-normal text-muted-foreground">
              {isAr ? `(ناقص ${gaps})` : `(${gaps} missing)`}
            </span>
          )}
        </h3>
        {onEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
            <Pencil aria-hidden />
            {isAr ? "تعديل" : "Edit"}
          </Button>
        )}
      </div>
      {children}
    </Card>
  );
}

export function ClinicSummary({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  const o = state.org;
  return (
    <Rows
      rows={[
        { label: isAr ? "الاسم بالعربية" : "Name in Arabic", value: o.nameAr },
        { label: isAr ? "الاسم بالإنجليزية" : "Name in English", value: o.nameEn, ltr: true },
        { label: isAr ? "الاسم النظامي" : "Legal name", value: o.legalNameAr },
        { label: isAr ? "الاسم النظامي بالإنجليزية" : "Legal name in English", value: o.legalNameEn, ltr: true },
        { label: isAr ? "السجل التجاري" : "CR number", value: o.crNumber, ltr: true },
        { label: isAr ? "الرقم الوطني الموحد" : "Unified number", value: o.unifiedNumber, ltr: true },
        { label: isAr ? "انتهاء السجل" : "CR expiry", value: o.crExpiresAt ? formatDate(o.crExpiresAt, isAr) : null },
        { label: isAr ? "الرقم الضريبي" : "VAT number", value: o.vatNumber, ltr: true },
      ]}
    />
  );
}

function hoursLine(b: RegistrationState["branches"][number], isAr: boolean): string {
  if (!b.hours?.length) return isAr ? "لم تُحدَّد" : "Not set";
  return b.hours
    .slice()
    .sort((a, z) => a.day - z.day)
    .map((h) => {
      const d = DAY_NAMES[h.day];
      const name = d ? (isAr ? d.ar : d.en.slice(0, 3)) : String(h.day);
      return `${name} ${h.closed ? (isAr ? "مغلق" : "closed") : `${h.open ?? ""}–${h.close ?? ""}`}`;
    })
    .join(" · ");
}

export function BranchesSummary({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  if (!state.branches.length) {
    return <p className="text-sm text-muted-foreground">{isAr ? "لم تُضف فروع بعد." : "No branches added yet."}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {state.branches.map((b, i) => (
        <li key={b.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
          <p className="text-sm font-semibold">
            {isAr ? `الفرع ${i + 1}` : `Branch ${i + 1}`} · {isAr ? b.nameAr : b.nameEn || b.nameAr}
            {b.emergency24h && (
              <span className="ms-2 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-medium text-destructive">
                {isAr ? "طوارئ ٢٤ ساعة" : "24h emergency"}
              </span>
            )}
          </p>
          <Rows
            rows={[
              {
                label: isAr ? "العنوان" : "Address",
                value: [b.addressLine, b.district, b.city ? (isAr ? b.city.ar : b.city.en) : null].filter(Boolean).join(isAr ? "، " : ", "),
              },
              { label: isAr ? "العنوان المختصر" : "Short address", value: b.nationalAddressCode, ltr: true },
              {
                label: isAr ? "الموقع" : "Location",
                value:
                  b.lat != null && b.lng != null ? (
                    <a
                      href={osmUrl(b.lat, b.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline-offset-4 hover:underline"
                      dir="ltr"
                    >
                      {b.lat}, {b.lng}
                    </a>
                  ) : null,
              },
              { label: isAr ? "رقم التواصل" : "Phone", value: b.phone, ltr: true },
              { label: isAr ? "البريد" : "Email", value: b.email, ltr: true },
              { label: isAr ? "ترخيص وزارة البيئة" : "MEWA licence", value: b.licenceNo, ltr: true },
              { label: isAr ? "انتهاء الترخيص" : "Licence expiry", value: b.licenceExpiresAt ? formatDate(b.licenceExpiresAt, isAr) : null },
              { label: isAr ? "الخدمات" : "Services", value: b.services.length ? b.services.join(isAr ? "، " : ", ") : null },
            ]}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">{isAr ? "الأوقات: " : "Hours: "}</span>
            {hoursLine(b, isAr)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function DocumentsSummary({
  state,
  isAr,
  api,
  orgId,
}: {
  state: RegistrationState;
  isAr: boolean;
  api: RegistrationApi;
  orgId: string;
}) {
  const [opening, setOpening] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState<string | null>(null);
  const branchName = (id: string | null) => {
    const b = state.branches.find((x) => x.id === id);
    return b ? (isAr ? b.nameAr : b.nameEn || b.nameAr) : null;
  };

  async function view(doc: RegDocument) {
    setOpening(doc.id);
    setFailed(null);
    try {
      await openPrivateDocument(() => api.ownerDocumentBlob(orgId, doc.id));
    } catch {
      setFailed(doc.id);
    } finally {
      setOpening(null);
    }
  }

  if (!state.documents.length) {
    return <p className="text-sm text-muted-foreground">{isAr ? "لم تُرفع مستندات بعد." : "No documents uploaded yet."}</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-border">
      {state.documents.map((d) => (
        <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {isAr ? d.label.ar : d.label.en}
              {d.branchId && <span className="font-normal text-muted-foreground"> · {branchName(d.branchId)}</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              <span dir="ltr">{d.fileName ?? "—"}</span> · {formatBytes(d.sizeBytes, isAr)} · {formatDate(d.createdAt, isAr)}
              {d.verified && <span className="text-success"> · {isAr ? "تم التحقق" : "verified"}</span>}
            </p>
            {failed === d.id && (
              <p role="alert" className="text-xs text-destructive">
                {isAr ? "تعذّر فتح الملف — حاول مجدداً." : "Couldn't open the file — try again."}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" loading={opening === d.id} onClick={() => void view(d)}>
            {opening !== d.id && <Eye aria-hidden />}
            {isAr ? "عرض" : "View"}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function TeamSummary({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  const o = state.owner;
  const ownerRow = o?.practisesAsVet ? (
    <li className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
      <p className="text-sm font-medium">
        {o.title ? `${o.title} ` : ""}
        {o.name || o.email}
        <span className="ms-2 text-xs font-normal text-muted-foreground">
          {isAr ? "المالك · يمارس كطبيب بيطري" : "Owner · practises as a veterinarian"}
        </span>
      </p>
      <p className="text-xs text-muted-foreground">
        {isAr ? "ترخيص " : "Licence "}
        {o.licenceNo ? <span dir="ltr">{o.licenceNo}</span> : isAr ? "لم يُدخل بعد" : "not entered yet"}
        {o.licenceExpiresAt && <> · {isAr ? `ينتهي ${formatDate(o.licenceExpiresAt, true)}` : `expires ${formatDate(o.licenceExpiresAt, false)}`}</>}
      </p>
    </li>
  ) : null;
  if (!state.team.length && !ownerRow) {
    return <p className="text-sm text-muted-foreground">{isAr ? "لم يُضف أحد بعد." : "Nobody added yet."}</p>;
  }
  const branchNames = (ids: string[]) =>
    ids.length === 0
      ? isAr
        ? "كل الفروع"
        : "All branches"
      : ids
          .map((id) => state.branches.find((b) => b.id === id))
          .filter(Boolean)
          .map((b) => (isAr ? b!.nameAr : b!.nameEn || b!.nameAr))
          .join(isAr ? "، " : ", ");
  return (
    <ul className="flex flex-col divide-y divide-border">
      {ownerRow}
      {state.team.map((m) => (
        <li key={m.email} className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0">
          <p className="text-sm font-medium">
            {m.title ? `${m.title} ` : ""}
            {m.fullName}
            <span className="ms-2 text-xs font-normal text-muted-foreground">{VET_ROLE_LABELS[m.role][isAr ? "ar" : "en"]}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            <span dir="ltr">{m.email}</span> · <span dir="ltr">{m.phone}</span>
            {isDoctorRole(m.role) && m.licenceNo && (
              <>
                {" · "}
                {isAr ? "ترخيص " : "Licence "}
                <span dir="ltr">{m.licenceNo}</span>
              </>
            )}
            {state.branches.length > 1 && <> · {branchNames(m.branchIds)}</>}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** All four sections, stacked. */
export function FullSummary({
  state,
  isAr,
  api,
  orgId,
  onEdit,
}: {
  state: RegistrationState;
  isAr: boolean;
  api: RegistrationApi;
  orgId: string;
  onEdit?: (step: WizardStep) => void;
}) {
  const editable = (s: WizardStep) => (onEdit && state.editableSteps.includes(s) ? () => onEdit(s) : undefined);
  return (
    <div className="flex flex-col gap-3">
      <SummaryCard step="clinic" isAr={isAr} state={state} onEdit={editable("clinic")}>
        <ClinicSummary state={state} isAr={isAr} />
      </SummaryCard>
      <SummaryCard step="branches" isAr={isAr} state={state} onEdit={editable("branches")}>
        <BranchesSummary state={state} isAr={isAr} />
      </SummaryCard>
      <SummaryCard step="documents" isAr={isAr} state={state} onEdit={editable("documents")}>
        <DocumentsSummary state={state} isAr={isAr} api={api} orgId={orgId} />
      </SummaryCard>
      <SummaryCard step="team" isAr={isAr} state={state} onEdit={editable("team")}>
        <TeamSummary state={state} isAr={isAr} />
      </SummaryCard>
    </div>
  );
}
