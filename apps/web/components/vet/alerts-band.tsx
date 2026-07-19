"use client";

// ════════════════════════════════════════════════════════════════════════
//  AlertsBand — the tier-0 safety strip (MRC-VET-001 §06, §21).
//
//  Design law, verbatim: "Alerts are deliberately in T0: a hidden allergy can
//  kill." So this component obeys three hard rules:
//
//   1. It is the TOP of the profile and never a tab, never collapsed, never
//      behind a consent grant. It renders identically at T0, T1 and T2, and
//      identically for a receptionist who cannot read one line of the record.
//   2. It is never a subtle chip. CRITICAL allergies get a SOLID destructive
//      fill (not a tint) because at arm's length across a consult room a
//      tinted pill reads as decoration. Colour is never the only carrier —
//      every group states its word and its icon too (R093).
//   3. Absence of a record is stated as absence of a RECORD, never as "no
//      allergies". Telling a vet "no allergies" when we only know "nothing
//      was written down" is the most dangerous sentence this product could
//      say (R006 — honest by default, admit coverage gaps).
//
//  Two postures: `compact` (profile header) and `display` (the emergency
//  break-glass screen — arm's-length type, maximum contrast, zero chrome).
// ════════════════════════════════════════════════════════════════════════

import * as React from "react";
import { AlertTriangle, Ban, HandHeart, Pill, ShieldAlert, Syringe } from "lucide-react";
import { cn } from "@moraqat/ui";
import { useLocale } from "@/app/providers";
import { formatDate } from "@/lib/datetime";
import type { MedicalAlert, Vaccination } from "@/lib/vet-api";

/**
 * A vaccination gap. The shared client models vaccinations, not gaps, so the
 * derivation lives here — and is deliberately conservative: a vaccine with no
 * `givenAt` is "no record", never "not vaccinated".
 */
export interface MissingVaccination {
  id: string;
  vaccine: string;
  status: "OVERDUE" | "DUE" | "NO_RECORD";
  dueAt?: string | null;
  overdueDays?: number;
}

const DAY = 86_400_000;

/** Derive the tier-0 vaccination gaps from the profile's vaccination list. */
export function deriveMissingVaccinations(
  vaccinations: Vaccination[] | undefined,
  isAr: boolean
): MissingVaccination[] {
  const now = Date.now();
  const out: MissingVaccination[] = [];
  for (const v of vaccinations ?? []) {
    const name = isAr ? v.nameAr : v.nameEn;
    if (!v.givenAt) {
      out.push({ id: v.id, vaccine: name, status: "NO_RECORD", dueAt: v.dueAt });
      continue;
    }
    if (!v.dueAt) continue;
    const due = new Date(v.dueAt).getTime();
    if (!Number.isFinite(due)) continue;
    if (due < now) {
      out.push({
        id: v.id,
        vaccine: name,
        status: "OVERDUE",
        dueAt: v.dueAt,
        overdueDays: Math.floor((now - due) / DAY),
      });
    } else if (due - now < 30 * DAY) {
      out.push({ id: v.id, vaccine: name, status: "DUE", dueAt: v.dueAt });
    }
  }
  return out;
}

type Posture = "compact" | "display";

type Weight = "solid" | "strong" | "steady" | "calm";

interface Group {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  labelAr: string;
  labelEn: string;
  weight: Weight;
  items: { id: string; primary: string; secondary?: string }[];
}

const SEVERITY_RANK: Record<MedicalAlert["severity"], number> = {
  CRITICAL: 0,
  IMPORTANT: 1,
  INFO: 2,
};

function severityWord(s: MedicalAlert["severity"], isAr: boolean): string {
  const map: Record<MedicalAlert["severity"], [string, string]> = {
    CRITICAL: ["حرِج", "Critical"],
    IMPORTANT: ["مهم", "Important"],
    INFO: ["للعلم", "For information"],
  };
  return isAr ? map[s][0] : map[s][1];
}

