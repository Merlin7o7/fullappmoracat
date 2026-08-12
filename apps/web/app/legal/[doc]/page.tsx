import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { LEGAL_DOCS, getLegalDoc } from "@/lib/legal";
import { LegalView } from "@/components/legal-view";
import { breadcrumbJsonLd } from "@/components/breadcrumbs";
import { jsonLdProps } from "@/lib/json-ld";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.slug }));
}

export function generateMetadata({ params }: { params: { doc: string } }): Metadata {
  const doc = getLegalDoc(params.doc);
  if (!doc) return { title: "Moracat" };
  const isAr = cookies().get("locale")?.value !== "en";
  // The root template appends "· Moracat" — don't brand the title twice.
  const title = `${doc.title.en} · ${doc.title.ar}`;
  const description = isAr ? doc.intro.ar : doc.intro.en;
  return {
    title,
    description,
    alternates: { canonical: `/legal/${doc.slug}` },
    openGraph: { type: "article", title, description, url: `/legal/${doc.slug}` },
  };
}

export default function LegalPage({ params }: { params: { doc: string } }) {
  const doc = getLegalDoc(params.doc);
  if (!doc) notFound();
  const isAr = cookies().get("locale")?.value !== "en";
  const crumbs = [
    { href: "/", label: isAr ? "الرئيسية" : "Home" },
    { label: isAr ? doc.title.ar : doc.title.en },
  ];
  return (
    <>
      <script {...jsonLdProps(breadcrumbJsonLd(crumbs, SITE))} />
      <LegalView doc={doc} />
    </>
  );
}
