"use client";

import { useParams, useRouter } from "next/navigation";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { CatManagePanel } from "@/components/cat-manage-panel";

/** Details, photos, visibility, hand-over and lifecycle — the cat's settings. */
export default function CatEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const { cats } = useCats();
  const cat = cats.find((c) => c.id === id);
  if (!cat) return null;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">{isAr ? `تعديل ملف ${localizeName(cat.name, "ar")}` : `Edit ${localizeName(cat.name, "en")}'s profile`}</h1>
      {/* Removing or handing the cat on leaves this page with nothing to show. */}
      <CatManagePanel cat={cat} isAr={isAr} onClose={() => router.push("/portal")} />
    </div>
  );
}
