import Link from "next/link";
import { Home } from "lucide-react";
import { Button } from "@moraqat/ui";
import { IlloCat } from "@/components/illustrations";

/**
 * 404 — a signature moment, not a dead end (R111/R112). The lost cat is the
 * hero; warm bilingual copy; one clear action home (R086). Server component,
 * so copy is bilingual inline rather than locale-switched.
 */
export default function NotFound() {
  return (
    <div className="mesh-bg grid min-h-dvh place-items-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <IlloCat tone="green" className="h-28 w-auto animate-float" />
        <p aria-hidden className="mt-8 font-display text-6xl font-semibold leading-none tracking-tight text-primary/15" dir="ltr">
          404
        </p>
        <h1 className="mt-3 font-display text-2xl font-semibold tracking-tight" lang="ar" dir="rtl">
          هذه الصفحة خرجت في نزهة
        </h1>
        <p className="mt-1.5 font-display text-lg font-medium text-foreground/80" lang="en" dir="ltr">
          This page wandered off
        </p>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground" lang="ar" dir="rtl">
          مثل قطٍّ فضولي، تسللت بعيداً. لنُعدك إلى البيت.
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground" lang="en" dir="ltr">
          Like a curious cat, it slipped away. Let&apos;s get you back home.
        </p>
        <Link href="/" className="mt-8">
          <Button size="lg">
            <Home className="size-4" /> العودة للرئيسية · Back home
          </Button>
        </Link>
      </div>
    </div>
  );
}
