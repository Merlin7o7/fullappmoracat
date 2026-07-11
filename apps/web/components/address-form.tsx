"use client";

/**
 * Shared delivery-address building blocks — extracted from portal/addresses so
 * checkout can reuse the exact same form + cities fetch instead of duplicating
 * them (one source of truth for how an address is created).
 *
 * Kingdom-wide delivery: the city list is a picker, never a gate.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Card, Button, cn } from "@moraqat/ui";
import { Field, SelectField } from "@/components/field";
import { fetchWithTimeout, httpError } from "@/lib/http";

export interface SavedAddress {
  id: string;
  label: string | null;
  recipient: string;
  phone: string;
  street: string;
  district: string | null;
  isDefault: boolean;
  city: { nameEn: string; nameAr: string };
}

export interface City {
  id: string;
  nameEn: string;
  nameAr: string;
}

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/**
 * The city list that feeds the form's picker. Public endpoint, but it still
 * needs a timeout and an honest error+retry — without cities the form can't be
 * used, so a silent failure would leave the "Add" button doing nothing.
 */
export function useCities() {
  return useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const res = await fetchWithTimeout(`${API}/api/cities`, {
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw httpError(res.status, await res.json().catch(() => null), "Couldn't load cities");
      return res.json() as Promise<City[]>;
    },
  });
}

export function AddressForm({
  isAr,
  cities,
  onSubmit,
  pending,
  error,
  onClose,
  className,
}: {
  isAr: boolean;
  cities: City[];
  onSubmit: (b: Record<string, unknown>) => void;
  pending: boolean;
  error?: string;
  onClose: () => void;
  className?: string;
}) {
  const [f, setF] = React.useState({
    label: "",
    recipient: "",
    phone: "",
    cityId: cities[0]?.id ?? "",
    district: "",
    street: "",
  });
  return (
    <Card className={cn("p-6", className)}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display font-semibold">{isAr ? "عنوان جديد" : "New address"}</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={isAr ? "إغلاق" : "Close"}
          className="grid size-11 place-items-center rounded-lg text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
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
          <Button type="submit" disabled={pending || !f.recipient || !f.street}>
            {pending && <Loader2 className="size-4 animate-spin" />} {isAr ? "حفظ العنوان" : "Save address"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
