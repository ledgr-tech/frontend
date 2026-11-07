import type { LinhaComparacao } from "@/lib/mock-data";
import { estaResolvida } from "../../dashboard/resumo";
import { situacaoDaLinha } from "./situacao";

/** O que o painel oferece para decidir a linha em foco. Desfazer (justificativa ou aprovação) é na janela do detalhe. */
export type AcoesDoPainel = {
  /** O campo "Justificativa": qualquer papel justifica a divergência que ainda pede decisão. */
  justificar: boolean;
  /** "Aprovar" e "Rejeitar" a justificativa que espera: só o admin e o gestor. */
  aprovar: boolean;
  /** O analista vê que a justificativa espera, e não ganha botão. */
  avisoDeAprovacao: boolean;
};

export function acoesDoPainel({
  linha,
  rodada,
  podeDecidir,
  podeAprovar,
}: {
  linha: LinhaComparacao;
  rodada: number;
  /** Há onde gravar, a rodada é a que vale e o mês está aberto (a mesma regra da tela). */
  podeDecidir: boolean;
  podeAprovar: boolean;
}): AcoesDoPainel {
  const situacao = situacaoDaLinha(linha, rodada);
  const aguardando = situacao === "aguardando";
  return {
    justificar: podeDecidir && (situacao === "a_conferir" || situacao === "conferida"),
    aprovar: podeDecidir && podeAprovar && aguardando,
    avisoDeAprovacao: aguardando && !podeAprovar,
  };
}

/**
 * Se o painel oferece "Explicar esta divergência": só com dado do backend (o mock não tem o que pedir), só
 * em divergência e só enquanto a linha não veio explicada. A mesma regra do detalhe da linha.
 */
export function ofereceExplicacao(linha: LinhaComparacao, real: boolean): boolean {
  return real && !linha.explicacao && !estaResolvida(linha.status);
}
