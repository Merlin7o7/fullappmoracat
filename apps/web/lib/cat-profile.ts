/**
 * The cat's *character & keepsake* layer — the data model behind the redesigned
 * "welcome a family member" journey.
 *
 * Design Authority reconciliation (read before editing):
 *  • The fast Cat-ID *issue* stays sacred: name → contact → ceremony, ≤6 inputs
 *    (R016, north star). NOTHING here is asked before the ID is issued.
 *  • Everything below is the *postponed, invited* follow-up (R002/R017) — offered
 *    later, framed as a benefit to the cat, every field optional.
 *  • "Gamification" is expressed as *recognition*, not a points economy: badges
 *    are identity & pride (R009, emotion #3), completeness is a gentle nudge —
 *    never currency, never a leaderboard (§04: "recognition and tenure, not
 *    gamification").
 *
 * Pure data + pure functions only — no JSX, no state. Shared by the journey
 * (authoring) and the Cat ID card (rendering the personalisation).
 */

/* ══ Types ═══════════════════════════════════════════════════════════════════ */

export interface StickerPlacement {
  id: string; // StickerDef id
  x: number; // 0..1 (fraction of card width, LTR origin)
  y: number; // 0..1 (fraction of card height)
  scale: number; // 0.3..3
  rotate: number; // -180..180 deg
  flip?: boolean;
}

export interface Personalization {
  theme?: string; // CardTheme id
  accent?: string; // AccentOption id
  frame?: string; // FrameOption id
  stickers?: StickerPlacement[];
}

/** Free-form answers: single value, or a set for multi-select questions. */
export type AnswerMap = Record<string, string | string[]>;

export interface CatProfile {
  about?: AnswerMap; // columnless identity extras (nickname, coat pattern, eye colour)
  personality?: AnswerMap;
  favorites?: AnswerMap;
  fun?: AnswerMap;
  personalization?: Personalization;
}

/** The subset of a cat we read to derive completeness & badges. */
export interface CatForDerivation {
  name: string;
  photoUrl?: string | null;
  birthDate?: string | null;
  breed?: { nameEn: string; nameAr: string } | null;
  breedId?: string | null;
  weightKg?: number | null;
  coatColor?: string | null;
  isIndoor?: boolean | null;
  isNeutered?: boolean | null;
  microchipNo?: string | null;
  vaccinationStatus?: string | null;
  favoriteFoods?: string[] | null;
  allergyNames?: string[] | null;
  healthConditionNames?: string[] | null;
  profile?: CatProfile | null;
}

/* ══ Question catalogs ═══════════════════════════════════════════════════════ */

export type QKind = "choice" | "multi" | "text" | "emoji";

export interface QOption {
  value: string;
  en: string;
  ar: string;
  emoji?: string;
}

export interface Question {
  id: string;
  kind: QKind;
  en: string;
  ar: string;
  emoji: string;
  options?: QOption[];
  suggestions?: QOption[]; // quick-fill chips for text questions
  placeholderEn?: string;
  placeholderAr?: string;
}

const c = (value: string, en: string, ar: string, emoji?: string): QOption => ({ value, en, ar, emoji });

/** About extras that have no DB column — stored in profile.about. Coat colour,
 *  weight, breed, birthday etc. remain real columns handled by the journey. */
