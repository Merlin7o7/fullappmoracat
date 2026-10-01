"use client";

import { useParams } from "next/navigation";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { LifeTimeline } from "@/components/cat-profile/life-timeline";

/** The cat's life album — record events and the owner's own moments. */
export default function CatTimelinePage() {
  const { id } = useParams<{ id: string }>();
  const { locale } = useLocale();
  const { cats } = useCats();
  const cat = cats.find((c) => c.id === id);
  if (!cat) return null;
  return <LifeTimeline cat={cat} isAr={locale === "ar"} />;
}
