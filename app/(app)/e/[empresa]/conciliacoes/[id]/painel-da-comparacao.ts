import type { LinhaComparacao } from "@/lib/mock-data";
import { aprovadaDepois, podeDesfazerAprovacao } from "@/lib/aprovacao";
import { estaResolvida } from "../../dashboard/resumo";
import { situacaoDaLinha } from "./situacao";

/** O que o painel oferece para decidir a linha em foco: as mesmas ações, com as mesmas regras, da janela da linha (#368). */
export type AcoesDoPainel = {
  /** O campo "Justificativa": qualquer papel justifica a divergência que ainda pede decisão. */
  justificar: boolean;
  /** "Aprovar" e "Rejeitar" a justificativa que espera: só o admin e o gestor. */
  aprovar: boolean;
  /** O analista vê que a justificativa espera, e não ganha botão. */
  avisoDeAprovacao: boolean;
  /** "Desfazer justificativa": a que espera aprovação, ou a que vale sem ter sido aprovada por alguém. */
  desfazer: boolean;
  /** "Desfazer aprovação…": só quem aprovou (backend #164/#174). */
  desfazerAprovacao: boolean;
  /** A aprovada por outra pessoa: o painel diz quem precisa desfazer a aprovação. */
  avisoDeQuemAprovou: boolean;
};

export function acoesDoPainel({
  linha,
  rodada,
  podeDecidir,
  podeAprovar,
  nome = "",
}: {
  linha: LinhaComparacao;
  rodada: number;
  /** Há onde gravar, a rodada é a que vale e o mês está aberto (a mesma regra da tela). */
  podeDecidir: boolean;
  podeAprovar: boolean;
  /** O nome de quem está logado: sem a resposta do backend #174, é ele que diz quem aprovou. */
  nome?: string;
}): AcoesDoPainel {
  const situacao = situacaoDaLinha(linha, rodada);
  const aguardando = situacao === "aguardando";
  // aprovada por alguém: não se retira (o backend responde 409) antes de quem aprovou desfazer a aprovação
  const aprovada = podeDecidir && situacao === "justificada" && aprovadaDepois(linha.decisao);
  const souQuemAprovou = podeAprovar && podeDesfazerAprovacao(linha.decisao, nome);
  return {
    justificar: podeDecidir && (situacao === "a_conferir" || situacao === "conferida"),
    aprovar: podeDecidir && podeAprovar && aguardando,
    avisoDeAprovacao: aguardando && !podeAprovar,
    desfazer: podeDecidir && (aguardando || (situacao === "justificada" && !aprovada)),
    desfazerAprovacao: aprovada && souQuemAprovou,
    avisoDeQuemAprovou: aprovada && !souQuemAprovou,
  };
}

/**
 * Se o painel oferece "Explicar esta divergência": só com dado do backend (o mock não tem o que pedir), só
 * em divergência e só enquanto a linha não veio explicada. A mesma regra do detalhe da linha.
 */
export function ofereceExplicacao(linha: LinhaComparacao, real: boolean): boolean {
  return real && !linha.explicacao && !estaResolvida(linha.status);
}
