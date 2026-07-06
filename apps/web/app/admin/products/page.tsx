"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Card, Badge, Button, DataTable, useToast, type Column } from "@moraqat/ui";
import { IlloCan } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field, SelectField } from "@/components/field";
import { Pagination } from "@/app/admin/_components/pagination";
import { titleCase, fmtNum } from "@/app/admin/_components/i18n";
import { QueryError } from "@/components/query-error";

interface ProductRow {
  id: string; sku: string; type: string; nameEn: string; price: number;
  costPrice: number | null; brand: string | null; isActive: boolean; stock: number;
}
interface ProductsResp { items: ProductRow[]; pagination: { total: number; page: number; totalPages: number } }

const TYPES = ["DRY_FOOD", "WET_FOOD", "TREATS", "LITTER", "TOY", "SUPPLEMENT", "HEALTHCARE", "ACCESSORY", "OTHER"];

export default function AdminProducts() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["admin-products", user?.id, page],
    queryFn: () => authedFetch<ProductsResp>(`/admin/products?page=${page}`),
    enabled: !!user?.isStaff,
  });

  const toggle = useMutation({
    mutationFn: (id: string) => authedFetch<ProductRow>(`/admin/products/${id}/toggle`, { method: "PATCH", body: "{}" }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: p.isActive ? (isAr ? "تم إظهار المنتج" : "Product shown") : (isAr ? "تم إخفاء المنتج" : "Product hidden"), description: p.nameEn, variant: "success" });
    },
    onError: (e) => toast({ title: isAr ? "فشل الإجراء" : "Action failed", description: e.message, variant: "error" }),
  });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch<ProductRow>("/admin/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setShowForm(false);
      toast({ title: isAr ? "تم إنشاء المنتج" : "Product created", description: p.nameEn, variant: "success" });
    },
    onError: (e) => toast({ title: isAr ? "تعذّر إنشاء المنتج" : "Couldn’t create product", description: e.message, variant: "error" }),
  });

  const columns: Column<ProductRow>[] = [
    {
      key: "nameEn", header: isAr ? "المنتج" : "Product", sortable: true,
      render: (p) => (
        <div><p className="font-medium">{p.nameEn}</p><p className="text-xs text-muted-foreground">{p.sku}{p.brand ? ` · ${p.brand}` : ""}</p></div>
      ),
    },
    { key: "type", header: isAr ? "النوع" : "Type", sortable: true, render: (p) => <span className="text-muted-foreground">{titleCase(p.type)}</span> },
    { key: "price", header: isAr ? "السعر" : "Price", sortable: true, align: "end", sortValue: (p) => p.price, render: (p) => <span className="font-semibold tabular">{fmtNum(p.price, isAr)} {isAr ? "ر.س" : "SAR"}</span> },
    { key: "stock", header: isAr ? "المخزون" : "Stock", sortable: true, align: "center", sortValue: (p) => p.stock, render: (p) => <span className="tabular">{fmtNum(p.stock, isAr)}</span> },
    { key: "isActive", header: isAr ? "الحالة" : "Status", sortable: true, sortValue: (p) => (p.isActive ? 1 : 0), render: (p) => <Badge dot variant={p.isActive ? "success" : "secondary"}>{p.isActive ? (isAr ? "نشط" : "Active") : (isAr ? "مخفي" : "Hidden")}</Badge> },
    {
      key: "action", header: "", align: "end",
      render: (p) => <Button variant="ghost" size="sm" onClick={() => toggle.mutate(p.id)} disabled={toggle.isPending}>{p.isActive ? (isAr ? "إخفاء" : "Hide") : (isAr ? "إظهار" : "Show")}</Button>,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "المنتجات" : "Products"}</h1>
          <p className="text-sm text-muted-foreground">
            {data ? (isAr ? `${data.pagination.total.toLocaleString("ar-SA")} إجمالاً` : `${data.pagination.total} total`) : "—"}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> {isAr ? "منتج جديد" : "New product"}</Button>
      </div>

      {showForm && <ProductForm isAr={isAr} onSubmit={(b) => create.mutate(b)} pending={create.isPending} onClose={() => setShowForm(false)} />}

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
      ) : (
        <>
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            rowKey={(p) => p.id}
            loading={isLoading}
            emptyState={<div className="flex flex-col items-center gap-3"><IlloCan tone="pink" className="h-10 w-auto opacity-80" />{isAr ? "لا توجد منتجات بعد" : "No products yet"}</div>}
          />
          {data && (
            <Pagination page={data.pagination.page} totalPages={data.pagination.totalPages} onPageChange={setPage} isAr={isAr} />
          )}
        </>
      )}
    </div>
  );
}

function ProductForm({ onSubmit, pending, onClose, isAr }: { onSubmit: (b: Record<string, unknown>) => void; pending: boolean; onClose: () => void; isAr: boolean }) {
  const [f, setF] = React.useState({ nameEn: "", nameAr: "", sku: "", type: "TOY", price: "" });
  const slug = f.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display font-semibold">{isAr ? "منتج جديد" : "New product"}</h3>
        <button onClick={onClose} aria-label={isAr ? "إغلاق" : "close"}><X className="size-4 text-muted-foreground" /></button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ nameEn: f.nameEn, nameAr: f.nameAr || f.nameEn, sku: f.sku, slug: `${slug}-${Date.now().toString(36)}`, type: f.type, price: Number(f.price) }); }} className="grid gap-4 sm:grid-cols-2">
        <Field label={isAr ? "الاسم (إنجليزي)" : "Name (EN)"} required value={f.nameEn} onChange={(v) => setF({ ...f, nameEn: v })} />
        <Field label={isAr ? "الاسم (عربي)" : "Name (AR)"} value={f.nameAr} onChange={(v) => setF({ ...f, nameAr: v })} />
        <Field label={isAr ? "رمز المنتج" : "SKU"} required value={f.sku} onChange={(v) => setF({ ...f, sku: v })} placeholder="MRQ-TOY-001" />
        <SelectField label={isAr ? "النوع" : "Type"} value={f.type} onChange={(v) => setF({ ...f, type: v })} options={TYPES.map((t) => ({ value: t, label: titleCase(t) }))} />
        <Field label={isAr ? "السعر (ر.س)" : "Price (SAR)"} type="number" required value={f.price} onChange={(v) => setF({ ...f, price: v })} />
        <div className="sm:col-span-2">
          <Button type="submit" loading={pending} disabled={!f.nameEn || !f.sku || !f.price}>{isAr ? "إنشاء المنتج" : "Create product"}</Button>
        </div>
      </form>
    </Card>
  );
}
