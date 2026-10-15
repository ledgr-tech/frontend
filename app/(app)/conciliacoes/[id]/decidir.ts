import { registrarDecisaoNoMock, type Conciliacao, type LinhaComparacao, type TipoEvento } from "@/lib/mock-data";
import { chaveDaLinha } from "@/lib/rodadas";
import { registrarDecisao } from "../acoes";

export type ResultadoDaDecisao = { ok: true; conciliacao: Conciliacao } | { ok: false; status: number; erro: string };

/**
 * Conferir, justificar ou desfazer numa linha, onde a conciliação mora: a do mock
 * guarda no navegador; a do backend, pela rota de decisões. Devolve a conciliação
 * com a linha atualizada.
 */
export async function decidir({
  conciliacao,
  real,
  linha,
  tipo,
  texto,
}: {
  conciliacao: Conciliacao;
  real: boolean;
  linha: LinhaComparacao;
  tipo: TipoEvento;
  texto?: string;
}): Promise<ResultadoDaDecisao> {
  const chave = chaveDaLinha(linha);
  if (!real) {
    const atualizada = registrarDecisaoNoMock(conciliacao.id, chave, tipo, texto ?? null);
    // sumiu do navegador (outra aba limpou): recarregar mostra o que restou
    return atualizada
      ? { ok: true, conciliacao: atualizada }
      : { ok: false, status: 404, erro: "Esta linha não está mais nesta conciliação." };
  }

  const resposta = await registrarDecisao(conciliacao.id, chave, tipo, texto);
  if (!resposta.ok) return resposta;
  return {
    ok: true,
    conciliacao: {
      ...conciliacao,
      linhas: conciliacao.linhas.map((atual) =>
        chaveDaLinha(atual) === chave ? { ...atual, decisao: resposta.dados } : atual,
      ),
    },
  };
}
