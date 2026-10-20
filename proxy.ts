import { NextResponse, type NextRequest } from "next/server";
import { novoNonce, politicaDeConteudo } from "@/lib/csp";

/**
 * A CSP de cada página, com um nonce novo (lib/csp.ts). A política vai no pedido, para o Next ler o
 * nonce ao renderizar, e na resposta, para o navegador aplicar; o `x-nonce` é para o layout.
 */
export function proxy(request: NextRequest) {
  const nonce = novoNonce();
  const politica = politicaDeConteudo(nonce, process.env.NODE_ENV === "development");

  const cabecalhos = new Headers(request.headers);
  cabecalhos.set("x-nonce", nonce);
  cabecalhos.set("Content-Security-Policy", politica);

  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set("Content-Security-Policy", politica);
  return resposta;
}

export const config = {
  matcher: [
    {
      // fora: rotas de API (o CSV e o NextAuth), os arquivos do build, a otimização de imagem e o
      // que tem extensão (mascotes, favicon, fontes); nada disso é página com script
      source: "/((?!api|_next/static|_next/image|.*\\..*).*)",
      // o prefetch do next/link não é página que o navegador vá montar
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
