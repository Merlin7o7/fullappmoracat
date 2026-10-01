"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@moraqat/ui";

/**
 * /portal/cats used to be a list with a drawer — the cat had no page of its
 * own. The household's cats now live on the «قططي» home (/portal) and each cat
 * on its own profile (/portal/cats/[id]). This route stays so every link,
 * email and notification ever sent keeps working:
 *
 *   /portal/cats                     → /portal
 *   /portal/cats?cat=<id>            → /portal/cats/<id>
 *   /portal/cats?cat=<id>&panel=health → /portal/cats/<id>/health
 */
function Redirect() {
  const router = useRouter();
  const params = useSearchParams();

  React.useEffect(() => {
    const id = params.get("cat");
    const panel = params.get("panel");
    if (!id) router.replace("/portal");
    else if (panel === "health" || panel === "privacy") router.replace(`/portal/cats/${encodeURIComponent(id)}/${panel}`);
    else router.replace(`/portal/cats/${encodeURIComponent(id)}`);
  }, [params, router]);

  return <Placeholder />;
}

function Placeholder() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export default function CatsRedirect() {
  return (
    <React.Suspense fallback={<Placeholder />}>
      <Redirect />
    </React.Suspense>
  );
}
