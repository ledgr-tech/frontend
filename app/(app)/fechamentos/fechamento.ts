import type { Fechamento } from "@/lib/adaptadores";
import type { StatusLinha, Tom } from "@/lib/mock-data";
import type { ParDoFechamento } from "../conciliacoes/acoes";
import { seloDoStatus } from "../dashboard/resumo";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type Pendencia = { status: StatusLinha; rotulo: string; tom: Tom; quantidade: number };

/** Um mês na mesa de fechamento: todos os pares de extratos conciliados dele. */
export type MesDeFechamento = {
  /** "2026-09": identifica e ordena. */
  chave: string;
  /** "Setembro" e "2026", separados para a folha do mês e o nome do CSV. */
  nome: string;
  ano: string;
  /** "Setembro de 2026". */
  titulo: string;
  /** "outubro": o mês que o "Começar" abre. */
  proximo: string;
  /** Da conciliação mais recente para a mais antiga. */
  pares: ParDoFechamento[];
  lancamentos: number;
  conciliados: number;
  divergentes: number;
  /** Das divergências, as justificadas: decididas, mas não batidas. */
  justificadas: number;
  /** As divergências do mês por categoria do motor, da mais grave para a mais leve. */
  pendencias: Pendencia[];
  naoLidas: { nome: string; linhas: number }[];
  /** Toda divergência justificada e os arquivos lidos por inteiro. */
  pronto: boolean;
  /**
   * O registro mais recente de fechamento do mês: `fechado` é o mês fechado agora, `reaberto` foi
   * fechado e reaberto depois. Null quando nunca foi fechado.
   */
  fechamento: Fechamento | null;
};

// "2026-09" no fuso de Brasília: o servidor da Vercel roda em UTC, e uma
// conciliação de 30/09 à noite sairia como outubro
const ANO_MES = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

/**
 * O mês (AAAA-MM) de uma conciliação: o de `periodo_inicio` do extrato do BANCO, a regra com que o
 * backend fecha o mês (um extrato que cruza dois meses fica no mês em que começa). Sem período,
 * o mês em que foi conciliada, no fuso de São Paulo. É o mesmo mês em todas as telas.
 */
export function competencia(periodoInicio: string | null, executadaEm: string): string {
  return periodoInicio?.slice(0, 7) ?? ANO_MES.format(new Date(executadaEm));
}

function chaveDoPar(par: ParDoFechamento): string {
  return competencia(par.execucao.periodoInicio, par.execucao.executadaEm);
}

// a régua das cores de status: o que custa dinheiro antes, o já explicado por último
const GRAVIDADE: Record<Tom, number> = { risco: 0, atencao: 1, neutro: 2, ok: 3 };

/** "2026-09" → "Setembro": o nome do mês de uma competência, com a inicial maiúscula. */
function nomeDoMes(chave: string): string {
  const mes = chave.split("-")[1];
  const minusculo = MESES[Number(mes) - 1] ?? mes;
  return `${minusculo.charAt(0).toUpperCase()}${minusculo.slice(1)}`;
}

/** "2026-09" → "Setembro de 2026", como o fechamento e a galeria de extratos chamam o mês. */
export function tituloDaCompetencia(chave: string): string {
  return `${nomeDoMes(chave)} de ${chave.split("-")[0]}`;
}

function montarMes(chave: string, pares: ParDoFechamento[]): Omit<MesDeFechamento, "fechamento"> {
  const [ano, mes] = chave.split("-");
  const indice = Number(mes) - 1;
  const nome = nomeDoMes(chave);

  const quantidades = new Map<StatusLinha, number>();
  for (const { execucao } of pares) {
    for (const [status, quantidade] of Object.entries(execucao.divergencias) as [StatusLinha, number][]) {
      quantidades.set(status, (quantidades.get(status) ?? 0) + quantidade);
    }
  }
  const pendencias = [...quantidades]
    .map(([status, quantidade]) => ({ status, quantidade, ...seloDoStatus(status) }))
    .sort((a, b) => GRAVIDADE[a.tom] - GRAVIDADE[b.tom] || b.quantidade - a.quantidade);

  const lancamentos = pares.reduce((soma, par) => soma + par.execucao.lancamentos, 0);
  const divergentes = pendencias.reduce((soma, pendencia) => soma + pendencia.quantidade, 0);
  // a contagem do backend não diz a categoria da justificada: ela desconta do total, não de cada uma
  const justificadas = pares.reduce((soma, par) => soma + par.execucao.justificadas, 0);
  const naoLidas = pares.flatMap((par) => par.naoLidas);

  return {
    chave,
    nome,
    ano,
    titulo: tituloDaCompetencia(chave),
    proximo: MESES[(indice + 1) % 12] ?? "próximo mês",
    pares,
    lancamentos,
    conciliados: lancamentos - divergentes,
    divergentes,
    justificadas,
    pendencias,
    naoLidas,
    pronto: divergentes - justificadas === 0 && naoLidas.length === 0,
  };
}

/** Os pares agrupados por mês, do mais recente para o mais antigo. */
export function agruparPorMes(pares: ParDoFechamento[], fechamentos: Fechamento[] = []): MesDeFechamento[] {
  const porMes = new Map<string, ParDoFechamento[]>();
  for (const par of pares) {
    const chave = chaveDoPar(par);
    porMes.set(chave, [...(porMes.get(chave) ?? []), par]);
  }
  // a lista vem do fechamento mais recente para o mais antigo: o primeiro de cada mês é o que vale
  const atual = new Map<string, Fechamento>();
  for (const fechamento of fechamentos) {
    if (!atual.has(fechamento.competencia)) atual.set(fechamento.competencia, fechamento);
  }
  return [...porMes]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([chave, doMes]) => ({ ...montarMes(chave, doMes), fechamento: atual.get(chave) ?? null }));
}
