"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, GitMerge } from "lucide-react";
import { Card, Badge, Skeleton, Button, Dialog, useToast } from "@moraqat/ui";
import { IlloMouse } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { friendlyError } from "@/lib/errors";
import { Pagination } from "@/app/admin/_components/pagination";
import { fmtDate } from "@/app/admin/_components/i18n";
import { Field } from "@/components/field";

/**
 * The cat CRM (MRC-PROD-001 T4): find any cat by Cat ID, microchip, owner
 * phone/email or name; see origin and claim state; fold a twin into its
 * survivor. Clinic claims are the usual source of twins, so merge lives here.
 */

interface CatRow {
  id: string; name: string; catIdNumber: string | null; catNumber: number; microchipNo: string | null; photoUrl: string | null;
  origin: "OWNER" | "CLINIC" | "ADMIN_IMPORT"; claimStatus: "CLAIMED" | "PENDING_CLAIM"; status: string; isDemo: boolean;
  createdAt: string; claimedAt: string | null;
  owner: { id: string; email: string; name: string; phone: string | null } | null;
  records: { vaccinations: number; clinicalEntries: number; visits: number };
}
interface CatsResp { items: CatRow[]; pagination: { total: number; page: number; totalPages: number } }

export default function AdminCats() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [merging, setMerging] = React.useState<CatRow | null>(null);
  const [targetId, setTargetId] = React.useState("");

  React.useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  React.useEffect(() => { setPage(1); }, [debounced]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-cats", user?.id, debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page) });
      if (debounced) qs.set("q", debounced);
      return authedFetch<CatsResp>(`/admin/cats?${qs.toString()}`);
    },
    enabled: !!user?.isStaff,
  });

  const merge = useMutation({
    mutationFn: () => authedFetch(`/admin/cats/${merging!.id}/merge`, { method: "POST", body: JSON.stringify({ targetId: targetId.trim() }) }),
    onSuccess: () => {
      toast({ title: isAr ? "تم الدمج" : "Merged", variant: "success" });
      setMerging(null); setTargetId("");
      void qc.invalidateQueries({ queryKey: ["admin-cats"] });
    },
    onError: (err) => { const e = friendlyError(err, isAr); toast({ title: e.title, description: e.message, variant: "error" }); },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "القطط" : "Cats"}</h1>
          <p className="text-sm text-muted-foreground">{data ? (isAr ? `${data.pagination.total.toLocaleString("ar-SA")} إجمالاً` : `${data.pagination.total} total`) : "—"}</p>
        </div>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAr ? "رقم الهوية، الشريحة، الجوال، البريد أو الاسم…" : "Cat ID, microchip, phone, email or name…"}
            className="h-10 w-80 rounded-full border border-input bg-background ps-9 pe-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "القط" : "Cat"}</th>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "المالك" : "Owner"}</th>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "المصدر" : "Origin"}</th>
                <th className="px-4 py-3 text-center font-medium">{isAr ? "السجلات" : "Records"}</th>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "أُنشئ" : "Created"}</th>
                <th className="px-4 py-3 text-end font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
              ) : isError ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">{isAr ? "تعذّر التحميل" : "Couldn't load"}</td></tr>
              ) : !data?.items.length ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground"><IlloMouse tone="sage" className="mx-auto mb-2 h-10 w-auto" />{isAr ? "لا نتائج" : "No results"}</td></tr>
              ) : data.items.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{c.name} {c.isDemo && <Badge variant="outline" className="ms-1 text-[10px]">demo</Badge>}</p>
                    <p className="font-mono text-xs text-muted-foreground" dir="ltr">{c.catIdNumber ?? "—"} · #{c.catNumber}{c.microchipNo ? ` · ${c.microchipNo}` : ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    {c.owner ? (<><p>{c.owner.name}</p><p className="text-xs text-muted-foreground" dir="ltr">{c.owner.phone ?? c.owner.email}</p></>) : <Badge variant="warning">{isAr ? "بانتظار الاستلام" : "Pending claim"}</Badge>}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary">{c.origin === "CLINIC" ? (isAr ? "عيادة" : "Clinic") : c.origin === "OWNER" ? (isAr ? "المالك" : "Owner") : "Import"}</Badge>
                    {c.status !== "ACTIVE" && <p className="mt-1 text-xs text-muted-foreground">{c.status}</p>}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-muted-foreground">{c.records.vaccinations} · {c.records.clinicalEntries} · {c.records.visits}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(c.createdAt, isAr)}</td>
                  <td className="px-4 py-3 text-end">
                    {c.claimStatus === "CLAIMED" && c.status === "ACTIVE" && (
                      <Button size="sm" variant="ghost" onClick={() => { setMerging(c); setTargetId(""); }}><GitMerge className="size-4" /> {isAr ? "دمج" : "Merge"}</Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data && data.pagination.totalPages > 1 && (
          <div className="border-t border-border p-3"><Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} isAr={isAr} /></div>
        )}
      </Card>

      <Dialog open={!!merging} onClose={() => setMerging(null)} title={isAr ? `دمج ${merging?.name ?? ""} في قط آخر` : `Merge ${merging?.name ?? ""} into another cat`}>
        <div className="space-y-3 pt-1">
          <p className="text-sm text-muted-foreground">
            {isAr
              ? "تنتقل كل السجلات إلى القط الهدف، ويُؤرشف هذا القط مع مؤشر إلى مكانه. يجب أن يكون القطان لنفس المالك."
              : "Every record moves to the target cat; this one is archived with a pointer to where it went. Both cats must belong to the same owner."}
          </p>
          <Field label={isAr ? "معرّف القط الهدف (id)" : "Target cat id"} value={targetId} onChange={setTargetId} placeholder="clx…" />
          <div className="flex gap-2">
            <Button loading={merge.isPending} disabled={!targetId.trim() || targetId.trim() === merging?.id} onClick={() => merge.mutate()}>{isAr ? "ادمج" : "Merge"}</Button>
            <Button variant="ghost" onClick={() => setMerging(null)}>{isAr ? "إلغاء" : "Cancel"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
