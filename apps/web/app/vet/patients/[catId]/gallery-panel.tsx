"use client";

// ════════════════════════════════════════════════════════════════════════
//  GalleryPanel — the clinical image record (MRC-VET-001 §10 attachments).
//
//  A dermatology recheck is won or lost on one question: "does it look better
//  than last time?" Text can't answer it. So this panel's job is not to be a
//  pretty grid — it is to make comparison across time effortless:
//
//   • Chronological within each kind, because a lesion's story is a sequence.
//   • Grouped by kind (imaging · lab · exam · other), because a vet comes
//     here looking for one body system, not for "photos".
//   • Before/after pairing: any kind with two or more images offers a
//     side-by-side of the earliest and the latest, dated, with the interval
//     spelled out. That single affordance is why this panel exists.
//
//  Every image keeps its provenance — which clinic, which clinician, which
//  entry — because an unattributed clinical photograph is an anecdote.
//
//  Kind note: the record model attaches files to entries and does not tag
//  them by body system, so the kind is inferred from the ENTRY that carries
//  the file. That is an honest inference (an image on an imaging entry is
//  imaging) rather than a guess at anatomy we were never told.
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronLeft, ChevronRight, Columns2, X } from "lucide-react";
import { Badge, Button, Card, Skeleton, cn, useFocusTrap } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import { QueryError } from "@/components/query-error";
import { IlloSprig } from "@/components/illustrations";
import { entryKindLabel } from "@/components/vet/entry-composer";
import { useVetActor, useVetApi, type EntryType } from "@/lib/vet-api";

/** The body-system grouping a clinician browses by. Local to this panel. */
type ImageKind = "IMAGING" | "LAB" | "EXAM" | "OTHER";

interface GalleryImage {
  id: string;
  url: string;
  filename: string;
  kind: ImageKind;
  capturedAt: string;
  clinic: string;
  author: string;
  entryKind: EntryType;
  entryTitle: string;
}

const KIND_ORDER: ImageKind[] = ["IMAGING", "LAB", "EXAM", "OTHER"];

const KIND_LABEL: Record<ImageKind, { ar: string; en: string }> = {
  IMAGING: { ar: "أشعة وتصوير", en: "Imaging" },
  LAB: { ar: "مختبر", en: "Lab" },
  EXAM: { ar: "فحص", en: "Examination" },
  OTHER: { ar: "أخرى", en: "Other" },
};

function kindFor(entryKind: EntryType): ImageKind {
  if (entryKind === "IMAGING") return "IMAGING";
  if (entryKind === "LAB") return "LAB";
  if (entryKind === "EXAM") return "EXAM";
  return "OTHER";
}

