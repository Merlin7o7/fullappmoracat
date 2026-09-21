"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Home, Loader2, MapPin, MessageCircle, Search, XCircle } from "lucide-react";
import { Badge, Button, Card, Skeleton, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { IlloEmpty, IlloHeader } from "@/components/illo-panel";
import { Illo3D } from "@/components/illo-3d";
import { LostFoundForm } from "@/components/lost-found-form";
import { LostFoundShare } from "@/components/lost-found-share";
import { QueryError } from "@/components/query-error";
import { localizeName } from "@/lib/translit";
import { relativeTime } from "@/lib/datetime";
import {
  cityLabel,
  lostFoundStatusLabel,
  type LostFoundCard,
  type LostFoundKind,
  type LostFoundMessage,
} from "@/lib/cat-life-api";

/**
 * My notices.
 *
 * Someone arriving here is usually mid-emergency, so the two report buttons sit
 * at the top and the form opens immediately when the page is reached from the
 * public board's "my cat is missing" door (`?kind=LOST`) — one fewer tap on the
 * worst day (R002, R100).
 *
 * The messages people have sent are the payload of the whole feature, so they
 * are one tap from each notice and never behind a separate page.
 */
export default function PortalLostFoundPage() {
  return (
    <React.Suspense
      fallback={
        <div className="grid place-items-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <PortalLostFoundInner />
    </React.Suspense>
  );
}

function PortalLostFoundInner() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { authedFetch } = useAuth();
  const params = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const initialKind = params.get("kind") === "FOUND" ? "FOUND" : params.get("kind") === "LOST" ? "LOST" : null;
  const [reporting, setReporting] = React.useState<LostFoundKind | null>(initialKind);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["lost-found-mine"],
    queryFn: () => authedFetch<{ items: (LostFoundCard & { description: string; messageCount: number })[] }>("/lost-found/mine"),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["lost-found-mine"] });
    void queryClient.invalidateQueries({ queryKey: ["lost-found"] });
    void queryClient.invalidateQueries({ queryKey: ["lf-facets"] });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <IlloHeader
        name="cat"
        tone="cream"
        align="start"
        eyebrow={isAr ? "مفقود وموجود" : "Lost & Found"}
        title={isAr ? "إعلاناتي" : "My notices"}
        body={
          isAr
            ? "لو ضاع قطك، انشر هنا — ونفعّل وضع «مفقود» على هويته في نفس اللحظة."
            : "If your cat goes missing, post here — their Cat ID switches to lost mode in the same action."
        }
        actions={
          <>
            <Button size="sm" onClick={() => setReporting("LOST")}>
              <Search className="size-4" aria-hidden />
              {isAr ? "ضاع قطي" : "My cat is missing"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setReporting("FOUND")}>
              <MapPin className="size-4" aria-hidden />
              {isAr ? "لقيت قطاً" : "I found a cat"}
            </Button>
            <Link href="/lost-found">
              <Button size="sm" variant="ghost">
                {isAr ? "اللوحة" : "The board"}
                <ArrowRight className="size-4 rtl:rotate-180" aria-hidden />
              </Button>
            </Link>
          </>
        }
      />

      {reporting && (
        <LostFoundForm
          kind={reporting}
          isAr={isAr}
          onCancel={() => setReporting(null)}
          onCreated={() => {
            setReporting(null);
            refresh();
            // Publishing is half the job — point straight at the other half.
            toast({
              title: isAr ? "الإعلان منشور" : "Your notice is live",
              description: isAr
                ? "شاركه الحين في واتساب مجموعات حيّك — الأزرار تحت الإعلان."
                : "Now share it to your neighbourhood WhatsApp groups — the buttons are under the notice.",
              variant: "success",
            });
          }}
        />
      )}

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => void refetch()} retrying={isFetching} />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28 rounded-3xl" />
          <Skeleton className="h-28 rounded-3xl" />
        </div>
      ) : (data?.items.length ?? 0) === 0 ? (
        <IlloEmpty
          name="paw"
          tone="sage"
          title={isAr ? "ما عندك إعلان — وهذا الأفضل" : "No notices — which is how it should stay"}
          body={
            isAr
              ? "لو احتجت يوماً، تنشر هنا في أقل من دقيقة، ويتفعّل وضع «مفقود» على هوية قطك تلقائياً."
              : "If you ever need it, posting takes under a minute and your cat's Cat ID switches to lost mode automatically."
          }
          action={
            <Button size="sm" variant="outline" onClick={() => setReporting("LOST")}>
              {isAr ? "بلّغ عن قط مفقود" : "Report a lost cat"}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {data?.items.map((post) => (
            <NoticeRow key={post.id} post={post} isAr={isAr} onChanged={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}

function NoticeRow({
  post,
  isAr,
  onChanged,
}: {
  post: LostFoundCard & { description: string; messageCount: number };
  isAr: boolean;
  onChanged: () => void;
}) {
  const { authedFetch } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const name = post.catName ? localizeName(post.catName, isAr ? "ar" : "en") : null;
  const city = cityLabel(post.city, isAr);
  const active = post.status === "ACTIVE";

  const messages = useQuery({
    queryKey: ["lost-found-messages", post.id],
    queryFn: () => authedFetch<{ items: LostFoundMessage[] }>(`/lost-found/posts/${post.id}/messages`),
    enabled: open,
  });

  const setStatus = useMutation({
    mutationFn: (status: "ACTIVE" | "REUNITED" | "CLOSED") =>
      authedFetch(`/lost-found/posts/${post.id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: (_r, status) => {
      toast({
        title:
          status === "REUNITED"
            ? isAr
              ? "الحمد لله 🤍"
              : "Wonderful news 🤍"
            : status === "CLOSED"
              ? isAr
                ? "أغلقنا الإعلان"
                : "Notice closed"
              : isAr
                ? "الإعلان شغّال مرة ثانية"
                : "Notice re-opened",
        description:
          status === "REUNITED"
            ? isAr
              ? "وأوقفنا وضع «مفقود» على هويته."
              : "We've also switched their Cat ID out of lost mode."
            : undefined,
      });
      onChanged();
    },
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        <Link href={`/lost-found/${post.id}`} className="shrink-0">
          <ImgWithFallback
            src={post.photoUrl}
            alt={name ?? ""}
            className="size-16 rounded-xl object-cover"
            fallback={
              <span className="grid size-16 place-items-center rounded-xl bg-cream/60">
                <Illo3D name="cat" className="size-12" px={64} shadow={false} />
              </span>
            }
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/lost-found/${post.id}`} className="truncate font-display font-semibold hover:underline">
              {name ?? (isAr ? "قط بدون اسم" : "An unnamed cat")}
            </Link>
            <Badge variant={post.status === "REUNITED" ? "default" : post.kind === "LOST" && active ? "destructive" : "secondary"}>
              {lostFoundStatusLabel(post.kind, post.status, isAr)}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[city, relativeTime(post.happenedAt, isAr)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button
          size="sm"
          variant={post.messageCount > 0 ? "primary" : "outline"}
          onClick={() => setOpen((v) => !v)}
          className="shrink-0"
        >
          <MessageCircle className="size-4" aria-hidden />
          {post.messageCount > 0 ? post.messageCount : isAr ? "الرسائل" : "Messages"}
        </Button>
      </div>

      {/* Reach is the job: the share row is always in view on a live notice,
          never behind the messages toggle (R005, R048). */}
      {active && (
        <div className="border-t border-border px-3 py-2.5">
          <LostFoundShare notice={post} isAr={isAr} compact />
        </div>
      )}

      {open && (
        <div className="space-y-3 border-t border-border bg-muted/30 p-3">
          {messages.isLoading ? (
            <Skeleton className="h-16 rounded-xl" />
          ) : (messages.data?.items.length ?? 0) === 0 ? (
            <p className="py-3 text-center text-sm text-muted-foreground">
              {isAr
                ? "ما وصل شي بعد. شارك الإعلان في مجموعات حيّك من الأزرار فوق — هذا اللي يفرق."
                : "Nothing yet. Share the notice to your neighbourhood groups with the buttons above — that's what moves the needle."}
            </p>
          ) : (
            <ul className="space-y-2">
              {messages.data?.items.map((m) => (
                <li key={m.id} className="rounded-xl border border-border bg-background p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">{m.name ?? (isAr ? "أحدهم" : "Someone")}</p>
                    <span className="text-xs text-muted-foreground">{relativeTime(m.createdAt, isAr)}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>
                  {m.phone && (
                    <a
                      href={`tel:${m.phone}`}
                      dir="ltr"
                      className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-primary"
                    >
                      {m.phone}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {active ? (
              <>
                <Button size="sm" onClick={() => setStatus.mutate("REUNITED")} disabled={setStatus.isPending}>
                  {setStatus.isPending ? <Loader2 className="size-4 animate-spin" /> : <Home className="size-4" />}
                  {post.kind === "LOST"
                    ? isAr
                      ? "رجع لي 🎉"
                      : "They're home 🎉"
                    : isAr
                      ? "وصل صاحبه 🎉"
                      : "Owner found them 🎉"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setStatus.mutate("CLOSED")}
                  disabled={setStatus.isPending}
                >
                  <XCircle className="size-4" aria-hidden />
                  {isAr ? "أغلق الإعلان" : "Close the notice"}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus.mutate("ACTIVE")}
                disabled={setStatus.isPending}
              >
                {setStatus.isPending && <Loader2 className="size-4 animate-spin" />}
                {isAr ? "أعد فتح الإعلان" : "Re-open the notice"}
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