export const ABOUT_Q: Question[] = [
  { id: "nickname", kind: "text", emoji: "🏷️", en: "Nickname", ar: "الدلع", placeholderEn: "Mr. Fluff, Boss…", placeholderAr: "بسبوس، الباشا…" },
  {
    id: "coatPattern", kind: "choice", emoji: "🎨", en: "Coat pattern", ar: "نقشة الفراء",
    options: [c("solid", "Solid", "سادة"), c("tabby", "Tabby", "مخطّط"), c("tuxedo", "Tuxedo", "توكسيدو"), c("calico", "Calico", "كاليكو"), c("tortie", "Tortoiseshell", "سلحفاتي"), c("pointed", "Pointed", "منقّط الأطراف"), c("bicolor", "Bicolour", "لونين")],
  },
  {
    id: "eyeColor", kind: "choice", emoji: "👁️", en: "Eye colour", ar: "لون العيون",
    options: [c("green", "Green", "أخضر", "💚"), c("gold", "Gold", "ذهبي", "💛"), c("blue", "Blue", "أزرق", "💙"), c("copper", "Copper", "نحاسي", "🟠"), c("odd", "Odd-eyed", "عينان مختلفتان", "✨")],
  },
];

/** Personality — social & behavioural character (energy lives in "About"). */
export const PERSONALITY_Q: Question[] = [
  {
    id: "friendliness", kind: "choice", emoji: "🥰", en: "Around new people they're…", ar: "مع الوجوه الجديدة…",
    options: [c("shy", "Shy", "خجول", "🫣"), c("warms-up", "Warms up", "يتعوّد", "🙂"), c("social", "A social butterfly", "اجتماعي", "🦋")],
  },
  {
    id: "lap", kind: "choice", emoji: "💺", en: "Lap cat?", ar: "قط حِضن؟",
    options: [c("always", "Always", "دائماً", "🫶"), c("sometimes", "Sometimes", "أحياناً", "🤏"), c("never", "Prefers space", "يفضّل مساحته", "🚫")],
  },
  {
    id: "talkative", kind: "choice", emoji: "💬", en: "How talkative?", ar: "كثير الكلام؟",
    options: [c("quiet", "Quiet type", "هادئ", "🤐"), c("chatty", "Chatty", "ثرثار", "💬"), c("opera", "Full opera", "أوبرا كاملة", "🎤")],
  },
  {
    id: "curiosity", kind: "choice", emoji: "🔎", en: "Curiosity level", ar: "الفضول",
    options: [c("cautious", "Cautious", "حذِر", "🧐"), c("curious", "Curious", "فضولي", "👀"), c("explorer", "Born explorer", "مستكشف", "🧭")],
  },
  {
    id: "bravery", kind: "choice", emoji: "🦁", en: "Brave or cautious?", ar: "شجاع أم حذِر؟",
    options: [c("timid", "Timid", "خجول", "🙈"), c("balanced", "Balanced", "متوازن", "⚖️"), c("fearless", "Fearless", "لا يخاف", "🦁")],
  },
  {
    id: "independence", kind: "choice", emoji: "🧷", en: "Independent or velcro?", ar: "مستقل أم ملتصق؟",
    options: [c("velcro", "My shadow", "ظلّي", "🫂"), c("balanced", "In between", "بينهما", "🔗"), c("independent", "Independent", "مستقل", "🐾")],
  },
  {
    id: "cuddles", kind: "choice", emoji: "🤗", en: "Loves cuddles?", ar: "يحب الحضن؟",
    options: [c("loves", "Loves them", "يعشقه", "❤️"), c("depends", "On their terms", "على مزاجه", "😌"), c("not-really", "Not really", "مو كثير", "🙅")],
  },
  {
    id: "hunter", kind: "choice", emoji: "🐁", en: "Hunting instinct", ar: "غريزة الصيد",
    options: [c("napper", "Pure napper", "نوّام", "😴"), c("watcher", "Window watcher", "مراقب النافذة", "🪟"), c("hunter", "Mighty hunter", "صيّاد ماهر", "🎯")],
  },
  {
    id: "sleep", kind: "choice", emoji: "😴", en: "Sleeping habits", ar: "عادات النوم",
    options: [c("light", "Light sleeper", "نوم خفيف", "🌙"), c("normal", "Normal", "عادي", "💤"), c("champion", "Sleep champion", "بطل النوم", "🏆")],
  },
];

