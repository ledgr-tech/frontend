import { mesPorExtenso, type Execucao } from "@/lib/adaptadores";
import type { StatusLinha, Tom } from "@/lib/mock-data";
import { seloDoStatus } from "../dashboard/resumo";

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

// "2026-09" no fuso de Brasília: o servidor roda em UTC, e uma conciliação de
// 30/09 à noite cairia em outubro
const ANO_MES = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

export type MesDoHistorico = { chave: string; titulo: string; execucoes: Execucao[] };

/** As execuções agrupadas pelo mês em que rodaram, na ordem em que chegam. */
export function porMes(execucoes: Execucao[]): MesDoHistorico[] {
  const meses: MesDoHistorico[] = [];
  for (const execucao of execucoes) {
    const chave = ANO_MES.format(new Date(execucao.executadaEm));
    const atual = meses.at(-1);
    if (atual?.chave === chave) {
      atual.execucoes.push(execucao);
    } else {
      meses.push({ chave, titulo: mesPorExtenso(`${chave}-01`).replace("/", " de "), execucoes: [execucao] });
    }
  }
  return meses;
}

export type Segmento = { tom: Tom; quantidade: number; rotulo: string };

// a ordem da barra é a régua das cores: o que casou, o que custa dinheiro, o que
// está incompleto, o que já está explicado
const TONS: Tom[] = ["ok", "risco", "atencao", "neutro"];
const ROTULO_DO_TOM: Record<Tom, string> = {
  ok: "Conciliados",
  risco: "Custam dinheiro",
  atencao: "Incompletos",
  neutro: "Já explicados",
};

/** A execução em segmentos de uma barra, um por tom de status, só os que têm linha. */
export function segmentos(execucao: Execucao): Segmento[] {
  const porTom = new Map<Tom, number>();
  let divergentes = 0;
  for (const [status, quantidade] of Object.entries(execucao.divergencias) as [StatusLinha, number][]) {
    const { tom } = seloDoStatus(status);
    porTom.set(tom, (porTom.get(tom) ?? 0) + quantidade);
    divergentes += quantidade;
  }
  porTom.set("ok", execucao.lancamentos - divergentes);
  return TONS.filter((tom) => (porTom.get(tom) ?? 0) > 0).map((tom) => ({
    tom,
    quantidade: porTom.get(tom) ?? 0,
    rotulo: ROTULO_DO_TOM[tom],
  }));
}
