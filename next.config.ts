import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF primeiro (bem menor nos mascotes em traço), WebP como fallback
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    serverActions: {
      // O extrato sobe por uma Server Action, que por padrão recusa corpo acima
      // de 1MB. 4,5MB é o teto que a Vercel impõe a qualquer requisição; a tela
      // de nova conciliação barra arquivo acima de 4MB para sobrar espaço pro
      // envelope multipart.
      bodySizeLimit: "4.5mb",
    },
  },
};

export default nextConfig;