/** Favourites — the little details that make them them. */
export const FAVORITES_Q: Question[] = [
  { id: "treat", kind: "text", emoji: "🍤", en: "Favourite treat", ar: "المكافأة المفضّلة", placeholderEn: "Churu, dried fish…", placeholderAr: "تشورو، سمك مجفف…" },
  { id: "toy", kind: "text", emoji: "🧶", en: "Favourite toy", ar: "اللعبة المفضّلة", placeholderEn: "The red dot, a crinkle ball…", placeholderAr: "النقطة الحمراء، كرة…" },
  { id: "spot", kind: "text", emoji: "🛏️", en: "Favourite sleeping spot", ar: "مكان النوم المفضّل", placeholderEn: "The windowsill, your pillow…", placeholderAr: "حافة النافذة، مخدّتك…" },
  { id: "human", kind: "text", emoji: "🫶", en: "Favourite human", ar: "الإنسان المفضّل", placeholderEn: "Be honest 😄", placeholderAr: "بصراحة 😄" },
  {
    id: "activity", kind: "multi", emoji: "🎈", en: "Favourite things to do", ar: "الأنشطة المفضّلة",
    options: [c("nap", "Napping", "القيلولة", "😴"), c("hunt", "Hunting", "الصيد", "🎯"), c("play", "Play", "اللعب", "🧶"), c("window", "Window-watching", "مراقبة النافذة", "🪟"), c("cuddle", "Cuddling", "الحضن", "🤗"), c("box", "Sitting in boxes", "الجلوس بالصناديق", "📦"), c("climb", "Climbing", "التسلّق", "🧗"), c("snack", "Snacking", "التسنيك", "🍤")],
  },
];

/** Fun — the smile moments. Playful by design (R071 acknowledge, R080 restraint). */
export const FUN_Q: Question[] = [
  { id: "fear", kind: "text", emoji: "🙀", en: "Biggest fear", ar: "أكبر مخاوفه", placeholderEn: "The vacuum, cucumbers…", placeholderAr: "المكنسة، الخيار…" },
  { id: "habit", kind: "text", emoji: "😹", en: "Funniest habit", ar: "أطرف عادة", placeholderEn: "Knocks pens off tables…", placeholderAr: "يرمي الأقلام…" },
  { id: "talent", kind: "text", emoji: "🎩", en: "Secret talent", ar: "موهبة سرية", placeholderEn: "Opens doors…", placeholderAr: "يفتح الأبواب…" },
  {
    id: "job", kind: "choice", emoji: "💼", en: "Their dream job", ar: "وظيفة أحلامه",
    options: [c("detective", "Detective", "محقّق", "🕵️"), c("chef", "Food critic", "ناقد طعام", "🍽️"), c("security", "Head of security", "رئيس الأمن", "🛡️"), c("nap-ceo", "Chief Napping Officer", "مدير القيلولة", "😴"), c("influencer", "Influencer", "مؤثّر", "📸"), c("hunter", "Pro hunter", "صيّاد محترف", "🎯")],
  },
  {
    id: "superpower", kind: "choice", emoji: "🦸", en: "If they had a superpower", ar: "لو عنده قوة خارقة",
    options: [c("invisible", "Invisibility", "الاختفاء", "👻"), c("teleport", "Teleport", "الانتقال الآني", "✨"), c("mind", "Mind reading", "قراءة الأفكار", "🔮"), c("nap", "Infinite naps", "نوم لا نهائي", "😴"), c("silent", "Silent walking", "مشي صامت", "🥷")],
  },
  { id: "emoji", kind: "emoji", emoji: "💫", en: "Their emoji", ar: "الإيموجي اللي يمثّله", placeholderEn: "Pick one", placeholderAr: "اختر واحد" },
  { id: "song", kind: "text", emoji: "🎵", en: "Their theme song", ar: "أغنيته", placeholderEn: "Plays when they enter a room", placeholderAr: "تشتغل لما يدخل الغرفة" },
  { id: "mood", kind: "text", emoji: "💭", en: "Their vibe in one word", ar: "مزاجه بكلمة", placeholderEn: "Regal. Chaos. Sleepy.", placeholderAr: "ملكي. فوضى. نعسان." },
];