export function AlertsBand({
  alerts,
  missingVaccinations = [],
  posture = "compact",
  catName,
  className,
}: {
  alerts: MedicalAlert[];
  missingVaccinations?: MissingVaccination[];
  posture?: Posture;
  /** Used in the screen-reader summary so the announcement names the patient. */
  catName?: string;
  className?: string;
}) {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const display = posture === "display";

  const groups = React.useMemo<Group[]>(() => {
    const out: Group[] = [];
    const label = (a: MedicalAlert) => (isAr ? a.labelAr : a.labelEn);
    const bySeverity = (a: MedicalAlert, b: MedicalAlert) =>
      SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    const meta = (a: MedicalAlert) =>
      [
        severityWord(a.severity, isAr),
        a.notedAt
          ? isAr
            ? `سُجّل ${formatDate(a.notedAt, locale)}`
            : `noted ${formatDate(a.notedAt, locale)}`
          : "",
      ]
        .filter(Boolean)
        .join(" · ");

    const pick = (kind: MedicalAlert["kind"]) =>
      (alerts ?? []).filter((a) => a.kind === kind).sort(bySeverity);

    // Allergies lead, always — the single most lethal omission. A CRITICAL
    // allergy escalates the whole group to a solid fill.
    const allergies = pick("ALLERGY");
    if (allergies.length) {
      out.push({
        key: "allergies",
        icon: Ban,
        labelAr: "حساسية",
        labelEn: "Allergies",
        weight: allergies.some((a) => a.severity === "CRITICAL") ? "solid" : "strong",
        items: allergies.map((a) => ({ id: a.id, primary: label(a), secondary: meta(a) })),
      });
    }

    const conditions = pick("CONDITION");
    if (conditions.length) {
      out.push({
        key: "conditions",
        icon: ShieldAlert,
        labelAr: "حالات مزمنة",
        labelEn: "Chronic conditions",
        weight: conditions.some((a) => a.severity === "CRITICAL") ? "solid" : "strong",
        items: conditions.map((a) => ({ id: a.id, primary: label(a), secondary: meta(a) })),
      });
    }

    const meds = pick("MEDICATION");
    if (meds.length) {
      out.push({
        key: "medications",
        icon: Pill,
        labelAr: "أدوية حالية",
        labelEn: "Current medications",
        weight: meds.some((a) => a.severity === "CRITICAL") ? "strong" : "steady",
        items: meds.map((a) => ({ id: a.id, primary: label(a), secondary: meta(a) })),
      });
    }

    if (missingVaccinations.length) {
      out.push({
        key: "vaccinations",
        icon: Syringe,
        labelAr: "تحصينات ناقصة",
        labelEn: "Missing vaccinations",
        weight: missingVaccinations.some((v) => v.status === "OVERDUE") ? "steady" : "calm",
        items: missingVaccinations.map((v) => ({
          id: v.id,
          primary: v.vaccine,
          secondary:
            v.status === "OVERDUE"
              ? isAr
                ? `متأخر${typeof v.overdueDays === "number" ? ` ${v.overdueDays} يوم` : ""}`
                : `overdue${typeof v.overdueDays === "number" ? ` by ${v.overdueDays} days` : ""}`
              : v.status === "DUE"
                ? isAr
                  ? `مستحق${v.dueAt ? ` ${formatDate(v.dueAt, locale)}` : ""}`
                  : `due${v.dueAt ? ` ${formatDate(v.dueAt, locale)}` : ""}`
                : isAr
                  ? "لا يوجد سجل جرعة"
                  : "no dose on record",
        })),
      });
    }

    // Behaviour/handling notes are owner-authored: care quality, not
    // pathology, so they read calm — but they stay above the fold, because
    // "wrap her in a towel" prevents a bite before it happens (P6, R001).
    const behaviour = [...pick("BEHAVIOUR"), ...pick("OTHER")];
    if (behaviour.length) {
      out.push({
        key: "handling",
        icon: HandHeart,
        labelAr: "ملاحظات التعامل",
        labelEn: "Handling notes",
        weight: "calm",
        items: behaviour.map((a) => ({ id: a.id, primary: label(a), secondary: meta(a) })),
      });
    }

    return out;
  }, [alerts, missingVaccinations, isAr, locale]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  // The screen-reader sentence a vet hears BEFORE any visual scanning — it
  // leads with the count so nothing is buried in a list traversal (R095).
  const srSummary = total
    ? isAr
      ? `تنبيهات سريرية${catName ? ` لـ${catName}` : ""}: ${total}. ${groups
          .map((g) => `${g.labelAr}: ${g.items.map((i) => i.primary).join("، ")}`)
          .join(". ")}`
      : `Clinical alerts${catName ? ` for ${catName}` : ""}: ${total}. ${groups
          .map((g) => `${g.labelEn}: ${g.items.map((i) => i.primary).join(", ")}`)
          .join(". ")}`
    : isAr
      ? "لا توجد تنبيهات مسجّلة. غياب السجل ليس دليلاً على غياب الحساسية."
      : "No alerts recorded. An absent record is not proof that there is no allergy.";

  return (
    <section
      role="status"
      aria-live="polite"
      aria-label={isAr ? "تنبيهات سريرية" : "Clinical alerts"}
      className={cn(
        "overflow-hidden rounded-2xl border",
        total ? "border-destructive/45 bg-destructive/[0.06]" : "border-border bg-muted/50",
        display && "rounded-none border-x-0 border-t-0 border-b-2",
        className
      )}
    >
      <p className="sr-only">{srSummary}</p>

      <header
        className={cn(
          "flex items-center gap-2 border-b px-4 py-2.5",
          total ? "border-destructive/25" : "border-border",
          display && "px-5 py-4"
        )}
      >
        <AlertTriangle
          aria-hidden
          className={cn(
            total ? "text-destructive" : "text-muted-foreground",
            display ? "size-7" : "size-4"
          )}
        />
        <h2
          className={cn(
            "font-semibold tracking-tight",
            total ? "text-destructive" : "text-muted-foreground",
            display ? "text-2xl" : "text-sm"
          )}
        >
          {isAr ? "تنبيهات سريرية" : "Clinical alerts"}
        </h2>
        {total > 0 && (
          <span
            className={cn(
              "ms-auto rounded-full bg-destructive font-semibold tabular-nums text-destructive-foreground",
              display ? "px-3 py-1 text-lg" : "px-2 py-0.5 text-xs"
            )}
          >
            {total}
          </span>
        )}
        {/* Tier-0 provenance, stated so nobody wonders whether consent hid something. */}
        <span
          className={cn(
            "rounded-full border font-medium uppercase tracking-wide",
            total
              ? "border-destructive/30 text-destructive"
              : "ms-auto border-border text-muted-foreground",
            display ? "px-3 py-1 text-sm" : "ms-2 px-2 py-0.5 text-[10px]"
          )}
        >
          {isAr ? "دائماً مرئي" : "Always shown"}
        </span>
      </header>

      {total === 0 ? (
        <div className={cn("px-4 py-3", display && "px-5 py-5")}>
          <p className={cn("font-medium text-foreground", display ? "text-xl" : "text-sm")}>
            {isAr ? "لا توجد تنبيهات مسجّلة." : "No alerts recorded."}
          </p>
          <p className={cn("mt-1 text-muted-foreground", display ? "text-base" : "text-xs")}>
            {isAr
              ? "غياب السجل ليس دليلاً على غياب الحساسية — اسأل المالك قبل أي دواء."
              : "An absent record is not proof of no allergy — confirm with the owner before any drug."}
          </p>
        </div>
      ) : (
        <ul className={cn("divide-y", "divide-destructive/15")}>
          {groups.map((g) => {
            const Icon = g.icon;
            return (
              <li key={g.key} className={cn("px-4 py-3", display && "px-5 py-4")}>
                <div className="flex items-center gap-2">
                  <Icon
                    aria-hidden
                    className={cn(
                      display ? "size-5" : "size-3.5",
                      g.weight === "calm" ? "text-muted-foreground" : "text-destructive"
                    )}
                  />
                  <h3
                    className={cn(
                      "font-semibold uppercase tracking-wide",
                      g.weight === "calm" ? "text-muted-foreground" : "text-destructive",
                      display ? "text-base" : "text-[11px]"
                    )}
                  >
                    {isAr ? g.labelAr : g.labelEn}
                  </h3>
                </div>
                <ul className={cn("mt-2 flex flex-wrap gap-2", display && "mt-3 gap-3")}>
                  {g.items.map((it) => (
                    <li
                      key={it.id}
                      className={cn(
                        "rounded-xl",
                        display ? "px-4 py-3" : "px-3 py-1.5",
                        // Solid fill for the lethal ones: legible across a room.
                        g.weight === "solid" &&
                          "bg-destructive text-destructive-foreground shadow-e1",
                        g.weight === "strong" &&
                          "border border-destructive/40 bg-destructive/10 text-destructive",
                        g.weight === "steady" &&
                          "border border-warning/50 bg-warning/15 text-[hsl(38_92%_26%)] dark:text-warning",
                        g.weight === "calm" && "border border-border bg-card text-foreground"
                      )}
                    >
                      <span
                        className={cn(
                          "block font-semibold leading-tight",
                          display ? "text-xl" : "text-sm"
                        )}
                      >
                        {it.primary}
                      </span>
                      {it.secondary && (
                        <span
                          className={cn(
                            "block leading-tight opacity-85",
                            display ? "mt-1 text-base" : "text-xs"
                          )}
                        >
                          {it.secondary}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
