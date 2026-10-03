import { ImageResponse } from "next/og";

/**
 * The link preview for a public cat page, on the designer's plate (delivery
 * 2026-10-03, 08-link-previews/og-cat-plate + its redline): emerald guilloché,
 * the Moracat · مرقط lockup already in the art, and three slots placed by code —
 *
 *   PHOTO   450,92  300 × 300   (rounded, inside the plate's paper frame)
 *   NAME    300,420 600 × 72
 *   SERIAL  400,516 400 × 34
 *
 * Everything key sits inside the central 630² square, so WhatsApp's square
 * crop keeps the photo and the name.
 *
 * The image renderer cannot shape Arabic (and throws on some ligatures), so a
 * name is drawn only when it is written in Latin letters; an Arabic name lives
 * in og:title, printed right beside this image. The serial always draws.
 */
export const runtime = "edge";
export const alt = "Moracat member card · بطاقة عضوية مرقط";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";
const PAPER = "#FBF8F4";
const MINT = "#C9E6D6";

interface OgCat {
  name: string;
  photoUrl: string | null;
  catIdNumber: string | null;
}

async function fetchCat(slug: string): Promise<OgCat | null> {
  try {
    const res = await fetch(`${BASE}/api/community/cats/${slug}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as OgCat;
  } catch {
    return null;
  }
}

function latinOrNull(raw: string | null | undefined): string | null {
  const text = raw?.trim();
  if (!text) return null;
  return [...text].every((ch) => { const c = ch.codePointAt(0) ?? 0; return c >= 0x20 && c <= 0x24f; }) ? text : null;
}

/** An absolute, non-WebP/AVIF URL the renderer can decode — else null. */
function drawablePhoto(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw, SITE);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (/\.(webp|avif)$/i.test(url.pathname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export default async function OpengraphImage({ params }: { params: { slug: string } }) {
  const [cat, plate] = await Promise.all([
    fetchCat(params.slug),
    fetch(new URL("../../../public/brand/og/cat-plate.png", import.meta.url)).then((r) => r.arrayBuffer()),
  ]);
  const name = latinOrNull(cat?.name);
  const photo = drawablePhoto(cat?.photoUrl);

  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", position: "relative", fontFamily: "sans-serif" }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={plate as unknown as string} width={1200} height={630} style={{ position: "absolute", left: 0, top: 0 }} />

        {photo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            width={300}
            height={300}
            style={{ position: "absolute", left: 450, top: 92, width: 300, height: 300, objectFit: "cover", borderRadius: 30 }}
          />
        )}

        {name && (
          <div
            style={{
              position: "absolute", left: 300, top: 420, width: 600, height: 72,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 58, fontWeight: 700, color: PAPER, overflow: "hidden", whiteSpace: "nowrap",
            }}
          >
            {name.length > 18 ? `${name.slice(0, 17)}…` : name}
          </div>
        )}

        {cat?.catIdNumber && (
          <div
            style={{
              position: "absolute", left: 400, top: name ? 516 : 440, width: 400, height: 34,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontFamily: "monospace", fontSize: 28, letterSpacing: 4, color: MINT,
            }}
          >
            {cat.catIdNumber}
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
