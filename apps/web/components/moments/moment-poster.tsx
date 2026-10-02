"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";

export type MomentKind = "lost" | "found" | "reunion" | "adoption" | "joined" | "birthday";

export interface MomentPosterProps {
  kind: MomentKind;
  isAr: boolean;
  catName: string;
  /** Already routed through exportSafeSrc (same-origin) for the capture. */
  photoUrl: string | null;
  catIdNumber?: string | null;
  /** Free lines under the name — district + date for lost, "new home" for adoption… */
  lines?: string[];
  /** Where the QR leads (scan page for lost cats, the community page otherwise). */
  qrUrl?: string | null;
}

const EMERALD = "#045B46";
const PAPER = "#FAF7F2";
const INK = "#15211C";
const COPPER = "#B5532A";
const ALERT = "#B42318";

// The founder's 3D renders on happy moments only — never on lost/found
// (AD 2.1: no 3D in distress). Same-origin <img> so the capture embeds it.
const OBJECT: Partial<Record<MomentKind, string>> = {
  joined: "/brand/3d/cat-plush.webp",
  birthday: "/brand/3d/heart-plush.webp",
  reunion: "/brand/3d/heart-plush.webp",
  adoption: "/brand/3d/paw-plush.webp",
};

const COPY: Record<MomentKind, { ar: string; en: string; tone: "alert" | "emerald" }> = {
  lost: { ar: "قطة مفقودة", en: "Lost cat", tone: "alert" },
  found: { ar: "وجدنا هذا القط", en: "Found this cat", tone: "alert" },
  reunion: { ar: "رجع للبيت", en: "Home again", tone: "emerald" },
  adoption: { ar: "بيت جديد", en: "A new home", tone: "emerald" },
  joined: { ar: "انضم إلى سجل مرقط", en: "Joined the Moracat register", tone: "emerald" },
  birthday: { ar: "عيد ميلاد سعيد", en: "Happy birthday", tone: "emerald" },
};

/**
 * One of the cat's shareable moments, as a 9:16 artifact (540×960, captured
 * at 2× = 1080×1920). Same document language as everything else Moracat
 * makes (AD 2.1): an ID band, the cat as hero, a seal, the serial in mono —
 * so a poster in a neighbourhood WhatsApp group is recognisably Moracat.
 *
 * Inline styles only: this node is rasterised by html-to-image, which keeps
 * computed styles but not every utility class at export time.
 */
export const MomentPoster = React.forwardRef<HTMLDivElement, MomentPosterProps>(function MomentPoster(
  { kind, isAr, catName, photoUrl, catIdNumber, lines = [], qrUrl },
  ref
) {
  const copy = COPY[kind];
  const band = copy.tone === "alert" ? ALERT : EMERALD;
  const dir = isAr ? "rtl" : "ltr";
  const font = isAr ? "var(--font-arabic-text), var(--font-sans), sans-serif" : "var(--font-sans), sans-serif";
  const display = isAr ? "var(--font-arabic-display), var(--font-arabic-text), serif" : "var(--font-display), serif";

  return (
    <div
      ref={ref}
      dir={dir}
      style={{ width: 540, height: 960, background: PAPER, color: INK, fontFamily: font, display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* The band: what this is, and who issued it. */}
      <div style={{ background: band, color: "#fff", padding: "22px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 34, fontFamily: display, lineHeight: 1.2 }}>{isAr ? copy.ar : copy.en}</span>
        <span style={{ fontSize: 16, opacity: 0.9 }}>{isAr ? "مرقط" : "Moracat"}</span>
      </div>

      <div style={{ padding: "26px 28px 0", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ position: "relative" }}>
        <div style={{ width: "100%", aspectRatio: "1 / 1", borderRadius: 18, overflow: "hidden", background: "#F1E6D6" }}>
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" crossOrigin="anonymous" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", fontFamily: display, fontSize: 160, color: "rgba(21,33,28,0.35)" }}>
              {catName.slice(0, 1)}
            </div>
          )}
        </div>
        {OBJECT[kind] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={OBJECT[kind]}
            alt=""
            style={{
              position: "absolute",
              bottom: -34,
              [isAr ? "left" : "right"]: -14,
              width: 132,
              height: 132,
              objectFit: "contain",
              transform: "rotate(-8deg)",
              filter: "drop-shadow(0 10px 12px rgba(21,33,28,0.22))",
            }}
          />
        ) : null}
        </div>

        <div>
          <div style={{ fontFamily: display, fontSize: 64, lineHeight: 1.1 }}>{catName}</div>
          {lines.map((l) => (
            <div key={l} style={{ fontSize: 20, lineHeight: 1.6, color: "rgba(21,33,28,0.72)" }}>
              {l}
            </div>
          ))}
        </div>
      </div>

      {/* The footer: the way back to the cat, and the seal. */}
      <div style={{ margin: "0 28px 28px", padding: 16, borderTop: "1px dashed rgba(21,33,28,0.25)", display: "flex", alignItems: "center", gap: 16 }}>
        {qrUrl ? (
          <div style={{ background: "#fff", padding: 8, borderRadius: 10 }}>
            <QRCodeSVG value={qrUrl} size={96} level="M" fgColor={EMERALD} bgColor="#ffffff" title={isAr ? "امسح للوصول إلى صفحة القط" : "Scan to reach the cat’s page"} />
          </div>
        ) : null}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, lineHeight: 1.5 }}>
            {kind === "lost"
              ? isAr ? "شفته؟ امسح الرمز وأرسل لأهله — رقمهم ما يظهر لك." : "Seen them? Scan the code to message the family — their number stays private."
              : isAr ? "لِحياة قطّك كلّها" : "For your cat's whole life"}
          </div>
          {catIdNumber ? (
            <div dir="ltr" style={{ fontFamily: "var(--font-mono), monospace", fontSize: 15, letterSpacing: "0.06em", color: COPPER, marginTop: 4 }}>
              {catIdNumber}
            </div>
          ) : null}
          <div dir="ltr" style={{ fontSize: 14, color: "rgba(21,33,28,0.6)", marginTop: 2 }}>moracat.co</div>
        </div>
      </div>
    </div>
  );
});
