"use client";

/**
 * Branches — what members will eventually see in the directory, so the
 * reviewer reads it the way a member would: where, when open, how to call,
 * and whether the licence behind it is valid.
 */

import * as React from "react";
import { MapPin, Phone, Siren, ExternalLink, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SAUDI_CITIES } from "@moraqat/core";
import { Badge, Button, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { RegBranch, RegBranchHour, RegistrationState } from "@/lib/vet-registration";
import { DAY_NAMES, ExpiryText, KV, SectionCard, fmtNumber } from "./shared";

/** Collapse a week into runs: "Sun–Thu 09:00–21:00 · Fri closed". */
function hoursSummary(hours: RegBranchHour[], isAr: boolean): string[] {
  const byDay = new Map<number, RegBranchHour>();
  hours.forEach((h) => {
    if (h.day >= 0 && h.day <= 6) byDay.set(h.day, h);
  });
  if (byDay.size === 0) return [];
  const keyOf = (h?: RegBranchHour) =>
    !h ? "" : h.closed ? "closed" : h.open && h.close ? `${h.open}–${h.close}` : "";
  const runs: { from: number; to: number; key: string }[] = [];
  for (let d = 0; d <= 6; d++) {
    const k = keyOf(byDay.get(d));
    const last = runs[runs.length - 1];
    if (last && last.key === k && last.to === d - 1) last.to = d;
    else runs.push({ from: d, to: d, key: k });
  }
  const dayName = (d: number) => {
    const n = DAY_NAMES[d];
    return n ? (isAr ? n.ar : n.en) : String(d);
  };
  return runs
    .filter((r) => r.key !== "")
    .map((r) => {
      const days = r.from === r.to ? dayName(r.from) : `${dayName(r.from)}–${dayName(r.to)}`;
      const when = r.key === "closed" ? (isAr ? "مغلق" : "closed") : r.key;
      return `${days}: ${when}`;
    });
}

export function ClinicBranchesCard({ state, isAr }: { state: RegistrationState; isAr: boolean }) {
  return (
    <SectionCard icon={MapPin} title={isAr ? "الفروع" : "Branches"} count={state.branches.length}>
      {state.branches.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {isAr ? "لم تُضف العيادة أي فرع بعد." : "The clinic hasn't added a branch yet."}
        </p>
      ) : (
        <div className="space-y-4">
          {state.branches.map((b, i) => (
            <BranchBlock key={b.id} branch={b} index={i} isAr={isAr} orgId={state.org.id} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

/**
 * The branch's census city, editable from the console. A branch with no city
 * is invisible to every city search in the public directory — this is the
 * fix, and the warning makes the gap impossible to miss.
 */
function BranchCity({ branch: b, orgId, isAr }: { branch: RegBranch; orgId: string; isAr: boolean }) {
  const { authedFetch, user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editing, setEditing] = React.useState(false);
  const [code, setCode] = React.useState(b.cityCode ?? "");
  const save = useMutation({
    mutationFn: () =>
      authedFetch(`/vet/admin/orgs/${encodeURIComponent(orgId)}/branches/${encodeURIComponent(b.id)}/city`, {
        method: "PATCH",
        body: JSON.stringify({ cityCode: code }),
      }),
    onSuccess: () => {
      setEditing(false);
      void qc.invalidateQueries({ queryKey: ["admin-clinic", user?.id, orgId] });
      toast({ title: isAr ? "حُدّثت مدينة الفرع" : "Branch city updated", variant: "success" });
    },
    onError: (e: unknown) => {
      const f = friendlyError(e, isAr);
      toast({ title: f.title, description: f.message, variant: "error" });
    },
  });
  const label = b.city ? (isAr ? b.city.ar : b.city.en) : null;

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        {label ?? (
          <span className="inline-flex items-center gap-1 text-warning-ink">
            <AlertTriangle aria-hidden className="size-3.5" />
            {isAr ? "بلا مدينة — لا يظهر في البحث بالمدينة" : "No city — hidden from city search"}
          </span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-[44px] rounded px-1 text-xs text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {isAr ? "تعديل" : "Edit"}
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor={`city-${b.id}`}>{isAr ? "مدينة الفرع" : "Branch city"}</label>
      <select
        id={`city-${b.id}`}
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="h-11 rounded-md border border-input bg-background px-3 text-base"
      >
        <option value="" disabled>{isAr ? "اختر المدينة" : "Choose a city"}</option>
        {SAUDI_CITIES.filter((c) => c.code !== "other").map((c) => (
          <option key={c.code} value={c.code}>{isAr ? c.ar : c.en}</option>
        ))}
      </select>
      <Button size="sm" disabled={!code} loading={save.isPending} onClick={() => save.mutate()}>
        {isAr ? "حفظ" : "Save"}
      </Button>
      <Button size="sm" variant="tertiary" onClick={() => setEditing(false)}>
        {isAr ? "إلغاء" : "Cancel"}
      </Button>
    </span>
  );
}

function BranchBlock({ branch: b, index, isAr, orgId }: { branch: RegBranch; index: number; isAr: boolean; orgId: string }) {
  const name = (isAr ? b.nameAr : b.nameEn) || b.nameAr || b.nameEn || (isAr ? `الفرع ${fmtNumber(index + 1, true)}` : `Branch ${index + 1}`);
  const other = isAr ? b.nameEn : b.nameAr;
  const hours = hoursSummary(b.hours, isAr);
  const mapHref = b.mapsUrl || (b.lat != null && b.lng != null ? `https://www.google.com/maps?q=${b.lat},${b.lng}` : null);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          {other && other !== name && <p className="text-xs text-muted-foreground">{other}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {b.emergency24h && (
            <Badge variant="destructive">
              <Siren aria-hidden className="size-3" />
              {isAr ? "طوارئ 24 ساعة" : "24h emergency"}
            </Badge>
          )}
          {b.directoryVisible ? (
            <Badge variant="success">
              <Eye aria-hidden className="size-3" />
              {isAr ? "ظاهر في الدليل" : "In directory"}
            </Badge>
          ) : (
            <Badge variant="secondary">
              <EyeOff aria-hidden className="size-3" />
              {isAr ? "غير ظاهر في الدليل" : "Not in directory"}
            </Badge>
          )}
          {!b.isActive && <Badge variant="secondary">{isAr ? "غير نشط" : "Inactive"}</Badge>}
        </div>
      </div>

      <dl className="grid gap-x-6 md:grid-cols-2">
        <div>
          <KV label={isAr ? "المدينة" : "City"}>
            <BranchCity branch={b} orgId={orgId} isAr={isAr} />
          </KV>
          <KV label={isAr ? "الحي" : "District"}>{b.district}</KV>
          <KV label={isAr ? "العنوان" : "Address"}>{b.addressLine}</KV>
          <KV label={isAr ? "العنوان الوطني المختصر" : "National address"} ltr mono>
            {b.nationalAddressCode}
          </KV>
          <KV label={isAr ? "الخريطة" : "Map"}>
            {mapHref ? (
              <a
                href={mapHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1 rounded text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {isAr ? "فتح الموقع" : "Open location"}
                <ExternalLink aria-hidden className="size-3.5" />
              </a>
            ) : null}
          </KV>
        </div>
        <div>
          <KV label={isAr ? "الهاتف" : "Phone"}>
            {b.phone ? (
              <a
                href={`tel:${b.phone.replace(/\s/g, "")}`}
                dir="ltr"
                className="inline-flex min-h-[44px] items-center gap-1 rounded text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Phone aria-hidden className="size-3.5" />
                {b.phone}
              </a>
            ) : null}
          </KV>
          {b.email && (
            <KV label={isAr ? "البريد" : "Email"} ltr>
              {b.email}
            </KV>
          )}
          <KV label={isAr ? "ترخيص وزارة البيئة" : "MEWA licence"} ltr mono>
            {b.licenceNo}
          </KV>
          <KV label={isAr ? "انتهاء الترخيص" : "Licence expiry"}>
            {b.licenceExpiresAt ? <ExpiryText iso={b.licenceExpiresAt} isAr={isAr} /> : null}
          </KV>
          <KV label={isAr ? "أوقات العمل" : "Hours"}>
            {hours.length > 0 ? (
              <span className="block text-end">
                {hours.map((h) => (
                  <span key={h} className="block tabular-nums">
                    {h}
                  </span>
                ))}
              </span>
            ) : null}
          </KV>
        </div>
      </dl>

      {b.services.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-xs text-muted-foreground">{isAr ? "الخدمات" : "Services"}</p>
          <div className="flex flex-wrap gap-1.5">
            {b.services.map((s) => (
              <Badge key={s} variant="secondary">
                {s}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
