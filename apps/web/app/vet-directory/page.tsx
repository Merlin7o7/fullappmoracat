import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { MapPin, Phone, Search, ShieldCheck, Siren, ExternalLink } from "lucide-react";
import { Card, Badge, Button } from "@moraqat/ui";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { IlloCat, IlloPaw } from "@/components/illustrations";
import { fetchWithTimeout, httpError } from "@/lib/http";
import { normalizeDirectory, type DirectoryClinic } from "@/lib/vet-directory";

/**
 * The public verified-clinic directory.
 *
 * Rendered on the server and filtered through the URL, so it is indexable, it
 * works with JavaScript switched off, and a shared link reproduces exactly what
 * the sender saw. Curation is the promise: only clinics Moracat has verified
 * appear, and the badge says what "verified" actually means rather than acting
 * as decoration (R006).
 */

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";
const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";


export function generateMetadata(): Metadata {
  const isAr = cookies().get("locale")?.value !== "en";
  const title = isAr ? "دليل العيادات البيطرية الموثّقة" : "Verified veterinary clinics";
  const description = isAr
    ? "عيادات بيطرية موثّقة من مرقط في السعودية: تحققنا من ترخيص كل عيادة. ابحث بالمدينة، واعرف من يفتح أبوابه للطوارئ على مدار الساعة."
    : "Veterinary clinics verified by Moracat across Saudi Arabia — we check every licence ourselves. Search by city and see who opens for emergencies around the clock.";
  const url = `${SITE}/vet-directory`;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", title, description, url },
    twitter: { card: "summary_large_image", title, description },
  };
}

