"use client";

/**
 * The map pin, three honest ways: stand in the clinic and tap "use my
 * location"; paste the Google Maps link the clinic already shares on WhatsApp;
 * or type the coordinates. No map SDK, no API key, no tracking script — and an
 * OpenStreetMap link to confirm the pin landed on the right building.
 */

import * as React from "react";
import { ExternalLink, Link2, LocateFixed, MapPin } from "lucide-react";
import { Button, Input, cn } from "@moraqat/ui";
import { asciiDigits } from "@moraqat/core";

export interface LocationValue {
  lat: string;
  lng: string;
  mapsUrl: string;
}

const inRange = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Roughly the Kingdom's bounding box — a soft check, never a block. */
export const inSaudi = (lat: number, lng: number) => lat >= 16 && lat <= 32.5 && lng >= 34.4 && lng <= 55.8;

/**
 * Pull coordinates out of the link shapes people actually paste:
 *   …/@24.7136,46.6753,17z          (place / map view)
 *   …!3d24.7136!4d46.6753           (place data — the precise pin, preferred)
 *   …?q=24.7136,46.6753 / ?ll= / ?query= / ?destination= / ?center=
 *   "24.7136, 46.6753"              (raw coordinates)
 */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const text = (() => {
    const ascii = asciiDigits(input.trim()).replace(/[،]/g, ",");
    try {
      return decodeURIComponent(ascii);
    } catch {
      return ascii;
    }
  })();
  const num = "(-?\\d{1,3}(?:\\.\\d+)?)";
  const patterns = [
    new RegExp(`!3d${num}!4d${num}`),
    new RegExp(`[?&](?:q|ll|query|destination|center|daddr|sll)=(?:loc:)?${num}\\s*,\\s*\\+?${num}`),
    new RegExp(`@${num},${num}`),
    new RegExp(`/(?:place|search|dir)/${num},\\s*\\+?${num}`),
    new RegExp(`^${num}\\s*,\\s*${num}$`),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1] && m[2]) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (inRange(lat, lng)) return { lat: round(lat), lng: round(lng) };
    }
  }
  return null;
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

export function osmUrl(lat: number, lng: number) {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
}

