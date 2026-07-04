"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Card, Badge, Skeleton } from "@moraqat/ui";
import { IlloMouse } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";

interface CustomerRow {
  id: string; email: string; name: string; phone: string | null;
  status: string; orders: number; subscriptions: number; cats: number; createdAt: string;
}
interface CustomersResp { items: CustomerRow[]; pagination: { total: number; page: number; totalPages: number } }

export default function AdminCustomers() {
  const { authedFetch, user } = useAuth();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers", user?.id, debounced],
    queryFn: () => authedFetch<CustomersResp>(`/admin/customers${debounced ? `?search=${encodeURIComponent(debounced)}` : ""}`),
    enabled: !!user?.isStaff,
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.pagination.total} total` : "—"}</p>
        </div>
        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone…"
            className="h-10 w-72 rounded-full border border-input bg-background ps-9 pe-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-center font-medium">Orders</th>
                <th className="px-4 py-3 text-center font-medium">Subs</th>
                <th className="px-4 py-3 text-center font-medium">Cats</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
                ))
              ) : data && data.items.length > 0 ? (
                data.items.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">{c.email}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                    <td className="px-4 py-3"><Badge variant={c.status === "ACTIVE" ? "success" : "secondary"}>{c.status}</Badge></td>
                    <td className="px-4 py-3 text-center">{c.orders}</td>
                    <td className="px-4 py-3 text-center">{c.subscriptions}</td>
                    <td className="px-4 py-3 text-center">{c.cats}</td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={6} className="px-4 py-14 text-center text-muted-foreground"><IlloMouse tone="sage" className="mx-auto mb-3 h-8 w-auto opacity-80" />No customers found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
