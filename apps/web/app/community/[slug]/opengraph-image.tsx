import { ImageResponse } from "next/og";

/**
 * The branded share card for a public cat profile — the growth lever. When a
 * member shares their cat's link, the preview is a membership credential (photo
 * in a sticker frame + name + Cat ID number + tenure), never a bare photo:
 * pride, gently shareable (R031/R032; the cat is the hero, R: principle 9).
 *
 * Fonts: ImageResponse's built-in fallback covers Latin and dynamically
 * resolves Arabic glyphs — no external font files are fetched by this route.
 */
export const runtime = "edge";
export const alt = "Moracat member card · بطاقة عضوية مرقط";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

// Warm-paper ground + deep green + ink, matching the site-wide OG card and the
// "warm paper, flat stickers" art direction.
const PAPER = "linear-gradient(135deg, #faf7f1 0%, #f3ede1 100%)";
const GREEN = "#1f6b4f";
const INK = "#12201a";
const MUTED = "#4b5a52";

interface OgCat {
  name: string;
  photoUrl: string | null;
  catIdNumber: string | null;
  issuedAt: string | null;
}

async function fetchCat(slug: string): Promise<OgCat | null> {
  try {
    const res = await fetch(`${BASE}/api/community/cats/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return (await res.json()) as OgCat;
  } catch {
    return null;
  }
}

/** Arabic-first tenure line; Gregorian month names in both scripts. */
function memberSince(issuedAt: string | null): { ar: string; en: string } | null {
  if (!issuedAt) return null;
  const d = new Date(issuedAt);
  if (Number.isNaN(d.getTime())) return null;
  return {
    ar: `عضو منذ ${new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" }).format(d)}`,
    en: `Member since ${new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(d)}`,
  };
}

export default async function OpengraphImage({ params }: { params: { slug: string } }) {
  const cat = await fetchCat(params.slug);
  const name = cat?.name ?? "Moracat";
  const since = memberSince(cat?.issuedAt ?? null);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: PAPER,
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        {/* The cat — always the hero, framed like a sticker on warm paper. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 420,
            height: 420,
            transform: "rotate(-3deg)",
            borderRadius: 44,
            background: "#ffffff",
            padding: 14,
            boxShadow: "0 18px 40px rgba(18, 32, 26, 0.16)",
            flexShrink: 0,
          }}
        >
          {cat?.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cat.photoUrl}
              alt=""
              width={392}
              height={392}
              style={{ width: 392, height: 392, objectFit: "cover", borderRadius: 32 }}
            />
          ) : (
            // Photo-less fallback: a calm branded field with a paw glyph.
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 392,
                height: 392,
                borderRadius: 32,
                background: GREEN,
                fontSize: 160,
              }}
            >
              🐾
            </div>
          )}
        </div>

        {/* The credential */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginLeft: 72,
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              color: INK,
              lineHeight: 1.1,
              maxWidth: 560,
              display: "block",
              // Long names must never break the card — clamp, don't wrap forever.
              overflow: "hidden",
            }}
          >
            {name}
          </div>

          {cat?.catIdNumber && (
            <div
              style={{
                display: "flex",
                marginTop: 26,
                fontFamily: "monospace",
                fontSize: 34,
                letterSpacing: 4,
                color: GREEN,
                fontWeight: 700,
              }}
            >
              {cat.catIdNumber}
            </div>
          )}

          {since && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 18 }}>
              <div style={{ display: "flex", fontSize: 30, color: INK }}>{since.ar}</div>
              <div style={{ display: "flex", fontSize: 24, color: MUTED, marginTop: 6 }}>{since.en}</div>
            </div>
          )}

          {/* Wordmark — quiet, deep green, never louder than the cat. */}
          <div style={{ display: "flex", alignItems: "center", marginTop: 44 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 44,
                height: 44,
                borderRadius: 14,
                background: GREEN,
                fontSize: 26,
                marginRight: 14,
              }}
            >
              🐱
            </div>
            <div style={{ display: "flex", fontSize: 32, fontWeight: 700, color: GREEN }}>
              Moracat · مرقط
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
