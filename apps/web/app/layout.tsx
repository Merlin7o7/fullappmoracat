import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
// Display face: Fraunces — a warm, softly-inked serif with real character.
// Latin only; Arabic display stays Lyon via the [dir="rtl"] font stack.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["SOFT", "opsz"],
});

// Brand Arabic face — Lyon Arabic Display (licensed; provided by the brand).
// #10: Lyon is restricted to Arabic LETTER ranges only. Latin glyphs and BOTH
// digit blocks (Western U+0030–0039 and Arabic-Indic U+0660–0669 / U+06F0–06F9)
// fall outside this range, so they render in the clean sans (Inter) via the
// `var(--font-arabic), var(--font-sans)` stack — keeping numbers crisp while
// Arabic copy keeps its premium Lyon identity.
const arabic = localFont({
  src: "./fonts/lyon-arabic-display-regular.otf",
  variable: "--font-arabic",
  display: "swap",
  declarations: [
    {
      prop: "unicode-range",
      value:
        "U+0600-065F, U+066A-06EF, U+06FA-06FF, U+0750-077F, U+08A0-08FF, U+FB50-FDFF, U+FE70-FEFF",
    },
  ],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Moracat — The cat membership | مرقط",
    template: "%s · Moracat",
  },
  description:
    "Moracat is a membership for people who take their cats seriously — an official Cat ID, a health record that follows them anywhere, and member rates across Jeddah & Riyadh.",
  keywords: ["cat membership", "Cat ID", "cat care Saudi Arabia", "عضوية قطط", "هوية قط", "Jeddah", "Riyadh"],
  openGraph: {
    type: "website",
    siteName: "Moracat",
    title: "Moracat — The cat membership",
    description: "Give your cat an identity of their own. Jeddah & Riyadh.",
    url: siteUrl,
  },
  twitter: { card: "summary_large_image", title: "Moracat", description: "The cat membership — an identity of their own." },
  alternates: { canonical: "/", languages: { "ar-SA": "/", "en-SA": "/en" } },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1712" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} ${arabic.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
