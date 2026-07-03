import type { Metadata, Viewport } from "next";
import { Inter, Sora } from "next/font/google";
import localFont from "next/font/local";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display", display: "swap" });

// Brand Arabic face — Lyon Arabic Display (licensed; provided by the brand).
const arabic = localFont({
  src: "./fonts/lyon-arabic-display-regular.otf",
  variable: "--font-arabic",
  display: "swap",
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
    { media: "(prefers-color-scheme: light)", color: "#f7dec9" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1712" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${inter.variable} ${sora.variable} ${arabic.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
