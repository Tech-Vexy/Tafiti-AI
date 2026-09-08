import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.clerk.accounts.dev" },
      { protocol: "https", hostname: "**.clerk.com" },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default nextConfig;
