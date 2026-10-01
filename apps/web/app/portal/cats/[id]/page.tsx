"use client";

import { useParams } from "next/navigation";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { CatProfile } from "@/components/cat-profile/cat-profile";

/** The cat's own page — identity, care, health and life in one place. */
export default function CatProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useLocale();
  const { cats } = useCats();
  const cat = cats.find((c) => c.id === id);
  // The layout handles loading / not-found; this renders once the cat is known.
  if (!cat) return null;
  return <CatProfile cat={cat} isAr={locale === "ar"} />;
}
