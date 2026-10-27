import { conteudoDaAjuda } from "../conteudo";
import { PAGINAS } from "../paginas";

// gerado no build: o backend busca em AJUDA_CONTEUDO_URL, sem login (é o mesmo texto da Central)
export const dynamic = "force-static";

export function GET() {
  return Response.json(conteudoDaAjuda(PAGINAS));
}