/** Options for the emoji "their emoji" question — a curated cat-mood set. */
export const EMOJI_CHOICES = ["😺", "😻", "😼", "😽", "🙀", "😾", "😿", "🐈", "🐈‍⬛", "🐾", "👑", "😴", "🤨", "😎", "🥺", "💅", "🔥", "✨", "💛", "🌙"];

/* ══ Personalization catalogs ═══════════════════════════════════════════════ */

export interface CardTheme {
  id: string;
  en: string;
  ar: string;
  /** CSS background-image applied to the card's green field. Kept dark enough
   *  that the white display text always clears 4.5:1 (R091). */
  field: string;
  /** Two-stop swatch for the picker chip. */
  swatch: [string, string];
}

/** The default is the brand's own deep-green civic field — never removed. */
export const CARD_THEMES: CardTheme[] = [
  { id: "classic", en: "Classic", ar: "كلاسيكي", field: "radial-gradient(130% 130% at 0% 0%,hsl(168 72% 19%),hsl(169 82% 11%) 52%,hsl(174 82% 6%))", swatch: ["hsl(168 72% 19%)", "hsl(174 82% 6%)"] },
  { id: "royal", en: "Royal", ar: "ملكي", field: "radial-gradient(130% 130% at 0% 0%,hsl(255 45% 32%),hsl(258 55% 18%) 52%,hsl(260 62% 9%))", swatch: ["hsl(255 45% 34%)", "hsl(260 62% 9%)"] },
  { id: "midnight", en: "Midnight", ar: "منتصف الليل", field: "radial-gradient(130% 130% at 0% 0%,hsl(205 42% 20%),hsl(208 55% 11%) 52%,hsl(212 65% 5%))", swatch: ["hsl(205 42% 22%)", "hsl(212 65% 5%)"] },
  { id: "sakura", en: "Sakura", ar: "ساكورا", field: "radial-gradient(130% 130% at 0% 0%,hsl(330 40% 34%),hsl(335 48% 21%) 52%,hsl(340 56% 12%))", swatch: ["hsl(330 42% 36%)", "hsl(340 56% 12%)"] },
  { id: "desert", en: "Desert", ar: "صحراء", field: "radial-gradient(130% 130% at 0% 0%,hsl(26 46% 30%),hsl(20 52% 18%) 52%,hsl(16 58% 9%))", swatch: ["hsl(26 46% 32%)", "hsl(16 58% 9%)"] },
  { id: "galaxy", en: "Galaxy", ar: "المجرّة", field: "radial-gradient(125% 125% at 18% 0%,hsl(245 55% 28%),hsl(272 50% 16%) 50%,hsl(250 64% 6%))", swatch: ["hsl(245 58% 32%)", "hsl(250 64% 6%)"] },
  { id: "forest", en: "Forest", ar: "الغابة", field: "radial-gradient(130% 130% at 0% 0%,hsl(140 40% 24%),hsl(150 50% 13%) 52%,hsl(158 62% 7%))", swatch: ["hsl(140 40% 26%)", "hsl(158 62% 7%)"] },
  { id: "gold", en: "Gold", ar: "ذهبي", field: "radial-gradient(130% 130% at 0% 0%,hsl(44 40% 30%),hsl(40 48% 17%) 52%,hsl(38 58% 8%))", swatch: ["hsl(44 44% 34%)", "hsl(38 58% 8%)"] },
];

export interface AccentOption {
  id: string;
  en: string;
  ar: string;
  hsl: string; // "H S% L%" — used raw inside hsl()
}

/** A curated accent set (restraint — not a raw colour wheel). Recolours the
 *  eyebrow, the hairline under the name, and the default sticker tint. */
