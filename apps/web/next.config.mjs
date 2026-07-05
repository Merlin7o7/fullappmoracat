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
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
