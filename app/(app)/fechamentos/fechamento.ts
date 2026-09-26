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
  /** O que ainda pede decisão, do mais grave para o mais leve. */
  pendencias: Pendencia[];
  naoLidas: { nome: string; linhas: number }[];
  /** Nada pede decisão e os arquivos foram lidos por inteiro. */
  pronto: boolean;
};

// "2026-09" no fuso de Brasília: o servidor da Vercel roda em UTC, e uma
// conciliação de 30/09 à noite sairia como outubro
const ANO_MES = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
});

/**
 * O mês do par é o do extrato, pela primeira data dele. Sem ela (conciliação
 * vazia, ou a consulta falhou), cai no mês em que foi conciliado.
 */
function chaveDoPar(par: ParDoFechamento): string {
  return par.primeiraData?.slice(0, 7) ?? ANO_MES.format(new Date(par.execucao.executadaEm));
}

// a régua das cores de status: o que custa dinheiro antes, o já explicado por último
const GRAVIDADE: Record<Tom, number> = { risco: 0, atencao: 1, neutro: 2, ok: 3 };

function montarMes(chave: string, pares: ParDoFechamento[]): MesDeFechamento {
  const [ano, mes] = chave.split("-");
  const indice = Number(mes) - 1;
  const minusculo = MESES[indice] ?? mes;
  const nome = `${minusculo.charAt(0).toUpperCase()}${minusculo.slice(1)}`;

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
  const naoLidas = pares.flatMap((par) => par.naoLidas);

  return {
    chave,
    nome,
    ano,
    titulo: `${nome} de ${ano}`,
    proximo: MESES[(indice + 1) % 12] ?? "próximo mês",
    pares,
    lancamentos,
    conciliados: lancamentos - divergentes,
    divergentes,
    pendencias,
    naoLidas,
    pronto: divergentes === 0 && naoLidas.length === 0,
  };
}

/** Os pares agrupados por mês, do mais recente para o mais antigo. */
export function agruparPorMes(pares: ParDoFechamento[]): MesDeFechamento[] {
  const porMes = new Map<string, ParDoFechamento[]>();
  for (const par of pares) {
    const chave = chaveDoPar(par);
    porMes.set(chave, [...(porMes.get(chave) ?? []), par]);
  }
  return [...porMes]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([chave, doMes]) => montarMes(chave, doMes));
}
