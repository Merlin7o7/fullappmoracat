"use client";

import * as React from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Loader2, X } from "lucide-react";
import { Badge, Button, Card, Skeleton, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { ImgWithFallback } from "@/components/img-with-fallback";
import { IlloEmpty, IlloHeader } from "@/components/illo-panel";
import { Illo3D } from "@/components/illo-3d";
import { QueryError } from "@/components/query-error";
import { localizeName } from "@/lib/translit";
import { formatDate, relativeTime } from "@/lib/datetime";
import { transferStatusLabel, type MyTransfers, type TransferCard } from "@/lib/cat-life-api";

/**
 * Cat IDs on the move — mine, both directions.
 *
 * Incoming first, always. An offer waiting on me is someone else's cat in
 * limbo; my own outgoing offer is just patience (R005).
 *
 * Accepting is deliberately NOT possible from this list: it routes to the
 * transfer page, where the inheritance is spelled out and the confirmation
 * lives. A cat should never change hands from a row in a table.
 */
export default function PortalTransfersPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { authedFetch } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["my-transfers"],
    queryFn: () => authedFetch<MyTransfers>("/transfers"),
  });

  const cancel = useMutation({
    mutationFn: (id: string) => authedFetch(`/transfers/${id}/cancel`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: isAr ? "سحبنا العرض" : "Offer withdrawn" });
      void queryClient.invalidateQueries({ queryKey: ["my-transfers"] });
    },
  });

  const incoming = data?.incoming ?? [];
  const outgoing = data?.outgoing ?? [];
  const pendingIncoming = incoming.filter((t) => t.status === "PENDING");
  const nothing = incoming.length === 0 && outgoing.length === 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <IlloHeader
        name="paw"
        tone="sage"
        align="start"
        eyebrow={isAr ? "نقل الملكية" : "Hand-overs"}
        title={isAr ? "هويات في الطريق" : "Cat IDs on the move"}
        body={
          isAr
            ? "كل نقل هنا ينقل الهوية بنفس رقمها، والسجل الصحي كاملاً — القط ما يبدأ من الصفر أبداً."
            : "Every hand-over here moves the Cat ID with its number, and the whole health record — a cat never starts over."
        }
      />

      {isError ? (
        <QueryError isAr={isAr} onRetry={() => void refetch()} retrying={isFetching} />
      ) : isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-24 rounded-3xl" />
        </div>
      ) : nothing ? (
        <IlloEmpty
          name="cat"
          tone="cream"
          title={isAr ? "ما في نقل جارٍ" : "Nothing is moving"}
          body={
            isAr
              ? "لو احتجت تسلّم قطك لأحد، تلقى الزر داخل صفحة القط نفسه."
              : "If you ever need to hand a cat to someone, you'll find it inside that cat's own page."
          }
          action={
            <Link href="/portal/cats">
              <Button size="sm">{isAr ? "قططي" : "My cats"}</Button>
            </Link>
          }
        />
      ) : (
        <>
          {incoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <ArrowDownLeft className="size-4 text-primary" aria-hidden />
                {isAr ? "موجّه إليك" : "Offered to you"}
                {pendingIncoming.length > 0 && (
                  <Badge variant="default">{pendingIncoming.length}</Badge>
                )}
              </h2>
              {incoming.map((t) => (
                <TransferRow key={t.id} transfer={t} isAr={isAr} />
              ))}
            </section>
          )}

          {outgoing.length > 0 && (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <ArrowUpRight className="size-4 text-muted-foreground" aria-hidden />
                {isAr ? "أرسلتها" : "Sent by you"}
              </h2>
              {outgoing.map((t) => (
                <TransferRow
                  key={t.id}
                  transfer={t}
                  isAr={isAr}
                  onCancel={t.status === "PENDING" ? () => cancel.mutate(t.id) : undefined}
                  cancelling={cancel.isPending}
                />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TransferRow({
  transfer,
  isAr,
  onCancel,
  cancelling,
}: {
  transfer: TransferCard;
  isAr: boolean;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const name = localizeName(transfer.cat.name, isAr ? "ar" : "en");
  const pending = transfer.status === "PENDING";
  const incoming = transfer.direction === "incoming";

  return (
    <Card className="flex flex-wrap items-center gap-3 p-3">
      <ImgWithFallback
        src={transfer.cat.photoUrl}
        alt={name}
        className="size-16 shrink-0 rounded-xl object-cover"
        fallback={
          <span className="grid size-16 shrink-0 place-items-center rounded-xl bg-cream/60">
            <Illo3D name="cat" className="size-12" px={64} shadow={false} />
          </span>
        }
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-display font-semibold">{name}</p>
          <Badge variant={transfer.status === "ACCEPTED" ? "default" : pending ? "secondary" : "outline"}>
            {transferStatusLabel(transfer.status, isAr)}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {incoming
            ? isAr
              ? `من ${transfer.fromName ?? "عضو"} · ${relativeTime(transfer.createdAt, true)}`
              : `From ${transfer.fromName ?? "a member"} · ${relativeTime(transfer.createdAt, false)}`
            : isAr
              ? `إلى ${transfer.toEmail} · ${relativeTime(transfer.createdAt, true)}`
              : `To ${transfer.toEmail} · ${relativeTime(transfer.createdAt, false)}`}
        </p>
        {pending && (
          <p className="text-xs text-muted-foreground">
            {isAr
              ? `ينتهي ${formatDate(transfer.expiresAt, "ar")}`
              : `Expires ${formatDate(transfer.expiresAt, "en")}`}
          </p>
        )}
        {transfer.cat.catIdNumber && (
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground" dir="ltr">
            {transfer.cat.catIdNumber}
          </p>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        {/* Incoming offers route to the page that explains what is being
            inherited — never a one-tap accept from a list. The id stands in for
            the emailed token for the person it is addressed to, so a deleted
            email never strands a cat. */}
        {incoming && pending && (
          <Link href={`/transfer/${transfer.id}`}>
            <Button size="sm">{isAr ? "شوف العرض" : "See the offer"}</Button>
          </Link>
        )}
        {onCancel && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            onClick={onCancel}
            disabled={cancelling}
          >
            {cancelling ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
            {isAr ? "اسحب" : "Withdraw"}
          </Button>
        )}
      </div>
    </Card>
  );
}
