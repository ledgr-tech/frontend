import { mesPorExtenso, type Execucao } from "@/lib/adaptadores";
import type { StatusLinha, Tom } from "@/lib/mock-data";
import { rodadasDoBanco } from "@/lib/rodadas";
import { formatarPercentual, seloDoStatus } from "../dashboard/resumo";
import { competencia } from "../fechamentos/fechamento";

/** Quantos meses o gráfico da taxa de match mostra. */
const MESES_NO_GRAFICO = 6;

/** Um mês no gráfico: todas as conciliações do mês do extrato, somadas. */
export type PontoDoGrafico = {
  /** AAAA-MM, o mês do extrato. */
  chave: string;
  /** Percentual de 0 a 100: o que casou sozinho sobre o total de lançamentos do mês. */
  taxa: number;
  conciliados: number;
  lancamentos: number;
  conciliacoes: number;
};

/**
 * A taxa de match por mês do extrato, dos seis meses mais recentes, do mais antigo ao mais novo:
 * o tempo do gráfico corre da esquerda para a direita. O mês soma as conciliações dele (a taxa é
 * pesada pelos lançamentos, não a média das taxas), e é o de `competencia`: o do período do
 * extrato do banco, ou o mês em que rodou. `execucoes` são as que valem (`execucoesVigentes`).
 */
export function serieMensal(execucoes: Execucao[]): PontoDoGrafico[] {
  const meses = new Map<string, PontoDoGrafico>();
  for (const execucao of execucoes) {
    if (execucao.lancamentos === 0) continue;
    const chave = competencia(execucao.periodoInicio, execucao.executadaEm);
    const mes = meses.get(chave) ?? { chave, taxa: 0, conciliados: 0, lancamentos: 0, conciliacoes: 0 };
    mes.conciliados += conciliados(execucao);
    mes.lancamentos += execucao.lancamentos;
    mes.conciliacoes += 1;
    meses.set(chave, mes);
  }
  // AAAA-MM ordena como texto
  return [...meses.values()]
    .sort((a, b) => a.chave.localeCompare(b.chave))
    .slice(-MESES_NO_GRAFICO)
    .map((mes) => ({ ...mes, taxa: (mes.conciliados / mes.lancamentos) * 100 }));
}

const MES_ABREVIADO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "mai", "jun", "set/26": o mês abreviado, com o ano no último ponto de cada ano. */
export function rotulosDaSerie(serie: Pick<PontoDoGrafico, "chave">[]): string[] {
  return serie.map(({ chave }, indice) => {
    const [ano, mes] = chave.split("-");
    const nome = MES_ABREVIADO[Number(mes) - 1] ?? mes;
    const fechaOAno = serie[indice + 1]?.chave.slice(0, 4) !== ano;
    return fechaOAno ? `${nome}/${ano.slice(2)}` : nome;
  });
}

/**
 * A altura de cada ponto, de 0 (a base) a 1 (100%). O design parte de 90% para que 91% e 97% não
 * pareçam iguais; com taxa abaixo disso, a base desce de 10 em 10 até caber.
 */
export function alturasNoGrafico(taxas: number[]): number[] {
  const menor = Math.min(90, ...taxas);
  const base = Math.max(0, Math.floor(menor / 10) * 10);
  const faixa = 100 - base || 1;
  return taxas.map((taxa) => (taxa - base) / faixa);
}

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
  /** O mês da conciliação (AAAA-MM), o mesmo de Fechamentos: ver `competencia`. */
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
 * com as rodadas dela. Ordena pela data da que vale, que é a que a linha mostra. O mês é o do
 * período do extrato do banco, e sem ele o mês em que a que vale rodou (`competencia`).
 *
 * ponytail: só enxerga a página. Uma conciliação com rodadas dos dois lados da quebra de página
 * aparece nas duas, cada uma com as rodadas que tem. O backend já filtra por extrato do banco
 * (`?extrato_banco_id=`, que a comparação usa), mas aqui seria uma chamada por conciliação da
 * página: vale quando o histórico tiver extratos com muitas rodadas.
 */
export function porConciliacao(execucoes: Execucao[]): ConciliacaoNoHistorico[] {
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
      competencia: competencia(principal.execucao.periodoInicio, principal.execucao.executadaEm),
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
 * A taxa de match da execução, de 0 a 100, pelas contagens; null sem lançamento. Toda tela usa
 * esta, não o `acerto` do backend: ele chega arredondado em duas casas, e 12 de 22 (54,54%) viraria
 * 54,6% numa tela e 54,5% no gráfico, que soma as contagens.
 */
export function taxaDeMatch(execucao: Execucao): number | null {
  return execucao.lancamentos === 0 ? null : (conciliados(execucao) / execucao.lancamentos) * 100;
}

/** A taxa de match como as tabelas escrevem: "54,5%", ou "—" sem lançamento. */
export function matchNaTela(execucao: Execucao): string {
  const taxa = taxaDeMatch(execucao);
  return taxa === null ? "—" : formatarPercentual(taxa);
}

/**
 * O que ainda pede revisão: diverge e ninguém justificou, a mesma regra de `pedeDecisao`.
 * A contagem do backend não diz a categoria da justificada, então ela desconta do total.
 */
export function paraRevisar(execucao: Execucao): number {
  return execucao.lancamentos - conciliados(execucao) - execucao.justificadas;
}
