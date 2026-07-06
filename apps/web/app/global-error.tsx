"use client";

/**
 * Root-layout crash boundary. Unlike error.tsx (which renders inside the app
 * shell), global-error replaces the entire document, so it must ship its own
 * <html>/<body> and cannot rely on the theme or locale providers. Kept minimal,
 * bilingual, and blameless (R112) with one clear recovery action.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#faf7f1",
          color: "#12201a",
          fontFamily: "system-ui, -apple-system, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <div style={{ fontSize: 44 }}>🐾</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginTop: 16 }}>حدث خطأ ما — ليس منك</h1>
          <p style={{ fontSize: 18, fontWeight: 600, opacity: 0.8, marginTop: 4, direction: "ltr" }}>
            Something went wrong — not your fault
          </p>
          <p style={{ fontSize: 14, color: "#4b5a52", marginTop: 16 }}>
            حاول مرة أخرى · Please try again
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "12px 24px",
              borderRadius: 12,
              border: "none",
              background: "#1f6b4f",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            حاول مجدداً · Try again
          </button>
        </div>
      </body>
    </html>
  );
}
