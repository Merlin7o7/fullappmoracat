"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { RotateCcw } from "lucide-react";
import { Button, cn, useFocusTrap } from "@moraqat/ui";
import { CatIdCard } from "./cat-id-card";
import { IlloPaw } from "./illustrations";

interface CeremonyCat {
  name: string;
  catIdNumber: string;
  idIssuedAt?: string | null;
  photoUrl?: string | null;
}

/** How the owner chose to appear beside a shared cat (strategy decision D6). */
export type ShareAppearance = "anonymous" | "nickname" | "firstName";

/** What the ceremony reports back when the member decides about sharing. */
export interface ShareChoice {
  public: boolean;
  /** Present only when `public` — which identity the owner picked. */
  appearance?: ShareAppearance;
  /** The resolved display name (their nickname or first name), when one is revealed. */
  nickname?: string;
  /** PDPL photo-consent attestation (R106) — always true when going public;
   *  the server mints the timestamp itself. */
  consent?: boolean;
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
 *
 * `variant="mini"` is the quieter sibling for every cat after the first
 * (R031/R009): no stamping act, one spring drop, one warm line, one action —
 * the household's second welcome should feel familiar, not inflated.
 */
export function CatIdCeremony({
  cat,
  isAr,
  onClose,
  onShareChoice,
  variant = "full",
  ownerFirstName,
}: {
  cat: CeremonyCat;
  isAr: boolean;
  onClose: () => void;
  /** If provided (full variant), the reveal asks "share with the community?"
   *  and reports the choice — including how the owner wants to appear (D6).
   *  Must THROW on failure so the ceremony can show an honest retry (R115). */
  onShareChoice?: (choice: ShareChoice) => Promise<void> | void;
  /** Full = stamping + reveal + share fork. Mini = one card drop + continue. */
  variant?: "full" | "mini";
  /** The member's first name — offered as one of the share-appearance options. */
  ownerFirstName?: string | null;
}) {
  const titleId = React.useId();
  const reduced = useReducedMotion();
  const mini = variant === "mini";
  const [act, setAct] = React.useState<"stamping" | "reveal">(mini || reduced ? "reveal" : "stamping");
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
        {mini
          ? isAr
            ? `أهلاً ${cat.name} — صرت فرد من عائلة مرقط، رقم الهوية ${cat.catIdNumber}`
            : `Welcome, ${cat.name} — you're part of the Moracat family, Cat ID ${cat.catIdNumber}`
          : isAr
            ? `${cat.name} صار عضو — رقم الهوية ${cat.catIdNumber}`
            : `${cat.name} is a member — Cat ID ${cat.catIdNumber}`}
      </h2>

      {mini ? (
        <MiniAct cat={cat} isAr={isAr} reduced={!!reduced} onClose={onClose} />
      ) : (
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
            <RevealAct
              key="reveal"
              cat={cat}
              isAr={isAr}
              reduced={!!reduced}
              onClose={onClose}
              onShareChoice={onShareChoice}
              ownerFirstName={ownerFirstName}
              // Watch again (R031): replay is pure theatre, so it only exists
              // where the theatre does — hidden under reduced motion (R075).
              onReplay={reduced ? undefined : () => setAct("stamping")}
            />
          )}
        </AnimatePresence>
      )}
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
  ownerFirstName,
  onReplay,
}: {
  cat: CeremonyCat;
  isAr: boolean;
  reduced: boolean;
  onClose: () => void;
  onShareChoice?: (choice: ShareChoice) => Promise<void> | void;
  ownerFirstName?: string | null;
  onReplay?: () => void;
}) {
  const ctaRef = React.useRef<HTMLButtonElement>(null);
  const firstOptionRef = React.useRef<HTMLButtonElement>(null);

  // The share fork (D6): first "share?", then — only on yes — "appear how?".
  const [stage, setStage] = React.useState<"ask" | "appearance">("ask");
  const [saving, setSaving] = React.useState<null | "public" | "private">(null);
  const [appearance, setAppearance] = React.useState<ShareAppearance | null>(null);
  const [nickname, setNickname] = React.useState("");
  const [consented, setConsented] = React.useState(false);
  const [shareError, setShareError] = React.useState(false);

  const firstName = (ownerFirstName ?? "").trim();

  async function keepPrivate() {
    setSaving("private");
    try {
      await onShareChoice?.({ public: false });
    } catch {
      // Private is the default state — nothing was promised, nothing is lost.
    }
    onClose();
  }

  const resolvedName =
    appearance === "nickname" ? nickname.trim() : appearance === "firstName" ? firstName : "";
  const canShare =
    appearance !== null && (appearance === "anonymous" || resolvedName.length > 0) && consented;

  async function sharePublic() {
    if (!canShare || saving) return;
    setSaving("public");
    setShareError(false);
    try {
      await onShareChoice?.({
        public: true,
        appearance: appearance!,
        ...(appearance !== "anonymous" && resolvedName ? { nickname: resolvedName } : {}),
        consent: true,
      });
      onClose();
    } catch {
      // Honest failure (R115/R117): stay open, say so warmly, offer a retry —
      // never close pretending the choice was saved.
      setShareError(true);
      setSaving(null);
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

  // When the fork opens, guide focus to the first option — the trap keeps Tab
  // inside; this keeps the next decision one keystroke away (R097).
  React.useEffect(() => {
    if (stage === "appearance") firstOptionRef.current?.focus();
  }, [stage]);

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
          <AnimatePresence mode="wait" initial={false}>
            {stage === "ask" ? (
              <motion.div
                key="ask"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: 0.16 } }}
              >
                <p className="mb-3 text-sm text-white/80">
                  {isAr
                    ? `تحب تشارك هوية ${cat.name} مع مجتمع مرقط؟`
                    : `Would you like to share ${cat.name}'s Cat ID with the Moracat Community?`}
                </p>
                <div className="flex flex-col gap-2">
                  <Button ref={ctaRef} size="lg" className="w-full" disabled={saving !== null} onClick={() => setStage("appearance")}>
                    {isAr ? "نعم، اجعلها عامة" : "Yes, make my Cat ID public"}
                  </Button>
                  <Button variant="glass" size="lg" className="w-full text-white" disabled={saving !== null} loading={saving === "private"} onClick={keepPrivate}>
                    {isAr ? "لا، احتفظ بها خاصة" : "No, keep it private"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-white/50">
                  {isAr ? "تقدر تغيّرها لاحقاً من إعدادات القط." : "You can change this later in your cat's settings."}
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="appearance"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } }}
                exit={{ opacity: 0 }}
                className="text-start"
              >
                {/* The identity fork (D6): three equal ways to stand beside the
                    cat — no default, no nudging. The cat stays the hero (§09). */}
                <p id="appearance-q" className="mb-3 text-center text-sm text-white/80">
                  {isAr ? "وتحب تظهر معه كيف؟" : "And how would you like to appear with them?"}
                </p>
                <div role="radiogroup" aria-labelledby="appearance-q" className="flex flex-col gap-2">
                  <AppearanceOption
                    ref={firstOptionRef}
                    selected={appearance === "anonymous"}
                    onSelect={() => setAppearance("anonymous")}
                    label={isAr ? "بدون اسم" : "Anonymous"}
                    detail={isAr ? "يظهر القط لحاله" : "Just the cat, on their own"}
                  />
                  <AppearanceOption
                    selected={appearance === "nickname"}
                    onSelect={() => setAppearance("nickname")}
                    label={isAr ? "باسم مستعار" : "With a nickname"}
                    detail={isAr ? "اسم تختاره أنت" : "A name you choose"}
                  />
                  {appearance === "nickname" && (
                    <motion.input
                      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      autoFocus
                      type="text"
                      value={nickname}
                      maxLength={60}
                      onChange={(e) => setNickname(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sharePublic(); } }}
                      aria-label={isAr ? "الاسم المستعار" : "Your nickname"}
                      placeholder={isAr ? "وش الاسم؟" : "What should it be?"}
                      className="h-11 w-full rounded-xl bg-white/[0.08] px-3.5 text-sm text-white outline-none ring-1 ring-white/20 transition placeholder:text-white/35 focus:ring-2 focus:ring-[hsl(18_93%_62%)]"
                    />
                  )}
                  {firstName && (
                    <AppearanceOption
                      selected={appearance === "firstName"}
                      onSelect={() => setAppearance("firstName")}
                      label={isAr ? "باسمي الأول" : "My first name"}
                      detail={firstName}
                    />
                  )}
                </div>

                {/* PDPL photo-consent attestation (R106) — same words as the
                    community panel; going public always carries this promise. */}
                <label className="mt-3 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl bg-white/[0.06] p-3 text-xs leading-relaxed text-white/80 ring-1 ring-white/15">
                  <input
                    type="checkbox"
                    checked={consented}
                    onChange={(e) => setConsented(e.target.checked)}
                    className="mt-0.5 size-4 shrink-0 accent-[hsl(18_93%_62%)]"
                  />
                  <span>
                    {isAr
                      ? `صور ${cat.name} ممكن تظهر فيها وجوه أشخاص — أؤكد أن عندي موافقتهم على نشرها.`
                      : `If ${cat.name}'s photos show people, I confirm I have their permission to share them.`}
                  </span>
                </label>

                {shareError && (
                  <p role="alert" className="mt-3 text-xs leading-relaxed text-[hsl(43_90%_70%)]">
                    {isAr
                      ? `ما قدرنا نحفظ اختيارك — هوية ${cat.name} سليمة، بس جرّب الحفظ مرة ثانية.`
                      : `We couldn't save your choice — ${cat.name}'s ID is safe, just try saving again.`}
                  </p>
                )}

                <Button size="lg" className="mt-4 w-full" disabled={!canShare} loading={saving === "public"} onClick={sharePublic}>
                  {shareError
                    ? isAr ? "جرّب مرة ثانية" : "Try again"
                    : isAr ? `شارك ${cat.name} مع المجتمع` : `Share ${cat.name} with the community`}
                </Button>
                <button
                  type="button"
                  onClick={keepPrivate}
                  disabled={saving !== null}
                  className="mt-1 inline-flex min-h-[44px] w-full items-center justify-center rounded-full text-sm text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50"
                >
                  {isAr ? "بل خلّها خاصة" : "Keep it private instead"}
                </button>
                <p className="mt-1 text-center text-xs text-white/50">
                  {isAr ? `تقدر تغيّر هذا متى ما تبي من ملف ${cat.name}.` : `Change this anytime from ${cat.name}'s profile.`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div {...fade(1.0)} className="mt-9 w-full">
          <Button ref={ctaRef} size="lg" className="w-full" onClick={onClose}>
            {isAr ? `يلا نبدأ مع ${cat.name}` : `Begin ${cat.name}'s journey`}
          </Button>
        </motion.div>
      )}

      {/* Watch again (R031) — quiet, and only while no choice is mid-flight;
          replaying resets the reveal, so it steps aside once the fork is open. */}
      {onReplay && stage === "ask" && saving === null && (
        <motion.div {...fade(1.25)}>
          <button
            type="button"
            onClick={onReplay}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 text-xs text-white/50 transition-colors hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <RotateCcw className="size-3.5" />
            {isAr ? "شوفها مرة ثانية" : "Watch again"}
          </button>
        </motion.div>
      )}
    </motion.div>
  );
}

