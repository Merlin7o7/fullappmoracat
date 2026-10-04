"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Cake, Sparkles, Syringe, Stethoscope, FileText, Scale, Home, Search, HeartHandshake, Camera, Plus, Trash2, BookOpen,
} from "lucide-react";
import { Button, Card, EmptyState, ErrorState, Skeleton, useToast } from "@moraqat/ui";
import { formatDate } from "@moraqat/core";
import { useAuth } from "@/lib/auth";
import { friendlyError } from "@/lib/errors";
import type { PortalCat } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { useShareLink } from "@/lib/share-link";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/field";
import { MomentShare } from "@/components/moments/moment-share";
import type { MomentKind } from "@/components/moments/moment-poster";

type Bi = { ar: string; en: string };
interface Event {
  key: string;
  kind: "born" | "birthday" | "joined" | "vaccine" | "visit" | "clinical" | "weight" | "handover" | "lost" | "reunion" | "moment";
  at: string;
  title: Bi;
  sub?: Bi | null;
  photoUrl?: string | null;
  momentId?: string;
}

const ICON: Record<Event["kind"], React.ElementType> = {
  born: Cake, birthday: Cake, joined: Sparkles, vaccine: Syringe, visit: Stethoscope, clinical: FileText,
  weight: Scale, handover: Home, lost: Search, reunion: HeartHandshake, moment: Camera,
};
// Which life events can become a shareable poster.
const SHARE: Partial<Record<Event["kind"], MomentKind>> = { joined: "joined", reunion: "reunion", handover: "adoption", birthday: "birthday" };

/**
 * The cat's life, as an album (W9). Grouped by year, newest first; every
 * milestone that's worth celebrating can be shared as a poster; the owner adds
 * their own moments with a photo. Links to each year's keepsake.
 */
