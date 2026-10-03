import type { Execucao } from "@/lib/adaptadores";
import type { StatusLinha, Tom } from "@/lib/mock-data";
import { conciliados, paraRevisar } from "../historico/execucoes";
import { formatarInteiro, seloDoStatus } from "./resumo";

/**
 * A tela Conciliações como lista de trabalho: cada extrato do banco uma vez, na rodada que vale,
 * com o que ainda falta decidir nele.
 */
export type ConciliacaoNaLista = {
  extratoBancoId: string;
  extratoSistemaId: string;
  arquivoBanco: string;
  /** O extrato do sistema da rodada que vale. */
  arquivoSistema: string;
  /** O mês do extrato (AAAA-MM), o mesmo de Fechamentos. */
  competencia: string;
  /** O número da rodada que vale, e quantas a conciliação teve. */
  rodada: number;
  rodadas: number;
  /** A execução da rodada que vale: lançamentos, contagens, justificadas, quando rodou. */
  execucao: Execucao;
};

/** O que ainda pede decisão: diverge e ninguém justificou (a regra de `pedeDecisao`). */
export function pedemDecisao(conciliacao: ConciliacaoNaLista): number {
  return paraRevisar(conciliacao.execucao);
}

/**
 * A ordem da fila: o que pede decisão primeiro, e em cada grupo do mês do extrato mais recente
 * para o mais antigo; no mesmo mês, a que rodou por último antes.
 */
export function ordemDeTrabalho(lista: ConciliacaoNaLista[]): ConciliacaoNaLista[] {
  const aberta = (item: ConciliacaoNaLista) => (pedemDecisao(item) > 0 ? 0 : 1);
  return [...lista].sort(
    (a, b) =>
      aberta(a) - aberta(b) ||
      b.competencia.localeCompare(a.competencia) ||
      b.execucao.executadaEm.localeCompare(a.execucao.executadaEm),
  );
}

/**
 * O selo da situação, com a régua de Fechamentos: terracota quando alguma divergência custa
 * dinheiro, dourado quando é só incompleta, verde sem nada por decidir. A contagem do backend não
 * diz a categoria da justificada, então o tom olha as categorias da conciliação inteira.
 */
export function seloDaConciliacao(conciliacao: ConciliacaoNaLista): { rotulo: string; tom: Tom } {
  const pendentes = pedemDecisao(conciliacao);
  if (pendentes <= 0) return { rotulo: "Sem pendência", tom: "ok" };
  const custaDinheiro = (Object.entries(conciliacao.execucao.divergencias) as [StatusLinha, number][]).some(
    ([status, quantidade]) => quantidade > 0 && seloDoStatus(status).tom === "risco",
  );
  return {
    rotulo: `${formatarInteiro(pendentes)} ${pendentes === 1 ? "pendência" : "pendências"}`,
    tom: custaDinheiro ? "risco" : "atencao",
  };
}

const MES_ABREVIADO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "set/2026", de "2026-09": o mês do extrato numa coluna estreita. */
export function mesDaLista(chave: string): string {
  const [ano, mes] = chave.split("-");
  return `${MES_ABREVIADO[Number(mes) - 1] ?? mes}/${ano}`;
}

/** A taxa de match pelas contagens, como o gráfico e a comparação; null sem lançamento. */
export function taxaDaConciliacao(conciliacao: ConciliacaoNaLista): number | null {
  const { lancamentos } = conciliacao.execucao;
  return lancamentos === 0 ? null : (conciliados(conciliacao.execucao) / lancamentos) * 100;
}
