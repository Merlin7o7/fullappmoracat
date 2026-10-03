import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moracat — مرقط",
    short_name: "Moracat",
    description: "A membership identity for your cat — the Cat ID.",
    start_url: "/",
    display: "standalone",
    // Matches the light themeColor in app/layout.tsx viewport ("#faf7f1") so the
    // installed app's splash/title chrome agrees with the in-browser chrome.
    background_color: "#faf7f1",
    theme_color: "#faf7f1",
    // The designer's icon set (delivery 2026-10-03): real 192/512 renders,
    // plus a maskable one whose art sits inside the 409 px safe circle.
    icons: [
      { src: "/brand/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
