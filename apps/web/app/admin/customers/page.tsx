"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Card, Badge, Skeleton } from "@moraqat/ui";
import { IlloMouse } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Pagination } from "@/app/admin/_components/pagination";
import { statusMeta } from "@/app/admin/_components/i18n";

interface CustomerRow {
  id: string; email: string; name: string; phone: string | null;
  status: string; orders: number; subscriptions: number; cats: number; createdAt: string;
}
interface CustomersResp { items: CustomerRow[]; pagination: { total: number; page: number; totalPages: number } }

export default function AdminCustomers() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever the search term changes.
  React.useEffect(() => { setPage(1); }, [debounced]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-customers", user?.id, debounced, page],
    queryFn: () => {
      const qs = new URLSearchParams({ page: String(page) });
      if (debounced) qs.set("search", debounced);
      return authedFetch<CustomersResp>(`/admin/customers?${qs.toString()}`);
    },
    enabled: !!user?.isStaff,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "العملاء" : "Customers"}</h1>
          <p className="text-sm text-muted-foreground">
            {data ? (isAr ? `${data.pagination.total.toLocaleString("ar-SA")} إجمالاً` : `${data.pagination.total} total`) : "—"}
          </p>
        </div>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={isAr ? "بحث بالاسم أو البريد أو الجوال…" : "Search name, email, phone…"}
            className="h-10 w-72 rounded-full border border-input bg-background ps-9 pe-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-start text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "العميل" : "Customer"}</th>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "الجوال" : "Phone"}</th>
                <th className="px-4 py-3 text-start font-medium">{isAr ? "الحالة" : "Status"}</th>
                <th className="px-4 py-3 text-center font-medium">{isAr ? "الطلبات" : "Orders"}</th>
                <th className="px-4 py-3 text-center font-medium">{isAr ? "الاشتراكات" : "Subs"}</th>
                <th className="px-4 py-3 text-center font-medium">{isAr ? "القطط" : "Cats"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : isError ? (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-muted-foreground">{isAr ? "تعذّر التحميل. حاول التحديث." : "Couldn’t load. Try refreshing."}</td></tr>
              ) : data && data.items.length > 0 ? (
                data.items.map((c) => {
                  const s = statusMeta(c.status);
                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/admin/customers/${c.id}`)}
                      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/admin/customers/${c.id}`); }}
                      tabIndex={0}
                      role="link"
                      className="cursor-pointer outline-none hover:bg-muted/30 focus-visible:bg-muted/40"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{c.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground" dir="ltr">{c.phone || "—"}</td>
                      <td className="px-4 py-3"><Badge variant={s.variant}>{isAr ? s.ar : s.en}</Badge></td>
                      <td className="px-4 py-3 text-center tabular-nums">{c.orders}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{c.subscriptions}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{c.cats}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-muted-foreground"><IlloMouse tone="sage" className="mx-auto mb-3 h-8 w-auto opacity-80" />{isAr ? "لا يوجد عملاء" : "No customers found"}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {data && (
        <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} isAr={isAr} />
      )}
    </div>
  );
}
