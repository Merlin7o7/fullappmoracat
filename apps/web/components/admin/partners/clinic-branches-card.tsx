"use client";

/**
 * Branches — what members will eventually see in the directory, so the
 * reviewer reads it the way a member would: where, when open, how to call,
 * and whether the licence behind it is valid.
 */

import * as React from "react";
import { MapPin, Phone, Siren, ExternalLink, Eye, EyeOff } from "lucide-react";
import { Badge } from "@moraqat/ui";
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
            <BranchBlock key={b.id} branch={b} index={i} isAr={isAr} />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function BranchBlock({ branch: b, index, isAr }: { branch: RegBranch; index: number; isAr: boolean }) {
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
              {isAr ? "طوارئ ٢٤ ساعة" : "24h emergency"}
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
          <KV label={isAr ? "المدينة" : "City"}>{b.city ? (isAr ? b.city.ar : b.city.en) : b.cityCode}</KV>
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
