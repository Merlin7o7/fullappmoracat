"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Loader2, Check, Sparkles, RotateCcw, FlipHorizontal2,
  Plus, Minus, Trash2, Wand2,
} from "lucide-react";
import { Card, Button, cn, useToast } from "@moraqat/ui";
import { useAuth } from "@/lib/auth";
import { useLocale } from "@/app/providers";
import { useCats } from "@/lib/cat-context";
import { localizeName } from "@/lib/translit";
import { Field, SelectField } from "@/components/field";
import { PhotoUploader } from "@/components/photo-uploader";
import { CatIdCard } from "@/components/cat-id-card";
import { IlloPaw } from "@/components/illustrations";
import {
  ABOUT_Q, EMOJI_CHOICES,
  CARD_THEMES, ACCENTS, FRAMES, STICKERS,
  themeById, accentById, resolvePersonalization, profileCompleteness, earnedBadges,
  type Question, type AnswerMap, type CatProfile, type Personalization, type StickerPlacement,
  type CatForDerivation,
} from "@/lib/cat-profile";

interface Breed { id: string; nameEn: string; nameAr: string }

interface CatDetail {
  id: string; name: string; catIdNumber?: string | null; idIssuedAt?: string | null;
  photoUrl?: string | null; birthDate?: string | null; breedId?: string | null;
  breed?: { id?: string; nameEn: string; nameAr: string } | null;
  coatColor?: string | null; weightKg?: number | null; isIndoor?: boolean | null;
  isNeutered?: boolean | null; microchipNo?: string | null; gender?: string | null;
  vaccinationStatus?: string | null; currentMedications?: string | null; emergencyNotes?: string | null;
  favoriteFoods?: string[]; allergyNames?: string[]; healthConditionNames?: string[];
  profile?: CatProfile | null;
}

/**
 * "Complete the file" — reimagined as *welcoming a family member*, not filling a
 * form. The fast Cat-ID issue already happened; this is the invited, optional,
 * joyful follow-up (R002/R017). Every input is skippable; the cat's name threads
 * through the copy (R082); the live card shows the identity becoming *theirs*;
 * and recognition (badges + a gentle completeness ring) replaces any points
 * economy (§04). One restrained celebration crowns it (R073/R080).
 */
