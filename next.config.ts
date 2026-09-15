import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF primeiro (bem menor nos mascotes em traço), WebP como fallback
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
