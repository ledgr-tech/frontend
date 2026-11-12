import type { Decisao } from "./mock-data";

/** Justificada, mas ainda esperando o admin ou o gestor aprovar (backend #132): não libera o fechamento. */
export function aguardaAprovacao(decisao: Decisao | null | undefined): boolean {
  return decisao?.tipo === "justificada" && decisao.situacao === "pendente";
}

/** Justificada e valendo: a aprovada, ou a de um backend em que a aprovação não existe. */
export function estaJustificada(decisao: Decisao | null | undefined): boolean {
  return decisao?.tipo === "justificada" && decisao.situacao !== "pendente";
}

/**
 * Aprovada por alguém depois de justificada. Com a aprovação desligada (backend #132) a justificativa
 * já nasce aprovada em nome de quem justificou, um microssegundo depois dela: essa não conta.
 * shortcut: o segundo de folga separa a dos dois casos sem um campo do backend; troque por ele se vier.
 */
export function aprovadaDepois(decisao: Decisao | null | undefined): boolean {
  if (!estaJustificada(decisao) || !decisao?.aprovadaPor || !decisao.aprovadaEm) return false;
  return Date.parse(decisao.aprovadaEm) - Date.parse(decisao.em) >= 1000;
}

/**
 * Só quem aprovou desfaz a aprovação (backend #164), e o admin quando quem aprovou saiu ou foi rebaixado.
 * O backend #174 manda a resposta pronta, calculada para quem está logado. Sem ela (o backend da `main`),
 * a tela compara o nome de quem aprovou com o de quem está logado; quem decide de verdade é o 403.
 */
export function podeDesfazerAprovacao(decisao: Decisao | null | undefined, nome: string): boolean {
  if (typeof decisao?.podeDesfazerAprovacao === "boolean") return decisao.podeDesfazerAprovacao;
  return aprovadaDepois(decisao) && nome.trim() !== "" && decisao?.aprovadaPor?.trim() === nome.trim();
}
