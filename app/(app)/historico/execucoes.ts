import { mesPorExtenso, type Execucao } from "@/lib/adaptadores";
import type { StatusLinha, Tom } from "@/lib/mock-data";
import { rodadasDoBanco } from "@/lib/rodadas";
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

/**
 * Como uma execução fica na conciliação dela: a que vale (a atual da rodada mais recente),
 * a de uma rodada anterior (o extrato do sistema ganhou versão nova depois), ou substituída
 * (o mesmo par conciliado de novo depois; o backend só guarda o resultado mais novo).
 */
export type SituacaoNoHistorico = "vale" | "anterior" | "substituida";

export type ExecucaoDaConciliacao = { execucao: Execucao; rodada: number; situacao: SituacaoNoHistorico };

/** Um extrato do banco e as execuções dele nesta página do histórico. */
export type ConciliacaoNoHistorico = {
  extratoBancoId: string;
  arquivoBanco: string;
  /** O mês do extrato (AAAA-MM), o mesmo de Fechamentos; sem ele, o mês em que a que vale rodou. */
  competencia: string;
  /** Quantas rodadas a página mostra. */
  rodadas: number;
  /** A linha da conciliação: a que vale, ou, se a página a cortou, a mais recente que sobrou. */
  principal: ExecucaoDaConciliacao;
  /** Da mais recente para a mais antiga. */
  execucoes: ExecucaoDaConciliacao[];
};

/**
 * As execuções da página juntas por extrato do banco, como a comparação abre: uma conciliação
 * com as rodadas dela. Ordena pela data da que vale, que é a que a linha mostra. `competencias`
 * diz o mês do extrato de cada extrato do banco (`carregarHistorico`); quem não tem, cai no mês
 * em que a que vale rodou.
 *
 * ponytail: só enxerga a página. Uma conciliação com rodadas dos dois lados da quebra de página
 * aparece nas duas, cada uma com as rodadas que tem; o filtro `?extrato_banco_id=` proposto ao
 * backend (ver `acoes.ts`) resolveria isso aqui também.
 */
export function porConciliacao(
  execucoes: Execucao[],
  competencias: Record<string, string> = {},
): ConciliacaoNoHistorico[] {
  const bancos = [...new Set(execucoes.map((execucao) => execucao.extratoBancoId))];
  const conciliacoes = bancos.map((banco): ConciliacaoNoHistorico => {
    const rodadas = rodadasDoBanco(execucoes, banco);
    const ultima = rodadas.length;
    const doBanco = execucoes
      .filter((execucao) => execucao.extratoBancoId === banco)
      .map((execucao): ExecucaoDaConciliacao => {
        const rodada = rodadas.find((item) => item.extratoSistemaId === execucao.extratoSistemaId)!;
        const vale = rodada.execucao.id === execucao.id && execucao.atual;
        return {
          execucao,
          rodada: rodada.numero,
          situacao: !vale ? "substituida" : rodada.numero === ultima ? "vale" : "anterior",
        };
      });
    const principal = doBanco.find((item) => item.situacao === "vale") ?? doBanco[0];
    return {
      extratoBancoId: banco,
      arquivoBanco: doBanco[0].execucao.arquivoBanco,
      competencia: competencias[banco] ?? ANO_MES.format(new Date(principal.execucao.executadaEm)),
      rodadas: ultima,
      principal,
      execucoes: doBanco,
    };
  });
  // ISO ordena como texto; o sort é estável, então o empate fica na ordem da página
  return conciliacoes.sort((a, b) => b.principal.execucao.executadaEm.localeCompare(a.principal.execucao.executadaEm));
}

export type MesDoHistorico = { chave: string; titulo: string; conciliacoes: ConciliacaoNoHistorico[] };

/**
 * As conciliações agrupadas pelo mês do extrato, do mais recente para o mais antigo. Dentro do
 * mês seguem na ordem em que chegam: a que rodou por último antes.
 */
export function porMes(conciliacoes: ConciliacaoNoHistorico[]): MesDoHistorico[] {
  const meses = new Map<string, ConciliacaoNoHistorico[]>();
  for (const conciliacao of conciliacoes) {
    meses.set(conciliacao.competencia, [...(meses.get(conciliacao.competencia) ?? []), conciliacao]);
  }
  // AAAA-MM ordena como texto
  return [...meses]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([chave, doMes]) => ({ chave, titulo: mesPorExtenso(`${chave}-01`).replace("/", " de "), conciliacoes: doMes }));
}

export type AnoDoHistorico = { ano: string; meses: MesDoHistorico[] };

/** Os meses já vêm do mais recente para o mais antigo: cada troca de ano abre um grupo. */
export function porAno(meses: MesDoHistorico[]): AnoDoHistorico[] {
  const anos: AnoDoHistorico[] = [];
  for (const mes of meses) {
    const ano = mes.chave.slice(0, 4);
    const ultimo = anos.at(-1);
    if (ultimo?.ano === ano) ultimo.meses.push(mes);
    else anos.push({ ano, meses: [mes] });
  }
  return anos;
}

export type Segmento = { tom: Tom; quantidade: number; rotulo: string };

// a ordem da barra é a régua das cores: o que casou, o que custa dinheiro, o que
// está incompleto, o que já está explicado. Os nomes são os curtos do eixo da
// comparação (`rotuloCurto`), juntos por tom.
const TONS: Tom[] = ["ok", "risco", "atencao", "neutro"];
const ROTULO_DO_TOM: Record<Tom, string> = {
  ok: "Bate",
  risco: "Valor diverge, Duplicidade",
  atencao: "Data diverge, Falta",
  neutro: "Tarifa",
};

/** Os tons da barra, na ordem da régua, com os nomes da legenda. */
export const LEGENDA_DOS_TONS: { tom: Tom; rotulo: string }[] = TONS.map((tom) => ({ tom, rotulo: ROTULO_DO_TOM[tom] }));

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

/** Quantos lançamentos casaram sozinhos na execução. */
export function conciliados(execucao: Execucao): number {
  return segmentos(execucao).find((parte) => parte.tom === "ok")?.quantidade ?? 0;
}

/**
 * O que ainda pede revisão: diverge e ninguém justificou, a mesma regra de `pedeDecisao`.
 * A contagem do backend não diz a categoria da justificada, então ela desconta do total.
 */
export function paraRevisar(execucao: Execucao): number {
  return execucao.lancamentos - conciliados(execucao) - execucao.justificadas;
}
