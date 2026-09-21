import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/**
 * Public certificate verification (MRC-PROD-001 T9). Whoever holds the
 * document — a boarding house, a breeder, a travel agent — scans the QR and
 * lands here. It confirms exactly what the certificate claims and nothing
 * more: no owner details, no medical notes. Not indexed.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface Verification {
  valid: boolean;
  revoked?: boolean;
  number?: string;
  catName?: string;
  catIdNumber?: string;
  breed?: { ar: string; en: string } | null;
  issuedAt?: string;
  issuedBy?: { ar: string; en: string } | null;
  vaccinationStanding?: string;
  verifiedVaccinations?: number;
  totalVaccinations?: number;
}

async function verify(token: string): Promise<Verification> {
  try {
    const res = await fetch(`${BASE}/api/certificates/verify/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!res.ok) return { valid: false };
    return (await res.json()) as Verification;
  } catch {
    return { valid: false };
  }
}

export const metadata: Metadata = {
  title: "Verify certificate · Moracat",
  robots: { index: false, follow: false },
};

const STANDING: Record<string, { ar: string; en: string }> = {
  UP_TO_DATE: { ar: "التطعيمات محدّثة", en: "Vaccinations up to date" },
  DUE_SOON: { ar: "جرعة مستحقة قريباً", en: "A dose is due soon" },
  OVERDUE: { ar: "جرعة متأخرة", en: "A dose is overdue" },
  UNKNOWN: { ar: "لا سجل تطعيمات", en: "No vaccination record" },
};

export default async function VerifyCertificatePage({ params }: { params: { token: string } }) {
  const v = await verify(params.token);
  const isAr = cookies().get("locale")?.value !== "en";
  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(isAr ? "ar-SA-u-ca-gregory" : "en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Riyadh" }) : "—";
  const standing = v.vaccinationStanding ? STANDING[v.vaccinationStanding] ?? STANDING.UNKNOWN : null;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className={`px-6 py-4 text-center text-sm font-semibold ${v.valid ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive"}`}>
            {v.valid
              ? isAr ? "✓ شهادة صحيحة صادرة من مرقط" : "✓ Valid certificate issued by Moracat"
              : v.revoked
                ? isAr ? "هذه الشهادة أُلغيت" : "This certificate has been revoked"
                : isAr ? "لم نجد شهادة بهذا الرمز" : "No certificate matches this code"}
          </div>
          {v.valid && (
            <div className="space-y-4 p-6">
              <div className="text-center">
                <h1 className="font-display text-3xl font-bold tracking-tight">{v.catName}</h1>
                <p className="mt-1 font-mono text-sm text-primary" dir="ltr">{v.catIdNumber}</p>
                {v.breed && <p className="text-sm text-muted-foreground">{isAr ? v.breed.ar : v.breed.en}</p>}
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">{isAr ? "رقم الشهادة" : "Certificate no."}</dt>
                  <dd className="font-mono text-xs" dir="ltr">{v.number}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{isAr ? "تاريخ الإصدار" : "Issued"}</dt>
                  <dd>{fmt(v.issuedAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{isAr ? "جهة الإصدار" : "Issued by"}</dt>
                  <dd>{v.issuedBy ? (isAr ? v.issuedBy.ar : v.issuedBy.en) : isAr ? "المالك عبر مرقط" : "The owner, via Moracat"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{isAr ? "التطعيمات" : "Vaccinations"}</dt>
                  <dd>
                    {standing ? (isAr ? standing.ar : standing.en) : "—"}
                    <span className="block text-xs text-muted-foreground">
                      {isAr
                        ? `${v.verifiedVaccinations ?? 0} من ${v.totalVaccinations ?? 0} كتبتها عيادة شريكة`
                        : `${v.verifiedVaccinations ?? 0} of ${v.totalVaccinations ?? 0} written by a partner clinic`}
                    </span>
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-muted-foreground">
                {isAr
                  ? "الإدخالات الذاتية أدخلها المالك ولم تتحقق منها مرقط. لا تُعرض بيانات المالك هنا."
                  : "Self-reported entries were entered by the owner and are not verified by Moracat. The owner's details are never shown here."}
              </p>
              <a
                href={`${BASE}/api/certificates/${encodeURIComponent(params.token)}/pdf`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-full border border-border text-sm font-semibold"
                target="_blank"
                rel="noopener noreferrer"
              >
                {isAr ? "افتح الشهادة (PDF)" : "Open the certificate (PDF)"}
              </a>
            </div>
          )}
        </div>
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">{isAr ? "عندك قط؟ امنحه هوية وسجلاً صحياً يكتبه طبيبه — مجاناً." : "Have a cat? Give them an ID and a health record their vet writes — free."}</p>
          <Link href="/register?src=certificate" className="mt-2 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
            {isAr ? "سجّل قطك" : "Register your cat"}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
