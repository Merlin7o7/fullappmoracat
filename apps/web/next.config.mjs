/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Self-contained server bundle for the Docker runtime stage. Opt-in via env
  // because the trace step needs symlinks (blocked on plain Windows dev boxes;
  // fine on Linux CI/Docker where this is actually consumed).
  ...(process.env.NEXT_STANDALONE === "1" ? { output: "standalone" } : {}),
  transpilePackages: ["@moraqat/ui", "@moraqat/core"],
  images: {
    formats: ["image/avif", "image/webp"],
    // Restricted allow-list (no wildcard) — prevents the image optimizer being
    // abused as an open proxy/SSRF vector. Add hosts here as needed.
    remotePatterns: [
      { protocol: "https", hostname: "*.r2.dev" }, // Cloudflare R2 public buckets
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // Google avatars
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          // DENY, not SAMEORIGIN — matches `frame-ancestors 'none'` in the CSP
          // set by middleware. Nothing in the product is meant to be framed.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The scan page needs the camera; everything else is denied. Without
          // the self grant here the QR scanner cannot open a video stream.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
