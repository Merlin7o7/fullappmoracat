"use client";

/**
 * Partner detail — everything a reviewer needs to make one decision.
 *
 * The same route serves an application and a live clinic, because to a reviewer
 * they are one entity at two points in its life. We resolve which by asking for
 * both and using whichever exists; if neither does, we say so honestly rather
 * than render an empty shell.
 *
 * Every state-changing action is confirmed, and the destructive ones (reject,
 * suspend) require a written reason — the partner will be told why, and a
 * decision nobody can explain later is a decision that shouldn't ship.
 *
 * The record-access audit at the bottom is the mirror of the owner's ledger:
 * the same reads, seen from Moracat's side. It is how we notice a clinic
 * reading records it has no business reading.
 */

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, ShieldCheck, ShieldOff, Check, X, FileText, AlertTriangle,
  Building2, Users, Phone, Mail, MapPin, Siren, Eye,
} from "lucide-react";
import { Card, Badge, Button, Skeleton, useToast, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { friendlyError } from "@/lib/errors";
import { formatDateTime } from "@/lib/datetime";
import { ConfirmDialog } from "@/app/admin/_components/confirm";
import { Pagination } from "@/app/admin/_components/pagination";
import { fmtDate, titleCase } from "@/app/admin/_components/i18n";
import { partnerStatusMeta, tierLabel } from "@/components/vet-consent-card";

interface PartnerDoc {
  id: string;
  type?: string | null;
  name?: string | null;
  url?: string | null;
  number?: string | null;
  issuedAt?: string | null;
  expiresAt?: string | null;
}

interface PartnerBranch {
  id: string;
  nameEn?: string | null;
  nameAr?: string | null;
  city?: string | null;
  addressLine?: string | null;
  phone?: string | null;
  emergency24h?: boolean;
  status?: string | null;
}

interface PartnerStaff {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  status?: string | null;
  licenceNo?: string | null;
}

interface PartnerDetail {
  id: string;
  nameEn?: string | null;
  nameAr?: string | null;
  orgNameEn?: string | null;
  orgNameAr?: string | null;
  status: string;
  verified?: boolean;
  tier?: string | null;
  city?: string | null;
  addressLine?: string | null;
  crNumber?: string | null;
  licenceNo?: string | null;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
  rejectionReason?: string | null;
  suspensionReason?: string | null;
  documents?: PartnerDoc[];
  branches?: PartnerBranch[];
  staff?: PartnerStaff[];
}

interface AuditRow {
  id: string;
  staffName?: string | null;
  catName?: string | null;
  catIdNumber?: string | null;
  tier: string;
  surface?: string | null;
  emergency: boolean;
  at: string;
}

interface AuditResponse {
  items: AuditRow[];
  pagination: { total: number; page: number; totalPages: number };
}

type PendingAction = "approve" | "reject" | "verify" | "suspend" | "unsuspend" | null;

export default function PartnerDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const router = useRouter();
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [action, setAction] = React.useState<PendingAction>(null);

  // Ask for both shapes; the one that resolves tells us what this record is.
  const orgQ = useQuery({
    queryKey: ["admin-vet-org", user?.id, id],
    queryFn: () => authedFetch<PartnerDetail>(`/admin/vet/orgs/${id}`),
    enabled: !!user?.isStaff && !!id,
    retry: false,
  });

  const appQ = useQuery({
    queryKey: ["admin-vet-application", user?.id, id],
    queryFn: () => authedFetch<PartnerDetail>(`/admin/vet/applications/${id}`),
    enabled: !!user?.isStaff && !!id && orgQ.isError,
    retry: false,
  });

  const isOrg = !!orgQ.data;
  const data = orgQ.data ?? appQ.data ?? null;
  const loading = orgQ.isLoading || (orgQ.isError && appQ.isLoading);
  const notFound = orgQ.isError && appQ.isError;

  /**
   * Reject and suspend must carry a reason: the partner is told it, and it is
   * kept in the audit trail. The shared ConfirmDialog treats the field as
   * optional, so we enforce it here — and say so out loud rather than let the
   * confirm button do nothing, which would read as a broken screen (R084).
   */
  const requireReason = (kind: Exclude<PendingAction, null>, reason?: string) => {
    if (reason && reason.trim()) {
      act.mutate({ kind, reason: reason.trim() });
      return;
    }
    toast({
      title: isAr ? "السبب مطلوب" : "A reason is required",
      description: isAr
        ? "اكتب سبباً مختصراً — سيُبلَّغ به الشريك ويُحفظ في سجل التدقيق."
        : "Write a short reason — the partner is told it, and it's kept in the audit trail.",
      variant: "error",
    });
  };

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-vet-org"] });
    void qc.invalidateQueries({ queryKey: ["admin-vet-application"] });
    void qc.invalidateQueries({ queryKey: ["admin-vet-applications"] });
    void qc.invalidateQueries({ queryKey: ["admin-vet-orgs"] });
  };

  const act = useMutation({
    mutationFn: ({ kind, reason }: { kind: Exclude<PendingAction, null>; reason?: string }) => {
      const base = kind === "approve" || kind === "reject" ? `/admin/vet/applications/${id}` : `/admin/vet/orgs/${id}`;
      return authedFetch(`${base}/${kind}`, {
        method: "POST",
        body: JSON.stringify(reason ? { reason } : {}),
      });
    },
    onSuccess: (_r, vars) => {
      const DONE: Record<string, { ar: string; en: string }> = {
        approve: { ar: "تم قبول الطلب", en: "Application approved" },
        reject: { ar: "تم رفض الطلب", en: "Application rejected" },
        verify: { ar: "تم توثيق العيادة", en: "Clinic verified" },
        suspend: { ar: "تم إيقاف العيادة", en: "Clinic suspended" },
        unsuspend: { ar: "تم استئناف العيادة", en: "Clinic reinstated" },
      };
      const msg = DONE[vars.kind] ?? { ar: "تم الحفظ", en: "Done" };
      setAction(null);
      refresh();
      toast({ title: isAr ? msg.ar : msg.en, variant: "success" });
    },
    onError: (err) => {
      const f = friendlyError(err, isAr);
      toast({ title: f.title, description: f.message, variant: "error" });
    },
  });

  const name = data ? (isAr ? data.nameAr ?? data.orgNameAr : data.nameEn ?? data.orgNameEn) || data.nameEn || data.orgNameEn || "—" : "";

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <BackLink isAr={isAr} />
        <Card className="p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "ما لقينا هذا السجل. قد يكون حُذف، أو أن الرابط غير صحيح."
              : "We couldn't find this record. It may have been removed, or the link is wrong."}
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push("/admin/partners")}>
            {isAr ? "العودة للشركاء" : "Back to partners"}
          </Button>
        </Card>
      </div>
    );
  }

  const s = partnerStatusMeta(data.status);
  const isPendingApp = !isOrg && ["PENDING", "SUBMITTED", "IN_REVIEW"].includes(data.status);
  const suspended = data.status === "SUSPENDED";

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackLink isAr={isAr} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">{name}</h1>
            <Badge variant={s.variant}>{isAr ? s.ar : s.en}</Badge>
            {data.verified && (
              <Badge variant="success" className="gap-1">
                <ShieldCheck aria-hidden className="size-3" />
                {isAr ? "موثّقة" : "Verified"}
              </Badge>
            )}
            {data.tier && <Badge variant="outline">{data.tier}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOrg ? (isAr ? "عيادة شريكة" : "Partner clinic") : (isAr ? "طلب انضمام" : "Application")}
            {(data.submittedAt ?? data.createdAt) && (
              <> · {isAr ? "منذ" : "since"} {fmtDate((data.submittedAt ?? data.createdAt)!, isAr)}</>
            )}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {isPendingApp && (
            <>
              <Button size="sm" onClick={() => setAction("approve")}>
                <Check aria-hidden className="size-4" />
                {isAr ? "قبول" : "Approve"}
              </Button>
              <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setAction("reject")}>
                <X aria-hidden className="size-4" />
                {isAr ? "رفض" : "Reject"}
              </Button>
            </>
          )}
          {isOrg && !data.verified && !suspended && (
            <Button size="sm" onClick={() => setAction("verify")}>
              <ShieldCheck aria-hidden className="size-4" />
              {isAr ? "توثيق" : "Verify"}
            </Button>
          )}
          {isOrg && !suspended && (
            <Button variant="outline" size="sm" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setAction("suspend")}>
              <ShieldOff aria-hidden className="size-4" />
              {isAr ? "إيقاف" : "Suspend"}
            </Button>
          )}
          {isOrg && suspended && (
            <Button variant="outline" size="sm" onClick={() => setAction("unsuspend")}>
              {isAr ? "استئناف" : "Reinstate"}
            </Button>
          )}
        </div>
      </div>

      {/* A stopped or refused partner keeps its reason on screen — the record of
          why must outlive the person who made the call. */}
      {(data.suspensionReason || data.rejectionReason) && (
        <Card className="border-destructive/30 bg-destructive/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <AlertTriangle aria-hidden className="size-4" />
            {data.suspensionReason ? (isAr ? "سبب الإيقاف" : "Reason for suspension") : (isAr ? "سبب الرفض" : "Reason for rejection")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{data.suspensionReason || data.rejectionReason}</p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ProfileCard data={data} isAr={isAr} />
        <DocumentsCard docs={data.documents ?? []} isAr={isAr} />
      </div>

      <BranchesCard branches={data.branches ?? []} isAr={isAr} />
      <StaffCard staff={data.staff ?? []} isAr={isAr} />

      {isOrg && <AccessAuditCard orgId={id} isAr={isAr} />}

      <ConfirmDialog
        open={action === "approve"}
        onClose={() => setAction(null)}
        onConfirm={() => act.mutate({ kind: "approve" })}
        isAr={isAr}
        pending={act.isPending}
        title={isAr ? "قبول هذا الطلب؟" : "Approve this application?"}
        description={
          isAr
            ? `ستُنشأ عيادة شريكة لـ${name} ويتمكن فريقها من الدخول للبوابة. لن تظهر في الدليل العام حتى توثّقها.`
            : `A partner clinic will be created for ${name} and its team can sign in to the portal. It won't appear in the public directory until you verify it.`
        }
        confirmLabel={isAr ? "قبول الطلب" : "Approve"}
      />

      <ConfirmDialog
        open={action === "reject"}
        onClose={() => setAction(null)}
        onConfirm={(reason) => requireReason("reject", reason)}
        isAr={isAr}
        destructive
        withReason
        pending={act.isPending}
        title={isAr ? "رفض هذا الطلب؟" : "Reject this application?"}
        description={
          isAr
            ? "سيُبلَّغ مقدّم الطلب بالسبب الذي تكتبه. السبب مطلوب."
            : "The applicant will be told the reason you write. A reason is required."
        }
        reasonLabel={isAr ? "سبب الرفض (مطلوب)" : "Reason for rejection (required)"}
        reasonPlaceholder={isAr ? "مثال: الترخيص منتهي الصلاحية" : "e.g. the licence has expired"}
        confirmLabel={isAr ? "رفض الطلب" : "Reject"}
      />

      <ConfirmDialog
        open={action === "verify"}
        onClose={() => setAction(null)}
        onConfirm={() => act.mutate({ kind: "verify" })}
        isAr={isAr}
        pending={act.isPending}
        title={isAr ? "توثيق هذه العيادة؟" : "Verify this clinic?"}
        description={
          isAr
            ? `ستظهر ${name} في الدليل العام بشارة «موثّقة»، ويقدر الأعضاء يمنحونها إذن الاطلاع على سجلات قططهم. وثّق فقط بعد مراجعة الترخيص والسجل التجاري.`
            : `${name} will appear in the public directory with a “Verified” badge, and members will be able to grant it access to their cats' records. Only verify after checking the licence and commercial registration.`
        }
        confirmLabel={isAr ? "توثيق العيادة" : "Verify clinic"}
      />

      <ConfirmDialog
        open={action === "suspend"}
        onClose={() => setAction(null)}
        onConfirm={(reason) => requireReason("suspend", reason)}
        isAr={isAr}
        destructive
        withReason
        pending={act.isPending}
        title={isAr ? "إيقاف هذه العيادة؟" : "Suspend this clinic?"}
        description={
          isAr
            ? `سيفقد فريق ${name} الدخول للبوابة فوراً، وتختفي من الدليل العام، ويتوقف اطلاعها على سجلات الأعضاء. السبب مطلوب ويُحفظ في سجل التدقيق.`
            : `${name}'s team loses portal access immediately, it disappears from the public directory, and its access to member records stops. A reason is required and is kept in the audit trail.`
        }
        reasonLabel={isAr ? "سبب الإيقاف (مطلوب)" : "Reason for suspension (required)"}
        reasonPlaceholder={isAr ? "مثال: بلاغ موثّق بسوء استخدام السجلات" : "e.g. a substantiated report of record misuse"}
        confirmLabel={isAr ? "إيقاف العيادة" : "Suspend clinic"}
      />

      <ConfirmDialog
        open={action === "unsuspend"}
        onClose={() => setAction(null)}
        onConfirm={() => act.mutate({ kind: "unsuspend" })}
        isAr={isAr}
        pending={act.isPending}
        title={isAr ? "استئناف هذه العيادة؟" : "Reinstate this clinic?"}
        description={
          isAr
            ? `سيعود فريق ${name} للدخول، وتعود العيادة للدليل العام إن كانت موثّقة.`
            : `${name}'s team regains access, and the clinic returns to the public directory if it is verified.`
        }
        confirmLabel={isAr ? "استئناف" : "Reinstate"}
      />
    </div>
  );
}

function BackLink({ isAr }: { isAr: boolean }) {
  return (
    <Link
      href="/admin/partners"
      className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft aria-hidden className="size-4 rtl:rotate-180" />
      {isAr ? "الشركاء" : "Partners"}
    </Link>
  );
}

function SectionCard({
  icon: Icon, title, count, children,
}: {
  icon: typeof Building2;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon aria-hidden className="size-4 text-muted-foreground" />
        <h2 className="font-display font-semibold">{title}</h2>
        {typeof count === "number" && <span className="text-sm tabular-nums text-muted-foreground">({count})</span>}
      </div>
      {children}
    </Card>
  );
}

function Row({ label, value, dir }: { label: string; value?: string | null; dir?: "ltr" }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-border py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium" dir={dir}>{value || "—"}</dd>
    </div>
  );
}

