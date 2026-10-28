import { DIVERGENCIAS, type Divergencia } from "@/lib/adaptadores";
import { seloDoStatus } from "../../(app)/e/[empresa]/dashboard/resumo";
import { tituloDaCompetencia } from "../../(app)/e/[empresa]/fechamentos/fechamento";
import type { LinhaDoRelatorio, RelatorioDoFechamento } from "../../(app)/e/[empresa]/fechamentos/relatorio";
import { formatarCnpj } from "../../(auth)/cadastro/passos";

/** `POST /relatorios-publicos/consultar` (backend #175): só os campos da lista fechada do backend. */
type LinhaAPI = {
  data: string;
  descricao: string;
  valor_banco: string | null;
  valor_sistema: string | null;
  situacao: Divergencia;
  justificativa: string | null;
  justificada_por: string | null;
  justificada_em: string | null;
};

export type RelatorioPublicoAPI = {
  empresa: { razao_social: string; cnpj: string };
  competencia: string;
  situacao: "fechado" | "fechado_com_ressalva";
  fechado_em: string;
  fechado_por: string;
  ressalva: string | null;
  resumo: {
    total: number;
    conciliadas: number;
    justificadas: number;
    pendentes: number;
    linhas_nao_lidas: number;
    valor_em_aberto: string | number;
    categorias: Partial<Record<Divergencia, number>>;
  };
  pares: {
    arquivo_banco: string;
    arquivo_sistema: string;
    rodada: number;
    justificadas: LinhaAPI[];
    pendentes: LinhaAPI[];
    truncada: boolean;
  }[];
  link: { expira_em: string };
};

/** "2026-09-04" → "04/09/2026". */
function dataBr(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : iso;
}

const numero = (texto: string | null): number | null => (texto === null ? null : Number(texto));

function linha(item: LinhaAPI): LinhaDoRelatorio {
  return {
    data: dataBr(item.data),
    descricao: item.descricao,
    valorBanco: numero(item.valor_banco),
    valorSistema: numero(item.valor_sistema),
    status: seloDoStatus(item.situacao).rotulo,
    justificativa: item.justificativa,
    decididoPor: item.justificada_por,
    decididoEm: item.justificada_em,
  };
}

/** O relatório do link no mesmo formato do da página do app, para as duas folhas serem a mesma. */
export function adaptarRelatorioPublico(r: RelatorioPublicoAPI): RelatorioDoFechamento {
  return {
    competencia: r.competencia,
    titulo: tituloDaCompetencia(r.competencia),
    empresa: r.empresa.razao_social,
    cnpj: r.empresa.cnpj ? formatarCnpj(r.empresa.cnpj) : "",
    situacao: r.situacao === "fechado_com_ressalva" ? "Fechado com ressalva" : "Fechado",
    fechadoPor: r.fechado_por,
    fechadoEm: r.fechado_em,
    ressalva: r.ressalva,
    total: r.resumo.total,
    conciliadas: r.resumo.conciliadas,
    justificadas: r.resumo.justificadas,
    pendentes: r.resumo.pendentes,
    linhasNaoLidas: r.resumo.linhas_nao_lidas,
    valorEmAberto: Number(r.resumo.valor_em_aberto),
    categorias: DIVERGENCIAS.map((status) => ({
      status,
      rotulo: seloDoStatus(status).rotulo,
      quantidade: r.resumo.categorias[status] ?? 0,
    })),
    pares: r.pares.map((par) => ({
      arquivoBanco: par.arquivo_banco,
      arquivoSistema: par.arquivo_sistema,
      rodada: par.rodada,
      justificadas: par.justificadas.map(linha),
      pendentes: par.pendentes.map(linha),
      truncada: par.truncada,
    })),
  };
}
