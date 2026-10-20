import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // o indicador do next dev nasce no canto inferior esquerdo, em cima da conta
  // do usuário no rodapé do menu lateral; só existe em desenvolvimento
  devIndicators: { position: "bottom-right" },
  // sem o "X-Powered-By: Next.js": é informação de graça para quem varre versão
  poweredByHeader: false,
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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // ninguém emoldura o app num iframe para induzir um clique
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // uma janela aberta por outro site não fica com referência a esta (window.opener)
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          // a URL da conciliação carrega ids de extrato: para fora vai só a origem
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          // dois anos, o mesmo que a Vercel manda nos domínios dela; sem
          // includeSubDomains, que prenderia qualquer subdomínio ao HTTPS
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          // a Content-Security-Policy sai do proxy.ts, com um nonce por página (lib/csp.ts)
        ],
      },
    ];
  },
};

export default nextConfig;
