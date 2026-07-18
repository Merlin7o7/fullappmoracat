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
  /** Guided-picker facets, derived server-side from the catalog. */
  lifeStage: "KITTEN" | "ADULT" | "SENIOR";
  sterilized: boolean;
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
  catLifeStage,
  catSterilized,
}: {
  planId: string;
  isAr: boolean;
  onChange: (selections: BoxSelections) => void;
  /** Seed the guided picker's facets from the target cat's own profile —
   *  recognition first (R001): the member never re-answers what we know. */
  catLifeStage?: "KITTEN" | "ADULT" | "SENIOR" | null;
  catSterilized?: boolean | null;
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
                <LinePicker
                  line={line}
                  chosenId={selections[line.contentId]}
                  isAr={isAr}
                  onPick={(productId) => pick(line.contentId, productId)}
                  catLifeStage={catLifeStage}
                  catSterilized={catSterilized}
                />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/**
 * The guided picker — premium selection, one considered choice at a time:
 * life stage → sterilised → brand → flavor. Prefilled from the current pick so
 * keeping our recommendation stays zero-tap (R002); facets only appear where
 * the catalog actually differentiates (no empty questions, R005).
 */
function LinePicker({
  line,
  chosenId,
  isAr,
  onPick,
  catLifeStage,
  catSterilized,
}: {
  line: BoxLine;
  chosenId?: string;
  isAr: boolean;
  onPick: (productId: string) => void;
  catLifeStage?: "KITTEN" | "ADULT" | "SENIOR" | null;
  catSterilized?: boolean | null;
}) {
  const opts = line.options ?? [];
  const chosen = opts.find((o) => o.productId === chosenId);
  // Our recommendation stays reachable no matter how the facets are set —
  // "keep our pick" must never be filtered out of existence (R005).
  const recommendedOpt = React.useMemo(() => opts.find((o) => o.recommended) ?? null, [opts]);

  const stages = React.useMemo(
    () => (["KITTEN", "ADULT", "SENIOR"] as const).filter((s) => opts.some((o) => o.lifeStage === s)),
    [opts]
  );
  const hasStageFacet = stages.length > 1;
  const hasSterFacet = opts.some((o) => o.sterilized);

  // Facets open pre-answered from what we already know: the current pick first,
  // then the cat's own profile (R001 — never re-ask what the profile holds).
  const [stage, setStage] = React.useState<"KITTEN" | "ADULT" | "SENIOR">(
    chosen?.lifeStage ?? catLifeStage ?? "ADULT"
  );
  const [ster, setSter] = React.useState<boolean>(chosen?.sterilized ?? catSterilized ?? false);
  const [brand, setBrand] = React.useState<string | null>(chosen?.brandEn ?? null);

  // Facet filters. Sterilised = yes still shows regular food (it's suitable) with
  // sterilised formulas first; = no hides sterilised-specific formulas. The
  // recommended pick is pinned back in (first) whenever filters would hide it.
  const filtered = React.useMemo(() => {
    let arr = opts;
    if (hasStageFacet) arr = arr.filter((o) => o.lifeStage === stage);
    arr = ster ? arr.slice().sort((a, b) => Number(b.sterilized) - Number(a.sterilized)) : arr.filter((o) => !o.sterilized);
    if (recommendedOpt && !arr.some((o) => o.productId === recommendedOpt.productId)) {
      arr = [recommendedOpt, ...arr];
    }
    return arr;
  }, [opts, hasStageFacet, stage, ster, recommendedOpt]);

  const brands = React.useMemo(() => {
    const seen = new Map<string, { en: string; ar: string }>();
    for (const o of filtered) if (!seen.has(o.brandEn)) seen.set(o.brandEn, { en: o.brandEn, ar: o.brandAr });
    return [...seen.values()];
  }, [filtered]);

  // Keep the brand valid as facets change; auto-pick when only one remains.
  React.useEffect(() => {
    if (brand && !brands.some((b) => b.en === brand)) setBrand(null);
    if (!brand && brands.length === 1 && brands[0]) setBrand(brands[0].en);
  }, [brand, brands]);

  const flavors = React.useMemo(() => filtered.filter((o) => o.brandEn === brand), [filtered, brand]);

  const stageLabel: Record<string, [string, string]> = {
    KITTEN: ["Kitten", "صغير (هريرة)"],
    ADULT: ["Adult", "بالغ"],
    SENIOR: ["Senior", "كبير السن"],
  };

  return (
    <div className="space-y-4 border-t border-border p-4">
      {hasStageFacet && (
        <Facet label={isAr ? "لمن هذا الطعام؟" : "Who is it for?"}>
          {stages.map((s) => (
            <FacetChip key={s} selected={stage === s} onClick={() => setStage(s)}>
              {isAr ? stageLabel[s]?.[1] : stageLabel[s]?.[0]}
            </FacetChip>
          ))}
        </Facet>
      )}

      {hasSterFacet && (
        <Facet label={isAr ? "معقّم / محيّد؟" : "Sterilised / neutered?"}>
          <FacetChip selected={ster} onClick={() => setSter(true)}>
            {isAr ? "نعم" : "Yes"}
          </FacetChip>
          <FacetChip selected={!ster} onClick={() => setSter(false)}>
            {isAr ? "لا" : "No"}
          </FacetChip>
        </Facet>
      )}

      <Facet label={isAr ? "العلامة التجارية" : "Brand"}>
        {brands.map((b) => (
          <FacetChip key={b.en} selected={brand === b.en} onClick={() => setBrand(b.en)}>
            {isAr ? b.ar : b.en}
          </FacetChip>
        ))}
        {brands.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {isAr ? "لا توجد خيارات لهذه التركيبة — جرّب تغيير الفلاتر" : "No options for this combination — try adjusting the filters"}
          </p>
        )}
      </Facet>

      {brand && flavors.length > 0 && (
        <div role="radiogroup" aria-label={isAr ? "النكهة" : "Flavor"} className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{isAr ? "النكهة" : "Flavor"}</p>
          {flavors.map((o) => {
            const selected = o.productId === chosenId;
            const flavor = isAr ? o.flavorAr : o.flavorEn;
            return (
              <button
                key={o.productId}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onPick(o.productId)}
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
                <span className="min-w-0 flex-1 text-sm">
                  {flavor ?? (isAr ? "التركيبة الأساسية" : "Original recipe")}
                  {o.sterilized && (
                    <span className="ms-1.5 text-[10px] text-muted-foreground">
                      {isAr ? "· تركيبة للمعقّم" : "· sterilised formula"}
                    </span>
                  )}
                </span>
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
}

function Facet({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FacetChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "min-h-11 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/10 font-medium text-foreground"
          : "border-border text-muted-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
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