export function CatOnboardingJourney({ catId }: { catId: string }) {
  const { authedFetch, user } = useAuth();
  const { locale } = useLocale();
  const { toast } = useToast();
  const { refresh } = useCats();
  const router = useRouter();
  const qc = useQueryClient();
  const isAr = locale === "ar";
  const reduced = useReducedMotion();

  const { data: cat, isLoading } = useQuery({
    queryKey: ["cat-file", catId],
    queryFn: () => authedFetch<CatDetail>(`/cats/${catId}`),
    enabled: !!user,
  });
  const { data: breeds } = useQuery({
    queryKey: ["breeds"],
    queryFn: () => authedFetch<Breed[]>("/cats/meta/breeds"),
    enabled: !!user,
  });

  const [draft, setDraft] = React.useState<Draft>(() => emptyDraft());
  const [step, setStep] = React.useState(0);
  const [dir, setDir] = React.useState<1 | -1>(1);
  const [celebrating, setCelebrating] = React.useState(false);
  const filled = React.useRef(false);

  // Prefill once — never make the member repeat themselves (R117).
  React.useEffect(() => {
    if (!cat || filled.current) return;
    filled.current = true;
    setDraft(fromCat(cat));
  }, [cat]);

  const catName = cat?.name ?? "";
  const dispName = localizeName(catName, isAr ? "ar" : "en");

  // A live view of the cat as it would be after this draft — powers the ring,
  // the badges, and the personalised card, all updating as they type.
  const liveCat: CatForDerivation = React.useMemo(
    () => ({
      name: catName,
      photoUrl: draft.photoUrl || cat?.photoUrl,
      birthDate: draft.birthDate || null,
      breedId: draft.breedId || null,
      breed: cat?.breed ?? null,
      weightKg: draft.weightKg ? Number(draft.weightKg) : null,
      coatColor: draft.coatColor || null,
      isIndoor: draft.isIndoor === "" ? null : draft.isIndoor === "true",
      isNeutered: draft.isNeutered === "unknown" ? null : draft.isNeutered === "true",
      microchipNo: draft.microchipNo || null,
      vaccinationStatus: draft.vaccinationStatus || null,
      favoriteFoods: draft.favoriteFood ? [draft.favoriteFood] : [],
      allergyNames: splitList(draft.allergies),
      healthConditionNames: splitList(draft.medicalConditions),
      profile: draftProfile(draft),
    }),
    [draft, cat, catName]
  );

  const completeness = React.useMemo(() => profileCompleteness(liveCat), [liveCat]);
  const badges = React.useMemo(() => earnedBadges(liveCat), [liveCat]);

  const persist = useMutation({
    mutationFn: () =>
      authedFetch(`/cats/${catId}`, { method: "PATCH", body: JSON.stringify(toPayload(draft)) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cats"] });
      qc.invalidateQueries({ queryKey: ["cat-file", catId] });
      refresh();
    },
  });

  const chapters = React.useMemo(() => buildChapters(dispName, isAr), [dispName, isAr]);
  const atLast = step === chapters.length - 1;

  async function go(next: number) {
    // Save progress every time we move forward — data is never at risk (R117).
    if (next > step) { try { await persist.mutateAsync(); } catch { /* soft — kept locally */ } }
    setDir(next > step ? 1 : -1);
    setStep(Math.max(0, Math.min(chapters.length - 1, next)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  }

  async function finish() {
    try {
      await persist.mutateAsync();
      setCelebrating(true);
    } catch (e) {
      toast({ title: isAr ? "ما قدرنا نحفظ" : "Couldn't save", description: (e as Error).message, variant: "error" });
    }
  }

  if (isLoading || !cat) {
    return <div className="grid place-items-center py-24"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  const personalization = draft.personalization;
  const resolved = resolvePersonalization(personalization);

  return (
    <div className="mx-auto max-w-5xl pb-24">
      {/* Header — warm, name-first, honest about being optional (R081/R082). */}
      <div className="relative mb-6">
        <IlloPaw tone="peach" className="pointer-events-none absolute -top-4 end-0 size-10 rotate-[14deg] opacity-40" />
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-accent-ink">
          {isAr ? "عائلة مرقط" : "The Moracat family"}
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {isAr ? `خلّنا نعرف ${dispName} أكثر` : `Let's get to know ${dispName}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isAr ? "كل سؤال اختياري — تقدر تتخطّى أي شي، وكل تفصيلة تخلّي هويته تحكي عنه" : "Every question is optional — skip anything. Each detail makes their ID more theirs."}
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_minmax(0,21rem)]">
        {/* ── Left: the chaptered experience ── */}
        <div className="order-2 lg:order-1">
          <Stepper chapters={chapters} step={step} onJump={go} isAr={isAr} />

          <div className="relative mt-4 overflow-hidden">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step}
                custom={dir}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: dir * 24 }}
                animate={reduced ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -24 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <ChapterBody
                  step={step}
                  draft={draft}
                  setDraft={setDraft}
                  breeds={breeds ?? []}
                  isAr={isAr}
                  dispName={dispName}
                  cat={cat}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Nav — one clear action, always (R005). */}
          <div className="mt-6 flex items-center justify-between gap-3">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => go(step - 1)} disabled={persist.isPending}>
                <ArrowLeft className="size-4 rtl:rotate-180" /> {isAr ? "رجوع" : "Back"}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => router.push("/portal/cats")} disabled={persist.isPending}>
                {isAr ? "لاحقاً" : "Later"}
              </Button>
            )}
            {atLast ? (
              <Button size="lg" onClick={finish} loading={persist.isPending}>
                <Sparkles className="size-4" /> {isAr ? `اكمل ملف ${dispName}` : `Complete ${dispName}'s profile`}
              </Button>
            ) : (
              <Button size="lg" onClick={() => go(step + 1)} loading={persist.isPending}>
                {isAr ? "التالي" : "Continue"} <ArrowRight className="size-4 rtl:rotate-180" />
              </Button>
            )}
          </div>
        </div>

        {/* ── Right: the living card + recognition rail ── */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-24">
          <div className="relative mx-auto w-full max-w-xs">
            <CatIdCard
              catName={catName}
              catIdNumber={cat.catIdNumber ?? "MRC-····-····"}
              photoUrl={draft.photoUrl || cat.photoUrl || null}
              issuedAt={cat.idIssuedAt}
              isAr={isAr}
              hideStatus
              themeField={themeById(personalization.theme).field}
              accentHsl={accentById(personalization.accent).hsl}
              frame={personalization.frame}
              // On the Personalize step the editor draws its own interactive
              // sticker layer, so the static one is suppressed to avoid doubles.
              stickers={step === STEP.personalize ? [] : resolved.stickers}
            />
          </div>

          <RecognitionRail completeness={completeness} badges={badges} isAr={isAr} dispName={dispName} />
        </aside>
      </div>

      {celebrating && cat.catIdNumber && (
        <Celebration
          cat={cat}
          draft={draft}
          badges={badges}
          completeness={completeness.percent}
          isAr={isAr}
          dispName={dispName}
          reduced={!!reduced}
          onClose={() => router.push("/portal/cats")}
        />
      )}
    </div>
  );
}

/* ══ Draft model ═════════════════════════════════════════════════════════════ */

interface Draft {
  photoUrl: string;
  birthDate: string; breedId: string; coatColor: string; weightKg: string;
  isIndoor: "" | "true" | "false"; isNeutered: "unknown" | "true" | "false"; microchipNo: string;
  vaccinationStatus: string; allergies: string; medicalConditions: string;
  currentMedications: string; emergencyNotes: string; favoriteFood: string;
  about: AnswerMap; personality: AnswerMap; favorites: AnswerMap; fun: AnswerMap;
  personalization: Personalization;
}

function emptyDraft(): Draft {
  return {
    photoUrl: "", birthDate: "", breedId: "", coatColor: "", weightKg: "",
    isIndoor: "", isNeutered: "unknown", microchipNo: "",
    vaccinationStatus: "UNKNOWN", allergies: "", medicalConditions: "",
    currentMedications: "", emergencyNotes: "", favoriteFood: "",
    about: {}, personality: {}, favorites: {}, fun: {},
    personalization: { theme: "classic", accent: "signature", frame: "none", stickers: [] },
  };
}

function fromCat(cat: CatDetail): Draft {
  const p = cat.profile ?? {};
  return {
    photoUrl: cat.photoUrl ?? "",
    birthDate: cat.birthDate ? cat.birthDate.slice(0, 10) : "",
    breedId: cat.breedId ?? cat.breed?.id ?? "",
    coatColor: cat.coatColor ?? "",
    weightKg: cat.weightKg != null ? String(cat.weightKg) : "",
    isIndoor: cat.isIndoor == null ? "" : cat.isIndoor ? "true" : "false",
    isNeutered: cat.isNeutered == null ? "unknown" : cat.isNeutered ? "true" : "false",
    microchipNo: cat.microchipNo ?? "",
    vaccinationStatus: cat.vaccinationStatus ?? "UNKNOWN",
    allergies: (cat.allergyNames ?? []).join(", "),
    medicalConditions: (cat.healthConditionNames ?? []).join(", "),
    currentMedications: cat.currentMedications ?? "",
    emergencyNotes: cat.emergencyNotes ?? "",
    favoriteFood: cat.favoriteFoods?.[0] ?? "",
    about: p.about ?? {},
    personality: p.personality ?? {},
    favorites: p.favorites ?? {},
    fun: p.fun ?? {},
    personalization: {
      theme: p.personalization?.theme ?? "classic",
      accent: p.personalization?.accent ?? "signature",
      frame: p.personalization?.frame ?? "none",
      stickers: p.personalization?.stickers ?? [],
    },
  };
}

function draftProfile(d: Draft): CatProfile {
  const clean = (m: AnswerMap) => (Object.keys(m).length ? m : undefined);
  return {
    about: clean(d.about),
    personality: clean(d.personality),
    favorites: clean(d.favorites),
    fun: clean(d.fun),
    personalization: d.personalization,
  };
}

function toPayload(d: Draft) {
  return {
    photoUrl: d.photoUrl || undefined,
    birthDate: d.birthDate || undefined,
    breedId: d.breedId || undefined,
    coatColor: d.coatColor || undefined,
    weightKg: d.weightKg ? Number(d.weightKg) : undefined,
    isIndoor: d.isIndoor === "" ? undefined : d.isIndoor === "true",
    isNeutered: d.isNeutered === "unknown" ? undefined : d.isNeutered === "true",
    microchipNo: d.microchipNo || undefined,
    vaccinationStatus: d.vaccinationStatus || undefined,
    allergies: splitList(d.allergies),
    healthConditions: splitList(d.medicalConditions),
    currentMedications: d.currentMedications || undefined,
    emergencyNotes: d.emergencyNotes || undefined,
    favoriteFoods: d.favoriteFood ? [d.favoriteFood] : [],
    profile: draftProfile(d),
  };
}

function splitList(s: string): string[] {
  return [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))];
}

/* ══ Chapters ════════════════════════════════════════════════════════════════ */

// Onboarding stays short and effortless (R002): only what serves the Cat ID and
// its personalization. Health records, personality, favourites and fun are
// invited LATER, framed as a benefit to the cat — never front-loaded at signup.
const STEP = { about: 0, personalize: 1, celebrate: 2 } as const;

interface Chapter { emoji: string; title: string; subtitle: string }

function buildChapters(name: string, isAr: boolean): Chapter[] {
  return [
    { emoji: "🐱", title: isAr ? "التعريف" : "About", subtitle: isAr ? `أساسيات ${name}` : `${name}'s basics` },
    { emoji: "🎨", title: isAr ? "التخصيص" : "Personalise", subtitle: isAr ? "صمّم بطاقته" : "Design their card" },
    { emoji: "🏅", title: isAr ? "الاحتفال" : "Celebrate", subtitle: isAr ? "ملف مكتمل" : "Profile complete" },
  ];
}

function Stepper({ chapters, step, onJump, isAr }: { chapters: Chapter[]; step: number; onJump: (n: number) => void; isAr: boolean }) {
  return (
    <div className="flex items-center gap-1.5" role="tablist" aria-label={isAr ? "مراحل الملف" : "Profile chapters"}>
      {chapters.map((ch, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={ch.title}
            onClick={() => onJump(i)}
            className={cn(
              "group flex items-center gap-1.5 rounded-full transition-all duration-300",
              active ? "bg-primary px-3 py-1.5 text-primary-foreground" : "px-1.5 py-1.5"
            )}
          >
            <span className={cn("grid size-6 place-items-center rounded-full text-xs transition-colors", !active && (done ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"))}>
              {done ? <Check className="size-3.5" /> : <span aria-hidden>{ch.emoji}</span>}
            </span>
            {active && <span className="text-xs font-semibold">{ch.title}</span>}
          </button>
        );
      })}
    </div>
  );
}

function ChapterBody({
  step, draft, setDraft, breeds, isAr, dispName, cat,
}: {
  step: number; draft: Draft; setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  breeds: Breed[]; isAr: boolean; dispName: string; cat: CatDetail;
}) {
  const set = (patch: Partial<Draft>) => setDraft((s) => ({ ...s, ...patch }));
  const setAns = (section: "about" | "personality" | "favorites" | "fun") => (id: string, v: string | string[] | undefined) =>
    setDraft((s) => {
      const next = { ...s[section] };
      if (v == null || (Array.isArray(v) && v.length === 0) || v === "") delete next[id];
      else next[id] = v;
      return { ...s, [section]: next };
    });

  switch (step) {
    case STEP.about:
      return (
        <ChapterCard emoji="🐱" title={isAr ? `تعريف ${dispName}` : `About ${dispName}`} intro={isAr ? "الأساسيات اللي تعرّف عنه — كلها اختيارية." : "The basics that describe them — all optional."}>
          <PhotoUploader
            endpoint="/uploads/image" aspect={1} rounded maxEdge={800}
            currentUrl={draft.photoUrl || null} isAr={isAr}
            label={isAr ? "صورته (تطلع على الهوية)" : "Photo (it goes on the ID)"}
            onUploaded={(res) => set({ photoUrl: (res.url as string) ?? "" })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={isAr ? "تاريخ الميلاد" : "Birthday"} type="date" value={draft.birthDate} onChange={(v) => set({ birthDate: v })} />
            <SelectField label={isAr ? "الفصيلة" : "Breed"} value={draft.breedId} onChange={(v) => set({ breedId: v })}
              options={[{ value: "", label: isAr ? "غير محدد" : "Not sure" }, ...breeds.map((b) => ({ value: b.id, label: isAr ? b.nameAr : b.nameEn }))]} />
            <Field label={isAr ? "لون الفراء" : "Coat colour"} value={draft.coatColor} onChange={(v) => set({ coatColor: v })} placeholder={isAr ? "مثلاً: مشمشي" : "e.g. Ginger"} />
            <Field label={isAr ? "الوزن (كجم)" : "Weight (kg)"} type="number" value={draft.weightKg} onChange={(v) => set({ weightKg: v })} placeholder="4.5" />
          </div>
          <QuestionList questions={ABOUT_Q} answers={draft.about} onChange={setAns("about")} isAr={isAr} />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label={isAr ? "البيئة" : "Indoor / Outdoor"} value={draft.isIndoor || ""} onChange={(v) => set({ isIndoor: v as Draft["isIndoor"] })}
              options={[{ value: "", label: isAr ? "غير محدد" : "Not sure" }, { value: "true", label: isAr ? "داخلي" : "Indoor" }, { value: "false", label: isAr ? "خارجي" : "Outdoor" }]} />
            <SelectField label={isAr ? "معقّم/محيّد؟" : "Neutered / spayed?"} value={draft.isNeutered} onChange={(v) => set({ isNeutered: v as Draft["isNeutered"] })}
              options={[{ value: "true", label: isAr ? "نعم" : "Yes" }, { value: "false", label: isAr ? "لا" : "No" }, { value: "unknown", label: isAr ? "غير متأكد" : "Not sure" }]} />
          </div>
        </ChapterCard>
      );

    case STEP.personalize:
      return (
        <ChapterCard emoji="🎨" title={isAr ? `صمّم بطاقة ${dispName}` : `Design ${dispName}'s card`} intro={isAr ? "خلّها تشبهه — التغييرات تنطبق على الهوية على طول." : "Make it theirs — changes apply to the live ID instantly."}>
          <ThemePicker value={draft.personalization.theme ?? "classic"} onChange={(theme) => setDraft((s) => ({ ...s, personalization: { ...s.personalization, theme } }))} isAr={isAr} />
          <AccentPicker value={draft.personalization.accent ?? "signature"} onChange={(accent) => setDraft((s) => ({ ...s, personalization: { ...s.personalization, accent } }))} isAr={isAr} />
          <FramePicker value={draft.personalization.frame ?? "none"} onChange={(frame) => setDraft((s) => ({ ...s, personalization: { ...s.personalization, frame } }))} isAr={isAr} />
          <StickerEditor
            cat={cat} draft={draft} isAr={isAr}
            onChange={(stickers) => setDraft((s) => ({ ...s, personalization: { ...s.personalization, stickers } }))}
          />
        </ChapterCard>
      );

    case STEP.celebrate:
      return (
        <ChapterCard emoji="🏅" title={isAr ? `${dispName} جاهز` : `${dispName} is ready`} intro={isAr ? "راجع كل شي — واحتفل. تقدر ترجع تعدّل أي وقت." : "Take a last look — then celebrate. You can edit any time."}>
          <ReviewSummary draft={draft} isAr={isAr} />
        </ChapterCard>
      );

    default:
      return null;
  }
}

function ChapterCard({ emoji, title, intro, children }: { emoji: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <Card className="p-6 sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <span aria-hidden className="grid size-11 shrink-0 place-items-center rounded-2xl bg-accent/10 text-2xl">{emoji}</span>
        <div>
          <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">{intro}</p>
        </div>
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </Card>
  );
}

/* ══ Question widgets ════════════════════════════════════════════════════════ */

function QuestionList({ questions, answers, onChange, isAr }: {
  questions: Question[]; answers: AnswerMap; onChange: (id: string, v: string | string[] | undefined) => void; isAr: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {questions.map((q) => (
        <QuestionField key={q.id} q={q} value={answers[q.id]} onChange={(v) => onChange(q.id, v)} isAr={isAr} />
      ))}
    </div>
  );
}

function QuestionField({ q, value, onChange, isAr }: { q: Question; value?: string | string[]; onChange: (v: string | string[] | undefined) => void; isAr: boolean }) {
  const label = (
    <span className="flex items-center gap-2 text-sm font-medium">
      <span aria-hidden>{q.emoji}</span> {isAr ? q.ar : q.en}
    </span>
  );

  if (q.kind === "text") {
    return (
      <div className="flex flex-col gap-1.5">
        {label}
        <input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value.slice(0, 160) || undefined)}
          placeholder={isAr ? q.placeholderAr : q.placeholderEn}
          className="h-11 rounded-xl border border-input bg-background px-3 text-sm shadow-e1 outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
      </div>
    );
  }

  if (q.kind === "emoji") {
    const selected = typeof value === "string" ? value : "";
    return (
      <div className="flex flex-col gap-2">
        {label}
        <div className="flex flex-wrap gap-1.5">
          {EMOJI_CHOICES.map((g) => (
            <button
              key={g} type="button" onClick={() => onChange(selected === g ? undefined : g)}
              aria-pressed={selected === g}
              className={cn("grid size-10 place-items-center rounded-xl text-xl transition-all", selected === g ? "bg-accent/15 ring-2 ring-accent" : "bg-muted hover:bg-accent/10")}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // choice / multi
  const isMulti = q.kind === "multi";
  const arr = Array.isArray(value) ? value : value ? [value] : [];
  const toggle = (v: string) => {
    if (isMulti) {
      const next = arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
      onChange(next.length ? next : undefined);
    } else {
      onChange(arr[0] === v ? undefined : v);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      {label}
      <div className="flex flex-wrap gap-2">
        {q.options?.map((o) => {
          const on = arr.includes(o.value);
          return (
            <button
              key={o.value} type="button" onClick={() => toggle(o.value)} aria-pressed={on}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-all min-h-[44px]",
                on ? "border-primary bg-primary/10 text-foreground shadow-e1" : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
              )}
            >
              {o.emoji && <span aria-hidden>{o.emoji}</span>}
              {isAr ? o.ar : o.en}
              {on && <Check className="size-3.5 text-primary" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ══ Personalisation pickers ═════════════════════════════════════════════════ */

function PickerLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-sm font-medium">{children}</p>;
}

function ThemePicker({ value, onChange, isAr }: { value: string; onChange: (id: string) => void; isAr: boolean }) {
  return (
    <div>
      <PickerLabel>{isAr ? "خلفية البطاقة" : "Card theme"}</PickerLabel>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CARD_THEMES.map((t) => (
          <button
            key={t.id} type="button" onClick={() => onChange(t.id)} aria-pressed={value === t.id}
            className={cn("group flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition-all", value === t.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40")}
          >
            <span className="h-10 w-full rounded-lg" style={{ backgroundImage: `linear-gradient(135deg, ${t.swatch[0]}, ${t.swatch[1]})` }} />
            <span className="text-xs font-medium">{isAr ? t.ar : t.en}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AccentPicker({ value, onChange, isAr }: { value: string; onChange: (id: string) => void; isAr: boolean }) {
  return (
    <div>
      <PickerLabel>{isAr ? "لون التوقيع" : "Accent"}</PickerLabel>
      <div className="flex flex-wrap gap-2">
        {ACCENTS.map((a) => (
          <button
            key={a.id} type="button" onClick={() => onChange(a.id)} aria-pressed={value === a.id}
            aria-label={isAr ? a.ar : a.en}
            className={cn("grid size-10 place-items-center rounded-full transition-all", value === a.id ? "ring-2 ring-offset-2 ring-offset-background" : "hover:scale-105")}
            style={{ boxShadow: value === a.id ? `0 0 0 2px hsl(${a.hsl})` : undefined }}
          >
            <span className="size-7 rounded-full" style={{ backgroundColor: `hsl(${a.hsl})` }} />
          </button>
        ))}
      </div>
    </div>
  );
}

function FramePicker({ value, onChange, isAr }: { value: string; onChange: (id: string) => void; isAr: boolean }) {
  return (
    <div>
      <PickerLabel>{isAr ? "الإطار" : "Frame"}</PickerLabel>
      <div className="flex flex-wrap gap-2">
        {FRAMES.map((f) => (
          <button
            key={f.id} type="button" onClick={() => onChange(f.id)} aria-pressed={value === f.id}
            className={cn("rounded-full border px-3 py-2 text-sm font-medium transition-all min-h-[44px]", value === f.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground")}
          >
            {isAr ? f.ar : f.en}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Sticker editor — tap to add, drag to place, tune the selected one ──────── */

function StickerEditor({ cat, draft, isAr, onChange }: {
  cat: CatDetail; draft: Draft; isAr: boolean; onChange: (s: StickerPlacement[]) => void;
}) {
  const stickers = draft.personalization.stickers ?? [];
  const [selected, setSelected] = React.useState<number | null>(null);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef<number | null>(null);

  const add = (id: string) => {
    if (stickers.length >= 14) return;
    const next = [...stickers, { id, x: 0.5, y: 0.4, scale: 1, rotate: 0 }];
    onChange(next);
    setSelected(next.length - 1);
  };
  const update = (i: number, patch: Partial<StickerPlacement>) => {
    onChange(stickers.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const remove = (i: number) => {
    onChange(stickers.filter((_, idx) => idx !== i));
    setSelected(null);
  };

  const pointFromEvent = (e: React.PointerEvent | PointerEvent) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  React.useEffect(() => {
    const move = (e: PointerEvent) => {
      if (dragging.current == null) return;
      const p = pointFromEvent(e);
      if (p) update(dragging.current, p);
    };
    const up = () => { dragging.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickers]);

  const sel = selected != null ? stickers[selected] : null;

  return (
    <div>
      <PickerLabel>{isAr ? "الملصقات — انقر لإضافتها، واسحبها على البطاقة" : "Stickers — tap to add, drag to place"}</PickerLabel>

      {/* The interactive card canvas */}
      <div ref={cardRef} className="relative mx-auto w-full max-w-xs touch-none select-none">
        <CatIdCard
          catName={cat.name}
          catIdNumber={cat.catIdNumber ?? "MRC-····-····"}
          photoUrl={draft.photoUrl || cat.photoUrl || null}
          issuedAt={cat.idIssuedAt}
          isAr={isAr}
          hideStatus
          themeField={themeById(draft.personalization.theme).field}
          accentHsl={accentById(draft.personalization.accent).hsl}
          frame={draft.personalization.frame}
          stickers={[]}
        />
        {/* Interactive sticker layer (mirrors the card's static layer, but movable) */}
        <div className="pointer-events-none absolute inset-0">
          {stickers.map((s, i) => {
            const glyph = STICKERS.find((d) => d.id === s.id)?.glyph ?? "⭐";
            const on = selected === i;
            return (
              <button
                key={i}
                type="button"
                onPointerDown={(e) => { e.preventDefault(); (e.target as HTMLElement).setPointerCapture?.(e.pointerId); dragging.current = i; setSelected(i); }}
                aria-label={isAr ? "ملصق" : "sticker"}
                className={cn("pointer-events-auto absolute cursor-grab active:cursor-grabbing rounded-lg", on && "ring-2 ring-accent ring-offset-1")}
                style={{
                  left: `${s.x * 100}%`, top: `${s.y * 100}%`, fontSize: `${28 * s.scale}px`,
                  transform: `translate(-50%,-50%) rotate(${s.rotate}deg) scaleX(${s.flip ? -1 : 1})`, lineHeight: 1,
                }}
              >
                {glyph}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticker tray */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {STICKERS.map((d) => (
          <button
            key={d.id} type="button" onClick={() => add(d.id)} aria-label={isAr ? d.ar : d.en}
            disabled={stickers.length >= 14}
            className="grid size-10 place-items-center rounded-xl bg-muted text-xl transition-colors hover:bg-accent/10 disabled:opacity-40"
          >
            {d.glyph}
          </button>
        ))}
      </div>

      {/* Controls for the selected sticker */}
      {sel && selected != null && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/40 p-2">
          <span className="ms-1 text-xs text-muted-foreground">{isAr ? "الملصق المحدّد:" : "Selected:"}</span>
          <IconBtn label={isAr ? "أصغر" : "Smaller"} onClick={() => update(selected, { scale: Math.max(0.4, sel.scale - 0.15) })}><Minus className="size-4" /></IconBtn>
          <IconBtn label={isAr ? "أكبر" : "Bigger"} onClick={() => update(selected, { scale: Math.min(2.6, sel.scale + 0.15) })}><Plus className="size-4" /></IconBtn>
          <IconBtn label={isAr ? "تدوير" : "Rotate"} onClick={() => update(selected, { rotate: (sel.rotate + 15) % 360 })}><RotateCcw className="size-4" /></IconBtn>
          <IconBtn label={isAr ? "قلب" : "Flip"} onClick={() => update(selected, { flip: !sel.flip })}><FlipHorizontal2 className="size-4" /></IconBtn>
          <IconBtn label={isAr ? "حذف" : "Remove"} onClick={() => remove(selected)} danger><Trash2 className="size-4" /></IconBtn>
        </div>
      )}
    </div>
  );
}

function IconBtn({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label} title={label}
      className={cn("grid size-9 place-items-center rounded-lg border border-border bg-background transition-colors hover:bg-muted", danger && "text-destructive hover:bg-destructive/10")}
    >
      {children}
    </button>
  );
}

/* ══ Recognition rail (completeness + badges) ════════════════════════════════ */

function RecognitionRail({ completeness, badges, isAr, dispName }: {
  completeness: ReturnType<typeof profileCompleteness>; badges: ReturnType<typeof earnedBadges>; isAr: boolean; dispName: string;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <CompletenessRing percent={completeness.percent} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{isAr ? "اكتمال الملف" : "Profile completeness"}</p>
          <p className="text-xs text-muted-foreground">
            {completeness.percent >= 90
              ? (isAr ? `ملف ${dispName} شبه مكتمل 🌟` : `${dispName}'s profile is nearly complete 🌟`)
              : (isAr ? "كل إجابة تكمل الصورة" : "Each answer fills in the picture")}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-muted-foreground">{isAr ? `أوسمة ${dispName}` : `${dispName}'s badges`}</p>
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span key={b.id} title={isAr ? b.whyAr : b.whyEn}
              className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium">
              <span aria-hidden>{b.emoji}</span> {isAr ? b.ar : b.en}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function CompletenessRing({ percent }: { percent: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const off = circ - (percent / 100) * circ;
  return (
    <div className="relative grid size-14 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="size-14 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4" />
        <circle cx="24" cy="24" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={off} className="transition-[stroke-dashoffset] duration-500" />
      </svg>
      <span className="absolute text-xs font-bold tabular-nums">{percent}%</span>
    </div>
  );
}

/* ══ Review summary ══════════════════════════════════════════════════════════ */

function ReviewSummary({ draft, isAr }: { draft: Draft; isAr: boolean }) {
  const chips: string[] = [];
  const push = (v?: string | string[] | null) => { if (Array.isArray(v)) v.forEach((x) => x && chips.push(x)); else if (v) chips.push(v); };
  push(draft.coatColor);
  Object.values(draft.about).forEach(push);
  Object.values(draft.personality).forEach((v) => push(v));
  Object.values(draft.favorites).forEach(push);
  push(draft.favoriteFood);
  Object.values(draft.fun).forEach(push);
  const shown = chips.slice(0, 14);
  return (
    <div className="rounded-2xl border border-dashed border-border p-4">
      {shown.length ? (
        <div className="flex flex-wrap gap-1.5">
          {shown.map((c, i) => (
            <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs">{c}</span>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{isAr ? "ما فيه تفاصيل بعد — وهذا تمام، تقدر تكمّل لاحقاً." : "No details yet — and that's fine, you can add them any time."}</p>
      )}
    </div>
  );
}

/* ══ The celebration — restrained, single, reduced-motion aware (R073/R080) ══ */

function Celebration({ cat, draft, badges, completeness, isAr, dispName, reduced, onClose }: {
  cat: CatDetail; draft: Draft; badges: ReturnType<typeof earnedBadges>; completeness: number;
  isAr: boolean; dispName: string; reduced: boolean; onClose: () => void;
}) {
  const ctaRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => ctaRef.current?.focus(), reduced ? 60 : 900);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", onKey); clearTimeout(t); };
  }, [onClose, reduced]);

  const resolved = resolvePersonalization(draft.personalization);
  const fade = (delay: number) =>
    reduced ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
      : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0, transition: { delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } } };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center overflow-y-auto p-6" role="dialog" aria-modal="true" aria-label={isAr ? `${dispName} صار جزء من العائلة` : `${dispName} joined the family`}>
      <div className="absolute inset-0 animate-fade-in bg-[hsl(168_50%_5%/0.92)] backdrop-blur-md" aria-hidden />

      {!reduced && <DriftLayer />}

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative flex w-full max-w-sm flex-col items-center py-8 text-center">
        <motion.p {...fade(0.35)} className="font-mono text-[10px] uppercase tracking-[0.28em] text-[hsl(18_93%_62%)]">
          {isAr ? "أهلاً في العائلة" : "Welcome to the family"}
        </motion.p>
        <motion.h2 {...fade(0.5)} className="mt-3 font-display text-3xl font-semibold tracking-tight text-white">
          {isAr ? `أهلاً ${dispName}! 🐾` : `Welcome, ${dispName}! 🐾`}
        </motion.h2>
        <motion.p {...fade(0.62)} className="mt-2 text-sm leading-relaxed text-white/70">
          {isAr ? "ملفه اكتمل، وهويته صارت تشبهه تماماً." : "Their profile is complete, and their ID is truly theirs now."}
        </motion.p>

        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.88, y: 20, rotateX: 14 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, rotateX: 0 }}
          transition={reduced ? undefined : { type: "spring", stiffness: 170, damping: 19, delay: 0.2 }}
          style={{ transformPerspective: 900 }}
          className="mt-7 w-full"
        >
          <CatIdCard
            catName={cat.name}
            catIdNumber={cat.catIdNumber!}
            photoUrl={draft.photoUrl || cat.photoUrl || null}
            issuedAt={cat.idIssuedAt}
            isAr={isAr}
            hideStatus
            className="mx-auto shadow-glow"
            themeField={themeById(draft.personalization.theme).field}
            accentHsl={accentById(draft.personalization.accent).hsl}
            frame={draft.personalization.frame}
            stickers={resolved.stickers}
          />
        </motion.div>

        <motion.div {...fade(0.9)} className="mt-6 w-full">
          <p className="mb-2 text-xs uppercase tracking-wider text-white/50">
            {isAr ? `${badges.length} أوسمة · اكتمال ${completeness}%` : `${badges.length} badges · ${completeness}% complete`}
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {badges.map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90">
                <span aria-hidden>{b.emoji}</span> {isAr ? b.ar : b.en}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div {...fade(1.05)} className="mt-8 w-full">
          <Button ref={ctaRef} size="lg" className="w-full" onClick={onClose}>
            <Wand2 className="size-4" /> {isAr ? `يلا نكمل مع ${dispName}` : `Continue with ${dispName}`}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}

/** A single, gentle drift of paws & hearts — not a confetti cannon (R080). */
function DriftLayer() {
  const bits = React.useMemo(() => Array.from({ length: 14 }, (_, i) => ({
    i, left: (i * 37) % 100, delay: (i % 7) * 0.18, dur: 2.6 + (i % 5) * 0.4, kind: i % 3,
  })), []);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b) => (
        <motion.span
          key={b.i}
          className="absolute text-lg"
          style={{ left: `${b.left}%`, bottom: "-8%" }}
          initial={{ y: 0, opacity: 0 }}
          animate={{ y: "-120vh", opacity: [0, 0.9, 0.9, 0] }}
          transition={{ delay: b.delay, duration: b.dur, ease: "easeOut" }}
        >
          {b.kind === 0 ? "🐾" : b.kind === 1 ? "💛" : "✨"}
        </motion.span>
      ))}
    </div>
  );
}
