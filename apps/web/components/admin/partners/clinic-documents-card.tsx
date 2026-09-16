"use client";

/**
 * Documents — the core review tool. The reviewer opens each file, checks it
 * against the numbers the clinic typed, and marks it verified. Required
 * documents that were never uploaded are shown as explicit "missing" rows, so
 * absence is as visible as presence (R093: never colour alone — every state
 * is also written).
 *
 * Files are private: they are fetched as blobs with the admin's session and
 * opened from an object URL, never via a public link.
 */

import * as React from "react";
import { FileText, Eye, ShieldCheck, ShieldOff, FileX2, CheckCircle2 } from "lucide-react";
import { Badge, Button, useToast, cn } from "@moraqat/ui";
import { CLINIC_DOCUMENT_LABELS } from "@moraqat/core";
import {
  formatBytes,
  openPrivateDocument,
  useRegistrationApi,
  type RegBranch,
  type RegDocument,
  type RegistrationState,
} from "@/lib/vet-registration";
import { fmtDate } from "@/app/admin/_components/i18n";
import { ExpiryText, SectionCard, describeError, fmtNumber } from "./shared";
import type { ClinicActions } from "./use-clinic-actions";

interface Group {
  key: string;
  title: string;
  docs: RegDocument[];
  missing: { kind: "CR" | "MEWA_LICENCE"; branchId: string | null }[];
}

