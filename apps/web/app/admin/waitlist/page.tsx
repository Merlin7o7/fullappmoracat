"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BellRing, Download } from "lucide-react";
import { Button } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Pagination } from "@/app/admin/_components/pagination";
import { fmtDate } from "@/app/admin/_components/i18n";

interface WaitlistEntry {
  id: string;
  email: string;
  catName: string | null;
  planInterest: string | null;
  source: string | null;
  createdAt: string;
}

interface WaitlistResp {
  items: WaitlistEntry[];
  pagination: { total: number; page: number; totalPages: number };
}

/**
 * Quote-escape a CSV field and neutralize spreadsheet formula injection.
 * Every field is wrapped in double quotes with internal quotes doubled; a
 * leading =, +, -, @ (or tab/CR) is prefixed with a single quote so Excel /
 * Sheets treat it as text, not a formula.
 */
function csvCell(value: string | null | undefined): string {
  const raw = value ?? "";
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export default function AdminWaitlistPage() {
  const { authedFetch } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [page, setPage] = React.useState(1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-waitlist", page],
    queryFn: () => authedFetch<WaitlistResp>(`/admin/waitlist?page=${page}`),
  });

  const entries = data?.items ?? [];

  function exportCsv() {
    const header = ["email", "plan_interest", "cat_name", "source", "joined_at"].map(csvCell).join(",") + "\r\n";
    const rows = entries
      .map((e) => [e.email, e.planInterest, e.catName, e.source, e.createdAt].map(csvCell).join(","))
      .join("\r\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "moracat-waitlist.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{isAr ? "قائمة انتظار العضوية" : "Membership waitlist"}</h1>
          <p className="text-sm text-muted-foreground">
            {data
              ? (isAr ? `${data.pagination.total.toLocaleString("ar-SA")} شخصاً في الانتظار` : `${data.pagination.total} people waiting`)
              : (isAr ? "أشخاص ينتظرون الإطلاق." : "People waiting for launch.")}
          </p>
        </div>
        {entries.length > 0 && (
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-4" /> {isAr ? "تصدير CSV" : "Export CSV"}</Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="py-16 text-center text-sm text-muted-foreground">{isAr ? "تعذّر التحميل. حاول التحديث." : "Couldn’t load. Try refreshing."}</p>
      ) : entries.length === 0 ? (
        <div className="grid place-items-center rounded-2xl border border-dashed py-16 text-center">
          <BellRing className="size-8 text-muted-foreground/40" />
          <p className="mt-2 text-sm text-muted-foreground">{isAr ? "لا يوجد مسجّلون بعد." : "No sign-ups yet."}</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{isAr ? "البريد" : "Email"}</th>
                  <th className="p-3 text-start">{isAr ? "الاهتمام" : "Interest"}</th>
                  <th className="p-3 text-start">{isAr ? "القط" : "Cat"}</th>
                  <th className="p-3 text-start">{isAr ? "المصدر" : "Source"}</th>
                  <th className="p-3 text-start">{isAr ? "تاريخ الانضمام" : "Joined"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    <td className="p-3" dir="ltr">{e.email}</td>
                    <td className="p-3 text-muted-foreground">{e.planInterest ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{e.catName ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{e.source ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{fmtDate(e.createdAt, isAr, { day: "numeric", month: "short", year: "numeric" })}</td>
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
