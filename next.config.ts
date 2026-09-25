import type { NextConfig } from "next";

/**
 * CSP sem nonce, como no guia de Content Security Policy do Next. Vai como
 * Report-Only: o navegador aponta no console o que a política bloquearia, sem
 * bloquear. Impor exige tirar antes o que ela acusar — o script do tema no
 * <head> é inline, e o toolbar da Vercel nos previews carrega de vercel.live.
 * 'unsafe-inline' fica porque, sem nonce, o Next também injeta scripts inline;
 * trocar por nonce obriga toda página a renderizar por requisição.
 *
 * O 'unsafe-eval' é só do next dev: o React usa eval para montar a pilha de
 * erros do servidor no navegador. Em produção nem o React nem o Next usam eval.
 */
function politicaDeConteudo(): string {
  const desenvolvimento = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${desenvolvimento ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    // Server Actions, a rota do CSV e o HMR do next dev: tudo na mesma origem
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

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
          // a URL da conciliação carrega ids de extrato: para fora vai só a origem
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          // dois anos, o mesmo que a Vercel manda nos domínios dela; sem
          // includeSubDomains, que prenderia qualquer subdomínio ao HTTPS
          { key: "Strict-Transport-Security", value: "max-age=63072000" },
          { key: "Content-Security-Policy-Report-Only", value: politicaDeConteudo() },
        ],
      },
    ];
  },
};

export default nextConfig;