export const ACCENTS: AccentOption[] = [
  { id: "signature", en: "Signature", ar: "التوقيع", hsl: "18 93% 62%" },
  { id: "blush", en: "Blush", ar: "وردي", hsl: "352 90% 74%" },
  { id: "sky", en: "Sky", ar: "سماوي", hsl: "202 85% 66%" },
  { id: "violet", en: "Violet", ar: "بنفسجي", hsl: "266 72% 74%" },
  { id: "gold", en: "Gold", ar: "ذهبي", hsl: "43 82% 62%" },
  { id: "leaf", en: "Leaf", ar: "أخضر", hsl: "145 55% 58%" },
];

export interface FrameOption {
  id: string;
  en: string;
  ar: string;
}

export const FRAMES: FrameOption[] = [
  { id: "none", en: "None", ar: "بدون" },
  { id: "minimal", en: "Minimal", ar: "بسيط" },
  { id: "gold", en: "Gold", ar: "ذهبي" },
  { id: "neon", en: "Neon", ar: "نيون" },
  { id: "floral", en: "Floral", ar: "زهور" },
  { id: "birthday", en: "Birthday", ar: "عيد ميلاد" },
];

export interface StickerDef {
  id: string;
  glyph: string;
  en: string;
  ar: string;
}

/** The sticker sheet — emoji so it's instantly legible, RTL-neutral, and free. */
export const STICKERS: StickerDef[] = [
  { id: "fish", glyph: "🐟", en: "Fish", ar: "سمكة" },
  { id: "yarn", glyph: "🧶", en: "Yarn", ar: "خيط" },
  { id: "paw", glyph: "🐾", en: "Paws", ar: "آثار أقدام" },
  { id: "heart", glyph: "💛", en: "Heart", ar: "قلب" },
  { id: "crown", glyph: "👑", en: "Crown", ar: "تاج" },
  { id: "star", glyph: "⭐", en: "Star", ar: "نجمة" },
  { id: "sparkle", glyph: "✨", en: "Sparkle", ar: "بريق" },
  { id: "sunglasses", glyph: "😎", en: "Cool", ar: "نظارات" },
  { id: "chef", glyph: "🧑‍🍳", en: "Chef", ar: "طاهٍ" },
  { id: "gamer", glyph: "🎮", en: "Gamer", ar: "لاعب" },
  { id: "wizard", glyph: "🧙", en: "Wizard", ar: "ساحر" },
  { id: "pirate", glyph: "🏴‍☠️", en: "Pirate", ar: "قرصان" },
  { id: "flower", glyph: "🌸", en: "Flower", ar: "زهرة" },
  { id: "balloon", glyph: "🎈", en: "Balloon", ar: "بالون" },
  { id: "moon", glyph: "🌙", en: "Moon", ar: "قمر" },
  { id: "bow", glyph: "🎀", en: "Bow", ar: "فيونكة" },
];

/* ══ Resolution helpers (catalog id → renderable primitives) ═════════════════ */

export function themeById(id?: string): CardTheme {
  return CARD_THEMES.find((t) => t.id === id) ?? CARD_THEMES[0]!;
}
export function accentById(id?: string): AccentOption {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]!;
}
export function stickerById(id: string): StickerDef | undefined {
  return STICKERS.find((s) => s.id === id);
}

export interface ResolvedPersonalization {
  themeField: string;
  accentHsl: string;
  frame: string;
  stickers: (StickerPlacement & { glyph: string })[];
  isCustomised: boolean;
}

