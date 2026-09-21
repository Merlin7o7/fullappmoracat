import { ImageResponse } from "next/og";
import { fetchNoticeForShare } from "@/lib/lost-found-share";

/**
 * The poster a lost-cat link unfurls into. In a neighbourhood WhatsApp group
 * this card IS the notice: the cat's face, LOST or FOUND in one word, and where
 * — nothing else earns the space. No phone number, ever: the link leads to the
 * relay form, which is the whole point of posting through Moracat.
 *
 * LATIN TEXT ONLY inside the image, on purpose. The image renderer cannot shape
 * Arabic: it throws on common ligatures (any "لا", as in الرياض) and the whole
 * card 500s — a link that unfurls as nothing, at the worst possible moment.
 * The Arabic lives where it renders perfectly: the page's og:title and
 * description, which WhatsApp prints right beside this image. So the card
 * carries the face, one universally-read word (LOST / FOUND), the name in
 * Latin letters and the city — and no font files are fetched.
 */
export const runtime = "edge";
export const alt = "Moracat Lost & Found notice";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "linear-gradient(135deg, #faf7f1 0%, #f3ede1 100%)";
const GREEN = "#045B46";
const INK = "#12201a";
const MUTED = "#4b5a52";
const ALERT = "#b3261e";
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://moracat.co";

/** Text the renderer can draw: Basic Latin through Latin Extended-B only. */
function latinOrNull(raw: string | null | undefined): string | null {
  const text = raw?.trim();
  if (!text) return null;
  // U+0020–U+024F, spelled as code points so the range survives any editor.
  return [...text].every((ch) => { const c = ch.codePointAt(0) ?? 0; return c >= 0x20 && c <= 0x24f; }) ? text : null;
}

/**
 * A photo the image renderer can actually draw, or null. It needs an ABSOLUTE
 * URL (a relative path throws and takes the whole card down with a 500), and
 * it cannot decode WebP/AVIF. Anything else falls back to the paw tile — a
 * poster without a photo still unfurls; a 500 unfurls as nothing.
 */
function drawablePhoto(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw, SITE);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (/\.(webp|avif)$/i.test(url.pathname)) return null;
  return url.toString();
}

export default async function OpengraphImage({ params }: { params: { id: string } }) {
  const notice = await fetchNoticeForShare(params.id);
  const reunited = notice?.status === "REUNITED";
  const lost = notice?.kind !== "FOUND";
  const band = reunited ? GREEN : lost ? ALERT : GREEN;
  const label = reunited ? "HOME AGAIN" : lost ? "LOST CAT" : "FOUND CAT";
  // Only a name already written in Latin letters is drawn. A machine
  // transliteration of an Arabic name ("بسبس" → "Bsbs") reads as a typo on a
  // poster; the real name is in the title printed beside this image.
  const name = latinOrNull(notice?.catName);
  const place = [latinOrNull(notice?.district), latinOrNull(notice?.city?.en)].filter(Boolean).join(", ");
  const photo = drawablePhoto(notice?.photoUrl);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: PAPER,
          padding: "56px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 460,
            height: 460,
            borderRadius: 40,
            background: "#ffffff",
            padding: 14,
            border: `6px solid ${band}`,
            flexShrink: 0,
          }}
        >
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photo}
              alt=""
              width={420}
              height={420}
              style={{ width: 420, height: 420, objectFit: "cover", borderRadius: 28 }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 420,
                height: 420,
                borderRadius: 28,
                // A pale ground: the paw glyph is dark and vanished on deep green.
                background: "#dfe9e2",
                fontSize: 170,
              }}
            >
              🐾
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginLeft: 60,
            flexGrow: 1,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              alignItems: "center",
              background: band,
              color: "#ffffff",
              borderRadius: 18,
              padding: "12px 26px",
            }}
          >
            <div style={{ display: "flex", fontSize: 46, fontWeight: 800, letterSpacing: 3 }}>{label}</div>
          </div>

          {name && (
            <div
              style={{
                display: "block",
                marginTop: 30,
                fontSize: 78,
                fontWeight: 800,
                color: INK,
                lineHeight: 1.15,
                maxWidth: 560,
                overflow: "hidden",
              }}
            >
              {name}
            </div>
          )}

          {place && <div style={{ display: "flex", marginTop: 20, fontSize: 38, color: INK, maxWidth: 540 }}>{place}</div>}

          <div style={{ display: "flex", marginTop: 14, fontSize: 26, lineHeight: 1.3, color: MUTED, maxWidth: 540 }}>
            {reunited ? "Thank you to everyone who looked." : "Seen them? Open the link to message the owner."}
          </div>

          <div style={{ display: "flex", alignItems: "center", marginTop: 40 }}>
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
            <div style={{ display: "flex", fontSize: 30, fontWeight: 700, color: GREEN }}>
              Moracat · Lost & Found
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
