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
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