export function LocationPicker({
  value,
  onChange,
  isAr,
  error,
}: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  isAr: boolean;
  error?: string;
}) {
  const id = React.useId();
  const [link, setLink] = React.useState(value.mapsUrl);
  const [linkMsg, setLinkMsg] = React.useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [geoMsg, setGeoMsg] = React.useState<string | null>(null);

  const lat = Number(asciiDigits(value.lat));
  const lng = Number(asciiDigits(value.lng));
  const hasPin = value.lat.trim() !== "" && value.lng.trim() !== "" && inRange(lat, lng);

  function applyLink(raw: string) {
    setLink(raw);
    if (!raw.trim()) {
      setLinkMsg(null);
      return;
    }
    const parsed = parseCoordinates(raw);
    if (parsed) {
      const isUrl = /^https?:\/\//i.test(raw.trim());
      onChange({ lat: String(parsed.lat), lng: String(parsed.lng), mapsUrl: isUrl ? raw.trim().slice(0, 500) : "" });
      setLinkMsg({ tone: "ok", text: isAr ? "قرأنا الموقع من الرابط." : "Got the location from the link." });
    } else if (/goo\.gl|maps\.app/i.test(raw)) {
      setLinkMsg({
        tone: "err",
        text: isAr
          ? "الروابط المختصرة لا تحتوي الإحداثيات. افتح الرابط، ثم انسخ الرابط الكامل من شريط العنوان والصقه هنا — أو استخدم موقعك الحالي."
          : "Short links don't contain the coordinates. Open the link, copy the full address from the browser bar and paste it here — or use your current location.",
      });
    } else {
      setLinkMsg({
        tone: "err",
        text: isAr
          ? "لم نجد إحداثيات في هذا الرابط. جرّب رابط الموقع الكامل من خرائط Google."
          : "We couldn't find coordinates in that link. Try the full place link from Google Maps.",
      });
    }
  }

  function locate() {
    setGeoMsg(null);
    if (!("geolocation" in navigator)) {
      setGeoMsg(isAr ? "المتصفح لا يدعم تحديد الموقع. الصق رابط الخريطة بدلاً من ذلك." : "This browser can't share location. Paste a map link instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onChange({ lat: String(round(pos.coords.latitude)), lng: String(round(pos.coords.longitude)), mapsUrl: "" });
        setLink("");
        setLinkMsg(null);
        if (pos.coords.accuracy > 150) {
          setGeoMsg(
            isAr
              ? "الدقة منخفضة. تأكد من الموقع عبر رابط المعاينة، أو الصق رابط الخريطة."
              : "Accuracy is low. Check the pin with the preview link, or paste a map link."
          );
        }
      },
      (err) => {
        setLocating(false);
        setGeoMsg(
          err.code === err.PERMISSION_DENIED
            ? isAr
              ? "لم يُسمح بالوصول للموقع. اسمح به من إعدادات المتصفح، أو الصق رابط الخريطة."
              : "Location access was blocked. Allow it in your browser settings, or paste a map link."
            : isAr
              ? "تعذّر تحديد موقعك الآن. الصق رابط الخريطة أو اكتب الإحداثيات."
              : "Couldn't find your location right now. Paste a map link or type the coordinates."
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  }

  return (
    <fieldset className="flex flex-col gap-3" aria-describedby={error ? `${id}-err` : `${id}-hint`}>
      <legend className="flex items-baseline gap-1.5 text-sm font-medium">
        {isAr ? "الموقع على الخريطة" : "Location on the map"}
        <span className="text-destructive" aria-hidden>
          *
        </span>
      </legend>
      <p id={`${id}-hint`} className="-mt-2 text-xs leading-relaxed text-muted-foreground">
        {isAr
          ? "هكذا يصل الأعضاء إليكم. إن كنت في العيادة الآن، الخيار الأول هو الأسرع."
          : "This is how members find you. If you're at the clinic right now, the first option is quickest."}
      </p>

      <Button type="button" variant="outline" onClick={locate} loading={locating} className="self-start">
        {!locating && <LocateFixed aria-hidden />}
        {isAr ? "استخدم موقعي الحالي" : "Use my current location"}
      </Button>
      {geoMsg && (
        <p className="text-xs leading-relaxed text-[hsl(38_92%_30%)] dark:text-warning-ink" role="status">
          {geoMsg}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-link`} className="text-xs font-medium text-muted-foreground">
          {isAr ? "أو الصق رابط الموقع من خرائط Google" : "Or paste the Google Maps link"}
        </label>
        <div className="relative">
          <Link2 className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            id={`${id}-link`}
            dir="ltr"
            inputMode="url"
            value={link}
            placeholder="https://www.google.com/maps/place/…"
            onChange={(e) => applyLink(e.target.value)}
            aria-describedby={linkMsg ? `${id}-linkmsg` : undefined}
            className="ps-9 text-start"
          />
        </div>
        {linkMsg && (
          <p
            id={`${id}-linkmsg`}
            role="status"
            className={cn("text-xs leading-relaxed", linkMsg.tone === "ok" ? "text-success" : "text-destructive")}
          >
            {linkMsg.text}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-lat`} className="text-xs font-medium text-muted-foreground">
            {isAr ? "خط العرض" : "Latitude"}
          </label>
          <Input
            id={`${id}-lat`}
            dir="ltr"
            inputMode="decimal"
            value={value.lat}
            placeholder="24.7136"
            invalid={!!error && !hasPin}
            onChange={(e) => onChange({ ...value, lat: asciiDigits(e.target.value), mapsUrl: "" })}
            className="tabular text-start"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-lng`} className="text-xs font-medium text-muted-foreground">
            {isAr ? "خط الطول" : "Longitude"}
          </label>
          <Input
            id={`${id}-lng`}
            dir="ltr"
            inputMode="decimal"
            value={value.lng}
            placeholder="46.6753"
            invalid={!!error && !hasPin}
            onChange={(e) => onChange({ ...value, lng: asciiDigits(e.target.value), mapsUrl: "" })}
            className="tabular text-start"
          />
        </div>
      </div>

      {hasPin && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-muted/60 px-3 py-2.5 text-xs">
          <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
          <span dir="ltr" className="tabular">
            {lat}, {lng}
          </span>
          <a
            href={osmUrl(lat, lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[44px] items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            {isAr ? "تأكد من الموقع على الخريطة" : "Check the pin on a map"}
            <ExternalLink className="size-3.5" aria-hidden />
            <span className="sr-only">{isAr ? "(يفتح في نافذة جديدة)" : "(opens in a new tab)"}</span>
          </a>
          {!inSaudi(lat, lng) && (
            <span className="basis-full text-[hsl(38_92%_30%)] dark:text-warning-ink">
              {isAr ? "هذا الموقع يبدو خارج المملكة — تأكد منه." : "This looks like it's outside Saudi Arabia — double-check it."}
            </span>
          )}
        </div>
      )}

      {error && (
        <p id={`${id}-err`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
