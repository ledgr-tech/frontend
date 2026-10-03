import type { Conciliacao, EventoDecisao, EventoHistorico, LinhaComparacao, TipoEvento } from "@/lib/mock-data";
import { estaResolvida, formatarDataHora } from "../../dashboard/resumo";

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

const ACAO: Record<TipoEvento, string> = {
  conferida: "Conferida",
  conferencia_desfeita: "Conferência desfeita",
  justificada: "Justificada",
  justificativa_desfeita: "Justificativa desfeita",
};

/** "Justificada por Eduardo (rodada 2): juros de atraso." A rodada só aparece a partir da segunda. */
function textoDoEvento({ tipo, autor, texto, rodada }: EventoDecisao): string {
  const quem = `${ACAO[tipo]} por ${autor}${rodada > 1 ? ` (rodada ${rodada})` : ""}`;
  return tipo === "justificada" && texto ? `${quem}: ${texto}` : quem;
}

function doLedgr(evento: EventoDecisao): EventoHistorico {
  return { quando: formatarDataHora(evento.em), evento: textoDoEvento(evento), origem: "Ledgr" };
}

/**
 * O histórico do lançamento no detalhe: o que veio dos extratos e, depois, as decisões
 * na ordem em que foram feitas. Se a última decisão das rodadas passadas era uma
 * conferência e a linha ainda diverge, a rodada de agora entra como "Continua
 * divergindo", na hora em que foi conciliada (`executadaEm`), antes das decisões dela.
 */
export function historicoDaLinha(linha: LinhaComparacao, rodada: number, executadaEm?: string): EventoHistorico[] {
  // a lista pode vir só no detalhe; sem ela, a decisão em vigor é o que se sabe
  const eventos = linha.eventos ?? (linha.decisao ? [linha.decisao] : []);
  const anteriores = eventos.filter((evento) => evento.rodada < rodada);
  const daRodada = eventos.filter((evento) => evento.rodada >= rodada);
  const continua = !estaResolvida(linha.status) && anteriores.at(-1)?.tipo === "conferida";
  return [
    ...linha.historico,
    ...anteriores.map(doLedgr),
    ...(continua
      ? [
          {
            quando: executadaEm ? formatarDataHora(executadaEm) : "—",
            evento: `Continua divergindo (rodada ${rodada})`,
            origem: "Ledgr" as const,
          },
        ]
      : []),
    ...daRodada.map(doLedgr),
  ];
}
