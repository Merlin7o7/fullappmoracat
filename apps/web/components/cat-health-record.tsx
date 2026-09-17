"use client";

import * as React from "react";
import { Syringe, Scale, Pill, Stethoscope, BadgeCheck, CalendarClock } from "lucide-react";
import { Badge, Card, cn } from "@moraqat/ui";
import { formatDate } from "@/lib/datetime";

/**
 * The read-only half of the living record (MRC-PROD-001 T3): what clinics
 * wrote, shown to the owner. The API already projected every entry through
 * `describeEntryForOwner`; this component only lays the facts out.
 */

export interface Bilingual { ar: string; en: string }

export interface HealthRecord {
  cat: {
    id: string;
    name: string;
    microchipNo: string | null;
    allergies: string[];
    healthConditions: string[];
    currentMedications: string | null;
    currentFood: string | null;
    emergencyNotes: string | null;
    acquisitionSource: string | null;
    district: string | null;
    homeBranch: { id: string; name: Bilingual; clinic: Bilingual; phone: string | null } | null;
    emergencyContact: { name: string; phone: string; relation: string | null } | null;
  };
  vaccination: {
    standing: "UP_TO_DATE" | "DUE_SOON" | "OVERDUE" | "UNKNOWN";
    nextDueAt: string | null;
    overdueSince: string | null;
    daysUntilDue: number | null;
    records: { id: string; name: string; administeredAt: string; dueAt: string | null; vetName: string | null; clinic: Bilingual | null; verified: boolean }[];
  };
  weights: { id: string; weightKg: number; bcs: number | null; measuredAt: string; source: string }[];
  prescriptions: { id: string; medication: string; strength: string | null; form: string | null; dosage: string; frequency: string; durationDays: number | null; status: string; issuedAt: string; clinic: Bilingual }[];
  clinicalEntries: { id: string; type: string; occurredAt: string; visitId: string | null; clinic: Bilingual; title: Bilingual; summary: Bilingual | null }[];
  visits: { id: string; checkedInAt: string; closedAt: string | null; state: string; reason: string | null; ownerSummary: string | null; followUpAt: string | null; clinic: Bilingual }[];
}

const pick = (b: Bilingual | null | undefined, isAr: boolean) => (b ? (isAr ? b.ar : b.en) : "");

export function StandingBadge({ standing, isAr }: { standing: HealthRecord["vaccination"]["standing"]; isAr: boolean }) {
  const map = {
    UP_TO_DATE: { ar: "التطعيمات محدّثة", en: "Vaccinations up to date", cls: "bg-success/15 text-success" },
    DUE_SOON: { ar: "جرعة قريبة", en: "A dose is due soon", cls: "bg-warning/20 text-warning-foreground" },
    OVERDUE: { ar: "جرعة متأخرة", en: "A dose is overdue", cls: "bg-destructive/10 text-destructive" },
    UNKNOWN: { ar: "لا نعرف موعد الجرعة القادمة", en: "Next dose not recorded", cls: "bg-muted text-muted-foreground" },
  } as const;
  const m = map[standing];
  return (
    <span className={cn("inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold", m.cls)}>
      <Syringe className="size-3.5" /> {isAr ? m.ar : m.en}
    </span>
  );
}

