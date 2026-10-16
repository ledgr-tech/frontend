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

/**
 * O saldo do extrato (backend #118), em `GET /extratos`, `GET /extratos/{id}` e na raiz de
 * `GET /conciliacoes/{id}` (o do extrato do banco). Opcionais porque o backend de antes da #118 não
 * os manda: sem a chave, a tela não fala de saldo nenhum.
 */
export type CamposDeSaldoAPI = {
  /** Decimal em string; null sem saldo ou com linhas não lidas (a soma sairia incompleta). */
  saldo_inicial?: string | null;
  /** Decimal em string: o saldo que o arquivo informa. */
  saldo_final?: string | null;
  /** AAAA-MM-DD, a data desse saldo. */
  saldo_data?: string | null;
};

/** O saldo que o arquivo do banco informa. */
export type SaldoDoExtrato = {
  /** Em reais. Null quando o extrato tem linhas não lidas: o backend não calcula, e o front também não. */
  inicial: number | null;
  final: number;
  /** AAAA-MM-DD. */
  data: string;
};

/**
 * `undefined` quando o backend ainda não manda saldo (a tela não mostra nada); `null` quando o
 * arquivo não trouxe saldo, é antigo ou ainda processa (a tela diz que não foi informado).
 */
export function adaptarSaldo(api: CamposDeSaldoAPI): SaldoDoExtrato | null | undefined {
  if (!("saldo_final" in api)) return undefined;
  const final = paraNumero(api.saldo_final);
  if (final === null || !api.saldo_data) return null;
  return { inicial: paraNumero(api.saldo_inicial), final, data: api.saldo_data };
}

