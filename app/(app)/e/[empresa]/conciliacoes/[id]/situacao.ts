import type { Conciliacao, EventoDecisao, EventoHistorico, LinhaComparacao, TipoEvento } from "@/lib/mock-data";
import { aguardaAprovacao } from "@/lib/aprovacao";
import { estaResolvida, formatarDataHora } from "../../dashboard/resumo";

/**
 * Onde cada linha está, do ponto de vista de quem concilia (spec
 * 2026-10-02-conciliacao-em-rodadas, decisão 3): o que o motor casou bate; o que
 * diverge está a conferir, conferido nesta rodada ou justificado. A justificada que espera o admin ou
 * o gestor aprovar (backend #132) é "aguardando": ainda segura o fechamento do mês.
 */
export type Situacao = "bate" | "a_conferir" | "conferida" | "aguardando" | "justificada";

export function situacaoDaLinha(linha: LinhaComparacao, rodada: number): Situacao {
  if (estaResolvida(linha.status)) return "bate";
  if (aguardaAprovacao(linha.decisao)) return "aguardando";
  if (linha.decisao?.tipo === "justificada") return "justificada";
  // a conferência é a promessa de corrigir no sistema: se a rodada nova não resolveu,
  // a linha volta a chamar atenção
  if (linha.decisao?.tipo === "conferida" && linha.decisao.rodada === rodada) return "conferida";
  return "a_conferir";
}

/** "Valor diverge · justificada": o status do motor não muda com a decisão, ela vem junto, não no lugar dele. */
export function rotuloComDecisao(rotulo: string, situacao: Situacao): string {
  if (situacao === "justificada") return `${rotulo} · justificada`;
  return situacao === "aguardando" ? `${rotulo} · aguardando aprovação` : rotulo;
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

const ACAO: Record<TipoEvento | "aprovacao_desfeita", string> = {
  conferida: "Conferida",
  conferencia_desfeita: "Conferência desfeita",
  justificada: "Justificada",
  justificativa_desfeita: "Justificativa desfeita",
  justificativa_aprovada: "Justificativa aprovada",
  justificativa_rejeitada: "Justificativa rejeitada",
  aprovacao_desfeita: "Aprovação desfeita",
};

/** "Justificada por Eduardo (rodada 2): juros de atraso." A rodada só aparece a partir da segunda. */
function textoDoEvento({ tipo, autor, texto, rodada }: EventoDecisao): string {
  // um tipo que o backend passou a mandar antes da tela conhecê-lo não pode virar "undefined"
  const acao = ACAO[tipo as keyof typeof ACAO] ?? "Decisão registrada";
  const quem = `${acao} por ${autor}${rodada > 1 ? ` (rodada ${rodada})` : ""}`;
  // o texto da justificada é o motivo; o da rejeitada é o motivo de ter rejeitado
  return (tipo === "justificada" || tipo === "justificativa_rejeitada") && texto ? `${quem}: ${texto}` : quem;
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
