"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Plus, Trash2, Loader2, Star } from "lucide-react";
import { Card, Badge, Button, Skeleton, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { QueryError } from "@/components/query-error";
import { IlloPaw } from "@/components/illustrations";
import { AddressForm, useCities, type SavedAddress as Address } from "@/components/address-form";

export default function AddressesPage() {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showForm, setShowForm] = React.useState(false);

  const { data: addresses, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: () => authedFetch<Address[]>("/addresses"),
    enabled: !!user,
  });
  // Cities feed the form's picker — shared with checkout (see address-form.tsx).
  const {
    data: cities, isLoading: citiesLoading, isError: citiesError,
    refetch: refetchCities, isFetching: citiesFetching,
  } = useCities();

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) => authedFetch("/addresses", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["addresses"] }); setShowForm(false); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => authedFetch(`/addresses/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["addresses"] }),
    onError: (e: Error) => toast({
      title: isAr ? "تعذّر حذف العنوان" : "Couldn't remove the address",
      description: e.message,
      variant: "error",
    }),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{isAr ? "العناوين" : "Addresses"}</h1>
          <p className="text-sm text-muted-foreground">{isAr ? "أماكن توصيل اشتراكك" : "Where your subscription is delivered"}</p>
        </div>
        <Button size="sm" onClick={() => setShowForm((v) => !v)} disabled={citiesLoading}>
          {citiesLoading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} {isAr ? "إضافة" : "Add"}
        </Button>
      </div>

      {showForm && (
        citiesLoading ? (
          <Card className="p-6"><Skeleton className="h-40 w-full" /></Card>
        ) : citiesError ? (
          <QueryError
            isAr={isAr}
            onRetry={() => refetchCities()}
            retrying={citiesFetching}
            title={isAr ? "تعذّر تحميل قائمة المدن — أعد المحاولة لإضافة عنوان" : "We couldn't load the city list — try again to add an address"}
          />
        ) : cities && cities.length > 0 ? (
          <AddressForm isAr={isAr} cities={cities} pending={create.isPending} error={create.error?.message}
            onClose={() => setShowForm(false)} onSubmit={(b) => create.mutate(b)} />
        ) : null
      )}

      {isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : isError ? (
        <QueryError isAr={isAr} onRetry={() => refetch()} retrying={isFetching} />
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
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 text-destructive"
                onClick={() => remove.mutate(a.id)}
                disabled={remove.isPending}
              >
                {remove.isPending && remove.variables === a.id ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                {isAr ? "حذف" : "Remove"}
              </Button>
            </Card>
          ))}
        </div>
      ) : (
        /* Empty state = a welcome, not a void (R111). */
        <Card className="relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center">
          <IlloPaw tone="sage" className="pointer-events-none absolute start-8 top-6 size-7 rotate-[-14deg] opacity-50" />
          <IlloPaw tone="peach" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-60" />
          <IlloPaw tone="butter" className="size-20" />
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
            {isAr ? "لا توجد عناوين محفوظة — أضف عنوانك ليصل صندوق قطك إلى الباب" : "No saved addresses — add yours so your cat's box reaches the door"}
          </p>
          <Button size="sm" onClick={() => setShowForm(true)}><Plus className="size-4" /> {isAr ? "أضف عنواناً" : "Add an address"}</Button>
        </Card>
      )}
    </div>
  );
}
