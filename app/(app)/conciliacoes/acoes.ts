"use server";

import {
  adaptarConciliacao,
  adaptarExecucao,
  adaptarFechamento,
  extratosDasExecucoes,
  pareceUuid,
  type ArquivoConciliado,
  type Execucao,
  type Fechamento,
  type FechamentoAPI,
  type ItemExtratoAPI,
  type ListaConciliacaoAPI,
  type ListaExecucoesAPI,
  type ListaExtratosAPI,
} from "@/lib/adaptadores";
import { chamarBackend, ErroBackend } from "@/lib/backend";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { compararRodadas, execucoesVigentes, rodadasDoBanco, type Mudancas } from "@/lib/rodadas";
import type { Conciliacao, Decisao, TipoEvento } from "@/lib/mock-data";
import { conciliados, porConciliacao } from "../historico/execucoes";
import { ordemDeTrabalho, pedemDecisao, type ConciliacaoNaLista } from "../dashboard/lista";
import { estaResolvida, pedeDecisao } from "../dashboard/resumo";
import { decisoesLigadas, situacaoDaLinha } from "./[id]/situacao";

/**
 * O fluxo real de conciliação, ponta a ponta, contra a API do backend:
 * sobe os dois extratos → acompanha o processamento → manda conciliar → lê o
 * resultado.
 *
 * São Server Actions porque o `Authorization: Bearer` precisa ser montado no
 * servidor (ver `lib/backend.ts`). O componente de tela chama estas funções
 * como chamaria qualquer outra.
 */

export type Falha = { ok: false; erro: string; status: number };
export type Resultado<T> = { ok: true; dados: T } | Falha;

/** Status do processamento assíncrono do extrato (`normalizar_extrato`). */
export type SituacaoExtrato = {
  extrato_id: string;
  status: "pendente" | "processando" | "concluido" | "concluido_com_erros" | "erro";
  origem: "banco" | "sistema";
  quantidade_lancamentos: number | null;
  erros: { identificador: string; motivo: string }[];
};

/** O `total` é a soma das sete categorias. */
export type ContagensConciliacao = {
  extrato_banco_id: string;
  extrato_sistema_id: string;
  total: number;
  match_exato: number;
  match_tolerancia: number;
  duplicado: number;
  sem_correspondencia: number;
  tarifa_bancaria: number;
  divergente_valor: number;
  divergente_data: number;
};

/** Só o 401 e o 429 precisam de texto nosso; o resto o FastAPI já explica bem. */
function traduzir(erro: unknown): Falha {
  if (erro instanceof ErroBackend) {
    if (erro.status === 401) {
      return { ok: false, status: 401, erro: "Sua sessão expirou. Entre de novo para continuar." };
    }
    if (erro.status === 429) {
      // limite de 10 req/min por IP no upload — mensagem específica, não "erro
      // inesperado", porque a ação certa é simplesmente esperar
      return {
        ok: false,
        status: 429,
        erro: "Muitos envios seguidos. Espere um minuto e tente de novo.",
      };
    }
    return { ok: false, status: erro.status, erro: erro.detalhe };
  }
  // o prazo do lib/backend estourou: o servidor aceitou a conexão e não respondeu a tempo
  if (erro instanceof DOMException && erro.name === "TimeoutError") {
    return { ok: false, status: 504, erro: "O servidor demorou para responder. Tente de novo em instantes." };
  }
  // fetch que nem chegou a sair (backend fora do ar, DNS, CORS de rede)
  return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
}

/** O 404 de uma linha que a tela ainda mostra: o par foi conciliado de novo depois que ela abriu. */
const LINHA_MUDOU = "Esta linha mudou: a conciliação foi refeita depois que a tela abriu.";

// O upload sobe o arquivo inteiro e a conciliação roda o motor sobre milhares de linhas: os
// dois passam dos 30 s do padrão do lib/backend num extrato grande ou numa rede lenta.
const PRAZO_DO_PROCESSAMENTO_MS = 120_000;

export async function enviarExtrato(dados: FormData): Promise<Resultado<{ extratoId: string }>> {
  try {
    const resposta = await chamarBackend<{ extrato_id: string; status: string }>(
      "/extratos/upload",
      { method: "POST", corpo: dados, signal: AbortSignal.timeout(PRAZO_DO_PROCESSAMENTO_MS) },
    );
    return { ok: true, dados: { extratoId: resposta.extrato_id } };
  } catch (erro) {
    return traduzir(erro);
  }
}

