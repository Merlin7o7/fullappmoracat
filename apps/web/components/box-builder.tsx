"use client";

// ════════════════════════════════════════════════════════════════════════
//  Box builder — "make it yours" before the ask.
//
//  Each consumable line (wet food, dry food, litter, treats) is computed into
//  the plan; here the member picks the BRAND + FLAVOR for each, pre-filled with
//  our recommendation so keeping the whole box is zero taps (R002/R005). Price
//  never changes — the flat plan price covers any choice. In-stock options come
//  first; popular "we'll source it" options are labelled honestly (R006).
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Sparkles, PackageCheck, Clock } from "lucide-react";
import { Card, Badge, Skeleton, cn } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";

export interface BoxOption {
  productId: string;
  brandEn: string;
  brandAr: string;
  flavorEn: string | null;
  flavorAr: string | null;
  inStock: boolean;
  recommended: boolean;
}
export interface BoxLine {
  contentId: string;
  label: string;
  quantity: number;
  unit: string;
  selectable: boolean;
  defaultProductId: string | null;
  options?: BoxOption[];
}
interface BoxData {
  planId: string;
  tier: string;
  lines: BoxLine[];
}

/** contentId → chosen productId. */
export type BoxSelections = Record<string, string>;

export function BoxBuilder({
  planId,
  isAr,
  onChange,
}: {
  planId: string;
  isAr: boolean;
  onChange: (selections: BoxSelections) => void;
}) {
  const { authedFetch, user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["plan-box", planId],
    queryFn: () => authedFetch<BoxData>(`/plans/${planId}/box`),
    enabled: !!user && !!planId,
    staleTime: 5 * 60_000,
  });

  const [selections, setSelections] = React.useState<BoxSelections>({});
  const [openLine, setOpenLine] = React.useState<string | null>(null);

  // Seed each choosable line with its recommended default the moment data lands.
  React.useEffect(() => {
    if (!data) return;
    const init: BoxSelections = {};
    for (const line of data.lines) {
      const opts = line.options;
      if (!line.selectable || !opts || opts.length === 0) continue;
      const rec = opts.find((o) => o.recommended) ?? opts[0];
      if (rec) init[line.contentId] = rec.productId;
    }
    setSelections(init);
    onChange(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const pick = (contentId: string, productId: string) => {
    const next = { ...selections, [contentId]: productId };
    setSelections(next);
    onChange(next);
    setOpenLine(null);
  };

  if (isLoading) {
    return (
      <Card className="space-y-3 p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </Card>
    );
  }
  // A box builder is a delight, not a gate — if it can't load, the plan's
  // recommended defaults still ship. Fail quiet rather than block checkout.
  if (isError || !data) return null;

  const selectableLines = data.lines.filter((l) => l.selectable && l.options?.length);
  if (!selectableLines.length) return null;

  const optlabel = (o: BoxOption) => {
    const brand = isAr ? o.brandAr : o.brandEn;
    const flavor = isAr ? o.flavorAr : o.flavorEn;
    return flavor ? `${brand} · ${flavor}` : brand;
  };

  return (
    <Card className="space-y-4 p-6">
      <div>
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles className="size-4 text-primary" aria-hidden />
          {isAr ? "خصّص صندوقك" : "Make your box yours"}
        </h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {isAr
            ? "اختر العلامة والنكهة لكل صنف — أو خلّ اختياراتنا كما هي. السعر ثابت مهما اخترت."
            : "Pick a brand & flavor for each — or keep our picks. The price stays the same whatever you choose."}
        </p>
      </div>

      <div className="space-y-2">
        {data.lines.map((line) => {
          const isSelectable = line.selectable && line.options?.length;
          const chosen =
            isSelectable && line.options
              ? line.options.find((o) => o.productId === selections[line.contentId])
              : undefined;
          const open = openLine === line.contentId;

          if (!isSelectable) {
            // Fixed line (e.g. grooming) — included, no choice offered.
            return (
              <div
                key={line.contentId}
                className="flex items-center gap-2 rounded-xl border border-border/70 bg-muted/20 p-3 text-sm"
              >
                <Check className="size-4 shrink-0 text-success" aria-hidden />
                <span className="font-medium">{line.label}</span>
                <span className="ms-auto text-xs text-muted-foreground tabular" dir="ltr">
                  ×{line.quantity}
                </span>
              </div>
            );
          }

          return (
            <div key={line.contentId} className="rounded-xl border border-border">
              <button
                type="button"
                onClick={() => setOpenLine(open ? null : line.contentId)}
                aria-expanded={open}
                className="flex w-full min-h-11 items-center gap-3 p-3 text-start transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    {line.label}
                    <span className="tabular" dir="ltr">
                      ×{line.quantity}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold">
                    {chosen ? optlabel(chosen) : isAr ? "اختر…" : "Choose…"}
                  </span>
                </span>
                {chosen && (
                  <SourcingChip inStock={chosen.inStock} isAr={isAr} />
                )}
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none",
                    open && "rotate-180"
                  )}
                  aria-hidden
                />
              </button>

              {open && line.options && (
                <div
                  role="radiogroup"
                  aria-label={line.label}
                  className="space-y-1 border-t border-border p-2"
                >
                  {line.options.map((o) => {
                    const selected = selections[line.contentId] === o.productId;
                    return (
                      <button
                        key={o.productId}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => pick(line.contentId, o.productId)}
                        className={cn(
                          "flex w-full min-h-11 items-center gap-2.5 rounded-lg border p-2.5 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected ? "border-primary bg-primary/[0.06]" : "border-transparent hover:bg-muted/50"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "grid size-4 shrink-0 place-items-center rounded-full border",
                            selected ? "border-primary" : "border-muted-foreground/40"
                          )}
                        >
                          {selected && <span className="size-2 rounded-full bg-primary" />}
                        </span>
                        <span className="min-w-0 flex-1 text-sm">{optlabel(o)}</span>
                        {o.recommended && (
                          <Badge variant="success" className="shrink-0 gap-1 text-[10px]">
                            <Sparkles className="size-2.5" />
                            {isAr ? "نرشّحه" : "Our pick"}
                          </Badge>
                        )}
                        <SourcingChip inStock={o.inStock} isAr={isAr} compact />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Honest availability label — in stock now vs. we'll source it (R006). */
function SourcingChip({ inStock, isAr, compact }: { inStock: boolean; isAr: boolean; compact?: boolean }) {
  if (inStock) {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success",
          compact && "px-1.5"
        )}
      >
        <PackageCheck className="size-3" aria-hidden />
        {isAr ? "متوفر" : "In stock"}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground",
        compact && "px-1.5"
      )}
      title={isAr ? "نوفّره لك خصيصاً" : "We'll source it for you"}
    >
      <Clock className="size-3" aria-hidden />
      {isAr ? "نوفّره لك" : "We'll source it"}
    </span>
  );
}
