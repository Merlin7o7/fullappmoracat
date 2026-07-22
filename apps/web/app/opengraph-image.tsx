import { ImageResponse } from "next/og";

// Static social share card — warm paper background, brand wordmark + the one line
// the whole product defends. Rendered by Next at build/edge, self-contained.
export const runtime = "edge";
export const alt = "Moracat — the cat membership";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #faf7f1 0%, #f3ede1 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: "#1f6b4f",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
            }}
          >
            🐱
          </div>
          <div style={{ fontSize: 46, fontWeight: 700, color: "#1a2b23" }}>Moracat</div>
        </div>
        <div style={{ fontSize: 62, fontWeight: 800, color: "#12201a", lineHeight: 1.15, maxWidth: 900 }}>
          Give your cat an identity of their own.
        </div>
        <div style={{ fontSize: 30, color: "#4b5a52", marginTop: 24 }}>
          An official Cat ID · a health record · a community · Jeddah &amp; Riyadh
        </div>
      </div>
    ),
    { ...size }
  );
}