/** One of the three ways to appear — equal weight, none preselected (D6). */
const AppearanceOption = React.forwardRef<
  HTMLButtonElement,
  { selected: boolean; onSelect: () => void; label: string; detail?: string }
>(function AppearanceOption({ selected, onSelect, label, detail }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-[44px] w-full items-center gap-3 rounded-xl px-4 py-2.5 text-start text-sm text-white ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(18_93%_62%)]",
        selected ? "bg-white/[0.12] ring-[hsl(18_93%_62%)]" : "bg-white/[0.06] ring-white/15 hover:bg-white/[0.09]"
      )}
    >
      {/* A real dot, not just a colour change (R093). */}
      <span aria-hidden className="grid size-4 shrink-0 place-items-center rounded-full ring-1 ring-white/40">
        {selected && <span className="size-2 rounded-full bg-[hsl(18_93%_62%)]" />}
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {detail && <span className="block truncate text-xs text-white/50">{detail}</span>}
      </span>
    </button>
  );
});

/* ── Mini · the familiar welcome for every cat after the first (R031/R009) ── */

function MiniAct({
  cat,
  isAr,
  reduced,
  onClose,
}: {
  cat: CeremonyCat;
  isAr: boolean;
  reduced: boolean;
  onClose: () => void;
}) {
  const ctaRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const t = setTimeout(() => ctaRef.current?.focus(), reduced ? 60 : 700);
    return () => clearTimeout(t);
  }, [reduced]);

  const fade = (delay: number) =>
    reduced
      ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { delay, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } } };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex w-full max-w-sm flex-col items-center text-center">
      {/* One spring drop (~0.6s) — the family knows this card by now. */}
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: -30, scale: 0.94 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={reduced ? { duration: 0.3 } : { type: "spring", stiffness: 240, damping: 22, mass: 0.8 }}
        className="w-full"
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
      </motion.div>

      <motion.p {...fade(0.35)} aria-hidden className="mt-7 text-base leading-relaxed text-white/85">
        {isAr
          ? `أهلاً ${cat.name} — صرت فرد من عائلة مرقط`
          : `Welcome, ${cat.name} — you're part of the Moracat family`}
      </motion.p>

      <motion.div {...fade(0.5)} className="mt-6 w-full">
        <Button ref={ctaRef} size="lg" className="w-full" onClick={onClose}>
          {isAr ? `يلا نكمل ملف ${cat.name}` : `Continue to ${cat.name}'s profile`}
        </Button>
      </motion.div>
    </motion.div>
  );
}