export function CatHealthRecord({ record, isAr }: { record: HealthRecord; isAr: boolean }) {
  const fmt = (d: string | null | undefined) => (d ? formatDate(d, isAr ? "ar" : "en", { day: "numeric", month: "short", year: "numeric" }) : "—");
  const { vaccination, weights, prescriptions, clinicalEntries, visits, cat } = record;
  const timeline = React.useMemo(
    () => [...clinicalEntries].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    [clinicalEntries]
  );
  const nothingYet = !vaccination.records.length && !weights.length && !prescriptions.length && !timeline.length && !visits.length;

  return (
    <div className="space-y-6">
      {/* Standing — the one line that answers "is my cat protected?" */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <StandingBadge standing={vaccination.standing} isAr={isAr} />
        <p className="text-sm text-muted-foreground">
          {vaccination.nextDueAt
            ? isAr ? `الجرعة القادمة ${fmt(vaccination.nextDueAt)}` : `Next dose ${fmt(vaccination.nextDueAt)}`
            : vaccination.overdueSince
              ? isAr ? `متأخرة منذ ${fmt(vaccination.overdueSince)}` : `Overdue since ${fmt(vaccination.overdueSince)}`
              : isAr ? "سجّل جرعة بموعدها القادم وسنذكّرك" : "Record a dose with its next date and we'll remind you"}
        </p>
      </Card>

      {nothingYet && (
        <Card className="p-8 text-center">
          <Stethoscope className="mx-auto mb-3 size-6 text-primary" />
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
            {isAr
              ? `سجل ${cat.name} يبدأ من هنا. أضف أول تطعيم أدناه، أو اطلب من عيادتك مسح هوية ${cat.name} في الزيارة القادمة — وسيُكتب السجل هنا تلقائياً.`
              : `${cat.name}'s record starts here. Add the first vaccination below, or ask your clinic to scan ${cat.name}'s ID at the next visit — the record is written here automatically.`}
          </p>
        </Card>
      )}

      {/* Vaccinations */}
      {vaccination.records.length > 0 && (
        <Section icon={Syringe} title={isAr ? "التطعيمات" : "Vaccinations"}>
          {vaccination.records.map((v) => (
            <Row
              key={v.id}
              title={v.name}
              meta={[fmt(v.administeredAt), v.dueAt ? (isAr ? `التالية ${fmt(v.dueAt)}` : `next ${fmt(v.dueAt)}`) : "", pick(v.clinic, isAr) || v.vetName || ""].filter(Boolean).join(" · ")}
              badge={v.verified ? <Verified isAr={isAr} /> : <Badge variant="outline" className="text-[10px]">{isAr ? "مُدخل يدوياً" : "Self-reported"}</Badge>}
            />
          ))}
        </Section>
      )}

      {/* Weight */}
      {weights.length > 0 && (
        <Section icon={Scale} title={isAr ? "الوزن" : "Weight"}>
          <WeightChart points={weights} isAr={isAr} />
          <p className="text-xs text-muted-foreground">
            {isAr ? `آخر قياس ${weights[weights.length - 1]!.weightKg} كجم في ${fmt(weights[weights.length - 1]!.measuredAt)}` : `Latest ${weights[weights.length - 1]!.weightKg} kg on ${fmt(weights[weights.length - 1]!.measuredAt)}`}
          </p>
        </Section>
      )}

      {/* Prescriptions */}
      {prescriptions.length > 0 && (
        <Section icon={Pill} title={isAr ? "الوصفات" : "Prescriptions"}>
          {prescriptions.map((rx) => (
            <Row
              key={rx.id}
              title={[rx.medication, rx.strength].filter(Boolean).join(" ")}
              meta={[rx.dosage, rx.frequency, rx.durationDays ? (isAr ? `${rx.durationDays} يوم` : `${rx.durationDays} days`) : "", fmt(rx.issuedAt), pick(rx.clinic, isAr)].filter(Boolean).join(" · ")}
              badge={<Badge variant="secondary" className="text-[10px]">{rxStatus(rx.status, isAr)}</Badge>}
            />
          ))}
        </Section>
      )}

      {/* Timeline of clinic entries */}
      {timeline.length > 0 && (
        <Section icon={CalendarClock} title={isAr ? "ما كتبته العيادة" : "What the clinic recorded"}>
          <ol className="relative space-y-3 border-s border-border ps-4">
            {timeline.map((e) => (
              <li key={e.id} className="relative">
                <span aria-hidden className="absolute -start-[21px] top-1.5 size-2.5 rounded-full bg-primary" />
                <p className="text-xs text-muted-foreground">{fmt(e.occurredAt)} · {pick(e.clinic, isAr)}</p>
                <p className="text-sm font-medium">{pick(e.title, isAr)}</p>
                {e.summary && <p className="text-xs text-muted-foreground">{pick(e.summary, isAr)}</p>}
              </li>
            ))}
          </ol>
        </Section>
      )}

      {/* Visits with owner summaries */}
      {visits.length > 0 && (
        <Section icon={Stethoscope} title={isAr ? "الزيارات" : "Visits"}>
          {visits.map((v) => (
            <Row
              key={v.id}
              title={v.reason || pick(v.clinic, isAr)}
              meta={[fmt(v.checkedInAt), pick(v.clinic, isAr), v.followUpAt ? (isAr ? `متابعة ${fmt(v.followUpAt)}` : `follow-up ${fmt(v.followUpAt)}`) : ""].filter(Boolean).join(" · ")}
              sub={v.ownerSummary}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: typeof Syringe; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Icon className="size-4 text-primary" /> {title}</h2>
      {children}
    </section>
  );
}

function Row({ title, meta, sub, badge }: { title: string; meta: string; sub?: string | null; badge?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        {badge}
      </div>
      <p className="text-xs text-muted-foreground">{meta}</p>
      {sub && <p className="mt-1 text-sm leading-relaxed text-foreground/80">{sub}</p>}
    </div>
  );
}

function Verified({ isAr }: { isAr: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
      <BadgeCheck className="size-3" /> {isAr ? "موثّق من العيادة" : "Clinic-verified"}
    </span>
  );
}

function rxStatus(s: string, isAr: boolean) {
  const map: Record<string, [string, string]> = {
    ISSUED: ["Issued", "صادرة"], DISPENSED: ["Dispensed", "صُرفت"], COMPLETED: ["Completed", "مكتملة"], CANCELLED: ["Cancelled", "ملغاة"], EXPIRED: ["Expired", "منتهية"],
  };
  const [en, ar] = map[s] ?? [s, s];
  return isAr ? ar : en;
}

/** A small, honest line chart: one scale, the real values, the latest point emphasised. */
function WeightChart({ points, isAr }: { points: HealthRecord["weights"]; isAr: boolean }) {
  const W = 320, H = 96, PAD = 10;
  const vals = points.map((p) => p.weightKg);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(0.5, max - min);
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (points.length - 1));
  const y = (v: number) => H - PAD - ((v - min) / span) * (H - PAD * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.weightKg).toFixed(1)}`).join(" ");
  const last = points[points.length - 1]!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-24 w-full max-w-md" role="img" aria-label={isAr ? "منحنى الوزن" : "Weight trend"}>
      <line x1={PAD} x2={W - PAD} y1={H - PAD} y2={H - PAD} className="stroke-border" strokeWidth="1" />
      <path d={d} fill="none" className="stroke-primary" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => <circle key={p.id} cx={x(i)} cy={y(p.weightKg)} r="3" className="fill-primary" />)}
      <circle cx={x(points.length - 1)} cy={y(last.weightKg)} r="5" className="fill-primary stroke-background" strokeWidth="2" />
      <text x={PAD} y={PAD + 4} className="fill-muted-foreground" fontSize="9">{max} kg</text>
      <text x={PAD} y={H - PAD - 3} className="fill-muted-foreground" fontSize="9">{min} kg</text>
    </svg>
  );
}
