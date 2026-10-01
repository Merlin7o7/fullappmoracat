import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { AlertTriangle, BadgeCheck, FileText, Phone } from "lucide-react";
import { IdBand, Ledger, LedgerRow, Seal, StatusTag, type StatusTone } from "@moraqat/ui";
import { formatAge, formatDate, formatWeight } from "@moraqat/core";
import { PrintButton } from "@/components/print-button";

/**
 * The health summary a vet opens from an owner's link (W6).
 *
 * Built for a clinician with forty seconds: safety first (allergies,
 * conditions, current medication), then vaccinations, weight, recent clinical
 * history and documents. No navigation, no marketing, no account — a document
 * with a seal, printable as-is. Not indexed; the link expires.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

type Bi = { ar: string; en: string };
interface Summary {
  issuedAt: string;
  expiresAt: string;
  lastUpdatedAt: string | null;
  cat: {
    name: string; photoUrl: string | null; catIdNumber: string | null; breed: Bi | null; sex: string;
    birthDate: string | null; ageMonths: number | null; neutered: boolean | null; coatColor: string | null;
    weightKg: number | null; microchipNo: string | null;
  };
  owner: { firstName: string | null; phone: string | null };
  safety: { allergies: string[]; conditions: string[]; medications: string | null; food: string | null; emergencyNotes: string | null };
  vaccination: {
    standing: "UP_TO_DATE" | "DUE_SOON" | "OVERDUE" | "UNKNOWN";
    nextDueAt: string | null;
    records: { id: string; name: string; administeredAt: string; dueAt: string | null; clinic: Bi | null; verified: boolean }[];
  };
  weights: { id: string; weightKg: number; measuredAt: string; source: string }[];
  prescriptions: { id: string; medication: string; dosage: string; frequency: string; issuedAt: string; clinic: Bi }[];
  clinicalEntries: { id: string; occurredAt: string; clinic: Bi; title: Bi; summary: Bi | null }[];
  visits: { id: string; checkedInAt: string; reason: string | null; clinic: Bi }[];
  documents: { id: string; title: string; kind: string; url: string; createdAt: string }[];
}

async function load(token: string): Promise<{ data: Summary | null; gone: boolean }> {
  try {
    const res = await fetch(`${BASE}/api/public/health/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (res.status === 410) return { data: null, gone: true };
    if (!res.ok) return { data: null, gone: false };
    return { data: (await res.json()) as Summary, gone: false };
  } catch {
    return { data: null, gone: false };
  }
}

export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  return {
    title: isAr ? "ملخص صحي" : "Health summary",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

const STANDING: Record<Summary["vaccination"]["standing"], { tone: StatusTone; ar: string; en: string }> = {
  UP_TO_DATE: { tone: "positive", ar: "محدّثة", en: "Up to date" },
  DUE_SOON: { tone: "attention", ar: "موعد قريب", en: "Due soon" },
  OVERDUE: { tone: "critical", ar: "متأخرة", en: "Overdue" },
  UNKNOWN: { tone: "neutral", ar: "غير مسجّلة", en: "Not recorded" },
};

export default async function HealthSummaryPage({ params }: { params: { token: string } }) {
  const isAr = cookies().get("locale")?.value !== "en";
  const loc = isAr ? "ar" : "en";
  const { data, gone } = await load(params.token);
  const t = (ar: string, en: string) => (isAr ? ar : en);

  if (!data) {
    return (
      <main id="main" className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-4 text-center">
        <div className="space-y-3">
          <p className="font-display text-3xl">{gone ? t("انتهت صلاحية هذا الرابط", "This link has ended") : t("ما وجدنا هذا الملخص", "Summary not found")}</p>
          <p className="text-muted-foreground">
            {gone
              ? t("روابط الملخص الصحي مؤقتة. اطلب من صاحب القط رابطاً جديداً من ملفه في مرقط.", "Health-summary links are temporary. Ask the cat's owner for a fresh one from their Moracat profile.")
              : t("تأكد من الرابط كاملاً كما وصلك.", "Check the full link exactly as you received it.")}
          </p>
        </div>
      </main>
    );
  }

  const c = data.cat;
  const s = data.safety;
  const standing = STANDING[data.vaccination.standing];
  const latestW = [...data.weights].sort((a, b) => +new Date(b.measuredAt) - +new Date(a.measuredAt))[0];
  const flags = [...s.allergies.map((a) => t(`حساسية: ${a}`, `Allergy: ${a}`)), ...s.conditions];
  const sex = c.sex === "MALE" ? t("ذكر", "Male") : c.sex === "FEMALE" ? t("أنثى", "Female") : t("غير محدد", "Unknown");

  return (
    <main id="main" className="mx-auto max-w-3xl space-y-6 px-4 py-6 print:max-w-none print:py-0 sm:py-10">
      {/* The document header: what this is, whose cat, and Moracat's seal. */}
      <header className="overflow-hidden rounded-2xl border border-border bg-card print:rounded-none">
        <IdBand
          tone="emerald"
          kind={t("ملخص صحي · مرقط", "Health summary · Moracat")}
          serial={c.catIdNumber ?? undefined}
          seal={<Seal label={t("صادر من مرقط", "Issued by Moracat")} className="border-white/40 text-white" />}
        />
        <div className="flex items-center gap-4 p-5 sm:p-6">
          {c.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.photoUrl} alt="" className="size-20 shrink-0 rounded-2xl object-cover sm:size-24" />
          ) : null}
          <div className="min-w-0">
            <h1 className="font-display text-4xl leading-tight">{c.name}</h1>
            <p className="text-muted-foreground">
              {[c.breed ? (isAr ? c.breed.ar : c.breed.en) : null, formatAge(c.ageMonths, loc), sex, c.neutered === true ? t("معقّم", "Neutered") : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
      </header>

      {/* Safety first — what must be known before touching the cat. */}
      <section aria-labelledby="safety" className="space-y-2">
        <h2 id="safety" className="font-display text-2xl">{t("قبل أي شيء", "Before anything else")}</h2>
        {flags.length > 0 ? (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden />
            <ul className="space-y-1 font-medium">
              {flags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rounded-2xl border border-border bg-card px-5 py-1">
          <Ledger>
            <LedgerRow label={t("الحساسية", "Allergies")} value={s.allergies.length ? s.allergies.join("، ") : t("لا شيء مسجّل", "None recorded")} />
            <LedgerRow label={t("حالات مزمنة", "Conditions")} value={s.conditions.length ? s.conditions.join("، ") : t("لا شيء مسجّل", "None recorded")} />
            <LedgerRow label={t("أدوية حالية", "Current medication")} value={s.medications || (data.prescriptions.length ? data.prescriptions.map((p) => p.medication).join("، ") : t("لا شيء", "None"))} />
            <LedgerRow label={t("الطعام الحالي", "Current food")} value={s.food || "—"} />
            <LedgerRow label={t("الشريحة", "Microchip")} value={c.microchipNo ? <span dir="ltr" className="font-mono">{c.microchipNo}</span> : t("غير مسجّلة", "Not on file")} />
            <LedgerRow label={t("الوزن", "Weight")} value={latestW ? formatWeight(latestW.weightKg, loc) : c.weightKg ? formatWeight(c.weightKg, loc) : "—"} hint={latestW ? formatDate(latestW.measuredAt, loc, "medium") : undefined} />
            {s.emergencyNotes ? <LedgerRow label={t("ملاحظات الطوارئ", "Emergency notes")} value={s.emergencyNotes} /> : null}
          </Ledger>
        </div>
      </section>

      <section aria-labelledby="vax" className="space-y-2">
        <div className="flex items-end justify-between gap-3">
          <h2 id="vax" className="font-display text-2xl">{t("التطعيمات", "Vaccinations")}</h2>
          <StatusTag tone={standing.tone}>{isAr ? standing.ar : standing.en}</StatusTag>
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {data.vaccination.records.length === 0 ? (
            <p className="p-5 text-muted-foreground">{t("لا تطعيمات مسجّلة.", "No vaccinations recorded.")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-start text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start font-medium">{t("اللقاح", "Vaccine")}</th>
                  <th scope="col" className="px-4 py-2 text-start font-medium">{t("أُعطي", "Given")}</th>
                  <th scope="col" className="px-4 py-2 text-start font-medium">{t("التالي", "Next")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.vaccination.records.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{v.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {v.verified ? (
                          <span className="inline-flex items-center gap-1">
                            <BadgeCheck className="size-3.5 text-primary" aria-hidden />
                            {v.clinic ? (isAr ? v.clinic.ar : v.clinic.en) : t("عيادة", "Clinic")}
                          </span>
                        ) : (
                          t("مُدخل من صاحب القط", "Entered by the owner")
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{formatDate(v.administeredAt, loc, "short")}</td>
                    <td className="px-4 py-2.5">{v.dueAt ? formatDate(v.dueAt, loc, "short") : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {data.clinicalEntries.length + data.visits.length > 0 && (
        <section aria-labelledby="history" className="space-y-2">
          <h2 id="history" className="font-display text-2xl">{t("السجل السريري", "Clinical history")}</h2>
          <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.clinicalEntries.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <p className="font-medium">{isAr ? e.title.ar : e.title.en}</p>
                {e.summary ? <p className="text-sm">{isAr ? e.summary.ar : e.summary.en}</p> : null}
                <p className="text-xs text-muted-foreground">{formatDate(e.occurredAt, loc, "medium")} · {isAr ? e.clinic.ar : e.clinic.en}</p>
              </li>
            ))}
            {data.clinicalEntries.length === 0 &&
              data.visits.map((v) => (
                <li key={v.id} className="px-5 py-3">
                  <p className="font-medium">{v.reason || t("زيارة", "Visit")}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(v.checkedInAt, loc, "medium")} · {isAr ? v.clinic.ar : v.clinic.en}</p>
                </li>
              ))}
          </ol>
        </section>
      )}

      {data.documents.length > 0 && (
        <section aria-labelledby="docs" className="space-y-2 print:hidden">
          <h2 id="docs" className="font-display text-2xl">{t("المستندات", "Documents")}</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {data.documents.map((d) => (
              <li key={d.id}>
                <a href={d.url} target="_blank" rel="noreferrer noopener" className="flex min-h-12 items-center gap-3 px-5 py-3 hover:bg-muted/50">
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  <span className="font-medium">{d.title}</span>
                </a>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">{t("روابط المستندات صالحة لدقائق — حدّث الصفحة لفتحها من جديد.", "Document links work for a few minutes — refresh the page to open them again.")}</p>
        </section>
      )}

      {/* Verification footer — who issued this, when, and until when. */}
      <footer className="space-y-3 rounded-2xl border border-border bg-card p-5 text-sm">
        {data.owner.firstName || data.owner.phone ? (
          <p className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{t("صاحب القط", "Owner")}:</span>
            <span className="font-medium">{data.owner.firstName ?? "—"}</span>
            {data.owner.phone ? (
              <a href={`tel:${data.owner.phone}`} dir="ltr" className="inline-flex min-h-11 items-center gap-1 text-primary hover:underline">
                <Phone className="size-4" aria-hidden /> {data.owner.phone}
              </a>
            ) : null}
          </p>
        ) : null}
        <p className="text-muted-foreground">
          {t(
            `صدر هذا الملخص من مرقط بطلب صاحب القط في ${formatDate(data.issuedAt, "ar", "medium")}، وينتهي ${formatDate(data.expiresAt, "ar", "medium")}.`,
            `Issued by Moracat at the owner's request on ${formatDate(data.issuedAt, "en", "medium")}; expires ${formatDate(data.expiresAt, "en", "medium")}.`
          )}
          {data.lastUpdatedAt
            ? t(` آخر تحديث للسجل: ${formatDate(data.lastUpdatedAt, "ar", "medium")}.`, ` Record last updated ${formatDate(data.lastUpdatedAt, "en", "medium")}.`)
            : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(
            "معلومات للاطلاع، يكتبها صاحب القط والعيادات الشريكة. التطعيمات الموثّقة كتبتها عيادة؛ غيرها أدخله صاحب القط. القرار الطبي لطبيبك.",
            "For reference — written by the owner and partner clinics. Verified vaccinations were entered by a clinic; others by the owner. Clinical judgement remains the vet's."
          )}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <PrintButton label={t("اطبع الملخص", "Print summary")} />
          <Link href="/vet-directory" className="text-xs text-muted-foreground underline underline-offset-4">
            {t("عيادة؟ انضم لشبكة مرقط", "A clinic? Join the Moracat network")}
          </Link>
        </div>
      </footer>
    </main>
  );
}
