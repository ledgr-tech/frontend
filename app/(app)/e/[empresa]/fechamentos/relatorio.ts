import { DIVERGENCIAS, type Divergencia, type Fechamento, type ResumoDoFechamento } from "@/lib/adaptadores";
import type { Conciliacao, LinhaComparacao } from "@/lib/mock-data";
import { estaResolvida, pedeDecisao, rotuloCurto, seloDoStatus } from "../dashboard/resumo";
import { formatarCnpj } from "../../../../(auth)/cadastro/passos";
import { tituloDaCompetencia } from "./fechamento";

/**
 * O relatório do fechamento do mês (#117), o "Relatório em PDF" do "Entregar o fechamento" do
 * design: o documento que o contador arquiva. Os números são os do resumo congelado no fechamento
 * (`GET /fechamentos`); as linhas, as da conciliação de cada par, que não mudam com o mês fechado
 * (o backend recusa decidir ou conciliar de novo com 409).
 */

export type LinhaDoRelatorio = {
  /** "04/09/2026". */
  data: string;
  descricao: string;
  valorBanco: number | null;
  valorSistema: number | null;
  /** "Valor diverge", "Falta no sistema". */
  status: string;
  justificativa: string | null;
  decididoPor: string | null;
  /** ISO 8601. */
  decididoEm: string | null;
};

export type ParDoRelatorio = {
  arquivoBanco: string;
  arquivoSistema: string;
  rodada: number;
  /** Null quando a conciliação do par não carregou: o par aparece, sem as linhas. */
  justificadas: LinhaDoRelatorio[] | null;
  /** As divergências sem justificativa, que a ressalva explica. */
  pendentes: LinhaDoRelatorio[] | null;
  /** O backend não mandou todas as linhas: o relatório avisa que a lista está incompleta. */
  truncada: boolean;
};

export type RelatorioDoFechamento = {
  competencia: string;
  /** "Setembro de 2026". */
  titulo: string;
  /** Vazios quando o `GET /me` falhou. */
  empresa: string;
  cnpj: string;
  situacao: "Fechado" | "Fechado com ressalva";
  fechadoPor: string;
  fechadoEm: string;
  ressalva: string | null;
  total: number;
  conciliadas: number;
  justificadas: number;
  pendentes: number;
  linhasNaoLidas: number;
  valorEmAberto: number;
  /** As cinco categorias de divergência, sempre todas e na mesma ordem: num relatório, o zero informa. */
  categorias: { status: Divergencia; rotulo: string; quantidade: number }[];
  pares: ParDoRelatorio[];
};

/** O que a action conseguiu ler de cada par do resumo, na mesma ordem. Null: não carregou. */
export type ConciliacaoDoPar = { conciliacao: Conciliacao; truncada: boolean } | null;

/** "2026-09-04" → "04/09/2026"; sem a data completa, o "04/09" da tabela. */
function dataCompleta(linha: LinhaComparacao): string {
  const [ano, mes, dia] = linha.dataISO?.split("-") ?? [];
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : linha.data;
}

function paraRelatorio(linha: LinhaComparacao): LinhaDoRelatorio {
  const decisao = linha.decisao?.tipo === "justificada" ? linha.decisao : null;
  return {
    data: dataCompleta(linha),
    // a linha que só existe no sistema não tem descrição do banco
    descricao: linha.valorBanco === null ? (linha.descricaoSistema ?? linha.descricao) : linha.descricao,
    valorBanco: linha.valorBanco,
    valorSistema: linha.valorSistema,
    status: rotuloCurto(linha),
    justificativa: decisao?.texto ?? null,
    decididoPor: decisao?.autor ?? null,
    decididoEm: decisao?.em ?? null,
  };
}

export function montarRelatorio({
  fechamento,
  resumo,
  empresa,
  conciliacoes,
}: {
  fechamento: Fechamento;
  resumo: ResumoDoFechamento;
  empresa: { razaoSocial: string; cnpj: string };
  conciliacoes: ConciliacaoDoPar[];
}): RelatorioDoFechamento {
  const { contagens } = resumo;
  return {
    competencia: fechamento.competencia,
    titulo: tituloDaCompetencia(fechamento.competencia),
    empresa: empresa.razaoSocial,
    cnpj: empresa.cnpj ? formatarCnpj(empresa.cnpj) : "",
    situacao: fechamento.ressalva ? "Fechado com ressalva" : "Fechado",
    fechadoPor: fechamento.fechadoPor,
    fechadoEm: fechamento.fechadoEm,
    ressalva: fechamento.ressalva,
    total: contagens.total ?? 0,
    conciliadas: (contagens.match_exato ?? 0) + (contagens.match_tolerancia ?? 0),
    justificadas: resumo.justificadas,
    pendentes: resumo.pendentes,
    linhasNaoLidas: resumo.linhasNaoLidas,
    valorEmAberto: resumo.valorEmAberto,
    categorias: DIVERGENCIAS.map((status) => ({
      status,
      rotulo: seloDoStatus(status).rotulo,
      quantidade: contagens[status] ?? 0,
    })),
    pares: resumo.pares.map((par, indice) => {
      const lida = conciliacoes[indice] ?? null;
      const linhas = lida?.conciliacao.linhas ?? null;
      return {
        arquivoBanco: par.arquivoBanco,
        arquivoSistema: par.arquivoSistema,
        rodada: par.rodada,
        justificadas:
          linhas
            ?.filter((linha) => !estaResolvida(linha.status) && linha.decisao?.tipo === "justificada")
            .map(paraRelatorio) ?? null,
        pendentes: linhas?.filter(pedeDecisao).map(paraRelatorio) ?? null,
        truncada: lida?.truncada ?? false,
      };
    }),
  };
}
