"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, ExternalLink, Heart, Loader2, MessageCircle, RotateCcw, Search } from "lucide-react";
import { Badge, Button, Card, Skeleton, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { Pagination } from "@/app/admin/_components/pagination";
import { fmtDateTime } from "@/app/admin/_components/i18n";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { QueryError } from "@/components/query-error";

/**
 * Moderating the two member-authored boards: adoption and Lost & Found.
 *
 * Both are public surfaces where a member writes free text and uploads photos,
 * so both need a staff member able to take something down in one action, with
 * a reason the author receives. Without this page the `hiddenAt` columns those
 * boards filter on could only ever be set by a database edit, which is another
 * way of saying they could not be moderated at all.
 *
 * Deliberately a light console rather than a full CRM: a moderator needs the
 * photo, the words, who wrote it, and one button.
 */

type Filter = "live" | "hidden" | "settled";
type Board = "adoption" | "lost-found";

interface AdoptionRow {
  id: string;
  status: string;
  excerpt: string;
  feeSar: number;
  cityCode: string | null;
  viewCount: number;
  requests: number;
  hiddenAt: string | null;
  hiddenReason: string | null;
  createdAt: string;
  cat: { id: string; name: string; photoUrl: string | null; catIdNumber: string | null };
  owner: { id: string; email: string; name: string | null };
}

interface LostFoundRow {
  id: string;
  kind: "LOST" | "FOUND";
  status: string;
  catName: string | null;
  excerpt: string;
  photoUrl: string | null;
  cityCode: string | null;
  district: string | null;
  contactPref: string;
  viewCount: number;
  messages: number;
  hiddenAt: string | null;
  hiddenReason: string | null;
  happenedAt: string;
  createdAt: string;
  registeredCatId: string | null;
  catIdNumber: string | null;
  reporter: { id: string; email: string; name: string | null };
}

interface Page<T> {
  items: T[];
  pagination: { total: number; page: number; totalPages: number };
}

const FILTERS: { key: Filter; en: string; ar: string }[] = [
  { key: "live", en: "Live", ar: "منشورة" },
  { key: "hidden", en: "Hidden", ar: "مخفية" },
  { key: "settled", en: "Settled", ar: "منتهية" },
];

export default function AdminBoardsPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [board, setBoard] = React.useState<Board>("adoption");
  const [filter, setFilter] = React.useState<Filter>("live");
  const [page, setPage] = React.useState(1);

  React.useEffect(() => setPage(1), [board, filter]);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {isAr ? "اللوحات العامة" : "Public boards"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "التبني ومفقود وموجود — محتوى يكتبه الأعضاء، يُنشر فوراً ويُخفى عند الحاجة. صاحب الإعلان يُبلَّغ بالسبب دائماً."
            : "Adoption and Lost & Found — member-written, published immediately, hidden when it needs to be. The author is always told why."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5" role="group" aria-label={isAr ? "اللوحة" : "Board"}>
          {(
            [
              { key: "adoption" as const, icon: Heart, en: "Adoption", ar: "التبني" },
              { key: "lost-found" as const, icon: Search, en: "Lost & Found", ar: "مفقود وموجود" },
            ]
          ).map((b) => (
            <button
              key={b.key}
              type="button"
              aria-pressed={board === b.key}
              onClick={() => setBoard(b.key)}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
                board === b.key
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <b.icon className="size-4" aria-hidden />
              {isAr ? b.ar : b.en}
            </button>
          ))}
        </div>
        <span aria-hidden className="h-6 w-px bg-border" />
        <div className="flex gap-1.5" role="group" aria-label={isAr ? "الحالة" : "Status"}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "min-h-11 rounded-full border px-3 text-xs font-medium transition-colors",
                filter === f.key
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {isAr ? f.ar : f.en}
            </button>
          ))}
        </div>
      </div>

      {board === "adoption" ? (
        <AdoptionBoard filter={filter} page={page} onPage={setPage} isAr={isAr} />
      ) : (
        <LostFoundBoard filter={filter} page={page} onPage={setPage} isAr={isAr} />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

function AdoptionBoard({
  filter,
  page,
  onPage,
  isAr,
}: {
  filter: Filter;
  page: number;
  onPage: (p: number) => void;
  isAr: boolean;
}) {
  const { authedFetch } = useAuth();
  const q = useQuery({
    queryKey: ["admin-adoption", filter, page],
    queryFn: () => authedFetch<Page<AdoptionRow>>(`/admin/adoption/listings?filter=${filter}&page=${page}`),
  });
  const moderate = useModeration("adoption", isAr, ["admin-adoption"]);

  if (q.isError) return <QueryError isAr={isAr} onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  if (q.isLoading) return <Rows />;
  if ((q.data?.items.length ?? 0) === 0) return <Empty isAr={isAr} />;

  return (
    <>
      <div className="space-y-3">
        {q.data?.items.map((row) => (
          <Card key={row.id} className="flex flex-wrap items-start gap-3 p-3">
            <Thumb src={row.cat.photoUrl} alt={row.cat.name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display font-semibold">{row.cat.name}</p>
                <Badge variant={row.hiddenAt ? "destructive" : "secondary"}>
                  {row.hiddenAt ? (isAr ? "مخفي" : "Hidden") : row.status}
                </Badge>
                {row.cat.catIdNumber && (
                  <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                    {row.cat.catIdNumber}
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{row.excerpt}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                <span dir="ltr">{row.owner.email}</span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3" aria-hidden /> {row.viewCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="size-3" aria-hidden /> {row.requests}
                </span>
                <span>{fmtDateTime(row.createdAt, isAr)}</span>
              </p>
              {row.hiddenReason && (
                <p className="mt-1 text-[11px] text-destructive">
                  {isAr ? "السبب: " : "Reason: "}
                  {row.hiddenReason}
                </p>
              )}
            </div>
            <Actions
              isAr={isAr}
              hidden={!!row.hiddenAt}
              href={`/adopt/${row.id}`}
              onHide={(reason) => moderate.hide.mutate({ id: row.id, reason })}
              onUnhide={() => moderate.unhide.mutate(row.id)}
              busy={moderate.busy}
            />
          </Card>
        ))}
      </div>
      <Pagination page={page} totalPages={q.data?.pagination.totalPages ?? 1} onPageChange={onPage} isAr={isAr} />
    </>
  );
}

function LostFoundBoard({
  filter,
  page,
  onPage,
  isAr,
}: {
  filter: Filter;
  page: number;
  onPage: (p: number) => void;
  isAr: boolean;
}) {
  const { authedFetch } = useAuth();
  const q = useQuery({
    queryKey: ["admin-lostfound", filter, page],
    queryFn: () => authedFetch<Page<LostFoundRow>>(`/admin/lost-found/posts?filter=${filter}&page=${page}`),
  });
  const moderate = useModeration("lost-found", isAr, ["admin-lostfound"]);

  if (q.isError) return <QueryError isAr={isAr} onRetry={() => void q.refetch()} retrying={q.isFetching} />;
  if (q.isLoading) return <Rows />;
  if ((q.data?.items.length ?? 0) === 0) return <Empty isAr={isAr} />;

  return (
    <>
      <div className="space-y-3">
        {q.data?.items.map((row) => (
          <Card key={row.id} className="flex flex-wrap items-start gap-3 p-3">
            <Thumb src={row.photoUrl} alt={row.catName ?? ""} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display font-semibold">
                  {row.catName ?? (isAr ? "قط بدون اسم" : "An unnamed cat")}
                </p>
                <Badge variant={row.kind === "LOST" ? "destructive" : "secondary"}>
                  {row.kind === "LOST" ? (isAr ? "مفقود" : "Lost") : isAr ? "موجود" : "Found"}
                </Badge>
                {row.hiddenAt && <Badge variant="destructive">{isAr ? "مخفي" : "Hidden"}</Badge>}
                {/* The field most likely to need judgement: did they publish a
                    number, and should it stay up? */}
                {row.contactPref !== "IN_APP" && (
                  <Badge variant="outline">
                    {isAr ? `تواصل: ${row.contactPref}` : `Contact: ${row.contactPref}`}
                  </Badge>
                )}
                {row.catIdNumber && (
                  <span className="font-mono text-[11px] text-muted-foreground" dir="ltr">
                    {row.catIdNumber}
                  </span>
                )}
              </div>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{row.excerpt}</p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                <span dir="ltr">{row.reporter.email}</span>
                <span className="inline-flex items-center gap-1">
                  <Eye className="size-3" aria-hidden /> {row.viewCount}
                </span>
                <span className="inline-flex items-center gap-1">
                  <MessageCircle className="size-3" aria-hidden /> {row.messages}
                </span>
                <span>{fmtDateTime(row.createdAt, isAr)}</span>
              </p>
              {row.hiddenReason && (
                <p className="mt-1 text-[11px] text-destructive">
                  {isAr ? "السبب: " : "Reason: "}
                  {row.hiddenReason}
                </p>
              )}
            </div>
            <Actions
              isAr={isAr}
              hidden={!!row.hiddenAt}
              href={`/lost-found/${row.id}`}
              onHide={(reason) => moderate.hide.mutate({ id: row.id, reason })}
              onUnhide={() => moderate.unhide.mutate(row.id)}
              busy={moderate.busy}
            />
          </Card>
        ))}
      </div>
      <Pagination page={page} totalPages={q.data?.pagination.totalPages ?? 1} onPageChange={onPage} isAr={isAr} />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */

/** Hide / restore for either board — one hook, two endpoints. */
function useModeration(board: Board, isAr: boolean, key: string[]) {
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const path = board === "adoption" ? "/admin/adoption/listings" : "/admin/lost-found/posts";
  const done = (title: string) => {
    toast({ title });
    void queryClient.invalidateQueries({ queryKey: key });
  };

  const hide = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      authedFetch(`${path}/${id}/hide`, {
        method: "PATCH",
        body: JSON.stringify(reason ? { reason } : {}),
      }),
    onSuccess: () => done(isAr ? "أخفيناه، وأبلغنا صاحبه" : "Hidden — the author has been told"),
  });

  const unhide = useMutation({
    mutationFn: (id: string) => authedFetch(`${path}/${id}/unhide`, { method: "PATCH" }),
    onSuccess: () => done(isAr ? "رجع للنشر" : "Restored"),
  });

  return { hide, unhide, busy: hide.isPending || unhide.isPending };
}

function Actions({
  isAr,
  hidden,
  href,
  onHide,
  onUnhide,
  busy,
}: {
  isAr: boolean;
  hidden: boolean;
  href: string;
  onHide: (reason?: string) => void;
  onUnhide: () => void;
  busy: boolean;
}) {
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <a
        href={href}
        target="_blank"
        rel="noopener"
        className="inline-flex min-h-11 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        {isAr ? "افتح الصفحة" : "Open page"}
      </a>
      {hidden ? (
        <Button size="sm" variant="outline" onClick={onUnhide} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          {isAr ? "إعادة النشر" : "Restore"}
        </Button>
      ) : asking ? (
        <div className="w-56 rounded-xl border border-border bg-background p-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={280}
            autoFocus
            placeholder={isAr ? "السبب (يصل صاحبه)" : "Reason (the author sees this)"}
            className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs outline-none ring-primary/20 focus:ring-2"
          />
          <div className="mt-1.5 flex justify-end gap-1">
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => {
                onHide(reason.trim() || undefined);
                setAsking(false);
                setReason("");
              }}
            >
              {isAr ? "أخفِ" : "Hide"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10"
          onClick={() => setAsking(true)}
        >
          <EyeOff className="size-4" aria-hidden />
          {isAr ? "إخفاء" : "Hide"}
        </Button>
      )}
    </div>
  );
}

function Thumb({ src, alt }: { src: string | null; alt: string }) {
  return (
    <ImgWithFallback
      src={src}
      alt={alt}
      className="size-16 shrink-0 rounded-xl object-cover"
      fallback={<span className="block size-16 shrink-0 rounded-xl bg-muted" />}
    />
  );
}

function Rows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

function Empty({ isAr }: { isAr: boolean }) {
  return (
    <Card className="grid place-items-center py-14 text-center">
      <p className="text-sm text-muted-foreground">{isAr ? "ما في شي هنا" : "Nothing here"}</p>
    </Card>
  );
}
