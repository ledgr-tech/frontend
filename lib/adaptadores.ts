import { caminhoDaConciliacao } from "./caminhos";
import { rodadasDoBanco } from "./rodadas";
import type {
  CampoLancamento,
  Conciliacao,
  Decisao,
  EventoDecisao,
  LinhaComparacao,
  StatusLinha,
} from "./mock-data";

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
  /** A chave estável da linha, se o backend mandar; senão o adaptador monta a sua. */
  chave?: string;
  extrato_sistema_id: string;
  status: StatusLinha;
  regra_aplicada: string | null;
  score_confianca: string | null;
  lancamento_banco: LancamentoAPI | null;
  lancamento_sistema: LancamentoAPI | null;
  /**
   * ponytail: o porquê de cada linha, que o backend vai gerar junto com a conciliação
   * (backend#28). Ainda sem contrato: os nomes são os do `POST /explicacoes`
   * (`explicarDivergencia` em conciliacoes/acoes.ts). Se o backend chamar diferente, a
   * troca é aqui e em `adaptarLinha`. Texto puro: vem de descrição de extrato de
   * terceiro e nunca vira HTML.
   */
  explicacao?: string | null;
  gerada_por_ia?: boolean;
  /**
   * ponytail: decisões por linha, propostas ao backend na spec 2026-10-02 (mesmos
   * nomes de lá). A chave ausente quer dizer que o backend ainda não as guarda.
   */
  decisao?: Decisao | null;
  eventos?: EventoDecisao[];
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
    // ponytail: é o id do lançamento no banco de dados do Ledgr, não um código
    // do banco. Os 8 primeiros caracteres bastam para achar a linha no suporte;
    // inteiro, o UUID ocupava quatro linhas do cartão.
    { rotulo: "Identificador", valor: lancamento.id.slice(0, 8) },
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

/**
 * A linha em qualquer rodada: o extrato do banco é o mesmo em todas, então o
 * lançamento do banco a identifica. Sem ele, o lançamento do sistema é outro a cada
 * envio, e o que sobra é o conteúdo: data, valor e descrição, normalizados.
 */
function chaveBase(item: ItemConciliacaoAPI): string {
  if (item.lancamento_banco) return `b:${item.lancamento_banco.id}`;
  const sistema = item.lancamento_sistema;
  if (!sistema) return `i:${item.id}`;
  const valor = Number(sistema.valor);
  // sem descrição (o mesmo caso do "Sem descrição"), a chave fica com data e valor
  const descricao = (sistema.descricao ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return `s:${sistema.data}|${Number.isFinite(valor) ? valor.toFixed(2) : sistema.valor}|${descricao}`;
}

/** A descrição do extrato, ou "Sem descrição" quando ele não trouxe nenhuma. */
function semVazio(descricao: string | null | undefined): string {
  return descricao?.trim() || "Sem descrição";
}

export function adaptarLinha(item: ItemConciliacaoAPI): LinhaComparacao {
  // Banco é a fonte da verdade (a "regra de ouro" da tela de nova conciliação):
  // quando existe, é dele a descrição e a data mostradas.
  const referencia = item.lancamento_banco ?? item.lancamento_sistema;
  // a explicação que o backend gerou vale mais que a frase da regra; em branco é nenhuma
  const doBackend = item.explicacao?.trim() || null;
  return {
    id: item.id,
    chave: item.chave ?? chaveBase(item),
    // OFX sem MEMO chega com a descrição vazia: sem texto, a linha ficava sem ter onde clicar
    descricao: semVazio(referencia?.descricao),
    data: referencia ? paraDiaMes(referencia.data) : "",
    dataISO: referencia?.data,
    dataSistema: item.lancamento_sistema ? paraDiaMes(item.lancamento_sistema.data) : undefined,
    descricaoSistema: item.lancamento_sistema ? semVazio(item.lancamento_sistema.descricao) : undefined,
    valorBanco: paraNumero(item.lancamento_banco?.valor),
    valorSistema: paraNumero(item.lancamento_sistema?.valor),
    status: item.status,
    explicacao: doBackend ?? explicar(item),
    // só com `true` a tela marca como gerada por IA, como no POST /explicacoes
    explicacaoPorIa: doBackend !== null && item.gerada_por_ia === true,
    // só com a chave no item: sem ela, o backend não guarda decisões e a tela não oferece
    ...("decisao" in item ? { decisao: item.decisao ?? null } : {}),
    ...(item.eventos ? { eventos: item.eventos } : {}),
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
  // duas linhas só do sistema iguais teriam a mesma chave e dividiriam a decisão de
  // uma: a segunda vira "#2", a terceira "#3", na ordem em que o backend manda
  const vistas = new Map<string, number>();
  const linhas = lista.itens.map(adaptarLinha).map((linha) => {
    const chave = linha.chave ?? linha.id;
    const vezes = (vistas.get(chave) ?? 0) + 1;
    vistas.set(chave, vezes);
    return vezes === 1 ? linha : { ...linha, chave: `${chave}#${vezes}` };
  });
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
    /**
     * Das divergências, quantas estão justificadas (spec 2026-10-02-conciliacao-em-rodadas).
     * Proposta ao backend: ausente enquanto ele não guarda decisões.
     */
    justificadas?: number;
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
  /** Das divergências, quantas estão justificadas: liberam o fechamento sem contar como batidas. */
  justificadas: number;
};

/**
 * As cinco categorias de divergência do motor, na régua das cores de status: o
 * que custa dinheiro primeiro, o que já tem explicação por último. É a ordem
 * do relatório da conciliação.
 */
export const DIVERGENCIAS = [
  "divergente_valor",
  "duplicado",
  "divergente_data",
  "sem_correspondencia",
  "tarifa_bancaria",
] as const satisfies readonly StatusLinha[];

export type Divergencia = (typeof DIVERGENCIAS)[number];

/** Confere um texto de fora (a URL) antes de usá-lo como filtro. */
export function ehDivergencia(valor: string | null | undefined): valor is Divergencia {
  return (DIVERGENCIAS as readonly string[]).includes(valor ?? "");
}

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
    justificadas: item.contagens.justificadas ?? 0,
  };
}

/** Um arquivo enviado, visto pelas conciliações em que ele entrou. */
export type ArquivoConciliado = {
  id: string;
  nome: string;
  origem: "banco" | "sistema";
  /** ISO da rodada mais recente que usou o arquivo. */
  conciliadoEm: string;
  /**
   * Onde o arquivo abre: o extrato do banco, pelo endereço só dele (a rodada que vale); o do
   * sistema, na rodada em que entrou.
   */
  resultado: string;
  /** Só do extrato do sistema: a rodada da conciliação em que ele entrou, e quantas ela tem. */
  rodada?: { numero: number; total: number };
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
    const { extratoBancoId: banco, extratoSistemaId: sistema, executadaEm: conciliadoEm } = execucao;
    if (!vistos.has(banco)) {
      vistos.set(banco, {
        id: banco,
        nome: execucao.arquivoBanco,
        origem: "banco",
        conciliadoEm,
        resultado: caminhoDaConciliacao(banco),
      });
    }
    if (!vistos.has(sistema)) {
      const rodadas = rodadasDoBanco(execucoes, banco);
      const numero = rodadas.find((rodada) => rodada.extratoSistemaId === sistema)?.numero ?? rodadas.length;
      vistos.set(sistema, {
        id: sistema,
        nome: execucao.arquivoSistema,
        origem: "sistema",
        conciliadoEm,
        resultado: caminhoDaConciliacao(banco, sistema),
        rodada: { numero, total: rodadas.length },
      });
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