export default function GalleryPanel({ catId, className }: { catId: string; className?: string }) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const actor = useVetActor();
  const api = useVetApi();
  const canRead = actor.can("record.read");

  const [kind, setKind] = React.useState<ImageKind | "ALL">("ALL");
  const [lightbox, setLightbox] = React.useState<number | null>(null);
  const [compare, setCompare] = React.useState<{ a: GalleryImage; b: GalleryImage } | null>(null);

  const query = useQuery({
    queryKey: ["vet-timeline", catId],
    queryFn: () => api.getPatientTimeline(catId),
    enabled: canRead,
  });

  const images = React.useMemo<GalleryImage[]>(() => {
    const out: GalleryImage[] = [];
    for (const entry of query.data?.entries ?? []) {
      // Retracted work is not clinical evidence.
      if (entry.status === "RETRACTED") continue;
      for (const a of entry.attachments ?? []) {
        if (!a.url || !a.mimeType?.startsWith("image/")) continue;
        out.push({
          id: a.id,
          url: a.url,
          filename: a.filename,
          kind: kindFor(entry.kind),
          capturedAt: a.uploadedAt || entry.at,
          clinic: (isAr ? entry.orgNameAr : entry.orgNameEn) ?? "",
          author: entry.authorName,
          entryKind: entry.kind,
          entryTitle: (isAr ? entry.titleAr : entry.titleEn) ?? "",
        });
      }
    }
    return out.sort((x, y) => new Date(x.capturedAt).getTime() - new Date(y.capturedAt).getTime());
  }, [query.data, isAr]);

  const visible = kind === "ALL" ? images : images.filter((i) => i.kind === kind);
  const presentKinds = KIND_ORDER.filter((k) => images.some((i) => i.kind === k));

  // Before/after candidates: same kind, at least two images apart in time.
  const pairs = React.useMemo(() => {
    const buckets = new Map<ImageKind, GalleryImage[]>();
    for (const img of images) {
      const arr = buckets.get(img.kind) ?? [];
      arr.push(img);
      buckets.set(img.kind, arr);
    }
    const out: { a: GalleryImage; b: GalleryImage }[] = [];
    for (const arr of buckets.values()) {
      const a = arr[0];
      const b = arr[arr.length - 1];
      if (a && b && a.id !== b.id) out.push({ a, b });
    }
    return out;
  }, [images]);

  if (!canRead) {
    return (
      <Card className={cn("p-6", className)}>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "الصور السريرية جزء من السجل الطبي، وهو خارج نطاق دورك."
            : "Clinical images are part of the medical record, which isn't part of your role."}
        </p>
      </Card>
    );
  }

  if (query.isLoading) {
    return (
      <Card className={cn("p-5", className)} aria-hidden>
        <Skeleton className="h-5 w-32" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      </Card>
    );
  }
  if (query.isError) {
    return (
      <QueryError
        isAr={isAr}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
        className={className}
      />
    );
  }

  if (images.length === 0) {
    return (
      <Card className={cn("flex flex-col items-center gap-3 p-10 text-center", className)}>
        <IlloSprig tone="leaf" className="size-10 opacity-70" aria-hidden />
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          {isAr
            ? "لا صور سريرية بعد. صورة واحدة اليوم تجعل مراجعة الشهر القادم أسهل بكثير."
            : "No clinical images yet. One photo today makes next month's recheck far easier."}
        </p>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-display text-base font-semibold tracking-tight">
          {isAr ? "الصور السريرية" : "Clinical images"}
        </h3>
        <Badge variant="secondary">{visible.length}</Badge>
      </div>

      <div
        role="group"
        aria-label={isAr ? "تصفية حسب النوع" : "Filter by kind"}
        className="mt-3 flex flex-wrap gap-1.5"
      >
        {(["ALL", ...presentKinds] as (ImageKind | "ALL")[]).map((k) => {
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              aria-pressed={active}
              onClick={() => setKind(k)}
              className={cn(
                "min-h-[44px] rounded-full border px-3.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {k === "ALL" ? (isAr ? "الكل" : "All") : isAr ? KIND_LABEL[k].ar : KIND_LABEL[k].en}
            </button>
          );
        })}
      </div>

      {/* Before/after — the panel's reason to exist. */}
      {pairs.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isAr ? "قارن قبل وبعد" : "Compare before & after"}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {pairs.map((p) => (
              <Button
                key={`${p.a.id}-${p.b.id}`}
                size="sm"
                variant="outline"
                onClick={() => setCompare(p)}
              >
                <Columns2 className="size-4" />
                {isAr ? KIND_LABEL[p.a.kind].ar : KIND_LABEL[p.a.kind].en}
                <span className="text-muted-foreground">
                  {formatDate(p.a.capturedAt, locale, { day: "numeric", month: "short" })} →{" "}
                  {formatDate(p.b.capturedAt, locale, { day: "numeric", month: "short" })}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {visible.map((img, i) => (
          <li key={img.id}>
            <button
              type="button"
              onClick={() => setLightbox(i)}
              className="block w-full overflow-hidden rounded-xl border border-border bg-background text-start transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`${isAr ? KIND_LABEL[img.kind].ar : KIND_LABEL[img.kind].en} — ${formatDate(img.capturedAt, locale)}`}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              <span className="block px-2.5 py-2">
                <span className="block text-xs font-medium text-foreground">
                  {isAr ? KIND_LABEL[img.kind].ar : KIND_LABEL[img.kind].en}
                </span>
                <span className="block text-[11px] tabular-nums text-muted-foreground">
                  {formatDate(img.capturedAt, locale)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {lightbox !== null && visible[lightbox] && (
        <Lightbox
          images={visible}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}

      {compare && <CompareView pair={compare} onClose={() => setCompare(null)} />}
    </Card>
  );
}

// ── lightbox ─────────────────────────────────────────────────────────────

function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: GalleryImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const panelRef = useFocusTrap<HTMLDivElement>(true);
  const img = images[index];
  const titleId = React.useId();

  const go = React.useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= 0 && next < images.length) onIndex(next);
    },
    [index, images.length, onIndex]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Arrows follow reading order, so they mirror in Arabic (R104).
      if (e.key === "ArrowRight") go(isAr ? -1 : 1);
      if (e.key === "ArrowLeft") go(isAr ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [go, isAr, onClose]);

  // Hooks first, then the guard — the index can go stale if a filter changes
  // underneath an open lightbox.
  if (!img) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-card outline-none"
      >
        <div className="flex items-center gap-2 border-b border-border p-3">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            {isAr ? KIND_LABEL[img.kind].ar : KIND_LABEL[img.kind].en}
          </h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {index + 1} / {images.length}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="ms-auto"
            onClick={onClose}
            aria-label={isAr ? "أغلق" : "Close"}
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={`${isAr ? KIND_LABEL[img.kind].ar : KIND_LABEL[img.kind].en} — ${formatDate(img.capturedAt, locale)}`}
            className="max-h-[62vh] w-auto max-w-full object-contain"
          />
          {index > 0 && (
            <Button
              size="icon"
              variant="glass"
              className="absolute start-3"
              onClick={() => go(-1)}
              aria-label={isAr ? "الصورة السابقة" : "Previous image"}
            >
              {isAr ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
            </Button>
          )}
          {index < images.length - 1 && (
            <Button
              size="icon"
              variant="glass"
              className="absolute end-3"
              onClick={() => go(1)}
              aria-label={isAr ? "الصورة التالية" : "Next image"}
            >
              {isAr ? <ChevronLeft className="size-5" /> : <ChevronRight className="size-5" />}
            </Button>
          )}
        </div>

        <div className="border-t border-border p-3">
          <p className="text-sm font-medium text-foreground">
            {img.entryTitle || entryKindLabel(img.entryKind, isAr)}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="tabular-nums">{formatDate(img.capturedAt, locale)}</span>
            <span>· {img.author}</span>
            {img.clinic && (
              <span className="inline-flex items-center gap-1">
                <Building2 className="size-3" aria-hidden />
                {img.clinic}
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── before / after ───────────────────────────────────────────────────────

function CompareView({
  pair,
  onClose,
}: {
  pair: { a: GalleryImage; b: GalleryImage };
  onClose: () => void;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const panelRef = useFocusTrap<HTMLDivElement>(true);
  const titleId = React.useId();

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const days = Math.max(
    0,
    Math.round(
      (new Date(pair.b.capturedAt).getTime() - new Date(pair.a.capturedAt).getTime()) / 86_400_000
    )
  );

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-card outline-none"
      >
        <div className="flex items-center gap-2 border-b border-border p-3">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            {isAr ? KIND_LABEL[pair.a.kind].ar : KIND_LABEL[pair.a.kind].en}
          </h2>
          <span className="text-xs text-muted-foreground">
            {isAr ? `${days} يوماً بين الصورتين` : `${days} days apart`}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="ms-auto"
            onClick={onClose}
            aria-label={isAr ? "أغلق" : "Close"}
          >
            <X className="size-5" />
          </Button>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {[
            { img: pair.a, ar: "قبل", en: "Before" },
            { img: pair.b, ar: "بعد", en: "After" },
          ].map(({ img, ar, en }) => (
            <figure key={img.id} className="bg-card">
              <figcaption className="flex items-center gap-2 px-3 py-2">
                <Badge variant="secondary">{isAr ? ar : en}</Badge>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {formatDate(img.capturedAt, locale)}
                </span>
              </figcaption>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`${isAr ? ar : en} — ${formatDate(img.capturedAt, locale)}`}
                className="max-h-[48vh] w-full bg-black object-contain"
              />
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {img.author}
                {img.clinic ? ` · ${img.clinic}` : ""}
              </p>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
}