export function ClinicDocumentsCard({
  state,
  actions,
  isAr,
}: {
  state: RegistrationState;
  actions: ClinicActions;
  isAr: boolean;
}) {
  const api = useRegistrationApi();
  const { toast } = useToast();
  const [opening, setOpening] = React.useState<string | null>(null);
  const orgId = state.org.id;

  const groups = React.useMemo<Group[]>(() => {
    const branchName = (b: RegBranch, i: number) =>
      (isAr ? b.nameAr : b.nameEn) || b.nameAr || b.nameEn || (isAr ? `الفرع ${fmtNumber(i + 1, true)}` : `Branch ${i + 1}`);
    const orgDocs = state.documents.filter((d) => d.scope === "org" || !d.branchId);
    const out: Group[] = [
      {
        key: "org",
        title: isAr ? "مستندات المنشأة" : "Organisation documents",
        docs: orgDocs,
        missing: orgDocs.some((d) => d.kind === "CR") ? [] : [{ kind: "CR", branchId: null }],
      },
    ];
    const known = new Set<string>();
    state.branches.forEach((b, i) => {
      known.add(b.id);
      const docs = state.documents.filter((d) => d.branchId === b.id);
      out.push({
        key: b.id,
        title: branchName(b, i),
        docs,
        missing: docs.some((d) => d.kind === "MEWA_LICENCE") ? [] : [{ kind: "MEWA_LICENCE", branchId: b.id }],
      });
    });
    const orphans = state.documents.filter((d) => d.branchId && !known.has(d.branchId));
    if (orphans.length) {
      out.push({ key: "orphans", title: isAr ? "مستندات فروع محذوفة" : "Documents for removed branches", docs: orphans, missing: [] });
    }
    return out;
  }, [state.documents, state.branches, isAr]);

  const required = state.documents.filter((d) => d.required);
  const verifiedRequired = required.filter((d) => d.verified).length;
  const missingCount = groups.reduce((n, g) => n + g.missing.length, 0);

  const view = async (doc: RegDocument) => {
    setOpening(doc.id);
    try {
      await openPrivateDocument(() => api.adminDocumentBlob(orgId, doc.id));
    } catch (err) {
      const d = describeError(err, isAr);
      toast({ title: d.title, description: d.description, variant: "error" });
    } finally {
      setOpening(null);
    }
  };

  const summary = (
    <span className="text-xs tabular-nums text-muted-foreground">
      {isAr
        ? `المطلوب: ${fmtNumber(verifiedRequired, true)} من ${fmtNumber(required.length + missingCount, true)} متحقق منه`
        : `Required: ${verifiedRequired} of ${required.length + missingCount} verified`}
    </span>
  );

  return (
    <SectionCard icon={FileText} title={isAr ? "المستندات" : "Documents"} count={state.documents.length} action={summary}>
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</h3>
            {g.docs.length === 0 && g.missing.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{isAr ? "لا توجد مستندات." : "No documents."}</p>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {g.missing.map((m) => (
                  <li key={`missing-${m.kind}-${m.branchId ?? "org"}`} className="flex flex-wrap items-center justify-between gap-2 bg-destructive/[0.03] px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <FileX2 aria-hidden className="size-4 shrink-0 text-destructive" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{isAr ? CLINIC_DOCUMENT_LABELS[m.kind].ar : CLINIC_DOCUMENT_LABELS[m.kind].en}</p>
                        <p className="text-xs text-muted-foreground">{isAr ? "لم يُرفع بعد" : "Not uploaded yet"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline">{isAr ? "مطلوب" : "Required"}</Badge>
                      <Badge variant="destructive">{isAr ? "مفقود" : "Missing"}</Badge>
                    </div>
                  </li>
                ))}
                {g.docs.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    isAr={isAr}
                    opening={opening === doc.id}
                    toggling={actions.pendingDocumentId === doc.id}
                    onView={() => void view(doc)}
                    onToggle={() => actions.verifyDocument(doc.id, !doc.verified)}
                  />
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function DocumentRow({
  doc,
  isAr,
  opening,
  toggling,
  onView,
  onToggle,
}: {
  doc: RegDocument;
  isAr: boolean;
  opening: boolean;
  toggling: boolean;
  onView: () => void;
  onToggle: () => void;
}) {
  const label = isAr ? doc.label.ar : doc.label.en;
  return (
    <li className={cn("px-3 py-2.5", doc.verified && "bg-success/[0.03]")}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
            {label}
            {doc.required && <Badge variant="outline">{isAr ? "مطلوب" : "Required"}</Badge>}
            {doc.verified ? (
              <Badge variant="success">
                <CheckCircle2 aria-hidden className="size-3" />
                {isAr ? "متحقق منه" : "Verified"}
              </Badge>
            ) : (
              <Badge variant="warning">{isAr ? "لم يُتحقق منه" : "Not verified"}</Badge>
            )}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {doc.fileName && (
              <span className="max-w-[16rem] truncate" dir="ltr" title={doc.fileName}>
                {doc.fileName}
              </span>
            )}
            <span className="tabular-nums">{formatBytes(doc.sizeBytes, isAr)}</span>
            {doc.number && (
              <span>
                {isAr ? "الرقم: " : "No. "}
                <span className="font-mono" dir="ltr">
                  {doc.number}
                </span>
              </span>
            )}
            {doc.expiresAt && (
              <span>
                {isAr ? "الانتهاء: " : "Expires: "}
                <ExpiryText iso={doc.expiresAt} isAr={isAr} />
              </span>
            )}
            <span>
              {isAr ? "رُفع " : "Uploaded "}
              {fmtDate(doc.createdAt, isAr)}
            </span>
            {doc.verified && doc.verifiedAt && (
              <span>
                {isAr ? "تُحقق منه " : "Verified "}
                {fmtDate(doc.verifiedAt, isAr)}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={onView}
            loading={opening}
            aria-label={isAr ? `عرض ${label}` : `View ${label}`}
          >
            {!opening && <Eye aria-hidden />}
            {isAr ? "عرض" : "View"}
          </Button>
          <Button
            variant={doc.verified ? "ghost" : "brand"}
            size="sm"
            onClick={onToggle}
            loading={toggling}
            aria-pressed={doc.verified}
            aria-label={doc.verified ? (isAr ? `إلغاء التحقق من ${label}` : `Unverify ${label}`) : isAr ? `تحقق من ${label}` : `Verify ${label}`}
          >
            {!toggling && (doc.verified ? <ShieldOff aria-hidden /> : <ShieldCheck aria-hidden />)}
            {doc.verified ? (isAr ? "إلغاء التحقق" : "Unverify") : isAr ? "تحقق" : "Verify"}
          </Button>
        </div>
      </div>
    </li>
  );
}