/** Turn a stored personalization blob into primitives the Cat ID card renders. */
export function resolvePersonalization(p?: Personalization | null): ResolvedPersonalization {
  const theme = themeById(p?.theme);
  const accent = accentById(p?.accent);
  const frame = p?.frame && FRAMES.some((f) => f.id === p.frame) ? p.frame : "none";
  const stickers = (p?.stickers ?? [])
    .map((s) => {
      const def = stickerById(s.id);
      return def ? { ...s, glyph: def.glyph } : null;
    })
    .filter(Boolean) as (StickerPlacement & { glyph: string })[];
  const isCustomised = Boolean(
    (p?.theme && p.theme !== "classic") || (p?.accent && p.accent !== "signature") || frame !== "none" || stickers.length
  );
  return { themeField: theme.field, accentHsl: accent.hsl, frame, stickers, isCustomised };
}

/* ══ Completeness ═══════════════════════════════════════════════════════════ */

interface CompletenessSlot {
  filled: boolean;
}

/** A gentle, weighted completeness read across every chapter. Recognition, not
 *  a demand — the copy around it never scolds (R084). */
export function profileCompleteness(cat: CatForDerivation): {
  percent: number;
  filled: number;
  total: number;
  sections: Record<string, { filled: number; total: number }>;
} {
  const p = cat.profile ?? {};
  const answered = (m: AnswerMap | undefined, ids: string[]) =>
    ids.filter((id) => {
      const v = m?.[id];
      return Array.isArray(v) ? v.length > 0 : Boolean(v);
    }).length;

  const about: CompletenessSlot[] = [
    { filled: Boolean(cat.photoUrl) },
    { filled: Boolean(cat.birthDate) },
    { filled: Boolean(cat.breedId || cat.breed) },
    { filled: Boolean(cat.coatColor) },
    { filled: cat.weightKg != null },
    { filled: cat.isNeutered != null },
    { filled: Boolean(cat.microchipNo) },
  ];
  const health: CompletenessSlot[] = [
    { filled: Boolean(cat.vaccinationStatus && cat.vaccinationStatus !== "UNKNOWN") },
    { filled: Boolean(cat.allergyNames?.length) },
    { filled: Boolean(cat.healthConditionNames?.length) },
  ];
  const favFood = Boolean(cat.favoriteFoods?.length);

  const sections = {
    about: {
      filled: about.filter((s) => s.filled).length + answered(p.about, ABOUT_Q.map((q) => q.id)),
      total: about.length + ABOUT_Q.length,
    },
    personality: { filled: answered(p.personality, PERSONALITY_Q.map((q) => q.id)), total: PERSONALITY_Q.length },
    favorites: { filled: answered(p.favorites, FAVORITES_Q.map((q) => q.id)) + (favFood ? 1 : 0), total: FAVORITES_Q.length + 1 },
    health: { filled: health.filter((s) => s.filled).length, total: health.length },
    fun: { filled: answered(p.fun, FUN_Q.map((q) => q.id)), total: FUN_Q.length },
    personalization: { filled: resolvePersonalization(p.personalization).isCustomised ? 1 : 0, total: 1 },
  };

  const filled = Object.values(sections).reduce((a, s) => a + s.filled, 0);
  const total = Object.values(sections).reduce((a, s) => a + s.total, 0);
  return { percent: total ? Math.round((filled / total) * 100) : 0, filled, total, sections };
}

/* ══ Badges — recognition, never currency ═══════════════════════════════════ */

export interface BadgeDef {
  id: string;
  emoji: string;
  en: string;
  ar: string;
  /** One-line reason the member earned it — warm, never braggy. */
  whyEn: string;
  whyAr: string;
  earned: (cat: CatForDerivation) => boolean;
}

function ageYears(birthDate?: string | null): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (Number.isNaN(+b)) return null;
  return (Date.now() - b.getTime()) / (365.25 * 24 * 3600 * 1000);
}
function ans(m: AnswerMap | undefined, id: string): string | string[] | undefined {
  return m?.[id];
}

