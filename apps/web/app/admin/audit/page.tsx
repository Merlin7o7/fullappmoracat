"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ScrollText } from "lucide-react";
import { Badge, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Pagination } from "@/app/admin/_components/pagination";
import { fmtDateTime } from "@/app/admin/_components/i18n";

interface AuditRow {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
  user: { email: string; firstName: string | null; lastName: string | null } | null;
}
interface AuditResp {
  items: AuditRow[];
  actions: string[];
  pagination: { total: number; page: number; totalPages: number };
}

/** Colour the action by its domain prefix so the log scans at a glance. */
function actionTone(action: string): string {
  if (action.includes("delete") || action.includes("hide") || action.includes("suspend")) return "text-destructive";
  if (action.includes("refund") || action.includes("report")) return "text-[hsl(var(--warning))]";
  return "text-foreground";
}

export default function AdminAuditPage() {
  const { authedFetch } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [page, setPage] = React.useState(1);
  const [action, setAction] = React.useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-audit", page, action],
    queryFn: () => authedFetch<AuditResp>(`/admin/audit?page=${page}${action ? `&action=${encodeURIComponent(action)}` : ""}`),
  });

  const rows = data?.items ?? [];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{isAr ? "سجل التدقيق" : "Audit log"}</h1>
          <p className="text-sm text-muted-foreground">
            {isAr ? "كل إجراء حسّاس مُسجّل — للمساءلة والامتثال." : "Every sensitive action, recorded — for accountability & compliance."}
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{isAr ? "الإجراء" : "Action"}</span>
          <select
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(1); }}
            className="h-9 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{isAr ? "الكل" : "All"}</option>
            {(data?.actions ?? []).map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{isAr ? "تعذّر التحميل. قد لا تملك صلاحية سجل التدقيق." : "Couldn’t load. You may not have audit permission."}</p>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed py-16 text-center">
          <ScrollText className="size-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">{isAr ? "لا سجلات." : "No entries."}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[46rem] text-sm">
              <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{isAr ? "الوقت" : "When"}</th>
                  <th className="p-3 text-start">{isAr ? "المنفّذ" : "Actor"}</th>
                  <th className="p-3 text-start">{isAr ? "الإجراء" : "Action"}</th>
                  <th className="p-3 text-start">{isAr ? "الكيان" : "Entity"}</th>
                  <th className="p-3 text-start">IP</th>
                  <th className="p-3 text-start">{isAr ? "تفاصيل" : "Details"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="align-top hover:bg-muted/30">
                    <td className="whitespace-nowrap p-3 text-muted-foreground">{fmtDateTime(r.createdAt, isAr)}</td>
                    <td className="p-3" dir="ltr">{r.user?.email ?? <span className="text-muted-foreground">system</span>}</td>
                    <td className={cn("whitespace-nowrap p-3 font-mono text-xs font-medium", actionTone(r.action))}>{r.action}</td>
                    <td className="p-3 text-muted-foreground">
                      {r.entityType ? <><Badge variant="secondary">{r.entityType}</Badge>{r.entityId && <span className="ms-1 font-mono text-[10px]">{r.entityId.slice(0, 8)}</span>}</> : "—"}
                    </td>
                    <td className="p-3 font-mono text-xs text-muted-foreground" dir="ltr">{r.ipAddress ?? "—"}</td>
                    <td className="max-w-[16rem] p-3">
                      {r.metadata ? <code className="block truncate text-xs text-muted-foreground" title={JSON.stringify(r.metadata)}>{JSON.stringify(r.metadata)}</code> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data && (
            <div className="mt-4">
              <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} isAr={isAr} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
