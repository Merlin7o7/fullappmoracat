import Link from "next/link";
import { catPossessive } from "@moraqat/core";
import { IdBand, Seal } from "@moraqat/ui";
import type { CommunityProfile } from "@/lib/api";
import { resolvePersonalization } from "@/lib/cat-profile";
import { registerHref } from "@/lib/share-url";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CatIdCard } from "@/components/cat-id-card";

/**
 * Where a shared story, card, poster or moment lands (audit 2026-10-04
 * Problem 9 / Opportunity 4): «هذي هوية لولو — رقمها … في سجل مرقط. قطك وش
 * رقمه؟» The cat that brought the visitor is the hero; one invitation
 * carries `ref` + `src` into /register so the member who shared is credited.
 *
 * Privacy: the cat appears only while it is public in the community (the
 * same server-side contract as /community/[slug]); a private cat, or a link
 * without a cat, gets the generic invitation and nothing about any cat.
 * Not the finder page — /c/[token] stays a tag, never marketing.
 */
export function ShareLanding({
  cat,
  isAr,
  refCode,
  src,
}: {
  cat: CommunityProfile | null;
  isAr: boolean;
  refCode?: string | null;
  src?: string | null;
}) {
  const href = registerHref(refCode, src);
  const rp = cat ? resolvePersonalization(cat.personalization) : null;
  const serial = cat?.catIdNumber ?? null;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main id="main" className="mx-auto w-full max-w-md px-4 pb-16 pt-6">
        {cat && rp ? (
          <article className="space-y-6">
            <div className="space-y-2 text-center">
              <h1 className="font-display text-4xl leading-tight">
                {isAr ? `هذي هوية ${cat.name}` : `This is ${cat.name}'s ID`}
              </h1>
              {serial && (
                <p className="text-muted-foreground">
                  {isAr ? (
                    <>
                      {catPossessive("رقم", cat.gender, cat.name)} <bdi dir="ltr" className="font-mono text-foreground">{serial}</bdi> في سجل مرقط.
                    </>
                  ) : (
                    <>
                      Number <bdi dir="ltr" className="font-mono text-foreground">{serial}</bdi> in the Moracat register.
                    </>
                  )}
                </p>
              )}
            </div>

            <CatIdCard
              catName={cat.name}
              catIdNumber={serial ?? "MRC-••••-••••"}
              issuedAt={cat.issuedAt}
              photoUrl={cat.photoUrl}
              isAr={isAr}
              // Identity, never billing — and no QR: this page is not the tag.
              hideStatus
              themeField={rp.themeField}
              themeArt={rp.themeArt}
              accentHsl={rp.accentHsl}
              frame={rp.frame}
              stickers={rp.stickers}
              className="mx-auto"
            />

            <Invite isAr={isAr} href={href} lead={isAr ? "قطك وش رقمه؟" : "What's your cat's number?"} />

            {cat.slug && (
              <p className="text-center">
                <Link href={`/community/${cat.slug}`} className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
                  {isAr ? `شوف ملف ${cat.name} في المجتمع` : `See ${cat.name} in the community`}
                </Link>
              </p>
            )}
          </article>
        ) : (
          <article className="space-y-6">
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <IdBand tone="emerald" kind={isAr ? "هوية مرقط" : "Moracat ID"} seal={<Seal label={isAr ? "سجل مرقط" : "Moracat register"} className="border-white/40 text-white" />} />
              <div className="space-y-2 p-6 text-center">
                <h1 className="font-display text-4xl leading-tight">{isAr ? "لكل قط رقم يخصّه" : "Every cat gets a number of its own"}</h1>
                <p className="text-muted-foreground">
                  {isAr
                    ? "هوية مرقط رقم دائم لقطك: يوصل من يجده بأهله، ويحمل سجله الصحي لأي عيادة. مجاناً."
                    : "A Moracat ID is your cat's permanent number: it connects whoever finds them with their family, and carries their health record to any clinic. Free."}
                </p>
              </div>
            </div>
            <Invite isAr={isAr} href={href} lead={isAr ? "قطك وش رقمه؟" : "What's your cat's number?"} />
          </article>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function Invite({ isAr, href, lead }: { isAr: boolean; href: string; lead: string }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5 text-center">
      <p className="font-display text-2xl">{lead}</p>
      <p className="text-sm text-muted-foreground">
        {isAr ? "سجّله وخذ هويته في مرقط — مجاناً، بدون أي دفع." : "Register them and get their Moracat ID — free, nothing to pay."}
      </p>
      <Link
        href={href}
        className="inline-flex h-12 w-full items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-foreground hover:bg-[hsl(var(--primary-hover))]"
      >
        {isAr ? "سجّل قطك" : "Register your cat"}
      </Link>
    </section>
  );
}
