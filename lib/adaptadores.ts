import { caminhoDaConciliacao } from "./caminhos";
import type { CampoLancamento, Conciliacao, LinhaComparacao, StatusLinha } from "./mock-data";

/**
 * Traduz o que `GET /conciliacoes/{extrato_id}` devolve para a forma que as
 * telas já usam. É adaptador, não modelo novo: a tabela, a ordenação, os filtros
 * e o detalhe continuam trabalhando em cima de `LinhaComparacao`.
 *
 * Função pura, sem `fetch` e sem `window` — é o pedaço que dá pra testar com o
 * JSON de exemplo do backend na mão.
 */

export type LancamentoAPI = {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  /** Decimal em string, de propósito: dinheiro não viaja como float. */
  valor: string;
  descricao: string;
  tipo: string;
};

export type ItemConciliacaoAPI = {
  id: string;
  extrato_sistema_id: string;
  status: StatusLinha;
  regra_aplicada: string | null;
  score_confianca: string | null;
  lancamento_banco: LancamentoAPI | null;
  lancamento_sistema: LancamentoAPI | null;
};

export type ListaConciliacaoAPI = {
  extrato_id: string;
  total: number;
  limit: number;
  offset: number;
  itens: ItemConciliacaoAPI[];
};

/** "2026-09-04" → "04/09", que é o formato da coluna no design. */
export function paraDiaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return dia && mes ? `${dia}/${mes}` : iso;
}

/**
 * String decimal → número.
 *
 * Converter é inevitável (a tela formata e compara números), mas só o valor de
 * uma linha passa por aqui. Soma de muitas linhas acontece em centavos, em
 * `resumo.ts`, que é onde o resíduo de float apareceria.
 */
