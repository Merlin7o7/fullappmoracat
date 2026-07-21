import { ImageResponse } from "next/og";

// Social share card for the Cat Census — warm paper, brand wordmark, the census
// question, and (when reachable) the REAL live count. The number is the hook: a
// share that says "12,431 cats counted" recruits better than any tagline. It is
// fetched honestly and omitted on failure — never a seeded or rounded figure
// (R006/R040), exactly like the on-site counter.
export const runtime = "edge";
export const alt = "Moracat — the national Cat Census";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function liveCount(): Promise<number | null> {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/api/census`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { registered?: number };
    return typeof data.registered === "number" ? data.registered : null;
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const count = await liveCount();
  const counted = count !== null ? new Intl.NumberFormat("en-US").format(count) : null;

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
          Every cat deserves an identity.
        </div>
        {counted ? (
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 28 }}>
            <div style={{ fontSize: 72, fontWeight: 800, color: "#1f6b4f" }}>{counted}</div>
            <div style={{ fontSize: 30, color: "#4b5a52" }}>cats counted so far · join the Cat Census</div>
          </div>
        ) : (
          <div style={{ fontSize: 30, color: "#4b5a52", marginTop: 24 }}>
            Join the national Cat Census · reserve your free Cat ID
          </div>
        )}
      </div>
    ),
    { ...size }
  );
}
