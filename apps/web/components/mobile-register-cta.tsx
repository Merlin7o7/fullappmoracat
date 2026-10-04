"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BottomBar, BOTTOM_LAYER, Button } from "@moraqat/ui";
import { useLocale } from "@/app/providers";

/**
 * Homepage-only mobile register bar (R100: the primary action lives in the
 * thumb zone). It appears only after the hero's own CTA has scrolled away —
 * never two competing asks on screen (R005) — and yields to the closing
 * invitation. It does NOT wait for the cookie notice (audit 2026-10-04,
 * Problem 4): both live on the one bottom stack, the notice above this bar,
 * so neither covers the other.
 * Reuses the hero's exact words and trust line: no urgency, no counters (R006).
 */
export function MobileRegisterCta({ heroId, closingId }: { heroId: string; closingId: string }) {
  const { t } = useLocale();
  const reduced = useReducedMotion();
  const [heroAway, setHeroAway] = React.useState(false);
  const [closingVisible, setClosingVisible] = React.useState(false);

  React.useEffect(() => {
    const hero = document.getElementById(heroId);
    const closing = document.getElementById(closingId);
    if (!hero) return;
    const observers: IntersectionObserver[] = [];
    const heroObs = new IntersectionObserver(([e]) => setHeroAway(!e?.isIntersecting), { threshold: 0 });
    heroObs.observe(hero);
    observers.push(heroObs);
    if (closing) {
      const closingObs = new IntersectionObserver(([e]) => setClosingVisible(!!e?.isIntersecting), { threshold: 0 });
      closingObs.observe(closing);
      observers.push(closingObs);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [heroId, closingId]);

  const show = heroAway && !closingVisible;

  return (
    <AnimatePresence>
      {show && (
        <BottomBar layer={BOTTOM_LAYER.action} className="sm:hidden">
          <motion.div
            initial={reduced ? { opacity: 0 } : { y: 72, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: 72, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="border-t border-border bg-card/95 px-3 pt-3 pb-bar backdrop-blur"
          >
            <Link href="/register" className="block">
              <Button size="lg" className="w-full">
                {t.hero.cta} <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            </Link>
            <p className="mt-1.5 text-center text-xs text-muted-foreground">{t.hero.trust}</p>
          </motion.div>
        </BottomBar>
      )}
    </AnimatePresence>
  );
}