function ProfileCard({ data, isAr }: { data: PartnerDetail; isAr: boolean }) {
  return (
    <SectionCard icon={Building2} title={isAr ? "الملف" : "Profile"}>
      <dl>
        <Row label={isAr ? "الاسم (عربي)" : "Name (Arabic)"} value={data.nameAr ?? data.orgNameAr} />
        <Row label={isAr ? "الاسم (إنجليزي)" : "Name (English)"} value={data.nameEn ?? data.orgNameEn} dir="ltr" />
        <Row label={isAr ? "المدينة" : "City"} value={data.city} />
        <Row label={isAr ? "العنوان" : "Address"} value={data.addressLine} />
        <Row label={isAr ? "السجل التجاري" : "CR number"} value={data.crNumber} dir="ltr" />
        <Row label={isAr ? "رقم الترخيص" : "Licence no."} value={data.licenceNo} dir="ltr" />
        <Row label={isAr ? "الموقع" : "Website"} value={data.website} dir="ltr" />
        <Row label={isAr ? "جهة الاتصال" : "Contact"} value={data.contactName} />
        <Row label={isAr ? "البريد" : "Email"} value={data.contactEmail} dir="ltr" />
        <Row label={isAr ? "الجوال" : "Phone"} value={data.contactPhone} dir="ltr" />
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {data.contactEmail && (
          <a href={`mailto:${data.contactEmail}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3 text-sm hover:bg-muted">
            <Mail aria-hidden className="size-4" />{isAr ? "مراسلة" : "Email"}
          </a>
        )}
        {data.contactPhone && (
          <a href={`tel:${data.contactPhone.replace(/\s/g, "")}`} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3 text-sm hover:bg-muted">
            <Phone aria-hidden className="size-4" />{isAr ? "اتصال" : "Call"}
          </a>
        )}
      </div>
    </SectionCard>
  );
}

/** Documents, sorted so anything expiring soonest is read first. */
function DocumentsCard({ docs, isAr }: { docs: PartnerDoc[]; isAr: boolean }) {
  const now = Date.now();
  const sorted = React.useMemo(
    () =>
      [...docs].sort((a, b) => {
        const at = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
        const bt = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
        return at - bt;
      }),
    [docs]
  );

  return (
    <SectionCard icon={FileText} title={isAr ? "المستندات" : "Documents"} count={docs.length}>
      {sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {isAr ? "لم تُرفع مستندات." : "No documents uploaded."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {sorted.map((d) => {
            const exp = d.expiresAt ? new Date(d.expiresAt).getTime() : null;
            const days = exp === null ? null : Math.floor((exp - now) / 86_400_000);
            const expired = days !== null && days < 0;
            const soon = days !== null && days >= 0 && days <= 30;
            return (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{d.name || (d.type ? titleCase(d.type) : (isAr ? "مستند" : "Document"))}</p>
                  <p className="text-xs text-muted-foreground" dir={d.number ? "ltr" : undefined}>
                    {d.number ? `${d.number} · ` : ""}
                    {d.issuedAt ? (isAr ? `صدر ${fmtDate(d.issuedAt, isAr)}` : `issued ${fmtDate(d.issuedAt, isAr)}`) : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {expired ? (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle aria-hidden className="size-3" />
                      {isAr ? `منتهٍ ${fmtDate(d.expiresAt!, isAr)}` : `Expired ${fmtDate(d.expiresAt!, isAr)}`}
                    </Badge>
                  ) : soon ? (
                    <Badge variant="warning" className="gap-1">
                      <AlertTriangle aria-hidden className="size-3" />
                      {isAr ? `ينتهي خلال ${days!.toLocaleString("ar-SA")} يوم` : `Expires in ${days}d`}
                    </Badge>
                  ) : d.expiresAt ? (
                    <span className="text-xs text-muted-foreground">
                      {isAr ? `حتى ${fmtDate(d.expiresAt, isAr)}` : `until ${fmtDate(d.expiresAt, isAr)}`}
                    </span>
                  ) : null}
                  {d.url && (
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {isAr ? "عرض" : "View"}
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function BranchesCard({ branches, isAr }: { branches: PartnerBranch[]; isAr: boolean }) {
  return (
    <SectionCard icon={MapPin} title={isAr ? "الفروع" : "Branches"} count={branches.length}>
      {branches.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{isAr ? "لا توجد فروع مسجّلة." : "No branches registered."}</p>
      ) : (
        <ul className="divide-y divide-border">
          {branches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {(isAr ? b.nameAr : b.nameEn) || b.nameEn || b.nameAr || "—"}
                  {b.emergency24h && (
                    <span className="inline-flex items-center gap-1 text-xs font-normal text-destructive">
                      <Siren aria-hidden className="size-3" />
                      {isAr ? "طوارئ ٢٤ ساعة" : "24h"}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{[b.city, b.addressLine].filter(Boolean).join(" · ") || "—"}</p>
              </div>
              <div className="flex items-center gap-3">
                {b.phone && <span className="text-xs text-muted-foreground" dir="ltr">{b.phone}</span>}
                {b.status && <Badge variant={partnerStatusMeta(b.status).variant}>{isAr ? partnerStatusMeta(b.status).ar : partnerStatusMeta(b.status).en}</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function StaffCard({ staff, isAr }: { staff: PartnerStaff[]; isAr: boolean }) {
  const roleLabel = (role?: string | null) => {
    if (!role) return "—";
    const MAP: Record<string, { ar: string; en: string }> = {
      OWNER: { ar: "مالك", en: "Owner" },
      ADMIN: { ar: "مدير", en: "Admin" },
      MANAGER: { ar: "مدير فرع", en: "Manager" },
      VET: { ar: "طبيب بيطري", en: "Veterinarian" },
      NURSE: { ar: "ممرض", en: "Nurse" },
      RECEPTION: { ar: "استقبال", en: "Reception" },
    };
    const hit = MAP[role];
    return hit ? (isAr ? hit.ar : hit.en) : titleCase(role);
  };

  return (
    <SectionCard icon={Users} title={isAr ? "الفريق" : "Staff"} count={staff.length}>
      {staff.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{isAr ? "لا يوجد أعضاء فريق." : "No staff members."}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="py-2 text-start font-medium">{isAr ? "الاسم" : "Name"}</th>
                <th scope="col" className="py-2 text-start font-medium">{isAr ? "الدور" : "Role"}</th>
                <th scope="col" className="py-2 text-start font-medium">{isAr ? "الترخيص" : "Licence"}</th>
                <th scope="col" className="py-2 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {staff.map((m) => (
                <tr key={m.id}>
                  <td className="py-2.5">
                    <p className="font-medium">{m.name || "—"}</p>
                    {m.email && <p className="text-xs text-muted-foreground" dir="ltr">{m.email}</p>}
                  </td>
                  <td className="py-2.5">{roleLabel(m.role)}</td>
                  <td className="py-2.5 text-muted-foreground" dir="ltr">{m.licenceNo || "—"}</td>
                  <td className="py-2.5">
                    {m.status ? (
                      <Badge variant={partnerStatusMeta(m.status).variant}>
                        {isAr ? partnerStatusMeta(m.status).ar : partnerStatusMeta(m.status).en}
                      </Badge>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

/**
 * The record-access audit — Moracat's side of the owner's ledger.
 * Emergency reads are marked, because a clinic that break-glasses often is a
 * clinic worth a conversation.
 */
function AccessAuditCard({ orgId, isAr }: { orgId: string; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const [page, setPage] = React.useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-vet-org-access-log", user?.id, orgId, page],
    queryFn: () => authedFetch<AuditResponse>(`/admin/vet/orgs/${orgId}/access-log?page=${page}`),
    enabled: !!user?.isStaff && !!orgId,
  });

  return (
    <SectionCard icon={Eye} title={isAr ? "سجل الاطلاع على السجلات" : "Record access audit"} count={data?.pagination.total}>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
        </div>
      ) : isError ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {isAr ? "تعذّر تحميل سجل الاطلاع." : "Couldn't load the access log."}
        </p>
      ) : !data || data.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {isAr ? "لم تفتح هذه العيادة أي سجل بعد." : "This clinic hasn't opened any records yet."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 text-start font-medium">{isAr ? "الموظف" : "Staff"}</th>
                  <th scope="col" className="py-2 text-start font-medium">{isAr ? "القط" : "Cat"}</th>
                  <th scope="col" className="py-2 text-start font-medium">{isAr ? "المستوى" : "Tier"}</th>
                  <th scope="col" className="py-2 text-start font-medium">{isAr ? "الوقت" : "When"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((r) => (
                  <tr key={r.id} className={cn(r.emergency && "bg-destructive/5")}>
                    <td className="py-2.5 font-medium">{r.staffName || "—"}</td>
                    <td className="py-2.5">
                      <p>{r.catName || "—"}</p>
                      {r.catIdNumber && <p className="text-xs text-muted-foreground" dir="ltr">{r.catIdNumber}</p>}
                    </td>
                    <td className="py-2.5">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={r.tier === "T2" ? "warning" : "info"}>
                          {r.tier === "T1" || r.tier === "T2" ? tierLabel(r.tier, isAr) : r.tier}
                        </Badge>
                        {r.emergency && (
                          <Badge variant="destructive" className="gap-1">
                            <Siren aria-hidden className="size-3" />
                            {isAr ? "طارئ" : "Emergency"}
                          </Badge>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      <time dateTime={r.at}>{formatDateTime(r.at, isAr ? "ar" : "en")}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={setPage}
            isAr={isAr}
            className="mt-3"
          />
        </>
      )}
    </SectionCard>
  );
}
