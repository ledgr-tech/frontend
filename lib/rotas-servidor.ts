import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { comEmpresa, ehUuid } from "./rotas";

/**
 * A empresa da aba, vista do servidor: o `proxy.ts` leu o `/e/<uuid>/` da URL e deixou no pedido o
 * `x-ledgr-empresa`. Vale em Server Components e em Server Actions (a Action é um POST na URL da própria
 * página). Null se o pedido não tem empresa, se o valor não é UUID ou fora de uma requisição, quando
 * `headers()` lança (o build, por exemplo): quem chama segue sem empresa.
 */
export async function empresaDaRequisicao(): Promise<string | null> {
  try {
    const valor = (await headers()).get("x-ledgr-empresa")?.trim();
    return valor && ehUuid(valor) ? valor : null;
  } catch {
    return null;
  }
}

/** O caminho de uma tela do app já com a empresa da requisição; o que não é tela da empresa volta igual. */
export async function caminhoDoApp(caminho: string): Promise<string> {
  const empresa = await empresaDaRequisicao();
  return empresa ? comEmpresa(empresa, caminho) : caminho;
}

/** O `redirect` do Next para dentro do app: leva à tela na empresa em que a pessoa está. */
export async function redirecionarNoApp(caminho: string): Promise<never> {
  redirect(await caminhoDoApp(caminho));
}
