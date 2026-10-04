"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useLocale } from "@/app/providers";

/**
 * The goodbye after an account deletion (/?farewell=1). Dignified, brief, no
 * guilt and no win-back offer (R068): it confirms what happened and leaves the
 * door open. Dismissing it also cleans the URL so a refresh or a shared link
 * doesn't say goodbye twice.
 *
 * Reads the query string in an effect (not useSearchParams) so the homepage
 * needs no Suspense boundary and the first paint stays identical on server
 * and client.
 */
export function FarewellNotice() {
  const { locale } = useLocale();
  const isAr = locale === "ar";
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get("farewell") === "1") setOpen(true);
  }, []);

  if (!open) return null;

  const dismiss = () => {
    setOpen(false);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("farewell");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    } catch {
      /* the notice is gone either way */
    }
  };

  return (
    <div role="status" className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-5xl items-start gap-3 px-4 py-4 sm:items-center">
        <p className="flex-1 text-sm leading-relaxed text-foreground sm:text-base">
          {isAr
            ? "مع السلامة — حذفنا حسابك وملفات قططك. لو رجعت يوم، مرقط بيكون هنا."
            : "Goodbye — we've deleted your account and your cats' files. If you ever come back, Moracat will be here."}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={isAr ? "إغلاق" : "Dismiss"}
          className="grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