async function loadDirectory(city: string, emergency: boolean, isAr: boolean): Promise<DirectoryClinic[]> {
  const qs = new URLSearchParams();
  if (city) qs.set("city", city);
  if (emergency) qs.set("emergency", "true");
  const q = qs.toString();
  const res = await fetchWithTimeout(`${API}/api/vet/directory${q ? `?${q}` : ""}`, {
    headers: { accept: "application/json" },
    // The roster changes rarely; revalidate hourly so the page stays fast and
    // still reflects a newly-verified partner within the hour.
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw httpError(res.status, await res.json().catch(() => null), "Directory unavailable");
  return normalizeDirectory(await res.json(), isAr);
}

export default async function VetDirectoryPage({
  searchParams,
}: {
  searchParams: { city?: string; emergency?: string };
}) {
  const isAr = cookies().get("locale")?.value !== "en";
  const city = (searchParams.city ?? "").trim();
  const emergency = searchParams.emergency === "1" || searchParams.emergency === "true";

  let clinics: DirectoryClinic[] | null = null;
  try {
    clinics = await loadDirectory(city, emergency, isAr);
  } catch {
    // Never fabricate a roster: a clinic list that isn't real could send
    // someone to a closed door in an emergency.
    clinics = null;
  }

  const name = (c: DirectoryClinic) => (isAr ? c.nameAr : c.nameEn) || c.nameEn || c.nameAr;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="container max-w-5xl py-12 outline-none sm:py-16">
        <header className="max-w-2xl">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {isAr ? "عيادات موثّقة" : "Verified clinics"}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            {isAr
              ? "كل عيادة هنا تحققنا من ترخيصها بأنفسنا قبل أن تظهر في هذه الصفحة. تقدر تمنحها إذن الاطلاع على سجل قطك وقت الزيارة، وتسحبه بعدها بضغطة."
              : "Every clinic here had its licence checked by us before it appeared on this page. You can give one access to your cat's record at the time of a visit, and take it back in one tap afterwards."}
          </p>
        </header>

        {/* A plain GET form: filtering works without JavaScript, and the URL
            carries the result so it can be shared or bookmarked. */}
        <form method="get" action="/vet-directory" className="mt-8 flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="city" className="mb-1.5 block text-sm font-medium">
              {isAr ? "المدينة" : "City"}
            </label>
            <div className="relative">
              <Search aria-hidden className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="city"
                name="city"
                defaultValue={city}
                placeholder={isAr ? "الرياض، جدة، الدمام…" : "Riyadh, Jeddah, Dammam…"}
                className="h-11 w-full rounded-xl border border-input bg-background ps-9 pe-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-input px-4 text-sm">
            <input
              type="checkbox"
              name="emergency"
              value="1"
              defaultChecked={emergency}
              className="size-4 accent-[hsl(var(--primary))]"
            />
            {isAr ? "طوارئ ٢٤ ساعة فقط" : "24h emergency only"}
          </label>

          <Button type="submit" className="min-h-[44px]">
            {isAr ? "ابحث" : "Search"}
          </Button>
          {(city || emergency) && (
            <Link
              href="/vet-directory"
              className="inline-flex min-h-[44px] items-center px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              {isAr ? "امسح البحث" : "Clear"}
            </Link>
          )}
        </form>

        <div className="mt-8">
          {clinics === null ? (
            <Card className="flex flex-col items-center gap-3 p-10 text-center">
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                {isAr
                  ? "تعذّر تحميل دليل العيادات الآن. لا شيء مفقود — فقط لم نصل إليه. حدّث الصفحة بعد قليل."
                  : "We couldn't load the clinic directory just now — nothing's lost, we just couldn't reach it. Refresh in a moment."}
              </p>
              <Link href="/vet-directory">
                <Button variant="outline" size="sm">{isAr ? "أعد المحاولة" : "Try again"}</Button>
              </Link>
            </Card>
          ) : clinics.length === 0 ? (
            <Card className="relative flex flex-col items-center gap-3 overflow-hidden p-12 text-center">
              <IlloPaw tone="peach" aria-hidden className="pointer-events-none absolute start-8 top-6 size-7 -rotate-12 opacity-50" />
              <IlloCat tone="sage" aria-hidden className="h-16 w-auto" />
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                {city || emergency
                  ? isAr
                    ? "ما لقينا عيادة موثّقة تطابق بحثك بعد. جرّب مدينة أخرى، أو تصفّح الدليل كاملاً — نضيف الشركاء أولاً بأول."
                    : "No verified clinic matches that search yet. Try another city, or browse the full directory — we add partners as they join."
                  : isAr
                    ? "لم تنضم عيادات موثّقة بعد. نحن نتحقق من كل عيادة قبل إدراجها، وهذا يأخذ وقته."
                    : "No verified clinics have joined yet. We check every clinic before listing it, and that takes time."}
              </p>
              {(city || emergency) && (
                <Link href="/vet-directory">
                  <Button variant="outline" size="sm">{isAr ? "اعرض كل العيادات" : "Show all clinics"}</Button>
                </Link>
              )}
            </Card>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
                {isAr
                  ? `${clinics.length.toLocaleString("ar-SA")} ${clinics.length === 1 ? "عيادة موثّقة" : "عيادة موثّقة"}`
                  : `${clinics.length} verified clinic${clinics.length === 1 ? "" : "s"}`}
              </p>
              <ul className="grid gap-4 sm:grid-cols-2">
                {clinics.map((c) => (
                  <li key={c.branchId || c.orgId}>
                    <ClinicCard clinic={c} name={name(c)} isAr={isAr} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <section className="mt-14 rounded-3xl border border-border bg-card p-8 shadow-e1 sm:p-10">
          <div className="flex items-start gap-4">
            <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
              <ShieldCheck className="size-5" />
            </span>
            <div className="space-y-2">
              <h2 className="font-display text-lg font-semibold">
                {isAr ? "ماذا يعني «موثّقة»؟" : "What “verified” means"}
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {isAr
                  ? "راجعنا ترخيص العيادة وسجلها التجاري وتواصلنا مع فريقها قبل إدراجها. ولا تفتح أي عيادة سجل قطك الطبي إلا بإذنك أنت — وكل مرة تفتحه، تجدها مكتوبة في سجل الاطلاع داخل حسابك."
                  : "We reviewed the clinic's licence and commercial registration and spoke with its team before listing it. And no clinic opens your cat's medical record without your permission — every time one does, you'll find it written in the access ledger inside your account."}
              </p>
              <Link
                href="/portal/health-access"
                className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                {isAr ? "اطّلع على أذوناتك" : "See your permissions"}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function ClinicCard({ clinic: c, name, isAr }: { clinic: DirectoryClinic; name: string; isAr: boolean }) {
  const photo = c.photos?.[0];
  return (
    <Card className="flex h-full flex-col overflow-hidden p-0">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- partner-hosted photo, arbitrary remote host
        <img
          src={photo}
          alt=""
          loading="lazy"
          className="h-36 w-full object-cover"
        />
      )}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display font-semibold">{name}</h3>
            {c.verified && (
              <Badge variant="success" className="gap-1">
                <ShieldCheck aria-hidden className="size-3" />
                {isAr ? "موثّقة" : "Verified"}
              </Badge>
            )}
            {c.emergency24h && (
              <Badge variant="destructive" className="gap-1">
                <Siren aria-hidden className="size-3" />
                {isAr ? "طوارئ ٢٤ ساعة" : "24h emergency"}
              </Badge>
            )}
          </div>

          {(c.city || c.addressLine) && (
            <p className="mt-1.5 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              <span>{[c.city, c.addressLine].filter(Boolean).join(" · ")}</span>
            </p>
          )}
        </div>

        {(c.specialties?.length > 0 || c.services?.length > 0) && (
          <ul className="flex flex-wrap gap-1.5">
            {[...(c.specialties ?? []), ...(c.services ?? [])].slice(0, 6).map((s, i) => (
              <li key={`${s}-${i}`}>
                <Badge variant="outline">{s}</Badge>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap gap-2 pt-1">
          {c.phone && (
            <a
              href={`tel:${c.phone.replace(/\s/g, "")}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              <Phone aria-hidden className="size-4" />
              <span dir="ltr">{c.phone}</span>
            </a>
          )}
          {c.mapsUrl && (
            <a
              href={c.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              <MapPin aria-hidden className="size-4" />
              {isAr ? "الموقع" : "Directions"}
              <ExternalLink aria-hidden className="size-3 opacity-60" />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
}
