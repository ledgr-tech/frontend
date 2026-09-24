import type { Execucao } from "@/lib/adaptadores";

/** Quantas colunas o gráfico tem no CSS (`.hist-barras`). */
const BARRAS_NO_GRAFICO = 6;

// Altura útil da barra dentro dos 176px do gráfico, descontados o percentual
// em cima e a data embaixo.
const ALTURA_MINIMA = 12;
const ALTURA_MAXIMA = 116;

export type ExecucaoNoGrafico = Execucao & { acerto: number };

/**
 * As seis execuções mais recentes que têm percentual, da mais antiga para a
 * mais nova — a lista chega ao contrário, e o tempo do gráfico corre da
 * esquerda para a direita.
 */
export function paraGrafico(execucoes: Execucao[]): ExecucaoNoGrafico[] {
  return execucoes
    .filter((execucao): execucao is ExecucaoNoGrafico => execucao.acerto !== null)
    .slice(0, BARRAS_NO_GRAFICO)
    .reverse();
}

/**
 * Altura de cada barra em px. O design parte de 90% pra que 91% e 97% não
 * pareçam iguais; com acerto abaixo disso, a base desce de 10 em 10 até caber —
 * a escala do design dava altura negativa abaixo de 87,5%.
 */
export function alturasDasBarras(acertos: number[]): number[] {
  const menor = Math.min(90, ...acertos);
  const base = Math.max(0, Math.floor(menor / 10) * 10);
  const faixa = 100 - base || 1;
  return acertos.map((acerto) =>
    Math.round(ALTURA_MINIMA + ((acerto - base) / faixa) * (ALTURA_MAXIMA - ALTURA_MINIMA)),
  );
}

/** Pontos percentuais entre a barra mais nova e a mais antiga; null com uma barra só. */
export function variacaoEmPontos(grafico: ExecucaoNoGrafico[]): number | null {
  if (grafico.length < 2) return null;
  return grafico[grafico.length - 1].acerto - grafico[0].acerto;
}