export function LifeTimeline({ cat, isAr }: { cat: PortalCat; isAr: boolean }) {
  const { authedFetch, user, uploadImage } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const loc = isAr ? "ar" : "en";
  const name = localizeName(cat.name, loc);
  const key = ["cat-timeline", cat.id];
  const q = useQuery({ queryKey: key, queryFn: () => authedFetch<Event[]>(`/cats/${cat.id}/timeline`), enabled: !!user });

  const [adding, setAdding] = React.useState(false);
  const [f, setF] = React.useState({ title: "", happenedAt: new Date().toISOString().slice(0, 10), note: "" });
  const [photo, setPhoto] = React.useState<File | null>(null);
  const fail = (e: unknown) => {
    const x = friendlyError(e, isAr);
    toast({ title: x.title, description: x.message, variant: "error" });
  };
  const add = useMutation({
    mutationFn: async () => {
      let photoUrl: string | undefined;
      if (photo) {
        const res = await uploadImage<{ url: string }>("/uploads/image", photo, { filename: photo.name });
        photoUrl = res.url;
      }
      return authedFetch(`/cats/${cat.id}/moments`, { method: "POST", body: JSON.stringify({ ...f, note: f.note || undefined, photoUrl }) });
    },
    onSuccess: () => {
      setAdding(false);
      setPhoto(null);
      setF({ title: "", happenedAt: new Date().toISOString().slice(0, 10), note: "" });
      void qc.invalidateQueries({ queryKey: key });
      toast({ title: isAr ? "أُضيفت اللحظة" : "Moment added", variant: "success" });
    },
    onError: fail,
  });
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => authedFetch(`/cats/${cat.id}/moments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setConfirmId(null);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: fail,
  });
  // A shared moment lands on /i/{slug} naming this cat; its QR goes there too
  // (the finder page /c/… stays for the collar and lost posters only).
  const momentLink = useShareLink(cat.isPublic ? cat.publicSlug : null, "moment");

  if (q.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  // A failed load is NOT an empty album — that reads as lost memories (audit
  // 2026-10-04, "Edge states that fail today"). Say so, and offer the retry.
  if (q.isError) {
    const f = friendlyError(q.error, isAr);
    return (
      <Card>
        <ErrorState
          title={isAr ? `ما قدرنا نفتح ألبوم ${name} الآن` : `We couldn't open ${name}'s album just now`}
          body={isAr ? `لحظاتك محفوظة — ${f.message}` : `Your moments are safe — ${f.message}`}
          onRetry={() => q.refetch()}
          retrying={q.isFetching}
          retryLabel={isAr ? "حاول مرة ثانية" : "Try again"}
        />
      </Card>
    );
  }
  const events = q.data ?? [];
  const byYear = new Map<number, Event[]>();
  for (const e of events) {
    const y = new Date(e.at).getFullYear();
    byYear.set(y, [...(byYear.get(y) ?? []), e]);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">{isAr ? `كل ما مرّ به ${name} — من السجل ومن ذكرياتك.` : `Everything ${name} has been through — from the record and from your memories.`}</p>
        {!adding && (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden /> {isAr ? "أضف لحظة" : "Add a moment"}
          </Button>
        )}
      </div>

      {adding && (
        <Card className="p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <Field label={isAr ? "اللحظة" : "The moment"} required value={f.title} onChange={(v) => setF({ ...f, title: v })} placeholder={isAr ? "مثلاً: أول يوم في البيت" : "e.g. First day home"} />
            <Field label={isAr ? "متى؟" : "When?"} type="date" required value={f.happenedAt} onChange={(v) => setF({ ...f, happenedAt: v })} />
            <div className="sm:col-span-2">
              <Field label={isAr ? "سطر عنها (اختياري)" : "A line about it (optional)"} value={f.note} onChange={(v) => setF({ ...f, note: v })} />
            </div>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm sm:col-span-2">
              <Camera className="size-4 text-muted-foreground" aria-hidden />
              <span>{photo ? photo.name : isAr ? "أضف صورة (اختياري)" : "Add a photo (optional)"}</span>
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" size="sm" loading={add.isPending} disabled={!f.title.trim()}>
                {isAr ? "احفظ" : "Save"}
              </Button>
              <Button type="button" size="sm" variant="tertiary" onClick={() => setAdding(false)}>
                {isAr ? "إلغاء" : "Cancel"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {events.length === 0 ? (
        <Card>
          <EmptyState title={isAr ? "الألبوم فاضي" : "The album is empty"} body={isAr ? "أضف أول لحظة." : "Add the first moment."} />
        </Card>
      ) : (
        years.map((y) => (
          <section key={y} aria-labelledby={`y-${y}`} className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <h2 id={`y-${y}`} className="font-display text-3xl" dir="ltr">{y}</h2>
              <Link href={`/portal/cats/${cat.id}/year/${y}`} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <BookOpen className="size-4" aria-hidden /> {isAr ? `عام ${name}` : `${name}'s year`}
              </Link>
            </div>
            <Card className="p-5">
              <ol className="relative space-y-6 border-s border-border ps-7">
                {byYear.get(y)!.map((e) => {
                  const Icon = ICON[e.kind];
                  const share = SHARE[e.kind];
                  return (
                    <li key={e.key} className="relative">
                      <span aria-hidden className="absolute -start-[2.35rem] top-0 grid size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <p className="font-medium">{isAr ? e.title.ar : e.title.en}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(e.at, loc, "medium")}
                        {e.sub ? ` · ${isAr ? e.sub.ar : e.sub.en}` : ""}
                      </p>
                      {e.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.photoUrl} alt="" loading="lazy" className="mt-3 aspect-[4/3] w-full max-w-sm rounded-md object-cover" />
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {share && (
                          <MomentShare
                            kind={share}
                            isAr={isAr}
                            catName={name}
                            photoUrl={cat.photoUrl}
                            catIdNumber={cat.catIdNumber}
                            lines={[formatDate(e.at, loc, "medium")]}
                            qrUrl={momentLink}
                            shareText={isAr ? `${name} — ${e.title.ar} 🐾 ${momentLink}` : `${name} — ${e.title.en} 🐾 ${momentLink}`}
                            label={isAr ? "شارك" : "Share"}
                            variant="tertiary"
                          />
                        )}
                        {e.momentId && (
                          <Button size="sm" variant="tertiary" className="text-destructive" onClick={() => setConfirmId(e.momentId!)}>
                            <Trash2 className="size-4" aria-hidden /> {isAr ? "حذف" : "Remove"}
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Card>
          </section>
        ))
      )}

      <ConfirmDialog
        open={!!confirmId}
        onClose={() => setConfirmId(null)}
        onConfirm={() => confirmId && remove.mutate(confirmId)}
        busy={remove.isPending}
        isAr={isAr}
        title={isAr ? "تحذف هذه اللحظة من الألبوم؟" : "Remove this moment from the album?"}
        description={isAr ? "تختفي اللحظة وصورتها من الألبوم. سجلات العيادة لا تتأثر." : "The moment and its photo leave the album. Clinic records are not affected."}
        confirmLabel={isAr ? "احذف اللحظة" : "Remove the moment"}
      />
    </div>
  );
}
