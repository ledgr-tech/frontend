import type { Execucao, Fechamento } from "@/lib/adaptadores";
import type { StatusLinha, Tom } from "@/lib/mock-data";
import { paraRevisar } from "../historico/execucoes";
import { tituloDaCompetencia } from "../fechamentos/fechamento";
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
    rotulo: `${formatarInteiro(pendentes)} ${pendentes === 1 ? "pede" : "pedem"} decisão`,
    tom: custaDinheiro ? "risco" : "atencao",
  };
}

const MES_ABREVIADO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "set/2026", de "2026-09": o mês do extrato numa coluna estreita. */
export function mesDaLista(chave: string): string {
  const [ano, mes] = chave.split("-");
  return `${MES_ABREVIADO[Number(mes) - 1] ?? mes}/${ano}`;
}

/** Um mês na lista: as conciliações dele e se está fechado agora. */
export type MesNaLista = {
  /** "2026-07". */
  chave: string;
  /** "Julho de 2026". */
  titulo: string;
  /** O fechamento em vigor do mês; null quando está aberto (nunca fechado ou reaberto). */
  fechamento: Fechamento | null;
  /** Na ordem de trabalho: o que pede decisão primeiro. */
  conciliacoes: ConciliacaoNaLista[];
  /** O que ainda pede decisão no mês inteiro. */
  pedemDecisao: number;
};

/**
 * A lista agrupada pelo mês do extrato do banco, como Fechamentos (revisão de estilo de 15/10): os
 * meses abertos primeiro, que é onde está o trabalho, e depois os fechados; cada lado do mais
 * recente ao mais antigo. O estado do mês é o registro mais recente de `/fechamentos`; sem a lista
 * (`null`), nenhum aparece fechado.
 */
export function agruparPorMes(lista: ConciliacaoNaLista[], fechamentos: Fechamento[] | null): MesNaLista[] {
  const vigente = new Map<string, Fechamento>();
  for (const fechamento of fechamentos ?? []) {
    if (!vigente.has(fechamento.competencia)) vigente.set(fechamento.competencia, fechamento);
  }
  const porMes = new Map<string, ConciliacaoNaLista[]>();
  for (const conciliacao of lista) porMes.set(conciliacao.competencia, [...(porMes.get(conciliacao.competencia) ?? []), conciliacao]);
  return [...porMes]
    .map(([chave, doMes]) => {
      const atual = vigente.get(chave);
      return {
        chave,
        titulo: tituloDaCompetencia(chave),
        fechamento: atual?.estado === "fechado" ? atual : null,
        conciliacoes: ordemDeTrabalho(doMes),
        pedemDecisao: doMes.reduce((soma, item) => soma + Math.max(0, pedemDecisao(item)), 0),
      };
    })
    .sort((a, b) => Number(a.fechamento !== null) - Number(b.fechamento !== null) || b.chave.localeCompare(a.chave));
}

export type FiltroDaLista = "pendentes" | "prontas" | "fechadas" | "todas";

/** Num mês fechado nada mais se decide: a conciliação conta só em "Mês fechado" (e em "Todas"). */
export function passaNoFiltro(conciliacao: ConciliacaoNaLista, mesFechado: boolean, filtro: FiltroDaLista): boolean {
  if (filtro === "todas") return true;
  if (filtro === "fechadas") return mesFechado;
  if (mesFechado) return false;
  return filtro === "pendentes" ? pedemDecisao(conciliacao) > 0 : pedemDecisao(conciliacao) <= 0;
}