export async function situacaoDoExtrato(
  extratoId: string,
): Promise<Resultado<SituacaoExtrato>> {
  // Server Action é endpoint público: o id vai no caminho da chamada ao backend,
  // com o token da sessão, e não entra lá sem ter formato de id
  if (!pareceUuid(extratoId)) return { ok: false, status: 404, erro: "Extrato não encontrado." };
  try {
    return { ok: true, dados: await chamarBackend<SituacaoExtrato>(`/extratos/${extratoId}`) };
  } catch (erro) {
    return traduzir(erro);
  }
}

export async function conciliar(
  extratoBancoId: string,
  extratoSistemaId: string,
): Promise<Resultado<ContagensConciliacao>> {
  try {
    const dados = await chamarBackend<ContagensConciliacao>("/conciliacoes", {
      method: "POST",
      corpo: { extrato_banco_id: extratoBancoId, extrato_sistema_id: extratoSistemaId },
      signal: AbortSignal.timeout(PRAZO_DO_PROCESSAMENTO_MS),
    });
    return { ok: true, dados };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Teto do backend por requisição. */
const POR_REQUISICAO = 1000;
// ponytail: teto de segurança. A tela ordena e filtra a lista inteira no
// cliente, então ela precisa estar inteira aqui — mas uma conciliação de 100 mil
// linhas não deve virar 100 requisições em sequência. Quando houver extrato
// desse tamanho, a ordenação passa pro servidor (o endpoint já aceita
// limit/offset/status) e este laço some.
const MAXIMO_DE_PAGINAS = 10;

/**
 * As linhas de uma conciliação. Com `extratoSistemaId`, só as do par; sem ele,
 * as de todos os pares em que o extrato do banco entrou — que é o que um link
 * antigo, de antes do par ir para a URL, ainda pede.
 */
export async function carregarConciliacao(
  extratoBancoId: string,
  extratoSistemaId?: string,
): Promise<Resultado<{ conciliacao: Conciliacao; truncada: boolean }>> {
  // os dois vêm da URL e vão para o caminho e a query do backend: não entram lá
  // sem ter formato de id
  if (!pareceUuid(extratoBancoId) || (extratoSistemaId !== undefined && !pareceUuid(extratoSistemaId))) {
    return { ok: false, status: 404, erro: "Conciliação não encontrada." };
  }
  const par = extratoSistemaId ? `&extrato_sistema_id=${extratoSistemaId}` : "";
  const pagina = (numero: number) =>
    `/conciliacoes/${extratoBancoId}?limit=${POR_REQUISICAO}&offset=${numero * POR_REQUISICAO}${par}`;

  try {
    const primeira = await chamarBackend<ListaConciliacaoAPI>(pagina(0));
    const itens = [...primeira.itens];
    let paginas = 1;
    while (itens.length < primeira.total && paginas < MAXIMO_DE_PAGINAS) {
      const proxima = await chamarBackend<ListaConciliacaoAPI>(pagina(paginas));
      if (proxima.itens.length === 0) break;
      itens.push(...proxima.itens);
      paginas += 1;
    }

    return {
      ok: true,
      dados: {
        conciliacao: adaptarConciliacao({ ...primeira, itens }, extratoSistemaId),
        truncada: itens.length < primeira.total,
      },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** A rodada que a tela mostra, e quantas o extrato do banco tem. */
export type RodadaVista = {
  numero: number;
  total: number;
  extratoSistemaId: string;
  arquivoSistema: string;
  executadaEm: string;
  /** O início do período do extrato do banco, o mesmo em todas as rodadas: dá o mês dela. */
  periodoInicio: string | null;
};

export type ConciliacaoEmRodadas = {
  conciliacao: Conciliacao;
  truncada: boolean;
  /** Null quando o extrato não aparece nas execuções lidas: a tela abre como antes. */
  rodada: RodadaVista | null;
  /** Todas as rodadas do extrato do banco, da primeira à mais recente; vazia sem rodada. */
  rodadas: RodadaVista[];
  /** O que mudou desde a rodada anterior; só na mais recente, a partir da segunda. */
  mudancas: Mudancas | null;
  /**
   * O fechamento ativo do mês da conciliação (o do extrato do banco): com ele, o backend recusa
   * conciliar e decidir (409) até reabrir. Null com o mês aberto, sem período ou sem resposta.
   */
  fechamento: Fechamento | null;
};

// O teto do backend por página de /execucoes. Um extrato do banco com mais de 100 rodadas
// vira outra página, até o mesmo teto de páginas das linhas.
const RODADAS_POR_PAGINA = 100;

/** Todas as execuções de um extrato do banco, pelo filtro `?extrato_banco_id=` (backend #82). */
async function execucoesDoBanco(extratoBancoId: string): Promise<Resultado<Execucao[]>> {
  const pagina = (numero: number) =>
    `/execucoes?extrato_banco_id=${extratoBancoId}&limit=${RODADAS_POR_PAGINA}&offset=${numero * RODADAS_POR_PAGINA}`;
  try {
    const primeira = await chamarBackend<ListaExecucoesAPI>(pagina(0));
    const itens = [...primeira.itens];
    for (let numero = 1; itens.length < primeira.total && numero < MAXIMO_DE_PAGINAS; numero += 1) {
      const proxima = await chamarBackend<ListaExecucoesAPI>(pagina(numero));
      if (proxima.itens.length === 0) break;
      itens.push(...proxima.itens);
    }
    return { ok: true, dados: itens.map(adaptarExecucao) };
  } catch (erro) {
    return traduzir(erro);
  }
}

/**
 * A conciliação de um extrato do banco numa rodada: a pedida em `extratoSistemaId`,
 * ou a mais recente. Na mais recente, a partir da segunda, também o que mudou desde
 * a anterior (spec 2026-10-02-conciliacao-em-rodadas). Sem as execuções do extrato,
 * cai na carga de antes, sem rodada, em vez de dizer que a conciliação não existe.
 */
export async function carregarConciliacaoEmRodadas(
  extratoBancoId: string,
  extratoSistemaId?: string,
): Promise<Resultado<ConciliacaoEmRodadas>> {
  if (!pareceUuid(extratoBancoId) || (extratoSistemaId !== undefined && !pareceUuid(extratoSistemaId))) {
    return { ok: false, status: 404, erro: "Conciliação não encontrada." };
  }

  const execucoes = await execucoesDoBanco(extratoBancoId);
  // `rodadasDoBanco` filtra de novo: um backend de antes da #82 ignora o filtro e manda todas
  const rodadas = execucoes.ok ? rodadasDoBanco(execucoes.dados, extratoBancoId) : [];
  const alvo = extratoSistemaId
    ? rodadas.find((rodada) => rodada.extratoSistemaId === extratoSistemaId)
    : rodadas.at(-1);

  if (!alvo) {
    const simples = await carregarConciliacao(extratoBancoId, extratoSistemaId);
    return simples.ok
      ? { ok: true, dados: { ...simples.dados, rodada: null, rodadas: [], mudancas: null, fechamento: null } }
      : simples;
  }

  const [atual, fechamento] = await Promise.all([
    carregarConciliacao(extratoBancoId, alvo.extratoSistemaId),
    fechamentoAtivo(alvo.execucao.periodoInicio),
  ]);
  if (!atual.ok) return atual;

  const vistas: RodadaVista[] = rodadas.map((item) => ({
    numero: item.numero,
    total: rodadas.length,
    extratoSistemaId: item.extratoSistemaId,
    arquivoSistema: item.arquivoSistema,
    executadaEm: item.execucao.executadaEm,
    periodoInicio: item.execucao.periodoInicio,
  }));
  const rodada = vistas[alvo.numero - 1];

  // a comparação é um extra: se a anterior não vier inteira, a tela abre sem ela
  let mudancas: Mudancas | null = null;
  if (alvo.numero === rodadas.length && alvo.numero > 1 && !atual.dados.truncada) {
    const anterior = await carregarConciliacao(extratoBancoId, rodadas[alvo.numero - 2].extratoSistemaId);
    if (anterior.ok && !anterior.dados.truncada) {
      mudancas = compararRodadas(anterior.dados.conciliacao.linhas, atual.dados.conciliacao.linhas);
    }
  }

  return {
    ok: true,
    dados: {
      ...atual.dados,
      conciliacao: { ...atual.dados.conciliacao, rodada: alvo.numero },
      rodada,
      rodadas: vistas,
      mudancas,
      fechamento,
    },
  };
}

/**
 * O fechamento em vigor no mês que começa em `periodoInicio`: o mais recente da competência, se
 * ainda está fechado. Sem período não há competência; sem resposta, a tela abre como aberta e o
 * backend ainda recusa a escrita com o 409, que ela mostra.
 */
async function fechamentoAtivo(periodoInicio: string | null): Promise<Fechamento | null> {
  if (!periodoInicio) return null;
  try {
    const lista = await chamarBackend<{ itens: FechamentoAPI[] }>(`/fechamentos?competencia=${periodoInicio.slice(0, 7)}`);
    const [maisRecente] = lista.itens;
    return maisRecente?.estado === "fechado" ? adaptarFechamento(maisRecente) : null;
  } catch {
    return null;
  }
}

// 50 por página (o backend aceita até 100). As telas que resumem — visão geral,
// fechamentos, extratos — leem só a primeira; o histórico pagina.
const EXECUCOES_POR_PAGINA = 50;

export type ListaExecucoes = {
  execucoes: Execucao[];
  total: number;
  /** Quantas vêm por página, para a tela saber quantas páginas há. */
  porPagina: number;
};

/** Mais recente primeiro, incluindo as rodadas que foram refeitas depois. */
export async function listarExecucoes(pagina = 0): Promise<Resultado<ListaExecucoes>> {
  // Server Action é endpoint público: a página vira offset na URL do backend,
  // então só entra inteiro não negativo
  const offset = Number.isSafeInteger(pagina) && pagina > 0 ? pagina * EXECUCOES_POR_PAGINA : 0;
  try {
    const lista = await chamarBackend<ListaExecucoesAPI>(
      `/execucoes?limit=${EXECUCOES_POR_PAGINA}&offset=${offset}`,
    );
    return {
      ok: true,
      dados: {
        execucoes: lista.itens.map(adaptarExecucao),
        total: lista.total,
        porPagina: EXECUCOES_POR_PAGINA,
      },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}

export type ListaDeConciliacoes = {
  /** Cada extrato do banco uma vez, na rodada que vale, na ordem da página. */
  conciliacoes: ConciliacaoNaLista[];
  /**
   * A primeira da fila que ainda pede decisão, contada pelas linhas dela: batem, pedem decisão,
   * justificadas e conferidas (null quando o backend não guarda decisões). Null sem nenhuma aberta.
   */
  emAndamento: {
    extratoBancoId: string;
    batem: number;
    pedemDecisao: number;
    justificadas: number;
    conferidas: number | null;
  } | null;
  /** O backend tem mais execuções que a primeira página, a única que a lista enxerga. */
  parcial: boolean;
};

/**
 * A tela Conciliações como lista de trabalho (spec 2026-10-02-conciliacao-em-rodadas): cada
 * extrato do banco na rodada que vale, com o mês do extrato, e as linhas da primeira da fila que
 * ainda pede decisão, que `/execucoes` não conta (ele não sabe das conferidas).
 *
 * ponytail: só a primeira página de `/execucoes`.
 */
export async function carregarConciliacoes(): Promise<Resultado<ListaDeConciliacoes>> {
  const lista = await listarExecucoes();
  if (!lista.ok) return lista;
  const { execucoes, total } = lista.dados;
  const parcial = total > execucoes.length;

  const conciliacoes = porConciliacao(execucoes)
    .filter(({ principal }) => principal.situacao === "vale")
    .map(({ extratoBancoId, arquivoBanco, competencia: mes, rodadas, principal: { execucao, rodada } }) => ({
      extratoBancoId,
      extratoSistemaId: execucao.extratoSistemaId,
      arquivoBanco,
      arquivoSistema: execucao.arquivoSistema,
      competencia: mes,
      rodada,
      rodadas,
      execucao,
    }));

  const [primeira] = ordemDeTrabalho(conciliacoes);
  if (!primeira || pedemDecisao(primeira) === 0) {
    return { ok: true, dados: { conciliacoes, emAndamento: null, parcial } };
  }
  const aberta = await carregarConciliacao(primeira.extratoBancoId, primeira.extratoSistemaId);
  // sem as linhas, a lista ainda serve: o cartão conta pelo que `/execucoes` sabe
  const emAndamento = aberta.ok
    ? contarDecisoes(primeira, aberta.dados.conciliacao)
    : {
        extratoBancoId: primeira.extratoBancoId,
        batem: conciliados(primeira.execucao),
        pedemDecisao: pedemDecisao(primeira),
        justificadas: primeira.execucao.justificadas,
        conferidas: null,
      };
  return { ok: true, dados: { conciliacoes, emAndamento, parcial } };
}

/** O que já foi decidido na conciliação aberta, contado pelas linhas dela. */
function contarDecisoes(
  conciliacao: ConciliacaoNaLista,
  aberta: Conciliacao,
): NonNullable<ListaDeConciliacoes["emAndamento"]> {
  const { linhas } = aberta;
  return {
    extratoBancoId: conciliacao.extratoBancoId,
    batem: linhas.filter((linha) => estaResolvida(linha.status)).length,
    pedemDecisao: linhas.filter(pedeDecisao).length,
    justificadas: linhas.filter((linha) => linha.decisao?.tipo === "justificada").length,
    // sem o campo `decisao` nas linhas, o backend não guarda conferência: não há o que contar
    conferidas: decisoesLigadas(aberta, true)
      ? linhas.filter((linha) => situacaoDaLinha(linha, conciliacao.rodada) === "conferida").length
      : null,
  };
}

/**
 * A tolerância de data da conciliação mais recente, em dias: é a configuração
 * que o motor usou por último. Null sem conciliação ou sem resposta. A janela de
 * configurações só a usa com o backend sem `GET /empresa/configuracoes`
 * (`carregarRegras` responde 404), para mostrar a regra como estava.
 */
export async function toleranciaDaUltimaConciliacao(): Promise<number | null> {
  try {
    const lista = await chamarBackend<ListaExecucoesAPI>("/execucoes?limit=1&offset=0");
    return lista.itens[0]?.tolerancia_dias ?? null;
  } catch {
    return null;
  }
}

/**
 * As regras do motor que a empresa ajusta (backend #85). Só a tolerância em dias: a de valor e a
 * semelhança mínima ficaram fora (ADR-006 e ADR-008), e o backend recusa mandá-las.
 */
export type RegrasDaEmpresa = {
  /** A tolerância que a próxima conciliação vai usar, em dias corridos. */
  toleranciaDias: number;
  /** O maior valor que o backend aceita; a tela não fixa o limite. */
  toleranciaDiasMaximo: number;
  /** Quem mudou por último e quando (ISO em UTC); null antes da primeira mudança. */
  atualizadoPor: string | null;
  atualizadoEm: string | null;
};

type ConfiguracoesAPI = {
  tolerancia_dias: number;
  tolerancia_dias_maximo: number;
  atualizado_por: string | null;
  atualizado_em: string | null;
};

function adaptarRegras(configuracoes: ConfiguracoesAPI): RegrasDaEmpresa {
  return {
    toleranciaDias: configuracoes.tolerancia_dias,
    toleranciaDiasMaximo: configuracoes.tolerancia_dias_maximo,
    atualizadoPor: configuracoes.atualizado_por,
    atualizadoEm: configuracoes.atualizado_em,
  };
}

/** `GET /empresa/configuracoes`. O 404 é o backend sem a rota: a janela mostra a regra como estava. */
export async function carregarRegras(): Promise<Resultado<RegrasDaEmpresa>> {
  try {
    return { ok: true, dados: adaptarRegras(await chamarBackend<ConfiguracoesAPI>("/empresa/configuracoes")) };
  } catch (erro) {
    return traduzir(erro);
  }
}

/**
 * `PUT /empresa/configuracoes`, só com a tolerância em dias. Vale a partir da próxima conciliação:
 * as que já rodaram ficam com a de quando rodaram (`tolerancia_dias` de cada execução). Acima do
 * máximo, o backend responde 422.
 */
export async function salvarToleranciaDias(dias: number): Promise<Resultado<RegrasDaEmpresa>> {
  // Server Action é endpoint público: só dia inteiro, não negativo, chega ao backend
  if (!Number.isSafeInteger(dias) || dias < 0) {
    return { ok: false, status: 422, erro: "A tolerância é um número inteiro de dias." };
  }
  try {
    const configuracoes = await chamarBackend<ConfiguracoesAPI>("/empresa/configuracoes", {
      method: "PUT",
      corpo: { tolerancia_dias: dias },
    });
    return { ok: true, dados: adaptarRegras(configuracoes) };
  } catch (erro) {
    return traduzir(erro);
  }
}

export type ArquivoExtrato = Partial<Pick<ArquivoConciliado, "conciliadoEm" | "resultado" | "rodada">> & {
  id: string;
  nome: string;
  origem: "banco" | "sistema";
  situacao: SituacaoExtrato["status"];
  lancamentos: number | null;
  /** Quantas linhas o parser não conseguiu ler. */
  naoLidas: number;
  /** Essas linhas, com o motivo; vazia quando o detalhe não carregou (a contagem fica). */
  erros: SituacaoExtrato["erros"];
  /**
   * O mês (AAAA-MM) do extrato, a regra do fechamento: o da conciliação em que entrou (o início
   * do extrato do banco) e, fora de conciliação, o início do próprio período. A galeria agrupa
   * por ele. Null enquanto ele não tem período (processando, ou sem lançamento válido).
   */
  competencia: string | null;
  enviadoEm: string;
  /** Já entrou em alguma conciliação. Onde ela abre (`resultado`) só se sabe quando aparece em `/execucoes`. */
  conciliado: boolean;
};

export type ListaDeExtratos = {
  arquivos: ArquivoExtrato[];
  /** Quantos o backend tem; mais que `arquivos` quando a lista passou do teto de páginas. */
  total: number;
};

const EXTRATOS_POR_PAGINA = 100;

/**
 * Os arquivos enviados, para a tela de extratos, de `GET /extratos` (backend #70): todos, do envio
 * mais recente ao mais antigo, inclusive os que ainda não entraram em conciliação.
 *
 * O que a lista não diz vem de outro lugar. Onde o arquivo abre e em que rodada entrou, da primeira
 * página de `/execucoes` (o extrato do banco abre pelo próprio id, esteja ou não nela). O motivo de
 * cada linha não lida, de `GET /extratos/{id}`, só dos arquivos que têm alguma.
 */
export async function listarExtratos(): Promise<Resultado<ListaDeExtratos>> {
  const pagina = (numero: number) => `/extratos?limit=${EXTRATOS_POR_PAGINA}&offset=${numero * EXTRATOS_POR_PAGINA}`;
  let lista: ListaExtratosAPI;
  let execucoes: Resultado<ListaExecucoes>;
  try {
    [lista, execucoes] = await Promise.all([chamarBackend<ListaExtratosAPI>(pagina(0)), listarExecucoes()]);
    for (let numero = 1; lista.itens.length < lista.total && numero < MAXIMO_DE_PAGINAS; numero += 1) {
      const proxima = await chamarBackend<ListaExtratosAPI>(pagina(numero));
      if (proxima.itens.length === 0) break;
      lista = { ...lista, itens: [...lista.itens, ...proxima.itens] };
    }
  } catch (erro) {
    return traduzir(erro);
  }

  // sem as execuções a lista ainda serve: só o extrato do sistema fica sem saber onde abre
  const doBackend = execucoes.ok ? execucoes.dados.execucoes : [];
  const conciliacoes = new Map(extratosDasExecucoes(doBackend).map((arquivo) => [arquivo.id, arquivo]));
  // o mês de um extrato do sistema conciliado é o da conciliação, que é o do extrato do banco (o
  // período do sistema pode começar antes, numa linha que o banco não tem); vale a mais recente
  const inicioDaConciliacao = new Map<string, string | null>();
  for (const execucao of doBackend) {
    if (!inicioDaConciliacao.has(execucao.extratoSistemaId)) {
      inicioDaConciliacao.set(execucao.extratoSistemaId, execucao.periodoInicio);
    }
  }
  const detalhes = await Promise.all(
    lista.itens.map((item) => (item.linhas_nao_lidas > 0 ? situacaoDoExtrato(item.extrato_id) : null)),
  );

  return {
    ok: true,
    dados: {
      total: lista.total,
      arquivos: lista.itens.map((item, i) => {
        const detalhe = detalhes[i];
        return {
          ...ondeAbre(item, conciliacoes.get(item.extrato_id)),
          id: item.extrato_id,
          nome: item.nome_arquivo,
          origem: item.origem,
          situacao: item.status,
          lancamentos: item.quantidade_lancamentos,
          naoLidas: item.linhas_nao_lidas,
          erros: detalhe?.ok ? detalhe.dados.erros : [],
          competencia: (inicioDaConciliacao.get(item.extrato_id) ?? item.periodo_inicio)?.slice(0, 7) ?? null,
          enviadoEm: item.enviado_em,
          conciliado: item.conciliado,
        };
      }),
    },
  };
}

/** Onde um extrato conciliado abre: pelas execuções, e o do banco, sem elas, pelo próprio id. */
function ondeAbre(
  item: ItemExtratoAPI,
  conciliacao: ArquivoConciliado | undefined,
): Partial<Pick<ArquivoConciliado, "conciliadoEm" | "resultado" | "rodada">> {
  if (conciliacao) {
    const { conciliadoEm, resultado, rodada } = conciliacao;
    return rodada ? { conciliadoEm, resultado, rodada } : { conciliadoEm, resultado };
  }
  return item.conciliado && item.origem === "banco" ? { resultado: caminhoDaConciliacao(item.extrato_id) } : {};
}

export type VisaoGeral = {
  /** Mais recente primeiro, incluindo as rodadas refeitas depois. */
  execucoes: Execucao[];
  total: number;
  /** A execução mais recente e as linhas dela; null sem execução nenhuma. */
  recente: { execucao: Execucao; conciliacao: Conciliacao } | null;
  /** Os arquivos da mais recente com linhas que o parser não conseguiu ler. */
  arquivosComLinhasNaoLidas: { nome: string; linhas: number }[];
};

/**
 * O que a visão geral precisa: a lista de execuções (tendência e atividade), as
 * linhas da mais recente (o estado do mês e o que está em aberto) e a situação
 * dos dois arquivos dela. Só dos dois: varrer todos os arquivos, como a tela de
 * extratos faz, custaria uma chamada por arquivo para abrir a home.
 */
export async function carregarVisaoGeral(): Promise<Resultado<VisaoGeral>> {
  const lista = await listarExecucoes();
  if (!lista.ok) return lista;
  const { execucoes, total } = lista.dados;

  // a rodada que vale do extrato do banco mais recente: a v1 reconciliada depois da
  // v2 é a execução mais nova, mas não a rodada de agora
  const [maisRecente] = execucoesVigentes(execucoes);
  if (!maisRecente) {
    return { ok: true, dados: { execucoes, total, recente: null, arquivosComLinhasNaoLidas: [] } };
  }

  const [conciliacao, banco, sistema] = await Promise.all([
    carregarConciliacao(maisRecente.extratoBancoId, maisRecente.extratoSistemaId),
    situacaoDoExtrato(maisRecente.extratoBancoId),
    situacaoDoExtrato(maisRecente.extratoSistemaId),
  ]);
  if (!conciliacao.ok) return conciliacao;

  // o detalhe do arquivo é aviso a mais, não o dado principal: se não carregar,
  // a home abre sem ele
  const arquivos = [
    { nome: maisRecente.arquivoBanco, situacao: banco },
    { nome: maisRecente.arquivoSistema, situacao: sistema },
  ];
  const arquivosComLinhasNaoLidas = arquivos.flatMap(({ nome, situacao }) =>
    situacao.ok && situacao.dados.erros.length > 0
      ? [{ nome, linhas: situacao.dados.erros.length }]
      : [],
  );

  return {
    ok: true,
    dados: {
      execucoes,
      total,
      recente: { execucao: maisRecente, conciliacao: conciliacao.dados.conciliacao },
      arquivosComLinhasNaoLidas,
    },
  };
}

export type ParDoFechamento = {
  /** O mês do par vem do período do extrato do banco, em `execucao.periodoInicio`. */
  execucao: Execucao;
  /** Os arquivos do par com linhas que o parser não conseguiu ler. */
  naoLidas: { nome: string; linhas: number }[];
};

export type DadosDoFechamento = {
  pares: ParDoFechamento[];
  /**
   * Os fechamentos da empresa (`GET /fechamentos`), do mais recente para o mais antigo, os
   * reabertos inclusive. Null quando a rota não respondeu: a mesa mostra os meses sem fechar nada.
   */
  fechamentos: Fechamento[] | null;
};

/**
 * Cada par de extratos conciliado, com as linhas não lidas dos dois arquivos: é o
 * que a mesa de fechamento agrupa por mês (o do período do extrato do banco, que
 * vem na execução). Só as rodadas atuais: a refeita depois substitui a anterior.
 * E os fechamentos, que dizem quais meses já estão fechados.
 *
 * ponytail: duas chamadas por par (os dois arquivos), em paralelo. `GET /extratos`
 * (backend #70) traz as linhas não lidas de todos numa lista.
 */
export async function carregarFechamentos(): Promise<Resultado<DadosDoFechamento>> {
  const [lista, fechamentos] = await Promise.all([listarExecucoes(), listarFechamentos()]);
  if (!lista.ok) return lista;

  // a versão nova do extrato do sistema substitui a antiga: um par por extrato do banco
  const atuais = execucoesVigentes(lista.dados.execucoes);
  const pares = await Promise.all(
    atuais.map(async (execucao) => {
      const [banco, sistema] = await Promise.all([
        situacaoDoExtrato(execucao.extratoBancoId),
        situacaoDoExtrato(execucao.extratoSistemaId),
      ]);
      const arquivos = [
        { nome: execucao.arquivoBanco, situacao: banco },
        { nome: execucao.arquivoSistema, situacao: sistema },
      ];
      const naoLidas = arquivos.flatMap(({ nome, situacao }) =>
        situacao.ok && situacao.dados.erros.length > 0
          ? [{ nome, linhas: situacao.dados.erros.length }]
          : [],
      );
      return { execucao, naoLidas };
    }),
  );
  return { ok: true, dados: { pares, fechamentos } };
}

async function listarFechamentos(): Promise<Fechamento[] | null> {
  try {
    const lista = await chamarBackend<{ itens: FechamentoAPI[] }>("/fechamentos");
    return lista.itens.map(adaptarFechamento);
  } catch {
    return null;
  }
}

/** AAAA-MM com mês de 01 a 12, o formato que o backend aceita. Vai no caminho do DELETE. */
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

const COMPETENCIA_INVALIDA: Falha = {
  ok: false,
  status: 422,
  erro: "A competência deve estar no formato AAAA-MM, com mês de 01 a 12.",
};

/**
 * Fecha o mês (`POST /fechamentos`). Com pendências e sem ressalva, o backend responde 409 com o
 * que falta, em texto para a tela; com a ressalva, fecha mesmo assim. O mês fechado trava conciliar
 * e decidir nele até reabrir.
 */
export async function fecharMes(competencia: string, ressalva?: string): Promise<Resultado<Fechamento>> {
  if (!COMPETENCIA.test(competencia)) return COMPETENCIA_INVALIDA;
  const texto = ressalva?.trim();
  try {
    const fechamento = await chamarBackend<FechamentoAPI>("/fechamentos", {
      method: "POST",
      corpo: texto ? { competencia, ressalva: texto } : { competencia },
    });
    return { ok: true, dados: adaptarFechamento(fechamento) };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Reabre o mês (`DELETE /fechamentos/{competencia}`). Nada se apaga: o fechamento fica como reaberto. */
export async function reabrirMes(competencia: string): Promise<Resultado<Fechamento>> {
  if (!COMPETENCIA.test(competencia)) return COMPETENCIA_INVALIDA;
  try {
    const fechamento = await chamarBackend<FechamentoAPI>(`/fechamentos/${competencia}`, { method: "DELETE" });
    return { ok: true, dados: adaptarFechamento(fechamento) };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Por que o texto é o fixo do motor, e não o da IA; null quando veio da IA. */
export type Indisponibilidade = "desabilitado" | "erro_provedor" | "limite_diario";

export type Explicacao = {
  /** Texto puro, sem markdown. Vem de descrição de extrato de terceiro: nunca vira HTML. */
  texto: string;
  /** Só com `true` a tela rotula como gerada por IA. */
  geradaPorIa: boolean;
  indisponibilidade: Indisponibilidade | null;
};

type ExplicacaoAPI = {
  conciliacao_id: string;
  status: string;
  explicacao: string;
  gerada_por_ia: boolean;
  em_cache: boolean;
  indisponibilidade: Indisponibilidade | null;
};

// O backend espera até 20 s pelo provedor de IA antes de cair no texto fixo;
// numa chamada real de teste levou 6,6 s. 30 s dá folga sem prender a tela.
const PRAZO_DA_EXPLICACAO_MS = 30_000;

/**
 * Por que uma linha é divergência, em linguagem natural (`POST /explicacoes`).
 * Só as cinco categorias de divergência são elegíveis; a tela nem oferece o
 * botão nas linhas casadas. É POST porque pode disparar uma geração paga, por
 * isso só roda no clique — nunca ao abrir a tela.
 *
 * Falha do provedor e limite diário não são erro: chegam como 200 com o texto
 * fixo do motor e o motivo em `indisponibilidade`.
 */
export async function explicarDivergencia(conciliacaoId: string): Promise<Resultado<Explicacao>> {
  try {
    const resposta = await chamarBackend<ExplicacaoAPI>("/explicacoes", {
      method: "POST",
      corpo: { conciliacao_id: conciliacaoId },
      signal: AbortSignal.timeout(PRAZO_DA_EXPLICACAO_MS),
    });
    return {
      ok: true,
      dados: {
        texto: resposta.explicacao,
        geradaPorIa: resposta.gerada_por_ia,
        indisponibilidade: resposta.indisponibilidade,
      },
    };
  } catch (erro) {
    // O id da linha muda quando o par é conciliado de novo (as linhas são
    // reescritas), e o id que a tela tem passa a responder 404.
    if (erro instanceof ErroBackend && erro.status === 404) {
      return { ok: false, status: 404, erro: LINHA_MUDOU };
    }
    if (erro instanceof DOMException && erro.name === "TimeoutError") {
      return {
        ok: false,
        status: 504,
        erro: "A explicação demorou mais que o normal. Tente de novo em instantes.",
      };
    }
    return traduzir(erro);
  }
}

/**
 * Conferir, justificar ou desfazer numa linha (spec 2026-10-02-conciliacao-em-rodadas).
 * A rota é a proposta ao backend; a tela só chega aqui quando os itens trazem o
 * campo `decisao`, sinal de que ela existe. Devolve a decisão em vigor, ou null
 * depois de desfazer.
 */
export async function registrarDecisao(
  extratoBancoId: string,
  chave: string,
  tipo: TipoEvento,
  texto?: string,
): Promise<Resultado<Decisao | null>> {
  if (!pareceUuid(extratoBancoId)) return { ok: false, status: 404, erro: "Conciliação não encontrada." };
  try {
    const decisao = await chamarBackend<Decisao | null>(`/conciliacoes/${extratoBancoId}/decisoes`, {
      method: "POST",
      corpo: { chave, tipo, texto },
    });
    return { ok: true, dados: decisao ?? null };
  } catch (erro) {
    // a chave some quando outra rodada entra no meio: a linha da tela não existe mais
    if (erro instanceof ErroBackend && erro.status === 404) {
      return { ok: false, status: 404, erro: LINHA_MUDOU };
    }
    return traduzir(erro);
  }
}
