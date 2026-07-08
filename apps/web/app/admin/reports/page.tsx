"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Flag, ShieldAlert, EyeOff, Check, ExternalLink } from "lucide-react";
import { Button, Badge, Avatar, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Pagination } from "@/app/admin/_components/pagination";
import { ConfirmDialog } from "@/app/admin/_components/confirm";
import { fmtDateTime } from "@/app/admin/_components/i18n";

type Status = "PENDING" | "RESOLVED" | "DISMISSED";

interface Report {
  id: string;
  reason: string;
  detail: string | null;
  status: Status;
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
  catReportCount: number;
  reporter: { email: string } | null;
  cat: { id: string; name: string; publicSlug: string | null; photoUrl: string | null; isPublic: boolean; hiddenAt: string | null; likeCount: number };
}
interface ReportsResp {
  items: Report[];
  pendingTotal: number;
  pagination: { total: number; page: number; totalPages: number };
}

const REASON: Record<string, { en: string; ar: string }> = {
  INAPPROPRIATE: { en: "Inappropriate", ar: "غير لائق" },
  SPAM: { en: "Spam", ar: "إزعاج" },
  FAKE: { en: "Fake", ar: "مزيّف" },
  HARASSMENT: { en: "Harassment", ar: "تحرّش" },
  OTHER: { en: "Other", ar: "أخرى" },
};

export default function AdminReportsPage() {
  const { authedFetch } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [status, setStatus] = React.useState<Status>("PENDING");
  const [page, setPage] = React.useState(1);
  const [hiding, setHiding] = React.useState<Report | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-reports", status, page],
    queryFn: () => authedFetch<ReportsResp>(`/admin/community/reports?status=${status}&page=${page}`),
  });

  const resolve = useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: "hide" | "dismiss"; note?: string }) =>
      authedFetch(`/admin/community/reports/${id}/resolve`, { method: "PATCH", body: JSON.stringify({ action, note }) }),
    onSuccess: (_r, v) => {
      toast({ title: v.action === "hide" ? (isAr ? "تم إخفاء القط" : "Cat hidden") : (isAr ? "تم تجاهل البلاغ" : "Report dismissed"), variant: "success" });
      setHiding(null);
      qc.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: () => toast({ title: isAr ? "تعذّر تنفيذ الإجراء." : "Action failed.", variant: "error" }),
  });

  const rows = data?.items ?? [];
  const tabs: { key: Status; en: string; ar: string }[] = [
    { key: "PENDING", en: "Pending", ar: "قيد المراجعة" },
    { key: "RESOLVED", en: "Resolved", ar: "مُعالجة" },
    { key: "DISMISSED", en: "Dismissed", ar: "متجاهلة" },
  ];

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold">{isAr ? "بلاغات المجتمع" : "Reported content"}</h1>
        <p className="text-sm text-muted-foreground">
          {isAr ? "طابور مراجعة القطط المُبلّغ عنها — الأقدم أولاً." : "Moderation queue for reported cats — oldest first."}
        </p>
      </div>

      <div className="mb-4 flex gap-1 rounded-xl border border-border p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => { setStatus(t.key); setPage(1); }}
            className={cn(
              "relative flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              status === t.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {isAr ? t.ar : t.en}
            {t.key === "PENDING" && (data?.pendingTotal ?? 0) > 0 && (
              <Badge variant="destructive" className="ms-2">{data!.pendingTotal}</Badge>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{isAr ? "تعذّر التحميل." : "Couldn’t load."}</p>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed py-16 text-center">
          <Flag className="size-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">
            {status === "PENDING" ? (isAr ? "لا بلاغات معلّقة — كل شيء هادئ ✨" : "No pending reports — all clear ✨") : (isAr ? "لا شيء هنا." : "Nothing here.")}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start gap-4 rounded-2xl border border-border bg-card p-4">
                <Avatar size="lg" name={r.cat.name} src={r.cat.photoUrl} className="shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.cat.name}</span>
                    <Badge variant="warning">{isAr ? REASON[r.reason]?.ar : REASON[r.reason]?.en}</Badge>
                    {r.catReportCount > 1 && <Badge variant="destructive">{r.catReportCount}× {isAr ? "بلاغ" : "reports"}</Badge>}
                    {r.cat.hiddenAt && <Badge variant="secondary"><EyeOff className="size-3" /> {isAr ? "مخفي" : "hidden"}</Badge>}
                    {r.cat.publicSlug && (
                      <a href={`/community/${r.cat.publicSlug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        {isAr ? "عرض" : "View"} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                  {r.detail && <p className="mt-1 text-sm text-muted-foreground">“{r.detail}”</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.reporter?.email ? <span dir="ltr">{r.reporter.email}</span> : (isAr ? "مجهول" : "anonymous")}
                    {" · "}{fmtDateTime(r.createdAt, isAr)}
                    {r.resolution && <> · {r.resolution}</>}
                  </p>
                </div>
                {status === "PENDING" && (
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => resolve.mutate({ id: r.id, action: "dismiss" })} disabled={resolve.isPending}>
                      <Check className="size-4" /> {isAr ? "تجاهل" : "Dismiss"}
                    </Button>
                    <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10" onClick={() => setHiding(r)}>
                      <ShieldAlert className="size-4" /> {isAr ? "إخفاء القط" : "Hide cat"}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {data && (
            <div className="mt-4">
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} isAr={isAr} />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!hiding}
        onClose={() => setHiding(null)}
        onConfirm={(reason) => hiding && resolve.mutate({ id: hiding.id, action: "hide", note: reason })}
        title={isAr ? `إخفاء ${hiding?.cat.name}؟` : `Hide ${hiding?.cat.name}?`}
        description={isAr ? "سيُزال القط من المجتمع، وسنُعلم المالك. تُحلّ كل البلاغات ضد هذا القط." : "The cat is removed from the community and the owner is notified. All reports against this cat are resolved."}
        confirmLabel={isAr ? "إخفاء القط" : "Hide cat"}
        destructive
        withReason
        reasonLabel={isAr ? "السبب (يُرسل للمالك)" : "Reason (shared with owner)"}
        pending={resolve.isPending}
        isAr={isAr}
      />
    </div>
  );
}
