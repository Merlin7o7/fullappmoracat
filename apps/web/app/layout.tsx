import type { Metadata, Viewport } from "next";
import { Inter, Sora, IBM_Plex_Sans_Arabic } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Moraqat — Cat Essentials Subscription | مرقط",
    template: "%s · Moraqat",
  },
  description:
    "Moraqat delivers intelligently-sized cat food, litter and treats to your door every month across Jeddah and Riyadh.",
  keywords: ["cat subscription", "cat food Saudi Arabia", "اشتراك قطط", "طعام قطط", "Jeddah", "Riyadh"],
  openGraph: {
    type: "website",
    siteName: "Moraqat",
    title: "Moraqat — Cat Essentials Subscription",
    description: "Everything your cat needs, delivered every month. Jeddah & Riyadh.",
    url: siteUrl,
  },
  twitter: { card: "summary_large_image", title: "Moraqat", description: "Cat essentials, delivered monthly." },
  alternates: { canonical: "/", languages: { "ar-SA": "/", "en-SA": "/en" } },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1417" },
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
