import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FoundCatForm } from "./found-cat-form";

/**
 * The page a phone camera opens from the collar QR (MRC-PROD-001 T6).
 *
 * The Safety job of the Cat ID (R040): whoever finds the cat learns its name,
 * that it is registered, and — in lost mode — how to reach the owner without
 * ever learning who the owner is. One invitation at the bottom; nothing else.
 * Not indexed: this is a tag, not a profile.
 */

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

interface PublicCard {
  name: string;
  photoUrl: string | null;
  breed: { ar: string; en: string } | null;
  registered: boolean;
  catIdMasked: string | null;
  vaccinationStanding: string;
  isLost: boolean;
  lifecycle: string;
}

async function fetchCard(token: string): Promise<PublicCard | null> {
  try {
    const res = await fetch(`${BASE}/api/public/cats/${encodeURIComponent(token)}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as PublicCard;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const card = await fetchCard(params.token);
  return {
    title: card ? `${card.name} · Moracat` : "Moracat",
    robots: { index: false, follow: false },
  };
}

export default async function PublicCatPage({ params }: { params: { token: string } }) {
  const card = await fetchCard(params.token);
  if (!card) notFound();
  const isAr = cookies().get("locale")?.value !== "en";

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md px-4 py-10">
        <div className="overflow-hidden rounded-3xl border border-border bg-card">
          <div className="relative aspect-square w-full bg-muted">
            {card.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.photoUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-6xl">🐈</div>
            )}
            {card.isLost && (
              <div className="absolute inset-x-0 top-0 bg-destructive px-4 py-2 text-center text-sm font-semibold text-destructive-foreground">
                {isAr ? `${card.name} مفقود — إذا كان معك، أرسل رسالة أدناه` : `${card.name} is lost — if they're with you, send a message below`}
              </div>
            )}
          </div>
          <div className="space-y-3 p-6 text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight">{card.name}</h1>
            <p className="text-sm text-muted-foreground">
              {[card.breed ? (isAr ? card.breed.ar : card.breed.en) : null, isAr ? "مسجّل في مُراقط" : "Registered with Moracat"].filter(Boolean).join(" · ")}
            </p>
            {card.catIdMasked && <p className="font-mono text-xs text-muted-foreground" dir="ltr">{card.catIdMasked}</p>}
            <p className="text-xs text-muted-foreground">
              {isAr ? "هذا القط له بيت وسجل صحي. لا تُعرض بيانات المالك هنا أبداً." : "This cat has a home and a health record. The owner's details are never shown here."}
            </p>
          </div>
          <div className="border-t border-border p-6">
            <FoundCatForm token={params.token} catName={card.name} isLost={card.isLost} isAr={isAr} />
          </div>
        </div>

        {/* One invitation, at a moment of relevance. */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">{isAr ? "عندك قط؟ امنحه هوية وسجلاً صحياً يكتبه طبيبه — مجاناً." : "Have a cat? Give them an ID and a health record their vet writes — free."}</p>
          <Link href="/register?src=qr" className="mt-2 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground">
            {isAr ? "سجّل قطك" : "Register your cat"}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
