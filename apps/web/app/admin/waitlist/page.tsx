"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BellRing, Download } from "lucide-react";
import { Button, useToast } from "@moraqat/ui";
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

export default function AdminWaitlistPage() {
  const { authedFetch, authedBlob } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const isAr = locale === "ar";
  const [page, setPage] = React.useState(1);
  const [exporting, setExporting] = React.useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-waitlist", page],
    queryFn: () => authedFetch<WaitlistResp>(`/admin/waitlist?page=${page}`),
  });

  const entries = data?.items ?? [];

  // Export the ENTIRE waitlist from the server (formula-safe, UTF-8 BOM), not
  // just the current page — the launch invite list must be complete.
  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await authedBlob("/admin/waitlist/export");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "moracat-waitlist.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      toast({ title: isAr ? "تعذّر التصدير. حاول مرة أخرى." : "Export failed. Please try again." });
    } finally {
      setExporting(false);
    }
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
        {(data?.pagination.total ?? 0) > 0 && (
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={exporting}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            {isAr ? "تصدير الكل CSV" : "Export all CSV"}
          </Button>
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
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[36rem] text-sm">
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
