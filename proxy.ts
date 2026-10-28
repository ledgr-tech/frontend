import { NextResponse, type NextRequest } from "next/server";
import { novoNonce, politicaDeConteudo } from "@/lib/csp";
import { empresaDoCaminho } from "@/lib/rotas";

/**
 * A CSP de cada página, com um nonce novo (lib/csp.ts). A política vai no pedido, para o Next ler o
 * nonce ao renderizar, e na resposta, para o navegador aplicar; o `x-nonce` é para o layout.
 *
 * Também leva ao pedido a empresa ativa (#169): o UUID de `/e/<uuid>/...` vira `x-ledgr-empresa`, que o
 * `chamarBackend` manda ao backend. O cabeçalho que vier de fora é **sempre** apagado antes: ele só existe
 * se nasceu aqui, de um UUID válido no caminho.
 *
 * O prefetch também passa por aqui: ele renderiza Server Components, e sem o proxy um `x-ledgr-empresa`
 * de fora chegaria inteiro ao backend. Só a CSP fica de fora dele, que não é página que o navegador monte.
 */
export function proxy(request: NextRequest) {
  const cabecalhos = new Headers(request.headers);
  cabecalhos.delete("x-ledgr-empresa");
  const empresa = empresaDoCaminho(request.nextUrl.pathname);
  if (empresa) cabecalhos.set("x-ledgr-empresa", empresa);

  const prefetch = request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
  if (prefetch) return NextResponse.next({ request: { headers: cabecalhos } });

  const nonce = novoNonce();
  const politica = politicaDeConteudo(nonce, process.env.NODE_ENV === "development");
  cabecalhos.set("x-nonce", nonce);
  cabecalhos.set("Content-Security-Policy", politica);

  const resposta = NextResponse.next({ request: { headers: cabecalhos } });
  resposta.headers.set("Content-Security-Policy", politica);
  return resposta;
}

export const config = {
  // fora: rotas de API (o CSV e o NextAuth), os arquivos do build, a otimização de imagem e o
  // que tem extensão (mascotes, favicon, fontes); nada disso é página com script
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
