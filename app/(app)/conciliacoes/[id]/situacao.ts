import type { Conciliacao, LinhaComparacao } from "@/lib/mock-data";
import { estaResolvida } from "../../dashboard/resumo";

/**
 * Onde cada linha está, do ponto de vista de quem concilia (spec
 * 2026-10-02-conciliacao-em-rodadas, decisão 3): o que o motor casou bate; o que
 * diverge está a conferir, conferido nesta rodada ou justificado.
 */
export type Situacao = "bate" | "a_conferir" | "conferida" | "justificada";

export function situacaoDaLinha(linha: LinhaComparacao, rodada: number): Situacao {
  if (estaResolvida(linha.status)) return "bate";
  if (linha.decisao?.tipo === "justificada") return "justificada";
  // a conferência é a promessa de corrigir no sistema: se a rodada nova não resolveu,
  // a linha volta a chamar atenção
  if (linha.decisao?.tipo === "conferida" && linha.decisao.rodada === rodada) return "conferida";
  return "a_conferir";
}

/** Conferida numa rodada anterior, e a versão nova do sistema não resolveu. */
export function continuaDivergindo(linha: LinhaComparacao, rodada: number): boolean {
  return !estaResolvida(linha.status) && linha.decisao?.tipo === "conferida" && linha.decisao.rodada < rodada;
}

/**
 * A tela não finge que salva: no mock as decisões ficam em memória; com dado do
 * backend, só quando os itens trazem o campo `decisao` (mesmo null).
 */
export function decisoesLigadas(conciliacao: Conciliacao, real: boolean): boolean {
  return !real || conciliacao.linhas.some((linha) => linha.decisao !== undefined);
}