export const BADGES: BadgeDef[] = [
  {
    id: "founding-member", emoji: "🪪", en: "Founding Member", ar: "عضو مؤسّس",
    whyEn: "Has an official Cat ID", whyAr: "يملك هوية رسمية",
    earned: () => true,
  },
  {
    id: "kitten", emoji: "🐣", en: "Kitten", ar: "هريرة",
    whyEn: "Under one year young", whyAr: "أقل من سنة",
    earned: (cat) => { const y = ageYears(cat.birthDate); return y != null && y < 1; },
  },
  {
    id: "senior", emoji: "🎗️", en: "Distinguished Senior", ar: "كبير محترم",
    whyEn: "Eight years and wiser", whyAr: "ثماني سنوات وأحكم",
    earned: (cat) => { const y = ageYears(cat.birthDate); return y != null && y >= 8; },
  },
  {
    id: "foodie", emoji: "🍤", en: "Foodie", ar: "ذوّاق",
    whyEn: "Has strong food opinions", whyAr: "له آراء في الأكل",
    earned: (cat) => Boolean(cat.favoriteFoods?.length) || Boolean(ans(cat.profile?.favorites, "treat")),
  },
  {
    id: "adventurer", emoji: "🧭", en: "Adventurer", ar: "مغامر",
    whyEn: "Explores the outdoors", whyAr: "يستكشف الخارج",
    earned: (cat) => cat.isIndoor === false || ans(cat.profile?.personality, "curiosity") === "explorer",
  },
  {
    id: "cuddler", emoji: "🤗", en: "Cuddle Champion", ar: "بطل الحضن",
    whyEn: "Lives for the cuddles", whyAr: "يعيش للحضن",
    earned: (cat) => ans(cat.profile?.personality, "cuddles") === "loves" || ans(cat.profile?.personality, "lap") === "always",
  },
  {
    id: "hunter", emoji: "🎯", en: "Mighty Hunter", ar: "صيّاد ماهر",
    whyEn: "A fearsome hunter", whyAr: "صيّاد لا يُشقّ له غبار",
    earned: (cat) => ans(cat.profile?.personality, "hunter") === "hunter",
  },
  {
    id: "sleep-champ", emoji: "😴", en: "Sleep Champion", ar: "بطل النوم",
    whyEn: "Napping is an art", whyAr: "النوم فنّ",
    earned: (cat) => ans(cat.profile?.personality, "sleep") === "champion",
  },
  {
    id: "protected", emoji: "🛡️", en: "Protected", ar: "محمي",
    whyEn: "Vaccinations up to date", whyAr: "تطعيماته محدّثة",
    earned: (cat) => cat.vaccinationStatus === "UP_TO_DATE",
  },
  {
    id: "chipped", emoji: "📡", en: "Chipped & Traceable", ar: "مُرقّم ومُتتبَّع",
    whyEn: "Microchipped for safety", whyAr: "مزوّد بشريحة للأمان",
    earned: (cat) => Boolean(cat.microchipNo),
  },
  {
    id: "storyteller", emoji: "📖", en: "Full of Character", ar: "شخصية كاملة",
    whyEn: "Shared three fun details", whyAr: "شارك ثلاث تفاصيل ممتعة",
    earned: (cat) => Object.values(cat.profile?.fun ?? {}).filter((v) => (Array.isArray(v) ? v.length : v)).length >= 3,
  },
  {
    id: "stylist", emoji: "🎨", en: "Card Stylist", ar: "مصمّم البطاقة",
    whyEn: "Personalised their Cat ID", whyAr: "خصّص هويته",
    earned: (cat) => resolvePersonalization(cat.profile?.personalization).isCustomised,
  },
  {
    id: "fully-known", emoji: "🌟", en: "Fully Known", ar: "معروف تماماً",
    whyEn: "A beautifully complete profile", whyAr: "ملف مكتمل بالكامل",
    earned: (cat) => profileCompleteness(cat).percent >= 90,
  },
];

export function earnedBadges(cat: CatForDerivation): BadgeDef[] {
  return BADGES.filter((b) => {
    try { return b.earned(cat); } catch { return false; }
  });
}
