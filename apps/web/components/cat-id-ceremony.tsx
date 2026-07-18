"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ImageDown, RotateCcw } from "lucide-react";
import { Button, cn, useFocusTrap, useToast } from "@moraqat/ui";
import { CatIdCard } from "./cat-id-card";
import { CatIdStory } from "./cat-id-story";
import { shareStoryPng, exportSafeSrc } from "@/lib/card-export";
import { IlloPaw } from "./illustrations";

interface CeremonyCat {
  name: string;
  catIdNumber: string;
  idIssuedAt?: string | null;
  photoUrl?: string | null;
  /** Enables the story-frame QR — the pride export works without it. */
  qrToken?: string | null;
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

/** On-scrim secondary button classes — the theme's `glass` hover paints
 *  white-on-white over the dark ceremony backdrop, so these are explicit. */
const SCRIM_BTN = "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/20";

/** The inscription date — Gregorian, in the member's language (R110). */
function formatIssued(iso: string | null | undefined, isAr: boolean): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString(isAr ? "ar-SA-u-ca-gregory" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * The Cat ID reveal — a moment, not a transaction (Dossier §05, R031).
 *
 * Two acts. First the press runs: the cat's NAME is stamped in glyph by glyph
 * — the cat is the hero, the name comes first (R009/R016) — then their number
 * follows, and the final lock lands with a tiny haptic tap. Then the card
 * itself arrives on a spring with a single sweep of light, an inscription
 * ("Member no. … · Issued …"), and the safety oath. The peak actions are
 * pride first — save the story, share with the community — and the exit is a
 * single quiet forward link, never a hard cut into a pitch. The richest
 * animation in the product lives here on purpose (R073); reduced-motion skips
 * straight to the card with a gentle fade (R075).
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
  /** If provided (full variant), the reveal offers "share with the community?"
   *  after the pride actions and reports the choice — including how the owner
   *  wants to appear (D6). Must THROW on failure so the ceremony can show an
   *  honest retry (R115). */
  onShareChoice?: (choice: ShareChoice) => Promise<void> | void;
  /** Full = stamping + reveal + pride + share fork. Mini = one card drop + continue. */
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
    <div ref={trapRef} className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="fixed inset-0 animate-fade-in bg-[hsl(168_50%_5%/0.9)] backdrop-blur-md" aria-hidden />

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

/* ── Act I · the press stamps the name, then the number ──────────────────── */

function StampingAct({ isAr, catName, idNumber, onDone }: { isAr: boolean; catName: string; idNumber: string; onDone: () => void }) {
  // The cat's name locks in first — the identity begins with who they are,
  // the number only certifies it (R009/R016). Name glyphs reveal in place
  // (no Latin scramble — Arabic names must stamp as themselves).
  const nameGlyphs = React.useMemo(() => catName.split(""), [catName]);
  const [nameLocked, setNameLocked] = React.useState(0);
  const [numberPhase, setNumberPhase] = React.useState(false);
  const [display, setDisplay] = React.useState(() => idNumber.replace(/[^-]/g, "•"));
  const done = React.useRef(false);

  // Phase 1 — the name.
  React.useEffect(() => {
    const NAME_EVERY = 85; // ms per name glyph — the press has a rhythm
    const NAME_SETTLE = 260; // beat between the name locking and the number starting
    const start = performance.now();
    const tick = setInterval(() => {
      const locked = Math.min(nameGlyphs.length, Math.floor((performance.now() - start) / NAME_EVERY) + 1);
      setNameLocked(locked);
      if (locked >= nameGlyphs.length) {
        clearInterval(tick);
        setTimeout(() => setNumberPhase(true), NAME_SETTLE);
      }
    }, 40);
    return () => clearInterval(tick);
  }, [nameGlyphs.length]);

  // Phase 2 — the number.
  React.useEffect(() => {
    if (!numberPhase) return;
    const glyphs = idNumber.split("");
    const lockable = glyphs.map((c, i) => (c === "-" ? -1 : i)).filter((i) => i >= 0);
    const start = performance.now();
    const LOCK_EVERY = 95;   // ms per locked glyph
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
        // The final glyph locks with a tiny physical tap — felt, not seen.
        // Belt-and-suspenders reduced-motion guard (this act is already
        // skipped under reduced motion) + feature support guard (R075).
        try {
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            navigator.vibrate?.([12, 40, 12]);
          }
        } catch { /* unsupported — the moment stands without it */ }
        setTimeout(onDone, SETTLE);
      }
    }, 45);
    return () => clearInterval(tick);
  }, [numberPhase, idNumber, onDone]);

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
      {/* The name — stamped first, glyph by glyph. */}
      <p className="mt-5 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl" dir={isAr ? "rtl" : "ltr"} aria-hidden>
        {nameGlyphs.map((g, i) => (
          <span key={i} className={cn("transition-opacity duration-150", i < nameLocked ? "opacity-100" : "opacity-25")}>
            {i < nameLocked ? g : g === " " ? " " : "•"}
          </span>
        ))}
      </p>
      {/* The number — follows once the name has locked. */}
      <p
        className={cn(
          "mt-3 font-mono text-2xl tracking-[0.22em] text-white tabular transition-opacity duration-300 sm:text-3xl",
          numberPhase ? "opacity-100" : "opacity-30"
        )}
        dir="ltr"
        aria-hidden
      >
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
  const { toast } = useToast();
  const ctaRef = React.useRef<HTMLButtonElement>(null);
  const firstOptionRef = React.useRef<HTMLButtonElement>(null);
  const storyRef = React.useRef<HTMLDivElement>(null);

  // Pride first, ask second (D6, R004): the fork only opens if invited.
  const [stage, setStage] = React.useState<"pride" | "appearance">("pride");
  const [saving, setSaving] = React.useState<null | "public" | "private">(null);
  const [appearance, setAppearance] = React.useState<ShareAppearance | null>(null);
  const [nickname, setNickname] = React.useState("");
  const [consented, setConsented] = React.useState(false);
  const [shareError, setShareError] = React.useState(false);
  const [sharedDone, setSharedDone] = React.useState(false);
  const [storyBusy, setStoryBusy] = React.useState(false);

  const firstName = (ownerFirstName ?? "").trim();
  const hasPhoto = Boolean(cat.photoUrl);

  /** THE peak action — the member walks away holding the story (Wrapped moment). */
  async function saveStory() {
    if (!storyRef.current || storyBusy) return;
    setStoryBusy(true);
    try {
      const outcome = await shareStoryPng(
        storyRef.current,
        `moracat-${cat.name}`.toLowerCase().replace(/\s+/g, "-"),
        isAr
          ? `${cat.name} رسمياً في عائلة مرقط 🐾 سوّ هوية قطك على moracat.co`
          : `${cat.name} is officially a Moracat 🐾 Create your cat's ID at moracat.co`
      );
      if (outcome === "downloaded") {
        toast({
          title: isAr ? "جاهزة للستوري ✨" : "Story ready ✨",
          description: isAr ? "حفظناها لك — ارفعها على انستقرام" : "Saved for you — post it to your Story",
          variant: "success",
        });
      }
    } catch {
      toast({ title: isAr ? "تعذّر إنشاء القصة — جرّب مرة ثانية" : "Couldn't create the story — try again", variant: "error" });
    } finally {
      setStoryBusy(false);
    }
  }

  /** The single quiet exit (R005): one breathing beat, then the plan. */
  async function finishToPlan() {
    if (saving) return;
    if (!sharedDone) {
      setSaving("private");
      try {
        await onShareChoice?.({ public: false });
      } catch {
        // Private is the default state — nothing was promised, nothing is lost.
      }
    }
    onClose();
  }

  const resolvedName =
    appearance === "nickname" ? nickname.trim() : appearance === "firstName" ? firstName : "";
  const canShare =
    appearance !== null &&
    (appearance === "anonymous" || resolvedName.length > 0) &&
    // PDPL people-consent only applies when there is a photo to publish (R106).
    (!hasPhoto || consented);

  async function sharePublic() {
    if (!canShare || saving) return;
    setSaving("public");
    setShareError(false);
    try {
      await onShareChoice?.({
        public: true,
        appearance: appearance!,
        ...(appearance !== "anonymous" && resolvedName ? { nickname: resolvedName } : {}),
        ...(hasPhoto ? { consent: true } : {}),
      });
      // Back to the pride screen — the celebration continues; the forward
      // link remains the one exit (R005, no hard cut).
      setSharedDone(true);
      setSaving(null);
      setStage("pride");
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
    else ctaRef.current?.focus();
  }, [stage]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative my-auto flex w-full max-w-sm flex-col items-center py-4 text-center">
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

      {/* The inscription — quiet, engraved, permanent (R032). */}
      <motion.p {...fade(0.85)} className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-white/45">
        {isAr ? (
          <>عضو رقم <bdi dir="ltr">{cat.catIdNumber}</bdi> · صدرت في {formatIssued(cat.idIssuedAt, true)}</>
        ) : (
          <>Member no. <bdi dir="ltr">{cat.catIdNumber}</bdi> · Issued {formatIssued(cat.idIssuedAt, false)}</>
        )}
      </motion.p>
      {/* The oath — the card's first real job, said plainly (R033/R040). */}
      <motion.p {...fade(0.95)} className="mt-2 text-xs leading-relaxed text-white/60">
        {isAr
          ? `إذا ضاع ${cat.name} يوماً، هذه البطاقة تعيده لك`
          : `If ${cat.name} is ever lost, this card brings them home`}
      </motion.p>

      <motion.div {...fade(1.1)} className="mt-8 w-full">
        <AnimatePresence mode="wait" initial={false}>
          {stage === "pride" ? (
            <motion.div
              key="pride"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, transition: { duration: 0.16 } }}
              className="flex flex-col gap-2"
            >
              {/* Pride comes first: walk away holding the story (Wrapped). */}
              <Button ref={ctaRef} size="lg" className="w-full" loading={storyBusy} onClick={saveStory}>
                {!storyBusy && <ImageDown className="size-4" aria-hidden />}
                {isAr ? `احفظ قصة ${cat.name}` : `Save ${cat.name}'s story`}
              </Button>

              {onShareChoice && (
                sharedDone ? (
                  <p role="status" className="py-2 text-sm text-white/75">
                    {isAr ? `صار ${cat.name} ظاهراً لمجتمع مرقط ✓` : `${cat.name} is now visible to the Moracat community ✓`}
                  </p>
                ) : (
                  <Button
                    variant="ghost"
                    size="lg"
                    className={cn("w-full", SCRIM_BTN)}
                    disabled={saving !== null || storyBusy}
                    onClick={() => setStage("appearance")}
                  >
                    {isAr ? `شارك ${cat.name} مع المجتمع` : `Share ${cat.name} with the community`}
                  </Button>
                )
              )}

              {/* One breathing beat, then forward — never a hard cut (R005/R007). */}
              <button
                type="button"
                onClick={finishToPlan}
                disabled={saving !== null}
                className="mt-2 inline-flex min-h-[44px] w-full items-center justify-center gap-1 rounded-full text-sm text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-50"
              >
                {saving === "private" ? (
                  isAr ? "لحظة…" : "One moment…"
                ) : (
                  <>
                    {isAr ? `التالي: خطة ${cat.name}` : `Next: ${cat.name}'s plan`}
                    <span aria-hidden className="rtl:rotate-180">→</span>
                  </>
                )}
              </button>
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

              {/* PDPL photo-consent attestation (R106) — only when there is a
                  photo to publish; the promise matches the community panel. */}
              {hasPhoto && (
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
              )}

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
              {/* Clearly skippable (R010/R116): Later is a full peer button,
                  and it returns to the celebration, not to a pitch. */}
              <Button
                variant="ghost"
                size="lg"
                className={cn("mt-2 w-full", SCRIM_BTN)}
                disabled={saving !== null}
                onClick={() => { setStage("pride"); setShareError(false); }}
              >
                {isAr ? "لاحقاً" : "Later"}
              </Button>
              <p className="mt-2 text-center text-xs text-white/50">
                {isAr ? `تقدر تغيّر هذا متى ما تبي من ملف ${cat.name}.` : `Change this anytime from ${cat.name}'s profile.`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Watch again (R031) — quiet, and only while no choice is mid-flight;
          replaying resets the reveal, so it steps aside once the fork is open. */}
      {onReplay && stage === "pride" && saving === null && (
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

      {/* Hidden 9:16 story node, captured by "Save the story" (kept off-screen). */}
      <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
        <div ref={storyRef}>
          <CatIdStory
            catName={cat.name}
            catIdNumber={cat.catIdNumber}
            issuedAt={cat.idIssuedAt}
            photoUrl={exportSafeSrc(cat.photoUrl)}
            qrToken={cat.qrToken}
            isAr={isAr}
          />
        </div>
      </div>
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
