"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { Card, Badge, Button, DataTable, useToast, type Column } from "@moraqat/ui";
import { IlloCan } from "@/components/illustrations";
import { useAuth } from "@/lib/auth";
import { Field, SelectField } from "@/components/field";

interface ProductRow {
  id: string; sku: string; type: string; nameEn: string; price: number;
  costPrice: number | null; brand: string | null; isActive: boolean; stock: number;
}
interface ProductsResp { items: ProductRow[]; pagination: { total: number } }

const TYPES = ["DRY_FOOD", "WET_FOOD", "TREATS", "LITTER", "TOY", "SUPPLEMENT", "HEALTHCARE", "ACCESSORY", "OTHER"];

export default function AdminProducts() {
  const { authedFetch, user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-products", user?.id],
    queryFn: () => authedFetch<ProductsResp>("/admin/products"),
    enabled: !!user?.isStaff,
  });

  const toggle = useMutation({
    mutationFn: (id: string) => authedFetch<ProductRow>(`/admin/products/${id}/toggle`, { method: "PATCH", body: "{}" }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: p.isActive ? "Product shown" : "Product hidden", description: p.nameEn, variant: "success" });
    },
    onError: (e) => toast({ title: "Action failed", description: e.message, variant: "error" }),
  });
  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch<ProductRow>("/admin/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setShowForm(false);
      toast({ title: "Product created", description: p.nameEn, variant: "success" });
    },
    onError: (e) => toast({ title: "Couldn't create product", description: e.message, variant: "error" }),
  });

  const columns: Column<ProductRow>[] = [
    {
      key: "nameEn", header: "Product", sortable: true,
      render: (p) => (
        <div><p className="font-medium">{p.nameEn}</p><p className="text-xs text-muted-foreground">{p.sku}{p.brand ? ` · ${p.brand}` : ""}</p></div>
      ),
    },
    { key: "type", header: "Type", sortable: true, render: (p) => <span className="text-muted-foreground">{label(p.type)}</span> },
    { key: "price", header: "Price", sortable: true, align: "end", sortValue: (p) => p.price, render: (p) => <span className="font-semibold tabular">{p.price} SAR</span> },
    { key: "stock", header: "Stock", sortable: true, align: "center", sortValue: (p) => p.stock, render: (p) => <span className="tabular">{p.stock}</span> },
    { key: "isActive", header: "Status", sortable: true, sortValue: (p) => (p.isActive ? 1 : 0), render: (p) => <Badge dot variant={p.isActive ? "success" : "secondary"}>{p.isActive ? "Active" : "Hidden"}</Badge> },
    {
      key: "action", header: "", align: "end",
      render: (p) => <Button variant="ghost" size="sm" onClick={() => toggle.mutate(p.id)} disabled={toggle.isPending}>{p.isActive ? "Hide" : "Show"}</Button>,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">{data ? `${data.pagination.total} total` : "—"}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> New product</Button>
      </div>

      {showForm && <ProductForm onSubmit={(b) => create.mutate(b)} pending={create.isPending} onClose={() => setShowForm(false)} />}

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(p) => p.id}
        loading={isLoading}
        emptyState={<div className="flex flex-col items-center gap-3"><IlloCan tone="pink" className="h-10 w-auto opacity-80" />No products yet</div>}
      />
    </div>
  );
}

function ProductForm({ onSubmit, pending, onClose }: { onSubmit: (b: Record<string, unknown>) => void; pending: boolean; onClose: () => void }) {
  const [f, setF] = React.useState({ nameEn: "", nameAr: "", sku: "", type: "TOY", price: "" });
  const slug = f.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product";
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display font-semibold">New product</h3>
        <button onClick={onClose} aria-label="close"><X className="size-4 text-muted-foreground" /></button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit({ nameEn: f.nameEn, nameAr: f.nameAr || f.nameEn, sku: f.sku, slug: `${slug}-${Date.now().toString(36)}`, type: f.type, price: Number(f.price) }); }} className="grid gap-4 sm:grid-cols-2">
        <Field label="Name (EN)" required value={f.nameEn} onChange={(v) => setF({ ...f, nameEn: v })} />
        <Field label="Name (AR)" value={f.nameAr} onChange={(v) => setF({ ...f, nameAr: v })} />
        <Field label="SKU" required value={f.sku} onChange={(v) => setF({ ...f, sku: v })} placeholder="MRQ-TOY-001" />
        <SelectField label="Type" value={f.type} onChange={(v) => setF({ ...f, type: v })} options={TYPES.map((t) => ({ value: t, label: label(t) }))} />
        <Field label="Price (SAR)" type="number" required value={f.price} onChange={(v) => setF({ ...f, price: v })} />
        <div className="sm:col-span-2">
          <Button type="submit" loading={pending} disabled={!f.nameEn || !f.sku || !f.price}>Create product</Button>
        </div>
      </form>
    </Card>
  );
}

const label = (s: string) => s.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ");
