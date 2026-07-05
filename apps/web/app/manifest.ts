import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moracat — مرقط",
    short_name: "Moracat",
    description: "A membership identity for your cat — the Cat ID.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF7F0",
    theme_color: "#0b3b30",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
  };
}