function paraNumero(valor: string | null | undefined): number | null {
  if (valor === null || valor === undefined) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

function campos(lancamento: LancamentoAPI): CampoLancamento[] {
  return [
    { rotulo: "Data do lançamento", valor: lancamento.data.split("-").reverse().join("/") },
    { rotulo: "Tipo", valor: lancamento.tipo },
    { rotulo: "Identificador", valor: lancamento.id },
  ];
}

/**
 * A frase do porquê, montada do que o backend conta sobre o match.
 *
 * `regra_aplicada` e `score_confianca` só existem quando houve match; nas
 * outras cinco categorias o motor não pareia nada, e aí não há o que explicar
 * além do próprio rótulo do status.
 */
function explicar(item: ItemConciliacaoAPI): string | null {
  if (!item.regra_aplicada) return null;
  const score = paraNumero(item.score_confianca);
  const confianca = score === null ? "" : ` Confiança de ${Math.round(score * 100)}%.`;
  return `Conciliado pela regra "${item.regra_aplicada}".${confianca}`;
}

export function adaptarLinha(item: ItemConciliacaoAPI): LinhaComparacao {
  // Banco é a fonte da verdade (a "regra de ouro" da tela de nova conciliação):
  // quando existe, é dele a descrição e a data mostradas.
  const referencia = item.lancamento_banco ?? item.lancamento_sistema;
  return {
    id: item.id,
    descricao: referencia?.descricao ?? "Lançamento sem descrição",
    data: referencia ? paraDiaMes(referencia.data) : "",
    dataISO: referencia?.data,
    valorBanco: paraNumero(item.lancamento_banco?.valor),
    valorSistema: paraNumero(item.lancamento_sistema?.valor),
    status: item.status,
    explicacao: explicar(item),
    // O backend não guarda linha do tempo por lançamento; o histórico do detalhe
    // fica vazio até existir (nada de inventar evento que ninguém registrou).
    historico: [],
    camposBanco: item.lancamento_banco ? campos(item.lancamento_banco) : undefined,
    camposSistema: item.lancamento_sistema ? campos(item.lancamento_sistema) : undefined,
  };
}

/**
 * `extratoSistemaId` é o filtro que foi pedido ao backend, quando houve: a
 * resposta não o repete, e a tela precisa dele para os links das linhas.
 */
export function adaptarConciliacao(
  lista: ListaConciliacaoAPI,
  extratoSistemaId?: string,
): Conciliacao {
  const linhas = lista.itens.map(adaptarLinha);
  const primeira = linhas.find((linha) => linha.dataISO)?.dataISO;
  return {
    id: lista.extrato_id,
    extratoSistemaId,
    // A competência sai da primeira data que apareceu; o backend não tem campo
    // de mês, e o extrato é sempre de um período.
    mes: primeira ? mesPorExtenso(primeira) : "Conciliação",
    status: "em_andamento",
    linhas,
  };
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export function mesPorExtenso(iso: string): string {
  const [ano, mes] = iso.split("-");
  const nome = MESES[Number(mes) - 1];
  return nome ? `${nome}/${ano}` : iso;
}

/** Uma rodada de `POST /conciliacoes`, como `GET /execucoes` devolve. */
export type ExecucaoAPI = {
  id: string;
  extrato_banco_id: string;
  extrato_sistema_id: string;
  nome_arquivo_banco: string;
  nome_arquivo_sistema: string;
  /** ISO 8601 em UTC, com o sufixo explícito. */
  executada_em: string;
  tolerancia_dias: number;
  contagens: {
    total: number;
    match_exato: number;
    match_tolerancia: number;
    duplicado: number;
    sem_correspondencia: number;
    tarifa_bancaria: number;
    divergente_valor: number;
    divergente_data: number;
  };
  /** Decimal (0 a 100, duas casas) — o Pydantic manda como string. Null sem lançamentos. */
  percentual_acerto: string | number | null;
  /** Falso quando o mesmo par de extratos foi conciliado de novo depois. */
  atual: boolean;
};

export type ListaExecucoesAPI = {
  total: number;
  limit: number;
  offset: number;
  itens: ExecucaoAPI[];
};

export type Execucao = {
  id: string;
  /** Por onde se abre o resultado: `/conciliacoes/{extratoBancoId}`. */
  extratoBancoId: string;
  extratoSistemaId: string;
  arquivoBanco: string;
  arquivoSistema: string;
  executadaEm: string;
  lancamentos: number;
  /** Percentual de 0 a 100 — match exato mais match por tolerância. */
  acerto: number | null;
  /** Quantas linhas de cada divergência a rodada deixou, só as que têm alguma. */
  divergencias: Partial<Record<StatusLinha, number>>;
  /** A tolerância de data daquela rodada, em dias — não a configuração de hoje. */
  toleranciaDias: number;
  atual: boolean;
};

const DIVERGENCIAS = [
  "divergente_valor",
  "divergente_data",
  "duplicado",
  "sem_correspondencia",
  "tarifa_bancaria",
] as const;

export function adaptarExecucao(item: ExecucaoAPI): Execucao {
  return {
    id: item.id,
    extratoBancoId: item.extrato_banco_id,
    extratoSistemaId: item.extrato_sistema_id,
    arquivoBanco: item.nome_arquivo_banco,
    arquivoSistema: item.nome_arquivo_sistema,
    executadaEm: item.executada_em,
    lancamentos: item.contagens.total,
    acerto: item.percentual_acerto === null ? null : paraNumero(String(item.percentual_acerto)),
    divergencias: Object.fromEntries(
      DIVERGENCIAS.filter((status) => item.contagens[status] > 0).map((status) => [
        status,
        item.contagens[status],
      ]),
    ),
    toleranciaDias: item.tolerancia_dias,
    atual: item.atual,
  };
}

/** Um arquivo enviado, visto pelas conciliações em que ele entrou. */
export type ArquivoConciliado = {
  id: string;
  nome: string;
  origem: "banco" | "sistema";
  /** ISO da rodada mais recente que usou o arquivo. */
  conciliadoEm: string;
  /** O resultado daquela rodada: o par de extratos dela. */
  resultado: string;
};

/**
 * Os arquivos que aparecem nas execuções, cada um uma vez.
 *
 * ponytail: o backend não lista extratos (só tem `GET /extratos/{id}`), então a
 * tela de extratos parte das conciliações — extrato enviado e nunca conciliado
 * fica de fora. Quando existir `GET /extratos`, é ele que substitui isto.
 */
export function extratosDasExecucoes(execucoes: Execucao[]): ArquivoConciliado[] {
  const vistos = new Map<string, ArquivoConciliado>();
  // a lista chega da mais recente para a mais antiga: o primeiro uso é o último
  for (const execucao of execucoes) {
    const resultado = caminhoDaConciliacao(execucao.extratoBancoId, execucao.extratoSistemaId);
    const lados = [
      { id: execucao.extratoBancoId, nome: execucao.arquivoBanco, origem: "banco" as const },
      { id: execucao.extratoSistemaId, nome: execucao.arquivoSistema, origem: "sistema" as const },
    ];
    for (const lado of lados) {
      if (!vistos.has(lado.id)) {
        vistos.set(lado.id, { ...lado, conciliadoEm: execucao.executadaEm, resultado });
      }
    }
  }
  return [...vistos.values()];
}

/**
 * Id vindo do backend (UUID do extrato) ou do mock ("conc-1")?
 *
 * É o que decide de onde a tela carrega os dados. Some junto com o mock.
 */
export function pareceUuid(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}
