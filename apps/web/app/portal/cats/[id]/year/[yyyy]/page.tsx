"use client";

import { useParams } from "next/navigation";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { YearKeepsake } from "@/components/cat-profile/year-keepsake";

/** «عام {cat}» — one year of the cat's life, as a printable keepsake. */
export default function CatYearPage() {
  const { id, yyyy } = useParams<{ id: string; yyyy: string }>();
  const { locale } = useLocale();
  const { cats } = useCats();
  const cat = cats.find((c) => c.id === id);
  const year = Number(yyyy);
  if (!cat || !Number.isInteger(year)) return null;
  return <YearKeepsake cat={cat} year={year} isAr={locale === "ar"} />;
}