export type ListaConciliacaoAPI = CamposDeSaldoAPI & {
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

const TIPOS: Record<string, string> = { credito: "Crédito", debito: "Débito" };

function campos(lancamento: LancamentoAPI): CampoLancamento[] {
  // o id do lançamento é do banco de dados do Ledgr e não diz nada a quem concilia: saiu na
  // revisão de 15/10 (o suporte acha a linha pela data, valor e descrição)
  return [
    { rotulo: "Data do lançamento", valor: lancamento.data.split("-").reverse().join("/") },
    { rotulo: "Tipo", valor: TIPOS[lancamento.tipo] ?? lancamento.tipo },
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
  // o motor só pareia nos matches; as divergências esperam a explicação do backend
  if (item.status === "match_exato") return "Bateu: mesmo valor e mesma data nos dois extratos.";
  if (item.status !== "match_tolerancia" || !item.lancamento_banco || !item.lancamento_sistema) return null;
  const banco = item.lancamento_banco.data;
  const sistema = item.lancamento_sistema.data;
  const dias = Math.round(Math.abs(Date.parse(banco) - Date.parse(sistema)) / 86_400_000);
  return `Bateu com ${dias} ${dias === 1 ? "dia" : "dias"} de diferença (${paraDiaMes(banco)} no banco, ${paraDiaMes(sistema)} no sistema), dentro da tolerância da empresa.`;
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
  // A competência é o mês em que o extrato do BANCO começa, a regra com que o backend fecha o
  // mês (`periodo_inicio`, backend #82): a menor data dele, que está nas linhas, porque todo
  // lançamento do banco entra numa. Uma linha só do sistema mais antiga não muda o mês.
  const inicioDoBanco = lista.itens.reduce<string | null>((menor, item) => {
    const data = item.lancamento_banco?.data;
    return data && (menor === null || data < menor) ? data : menor;
  }, null);
  const saldo = adaptarSaldo(lista);
  return {
    id: lista.extrato_id,
    extratoSistemaId,
    mes: inicioDoBanco ? mesPorExtenso(inicioDoBanco) : "Conciliação",
    status: "em_andamento",
    linhas,
    ...(saldo !== undefined && { saldo }),
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
  /**
   * A primeira e a última data do extrato do BANCO, nunca do par (backend #82): AAAA-MM-DD, ou
   * null enquanto ele é processado ou quando não sobrou lançamento válido. Opcionais porque o
   * backend de antes da #82 não os manda.
   */
  periodo_inicio?: string | null;
  periodo_fim?: string | null;
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
  /**
   * A primeira data do extrato do banco (AAAA-MM-DD), a mesma em todas as rodadas dele: o mês
   * dela é o mês da conciliação, no fechamento do backend e em todas as telas. Null sem período.
   */
  periodoInicio: string | null;
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
    periodoInicio: item.periodo_inicio ?? null,
  };
}

/**
 * O resumo do mês gravado no momento do fechamento (backend #86): não muda depois, mesmo que o mês
 * seja reaberto. `contagens` traz as sete categorias e o `total`; `valor_em_aberto` é decimal em texto.
 */
export type ResumoFechamentoAPI = {
  pares: {
    extrato_banco_id: string;
    extrato_sistema_id: string;
    execucao_id: string;
    rodada: number;
    nome_arquivo_banco: string;
    nome_arquivo_sistema: string;
  }[];
  contagens: Record<StatusLinha | "total", number>;
  justificadas: number;
  pendentes: number;
  linhas_nao_lidas: number;
  valor_em_aberto: string;
};

export type ResumoDoFechamento = {
  pares: {
    extratoBancoId: string;
    extratoSistemaId: string;
    rodada: number;
    arquivoBanco: string;
    arquivoSistema: string;
  }[];
  contagens: Record<StatusLinha | "total", number>;
  justificadas: number;
  pendentes: number;
  linhasNaoLidas: number;
  /** Em reais. */
  valorEmAberto: number;
};

export function adaptarResumoDoFechamento(resumo: ResumoFechamentoAPI): ResumoDoFechamento {
  const valor = Number(resumo.valor_em_aberto);
  return {
    pares: resumo.pares.map((par) => ({
      extratoBancoId: par.extrato_banco_id,
      extratoSistemaId: par.extrato_sistema_id,
      rodada: par.rodada,
      arquivoBanco: par.nome_arquivo_banco,
      arquivoSistema: par.nome_arquivo_sistema,
    })),
    contagens: resumo.contagens,
    justificadas: resumo.justificadas,
    pendentes: resumo.pendentes,
    linhasNaoLidas: resumo.linhas_nao_lidas,
    valorEmAberto: Number.isFinite(valor) ? valor : 0,
  };
}

/**
 * Um fechamento de competência, como `/fechamentos` devolve (backend #86). Nada é apagado: reabrir
 * marca o registro como `reaberto`, e fechar de novo cria outro. O `resumo` congelado no fechamento
 * só o relatório do mês lê (`adaptarResumoDoFechamento`); a mesa mostra o mês como está agora.
 */
export type FechamentoAPI = {
  id: string;
  competencia: string;
  estado: "fechado" | "reaberto";
  ressalva: string | null;
  /** O nome de quem fechou, gravado no momento. */
  fechado_por: string;
  /** ISO 8601 em UTC. */
  fechado_em: string;
  reaberto_por: string | null;
  reaberto_em: string | null;
  resumo?: ResumoFechamentoAPI;
};

export type Fechamento = {
  /** AAAA-MM. */
  competencia: string;
  estado: "fechado" | "reaberto";
  ressalva: string | null;
  fechadoPor: string;
  fechadoEm: string;
  reabertoPor: string | null;
  reabertoEm: string | null;
};

export function adaptarFechamento(item: FechamentoAPI): Fechamento {
  return {
    competencia: item.competencia,
    estado: item.estado,
    ressalva: item.ressalva,
    fechadoPor: item.fechado_por,
    fechadoEm: item.fechado_em,
    reabertoPor: item.reaberto_por,
    reabertoEm: item.reaberto_em,
  };
}

/** Um extrato enviado, como `GET /extratos` lista (backend #70): do envio mais recente ao mais antigo. */
export type ItemExtratoAPI = CamposDeSaldoAPI & {
  extrato_id: string;
  nome_arquivo: string;
  origem: "banco" | "sistema";
  formato: string;
  status: "pendente" | "processando" | "concluido" | "concluido_com_erros" | "erro";
  /** Lançamentos válidos; null enquanto não processou. */
  quantidade_lancamentos: number | null;
  /** As linhas que o parser não leu; o motivo de cada uma só vem em `GET /extratos/{id}`. */
  linhas_nao_lidas: number;
  /** A primeira e a última data dos lançamentos (AAAA-MM-DD); null enquanto processa ou sem lançamento válido. */
  periodo_inicio: string | null;
  periodo_fim: string | null;
  /** ISO 8601 em UTC. */
  enviado_em: string;
  /** Já entrou em alguma conciliação, como extrato do banco ou do sistema. */
  conciliado: boolean;
};

export type ListaExtratosAPI = {
  total: number;
  limit: number;
  offset: number;
  itens: ItemExtratoAPI[];
};

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
 * Os arquivos que aparecem nas execuções, cada um uma vez: onde cada um abre e em que rodada
 * entrou, que `GET /extratos` não diz. A tela de extratos usa para ligar o arquivo à conciliação.
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

const DIA_EM_BRASILIA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** `dd/mm/aaaa` no fuso de Brasília: o backend manda as datas em UTC. */
export function formatarDia(iso: string): string {
  return DIA_EM_BRASILIA.format(new Date(iso));
}

/** Uma pessoa da empresa (`GET /empresa/usuarios`, backend #69). */
export type PessoaAPI = { id: string; nome: string; email: string; administrador: boolean; criado_em: string };
export type Pessoa = { id: string; nome: string; email: string; administrador: boolean };

export function adaptarPessoa(api: PessoaAPI): Pessoa {
  return { id: api.id, nome: api.nome, email: api.email, administrador: api.administrador };
}

/** Um convite pendente (`GET`/`POST /empresa/convites`). */
export type ConviteAPI = { id: string; email: string; criado_em: string; expira_em: string };
export type Convite = { id: string; email: string; enviadoEm: string; valeAte: string };

export function adaptarConvite(api: ConviteAPI): Convite {
  return { id: api.id, email: api.email, enviadoEm: formatarDia(api.criado_em), valeAte: formatarDia(api.expira_em) };
}

/** O que a página do convite mostra antes de pedir qualquer coisa (`POST /convites/consultar`). */
export type ConsultaConviteAPI = { email: string; razao_social: string; expira_em: string };
export type ConsultaConvite = { email: string; razaoSocial: string; valeAte: string };

export function adaptarConsultaConvite(api: ConsultaConviteAPI): ConsultaConvite {
  return { email: api.email, razaoSocial: api.razao_social, valeAte: formatarDia(api.expira_em) };
}
