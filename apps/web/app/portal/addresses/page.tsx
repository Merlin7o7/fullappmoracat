"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Trash2, Loader2, Star, X } from "lucide-react";
import { Card, Badge, Button, Skeleton } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Field, SelectField } from "@/components/field";

interface Address {
  id: string;
  label: string | null;
  recipient: string;
  phone: string;
  street: string;
  district: string | null;
  isDefault: boolean;
  city: { nameEn: string; nameAr: string };
}
interface City { id: string; nameEn: string; nameAr: string }

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export default function AddressesPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const [showForm, setShowForm] = React.useState(false);

  const { data: addresses, isLoading } = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: () => authedFetch<Address[]>("/addresses"),
    enabled: !!user,
  });
  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => (await fetch(`${API}/api/cities`)).json() as Promise<City[]>,
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch("/addresses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["addresses"] }); setShowForm(false); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => authedFetch(`/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{isAr ? "العناوين" : "Addresses"}</h1>
          <p className="text-sm text-muted-foreground">{isAr ? "أماكن توصيل اشتراكك" : "Where your subscription is delivered"}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}><Plus className="size-4" /> {isAr ? "إضافة" : "Add"}</Button>
      </div>

      {showForm && cities && (
        <AddressForm isAr={isAr} cities={cities} pending={create.isPending} error={create.error?.message}
          onClose={() => setShowForm(false)} onSubmit={(b) => create.mutate(b)} />
      )}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : addresses && addresses.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((a) => (
            <Card key={a.id} className="p-5">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-primary" />
                  <span className="font-medium">{a.label || a.recipient}</span>
                </div>
                {a.isDefault && <Badge variant="success"><Star className="size-3" /> {isAr ? "افتراضي" : "Default"}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {a.recipient} · {a.phone}<br />
                {a.street}{a.district ? `, ${a.district}` : ""}<br />
                {isAr ? a.city.nameAr : a.city.nameEn}
              </p>
              <Button variant="ghost" size="sm" className="mt-3 text-destructive" onClick={() => remove.mutate(a.id)} disabled={remove.isPending}>
                <Trash2 className="size-4" /> {isAr ? "حذف" : "Remove"}
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <span className="grid size-14 place-items-center rounded-2xl bg-muted"><MapPin className="size-7 text-muted-foreground" /></span>
          <p className="text-sm text-muted-foreground">{isAr ? "لا توجد عناوين محفوظة" : "No saved addresses"}</p>
        </Card>
      )}
    </div>
  );
}

function AddressForm({ isAr, cities, onSubmit, pending, error, onClose }: {
  isAr: boolean; cities: City[]; onSubmit: (b: Record<string, unknown>) => void; pending: boolean; error?: string; onClose: () => void;
}) {
  const [f, setF] = React.useState({ label: "", recipient: "", phone: "", cityId: cities[0]?.id ?? "", district: "", street: "" });
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display font-semibold">{isAr ? "عنوان جديد" : "New address"}</h3>
        <button onClick={onClose} aria-label="close"><X className="size-4 text-muted-foreground" /></button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(f); }} className="grid gap-4 sm:grid-cols-2">
        <Field label={isAr ? "التسمية" : "Label"} value={f.label} onChange={(v) => setF({ ...f, label: v })} placeholder={isAr ? "المنزل" : "Home"} />
        <Field label={isAr ? "المستلم" : "Recipient"} required value={f.recipient} onChange={(v) => setF({ ...f, recipient: v })} />
        <Field label={isAr ? "الجوال" : "Phone"} required value={f.phone} onChange={(v) => setF({ ...f, phone: v })} placeholder="+9665..." />
        <SelectField label={isAr ? "المدينة" : "City"} value={f.cityId} onChange={(v) => setF({ ...f, cityId: v })}
          options={cities.map((c) => ({ value: c.id, label: isAr ? c.nameAr : c.nameEn }))} />
        <Field label={isAr ? "الحي" : "District"} value={f.district} onChange={(v) => setF({ ...f, district: v })} />
        <Field label={isAr ? "الشارع" : "Street"} required value={f.street} onChange={(v) => setF({ ...f, street: v })} />
        {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending || !f.recipient || !f.street}>{pending && <Loader2 className="size-4 animate-spin" />} {isAr ? "حفظ العنوان" : "Save address"}</Button>
        </div>
      </form>
    </Card>
  );
}
