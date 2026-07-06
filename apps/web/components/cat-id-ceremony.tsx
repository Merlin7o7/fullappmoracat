"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button, useFocusTrap } from "@moraqat/ui";
import { CatIdCard } from "./cat-id-card";
import { IlloPaw } from "./illustrations";

interface CeremonyCat {
  name: string;
  catIdNumber: string;
  idIssuedAt?: string | null;
  photoUrl?: string | null;
}

/** Characters the press cycles through before each glyph of the ID locks in. */
const STAMP_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * The Cat ID reveal — a moment, not a transaction (Dossier §05, R031).
 *
 * Two acts. First the press runs: the member watches their cat's number get
 * stamped in, glyph by glyph — anticipation with a purpose (R119). Then the
 * card itself arrives on a spring with a single sweep of light, and the words
 * follow. The richest animation in the product lives here on purpose (R073);
 * everything else stays calm so this peak means something. Reduced-motion
 * skips straight to the card with a gentle fade (R075).
 */
export function CatIdCeremony({
  cat,
  isAr,
  onClose,
  onShareChoice,
}: {
  cat: CeremonyCat;
  isAr: boolean;
  onClose: () => void;
  /** If provided, the reveal asks "share with the community?" and reports the choice. */
  onShareChoice?: (makePublic: boolean) => Promise<void> | void;
}) {
  const titleId = React.useId();
  const reduced = useReducedMotion();
  const [act, setAct] = React.useState<"stamping" | "reveal">(reduced ? "reveal" : "stamping");
  // Trap focus within the ceremony and restore it to the trigger on close — the
  // signature moment must not let keyboard focus wander to the page behind (R097).
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [onClose]);

  return (
    <div ref={trapRef} className="fixed inset-0 z-[95] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 animate-fade-in bg-[hsl(168_50%_5%/0.9)] backdrop-blur-md" aria-hidden />

      {/* Screen readers get the outcome immediately — the theatre is visual only. */}
      <h2 id={titleId} className="sr-only">
        {isAr ? `${cat.name} صار عضو — رقم الهوية ${cat.catIdNumber}` : `${cat.name} is a member — Cat ID ${cat.catIdNumber}`}
      </h2>

      <AnimatePresence mode="wait">
        {act === "stamping" ? (
          <StampingAct
            key="stamping"
            isAr={isAr}
            catName={cat.name}
            idNumber={cat.catIdNumber}
            onDone={() => setAct("reveal")}
          />
        ) : (
          <RevealAct key="reveal" cat={cat} isAr={isAr} reduced={!!reduced} onClose={onClose} onShareChoice={onShareChoice} />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Act I · the press stamps the number ─────────────────────────────────── */

function StampingAct({ isAr, catName, idNumber, onDone }: { isAr: boolean; catName: string; idNumber: string; onDone: () => void }) {
  const [display, setDisplay] = React.useState(() => idNumber.replace(/[^-]/g, "•"));
  const done = React.useRef(false);

  React.useEffect(() => {
    const glyphs = idNumber.split("");
    const lockable = glyphs.map((c, i) => (c === "-" ? -1 : i)).filter((i) => i >= 0);
    const start = performance.now();
    const LOCK_EVERY = 95;   // ms per locked glyph — the press has a rhythm
    const SETTLE = 320;      // pause once fully stamped, before the card

    const tick = setInterval(() => {
      const locked = Math.min(lockable.length, Math.floor((performance.now() - start) / LOCK_EVERY));
      setDisplay(
        glyphs
          .map((c, i) => {
            if (c === "-") return c;
            const pos = lockable.indexOf(i);
            if (pos < locked) return c;
            return STAMP_CHARSET[Math.floor(Math.random() * STAMP_CHARSET.length)];
          })
          .join("")
      );
      if (locked >= lockable.length && !done.current) {
        done.current = true;
        clearInterval(tick);
        setDisplay(idNumber);
        setTimeout(onDone, SETTLE);
      }
    }, 45);
    return () => clearInterval(tick);
  }, [idNumber, onDone]);

  return (
    <motion.div
      className="relative flex flex-col items-center text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.18 } }}
    >
      <motion.span
        aria-hidden
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        className="grid size-14 place-items-center rounded-full bg-white/[0.06] ring-1 ring-white/15"
      >
        <IlloPaw tone="orange" className="size-7" />
      </motion.span>
      <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.28em] text-white/50">
        {isAr ? `نطبع هوية ${catName}…` : `Stamping ${catName}'s ID…`}
      </p>
      <p className="mt-4 font-mono text-2xl tracking-[0.22em] text-white tabular sm:text-3xl" dir="ltr" aria-hidden>
        {display}
      </p>
    </motion.div>
  );
}

/* ── Act II · the card arrives ───────────────────────────────────────────── */

function RevealAct({
  cat,
  isAr,
  reduced,
  onClose,
  onShareChoice,
}: {
  cat: CeremonyCat;
  isAr: boolean;
  reduced: boolean;
  onClose: () => void;
  onShareChoice?: (makePublic: boolean) => Promise<void> | void;
}) {
  const ctaRef = React.useRef<HTMLButtonElement>(null);
  const [choosing, setChoosing] = React.useState<null | "public" | "private">(null);

  async function choose(makePublic: boolean) {
    setChoosing(makePublic ? "public" : "private");
    try {
      await onShareChoice?.(makePublic);
    } finally {
      onClose();
    }
  }
  const fade = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } } };

  React.useEffect(() => {
    const t = setTimeout(() => ctaRef.current?.focus(), reduced ? 60 : 1150);
    return () => clearTimeout(t);
  }, [reduced]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex w-full max-w-sm flex-col items-center text-center">
      <motion.p {...fade(0.45)} className="font-mono text-[10px] uppercase tracking-[0.28em] text-[hsl(18_93%_62%)]">
        {isAr ? "صارت رسمية" : "It's official"}
      </motion.p>
      <motion.p {...fade(0.6)} aria-hidden className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">
        {isAr ? `${cat.name} صار عضو` : `${cat.name} is a member`}
      </motion.p>
      <motion.p {...fade(0.75)} className="mt-2 text-sm leading-relaxed text-white/65">
        {isAr ? "هوية على اسمه، ورقم يخصّه هو بس." : "An identity in their name, and a number that's theirs alone."}
      </motion.p>

      {/* The artifact itself — it lands, settles, and a light passes over it once. */}
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 26, rotateX: 16 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, rotateX: 0 }}
        transition={reduced ? undefined : { type: "spring", stiffness: 170, damping: 19, mass: 0.9 }}
        style={{ transformPerspective: 900 }}
        className="relative mt-8 w-full"
      >
        <CatIdCard
          catName={cat.name}
          catIdNumber={cat.catIdNumber}
          issuedAt={cat.idIssuedAt}
          photoUrl={cat.photoUrl}
          isAr={isAr}
          hideStatus
          className="mx-auto shadow-glow"
        />
        {!reduced && (
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
            <motion.span
              className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
              initial={{ x: "-160%" }}
              animate={{ x: "420%" }}
              transition={{ delay: 0.5, duration: 0.9, ease: "easeInOut" }}
            />
          </span>
        )}
      </motion.div>

      {onShareChoice ? (
        <motion.div {...fade(1.0)} className="mt-9 w-full">
          <p className="mb-3 text-sm text-white/80">
            {isAr
              ? `تحب تشارك هوية ${cat.name} مع مجتمع مرقط؟`
              : `Would you like to share ${cat.name}'s Cat ID with the Moracat Community?`}
          </p>
          <div className="flex flex-col gap-2">
            <Button ref={ctaRef} size="lg" className="w-full" disabled={choosing !== null} onClick={() => choose(true)}>
              {choosing === "public" ? "…" : isAr ? "نعم، اجعلها عامة" : "Yes, make my Cat ID public"}
            </Button>
            <Button variant="glass" size="lg" className="w-full text-white" disabled={choosing !== null} onClick={() => choose(false)}>
              {choosing === "private" ? "…" : isAr ? "لا، احتفظ بها خاصة" : "No, keep it private"}
            </Button>
          </div>
          <p className="mt-2 text-xs text-white/50">
            {isAr ? "تقدر تغيّرها لاحقاً من إعدادات القط." : "You can change this later in your cat's settings."}
          </p>
        </motion.div>
      ) : (
        <motion.div {...fade(1.0)} className="mt-9 w-full">
          <Button ref={ctaRef} size="lg" className="w-full" onClick={onClose}>
            {isAr ? `يلا نبدأ مع ${cat.name}` : `Begin ${cat.name}'s journey`}
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
