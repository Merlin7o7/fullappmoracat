import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LEGAL_DOCS, getLegalDoc } from "@/lib/legal";
import { LegalView } from "@/components/legal-view";

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ doc: d.slug }));
}

export function generateMetadata({ params }: { params: { doc: string } }): Metadata {
  const doc = getLegalDoc(params.doc);
  if (!doc) return { title: "Moracat" };
  return {
    title: `${doc.title.en} · ${doc.title.ar} — Moracat`,
    description: doc.intro.en,
  };
}

export default function LegalPage({ params }: { params: { doc: string } }) {
  const doc = getLegalDoc(params.doc);
  if (!doc) notFound();
  return <LegalView doc={doc} />;
}
