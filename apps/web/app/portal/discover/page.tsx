"use client";

import { Search, Heart, Users, Stethoscope } from "lucide-react";
import { useLocale } from "@/app/providers";
import { HubLink } from "@/components/hub-link";
import { Illo3D } from "@/components/illo-3d";

/**
 * «اكتشف» — the cats around yours: the neighbourhood's lost and found, cats
 * looking for a home, the community, and the clinics that read the record.
 * Lost & Found leads, in red: it is the one door here that can be urgent.
 */
export default function DiscoverPage() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-4xl">{isAr ? "اكتشف" : "Discover"}</h1>
          <p className="text-muted-foreground">
            {isAr ? "القطط من حولك — ومن يساعدك تعتني بقطك." : "The cats around yours — and the people who help you care for them."}
          </p>
        </div>
        <Illo3D name="paw" className="hidden size-24 shrink-0 sm:block" px={96} />
      </header>

      <div className="grid gap-3">
        <HubLink
          href="/portal/lost-found"
          icon={Search}
          tone="critical"
          title={isAr ? "مفقود وموجود" : "Lost & Found"}
          body={isAr ? "قط ضاع أو لقيت قطاً؟ ابدأ من هنا — البلاغ يُنشر في لوحة مرقط، والرسائل توصلك دون كشف رقمك." : "A cat lost, or one found? Start here — the notice goes on the Moracat board and messages reach you without exposing your number."}
        />
        <HubLink
          href="/portal/adoption"
          icon={Heart}
          title={isAr ? "التبنّي" : "Adoption"}
          body={isAr ? "قطط تبحث عن بيت — وهويتها وسجلها ينتقلان معها." : "Cats looking for a home — their ID and record move with them."}
        />
        <HubLink
          href="/portal/community"
          icon={Users}
          title={isAr ? "المجتمع" : "Community"}
          body={isAr ? "قطط أهلها خلّوها ظاهرة — وكل واحد يقدر يخفي قطه بضغطة." : "Cats whose people keep them visible — anyone can hide their cat in one tap."}
        />
        <HubLink
          href="/vet-directory"
          icon={Stethoscope}
          title={isAr ? "العيادات" : "Clinics"}
          body={isAr ? "عيادات تحققنا من تراخيصها، ومن يفتح للطوارئ." : "Clinics whose licences we checked, and who opens for emergencies."}
        />
      </div>
    </div>
  );
}
