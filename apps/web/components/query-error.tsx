"use client";

/**
 * QueryError — the blameless recovery state for a failed authed query (R112).
 *
 * An error is never a dead end and never the member's fault: it's a warm
 * "we couldn't reach it, let's try again" with a single, honest action.
 * This is deliberately NOT the empty state — an empty list means "nothing yet"
 * (a welcome, R111); an error means "we couldn't load what's there" (recovery).
 */
import * as React from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { Card, Button } from "@moraqat/ui";
import { IlloPaw } from "@/components/illustrations";

export function QueryError({
  isAr,
  onRetry,
  retrying,
  title,
  className,
}: {
  isAr: boolean;
  onRetry: () => void;
  /** Show a spinner while the refetch is in flight. */
  retrying?: boolean;
  /** Optional override for the reassuring headline. */
  title?: string;
  className?: string;
}) {
  return (
    <Card className={"relative flex flex-col items-center gap-4 overflow-hidden p-10 text-center " + (className ?? "")}>
      <IlloPaw tone="peach" className="pointer-events-none absolute start-8 top-6 size-7 rotate-[-14deg] opacity-50" />
      <IlloPaw tone="butter" className="pointer-events-none absolute bottom-6 end-10 size-7 rotate-[18deg] opacity-50" />
      <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <RefreshCw className="size-6" />
      </span>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        {title ?? (isAr ? "تعذّر تحميل هذا الآن — لا شيء مفقود، فقط لم نصل إليه" : "We couldn't load this just now — nothing's lost, we just couldn't reach it")}
      </p>
      <Button size="sm" variant="outline" onClick={onRetry} disabled={retrying}>
        {retrying ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        {isAr ? "أعد المحاولة" : "Try again"}
      </Button>
    </Card>
  );
}
