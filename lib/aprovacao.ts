import type { Decisao } from "./mock-data";

/** Justificada, mas ainda esperando o admin ou o gestor aprovar (backend #132): não libera o fechamento. */
export function aguardaAprovacao(decisao: Decisao | null | undefined): boolean {
  return decisao?.tipo === "justificada" && decisao.situacao === "pendente";
}

/** Justificada e valendo: a aprovada, ou a de um backend em que a aprovação não existe. */
export function estaJustificada(decisao: Decisao | null | undefined): boolean {
  return decisao?.tipo === "justificada" && decisao.situacao !== "pendente";
}
