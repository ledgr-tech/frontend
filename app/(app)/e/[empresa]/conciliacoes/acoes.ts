"use server";

import {
  adaptarConciliacao,
  adaptarDecisao,
  adaptarExecucao,
  adaptarFechamento,
  adaptarResumoDoFechamento,
  adaptarSaldo,
  extratosDasExecucoes,
  pareceUuid,
  type ArquivoConciliado,
  type CamposDeSaldoAPI,
  type DecisaoAPI,
  type SaldoDoExtrato,
  type Execucao,
  type Fechamento,
  type FechamentoAPI,
  type ItemExtratoAPI,
  type ResumoDoFechamento,
  type ListaConciliacaoAPI,
  type ListaExecucoesAPI,
  type ListaExtratosAPI,
} from "@/lib/adaptadores";
import { chamarBackend, emailDaSessao, ErroBackend } from "@/lib/backend";
import { RECUSA_DEMONSTRACAO, ehContaDeDemonstracao } from "@/lib/demo";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { compararRodadas, execucoesVigentes, rodadasDoBanco, type Mudancas } from "@/lib/rodadas";
import type { Conciliacao, Decisao, TipoEvento } from "@/lib/mock-data";
import { conciliados, paraRevisar, porConciliacao } from "../historico/execucoes";
import { ordemDeTrabalho, pedemDecisao, type ConciliacaoNaLista } from "../dashboard/lista";
import { estaResolvida, pedeDecisao } from "../dashboard/resumo";
import { decisoesLigadas, situacaoDaLinha } from "./[id]/situacao";
import { competencia } from "../fechamentos/fechamento";
import type { ConciliacaoDoPar } from "../fechamentos/relatorio";
import type { DadosDoRoteiro } from "../visao-geral/roteiro";
import { contaDaSessao } from "../../../../(auth)/acoes";
import { SO_O_GESTOR_APROVA, SO_O_GESTOR_FECHA } from "@/lib/gestor";
import { podeFecharMes } from "@/lib/papel";

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
export type SituacaoExtrato = CamposDeSaldoAPI & {
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

/**
 * Fechar ou reabrir o mês é do admin e do gestor (#168, #133); o analista concilia e justifica. A
 * Server Action é endpoint público, então recusa aqui também, e não só esconde o botão; a trava que
 * vale é a do backend, que responde 403. Sem o `/me`, `contaDaSessao` diz admin e o backend decide.
 */
async function recusaSeNaoPodeFechar(erro: string): Promise<Falha | null> {
  const { papel } = await contaDaSessao();
  return podeFecharMes(papel) ? null : { ok: false, status: 403, erro };
}

/** O 403 do backend para quem não pode fechar o mês chega com o mesmo texto da tela. */
function traduzirDoFechamento(erro: unknown, texto: string): Falha {
  return erro instanceof ErroBackend && erro.status === 403 ? { ok: false, status: 403, erro: texto } : traduzir(erro);
}

/** O 404 de uma linha que a tela ainda mostra: o par foi conciliado de novo depois que ela abriu. */
const LINHA_MUDOU = "Esta linha mudou: a conciliação foi refeita depois que a tela abriu.";

// O upload sobe o arquivo inteiro e a conciliação roda o motor sobre milhares de linhas: os
// dois passam dos 30 s do padrão do lib/backend num extrato grande ou numa rede lenta.
const PRAZO_DO_PROCESSAMENTO_MS = 120_000;

export async function enviarExtrato(dados: FormData): Promise<Resultado<{ extratoId: string }>> {
  // Server Action é endpoint público: ao backend vão só os dois campos que a tela manda
  const arquivo = dados.get("arquivo");
  const origem = dados.get("origem");
  if (!(arquivo instanceof File) || (origem !== "banco" && origem !== "sistema")) {
    return { ok: false, status: 422, erro: "Envie o arquivo do extrato do banco ou do sistema." };
  }
  const corpo = new FormData();
  corpo.append("arquivo", arquivo);
  corpo.append("origem", origem);
  try {
    const resposta = await chamarBackend<{ extrato_id: string; status: string }>(
      "/extratos/upload",
      { method: "POST", corpo, signal: AbortSignal.timeout(PRAZO_DO_PROCESSAMENTO_MS) },
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
  if (!pareceUuid(extratoBancoId) || !pareceUuid(extratoSistemaId)) {
    return { ok: false, status: 404, erro: "Extrato não encontrado." };
  }
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
  // o período vem do backend, mas vira parte da URL: só segue com cara de AAAA-MM
  const mes = periodoInicio?.slice(0, 7);
  if (!mes || !COMPETENCIA.test(mes)) return null;
  try {
    const lista = await chamarBackend<{ itens: FechamentoAPI[] }>(`/fechamentos?competencia=${mes}`);
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
  /** Os fechamentos da empresa, para a lista dizer que meses estão fechados; null se não vieram. */
  fechamentos: Fechamento[] | null;
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
  const [lista, fechamentos] = await Promise.all([listarExecucoes(), listarFechamentos()]);
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
    return { ok: true, dados: { conciliacoes, fechamentos, emAndamento: null, parcial } };
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
  return { ok: true, dados: { conciliacoes, fechamentos, emAndamento, parcial } };
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
  // a regra vale para todo visitante da demo, que divide a mesma empresa
  if (ehContaDeDemonstracao(await emailDaSessao())) return { ok: false, status: 403, erro: RECUSA_DEMONSTRACAO };
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
  /** O saldo que o arquivo informa (backend #118); ausente quando o backend não manda. */
  saldo?: SaldoDoExtrato | null;
  /** A primeira e a última data dos lançamentos (AAAA-MM-DD); null enquanto não há período. */
  periodo?: { inicio: string; fim: string } | null;
  /** A rodada em que o arquivo conta hoje, para o painel: só quando ela está em `/execucoes`. */
  ultimaRodada?: ResumoDaRodada;
};

/** O que a rodada de um arquivo deu, das contagens de `/execucoes`, sem abrir a conciliação. */
export type ResumoDaRodada = {
  /** O arquivo do outro lado da conciliação. */
  com: string;
  /** Percentual de 0 a 100 do que bateu (exato e na tolerância); null quando o backend não manda. */
  acerto: number | null;
  divergencias: number;
  justificadas: number;
  toleranciaDias: number;
};

/**
 * A rodada que vale para o arquivo: a do extrato do banco é a vigente dele; a do sistema, a mais
 * recente em que ele entrou (a lista chega da mais nova para a mais antiga).
 */
function rodadaDoArquivo(execucoes: Execucao[], id: string, origem: "banco" | "sistema"): ResumoDaRodada | undefined {
  const execucao =
    origem === "banco"
      ? rodadasDoBanco(execucoes, id).at(-1)?.execucao
      : execucoes.find((cada) => cada.extratoSistemaId === id);
  if (!execucao) return undefined;
  return {
    com: origem === "banco" ? execucao.arquivoSistema : execucao.arquivoBanco,
    acerto: execucao.acerto,
    divergencias: Object.values(execucao.divergencias).reduce((soma, n) => soma + (n ?? 0), 0),
    justificadas: execucao.justificadas,
    toleranciaDias: execucao.toleranciaDias,
  };
}

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
        const saldo = adaptarSaldo(item);
        const ultimaRodada = item.conciliado ? rodadaDoArquivo(doBackend, item.extrato_id, item.origem) : undefined;
        return {
          ...(saldo !== undefined && { saldo }),
          ...(ultimaRodada && { ultimaRodada }),
          ...ondeAbre(item, conciliacoes.get(item.extrato_id)),
          periodo: item.periodo_inicio && item.periodo_fim ? { inicio: item.periodo_inicio, fim: item.periodo_fim } : null,
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
  /**
   * O mês em foco (revisão de 15/10): o aberto mais recente, ou o mais recente se todos estão
   * fechados, com as linhas de todas as conciliações dele. O número do topo, "Pede sua atenção" e
   * o atalho de Fechamentos olham o mês inteiro, não só a última conciliação. Ausente quando alguma
   * conciliação do mês não carregou: a home cai para só a recente, como era.
   */
  mes?: { competencia: string; fechado: boolean; conciliacoes: Conciliacao[] };
};

/**
 * O que a visão geral precisa: a lista de execuções (tendência e atividade), as
 * linhas da mais recente (o estado do mês e o que está em aberto) e a situação
 * dos dois arquivos dela. Só dos dois: varrer todos os arquivos, como a tela de
 * extratos faz, custaria uma chamada por arquivo para abrir a home.
 */
export async function carregarVisaoGeral(): Promise<Resultado<VisaoGeral>> {
  const [lista, fechamentos] = await Promise.all([listarExecucoes(), listarFechamentos()]);
  if (!lista.ok) return lista;
  const { execucoes, total } = lista.dados;

  // a rodada que vale de cada extrato do banco: a v1 reconciliada depois da v2 é a execução mais
  // nova, mas não a rodada de agora
  const vigentes = execucoesVigentes(execucoes);
  if (vigentes.length === 0) {
    return { ok: true, dados: { execucoes, total, recente: null, arquivosComLinhasNaoLidas: [] } };
  }

  // o mês em foco: o aberto mais recente (é onde está o trabalho); todos fechados, o mais recente
  const mesDe = (execucao: Execucao) => competencia(execucao.periodoInicio, execucao.executadaEm);
  const fechados = new Set<string>();
  const vistos = new Set<string>();
  for (const fechamento of fechamentos ?? []) {
    if (vistos.has(fechamento.competencia)) continue;
    vistos.add(fechamento.competencia);
    if (fechamento.estado === "fechado") fechados.add(fechamento.competencia);
  }
  const meses = [...new Set(vigentes.map(mesDe))].sort((a, b) => b.localeCompare(a));
  const foco = meses.find((mes) => !fechados.has(mes)) ?? meses[0];
  const doMes = vigentes.filter((execucao) => mesDe(execucao) === foco);
  const [maisRecente] = doMes;

  const [conciliacoes, banco, sistema] = await Promise.all([
    Promise.all(doMes.map((execucao) => carregarConciliacao(execucao.extratoBancoId, execucao.extratoSistemaId))),
    situacaoDoExtrato(maisRecente.extratoBancoId),
    situacaoDoExtrato(maisRecente.extratoSistemaId),
  ]);
  const [conciliacao] = conciliacoes;
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
  const todasCarregaram = conciliacoes.every((resultado) => resultado.ok);

  return {
    ok: true,
    dados: {
      execucoes,
      total,
      recente: { execucao: maisRecente, conciliacao: conciliacao.dados.conciliacao },
      arquivosComLinhasNaoLidas,
      ...(todasCarregaram && {
        mes: {
          competencia: foco,
          fechado: fechados.has(foco),
          conciliacoes: conciliacoes.flatMap((resultado) => (resultado.ok ? [resultado.dados.conciliacao] : [])),
        },
      }),
    },
  };
}

export type ParDoFechamento = {
  /** O mês do par vem do período do extrato do banco, em `execucao.periodoInicio`. */
  execucao: Execucao;
  /** Os arquivos do par com linhas que o parser não conseguiu ler. */
  naoLidas: { nome: string; linhas: number }[];
  /** O saldo do extrato do banco (backend #118); ausente sem o detalhe dele ou sem a #118. */
  saldo?: SaldoDoExtrato | null;
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
      // o saldo vem no mesmo detalhe do extrato do banco que já diz as linhas não lidas
      const saldo = banco.ok ? adaptarSaldo(banco.dados) : undefined;
      return { execucao, naoLidas, ...(saldo !== undefined && { saldo }) };
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
  const recusa = await recusaSeNaoPodeFechar(SO_O_GESTOR_FECHA);
  if (recusa) return recusa;
  const texto = ressalva?.trim();
  try {
    const fechamento = await chamarBackend<FechamentoAPI>("/fechamentos", {
      method: "POST",
      corpo: texto ? { competencia, ressalva: texto } : { competencia },
    });
    return { ok: true, dados: adaptarFechamento(fechamento) };
  } catch (erro) {
    return traduzirDoFechamento(erro, SO_O_GESTOR_FECHA);
  }
}

/** Reabre o mês (`DELETE /fechamentos/{competencia}`). Nada se apaga: o fechamento fica como reaberto. */
export async function reabrirMes(competencia: string): Promise<Resultado<Fechamento>> {
  if (!COMPETENCIA.test(competencia)) return COMPETENCIA_INVALIDA;
  const recusa = await recusaSeNaoPodeFechar(SO_O_GESTOR_FECHA);
  if (recusa) return recusa;
  try {
    const fechamento = await chamarBackend<FechamentoAPI>(`/fechamentos/${competencia}`, { method: "DELETE" });
    return { ok: true, dados: adaptarFechamento(fechamento) };
  } catch (erro) {
    return traduzirDoFechamento(erro, SO_O_GESTOR_FECHA);
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
  // cada explicação custa: id que nem tem formato de linha não chega ao backend
  if (!pareceUuid(conciliacaoId)) return { ok: false, status: 404, erro: "Linha não encontrada." };
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

/** Aprovar e rejeitar uma justificativa (backend #132): do admin e do gestor, como fechar o mês. */
const TIPOS_DA_APROVACAO: readonly TipoEvento[] = ["justificativa_aprovada", "justificativa_rejeitada"];

/**
 * Conferir, justificar ou desfazer numa linha (spec 2026-10-02-conciliacao-em-rodadas), e aprovar ou
 * rejeitar uma justificativa (`texto` é o motivo da rejeição, opcional). A rota é a proposta ao
 * backend; a tela só chega aqui quando os itens trazem o campo `decisao`, sinal de que ela existe.
 * Devolve a decisão em vigor, ou null depois de desfazer ou rejeitar: a linha volta a divergente.
 */
export async function registrarDecisao(
  extratoBancoId: string,
  chave: string,
  tipo: TipoEvento,
  texto?: string,
): Promise<Resultado<Decisao | null>> {
  if (!pareceUuid(extratoBancoId)) return { ok: false, status: 404, erro: "Conciliação não encontrada." };
  // conferir e justificar são de todos os papéis (decisão de 21/10); aprovar e rejeitar, do admin e do gestor
  const aprovacao = TIPOS_DA_APROVACAO.includes(tipo);
  if (aprovacao) {
    const recusa = await recusaSeNaoPodeFechar(SO_O_GESTOR_APROVA);
    if (recusa) return recusa;
  }
  try {
    const decisao = await chamarBackend<DecisaoAPI | null>(`/conciliacoes/${extratoBancoId}/decisoes`, {
      method: "POST",
      corpo: { chave, tipo, texto },
    });
    return { ok: true, dados: decisao ? adaptarDecisao(decisao) : null };
  } catch (erro) {
    // a chave some quando outra rodada entra no meio: a linha da tela não existe mais
    if (erro instanceof ErroBackend && erro.status === 404) {
      return { ok: false, status: 404, erro: LINHA_MUDOU };
    }
    return aprovacao ? traduzirDoFechamento(erro, SO_O_GESTOR_APROVA) : traduzir(erro);
  }
}

/**
 * Aprova de uma vez as justificativas que esperam aprovação num mês (`POST /justificativas/lote`,
 * backend #132): é o que a mesa de fechamento faz antes de fechar. Devolve quantas foram aprovadas e
 * quantas o backend ignorou por já não estarem pendentes.
 */
export async function aprovarPendentes(competenciaDoMes: string): Promise<Resultado<DecididasEmLote>> {
  if (!COMPETENCIA.test(competenciaDoMes)) return COMPETENCIA_INVALIDA;
  return decidirEmLote({ acao: "aprovar", competencia: competenciaDoMes });
}

/** Rejeita de uma vez as justificativas que esperam aprovação num mês; o motivo é opcional, como na linha. */
export async function rejeitarPendentes(competenciaDoMes: string, motivo?: string): Promise<Resultado<DecididasEmLote>> {
  if (!COMPETENCIA.test(competenciaDoMes)) return COMPETENCIA_INVALIDA;
  const texto = lerMotivo(motivo);
  if (texto === false) return MOTIVO_INVALIDO;
  return decidirEmLote({ acao: "rejeitar", competencia: competenciaDoMes, motivo: texto });
}

/**
 * Aprova ou rejeita as linhas marcadas na comparação (`itens` do lote). As que já não esperam
 * aprovação o backend ignora e conta em `ignoradas`, sem erro.
 */
export async function decidirLinhas(
  extratoBancoId: string,
  chaves: string[],
  acao: "aprovar" | "rejeitar",
  motivo?: string,
): Promise<Resultado<DecididasEmLote>> {
  if (!pareceUuid(extratoBancoId)) return { ok: false, status: 404, erro: "Conciliação não encontrada." };
  // Server Action é endpoint público: o mesmo formato que o backend aceita, até 500 itens
  const chavesValidas =
    Array.isArray(chaves) &&
    chaves.length >= 1 &&
    chaves.length <= MAXIMO_ITENS_DO_LOTE &&
    chaves.every((chave) => typeof chave === "string" && chave.length >= 1 && chave.length <= 64);
  if (!chavesValidas) return { ok: false, status: 422, erro: "Marque de 1 a 500 linhas." };
  if (acao !== "aprovar" && acao !== "rejeitar") return { ok: false, status: 422, erro: "Ação inválida." };
  const texto = acao === "rejeitar" ? lerMotivo(motivo) : undefined;
  if (texto === false) return MOTIVO_INVALIDO;
  return decidirEmLote({
    acao,
    motivo: texto,
    itens: chaves.map((chave) => ({ extrato_banco_id: extratoBancoId, chave })),
  });
}

type DecididasEmLote = { processadas: number; ignoradas: number };

const MAXIMO_ITENS_DO_LOTE = 500;
/** O tamanho máximo da justificativa no backend, que vale também para o motivo da rejeição. */
const TAMANHO_MAXIMO_DO_MOTIVO = 1000;
const MOTIVO_INVALIDO: Falha = { ok: false, status: 422, erro: "O motivo pode ter até 1.000 caracteres." };

/** O motivo aparado, undefined quando vazio, ou false quando não é texto ou passa do tamanho. */
function lerMotivo(motivo: unknown): string | undefined | false {
  if (motivo === undefined || motivo === null) return undefined;
  if (typeof motivo !== "string") return false;
  const texto = motivo.trim();
  if (texto.length > TAMANHO_MAXIMO_DO_MOTIVO) return false;
  return texto || undefined;
}

/** `POST /justificativas/lote` (backend #132): do admin e do gestor, pela empresa ativa. */
async function decidirEmLote(corpo: Record<string, unknown>): Promise<Resultado<DecididasEmLote>> {
  const recusa = await recusaSeNaoPodeFechar(SO_O_GESTOR_APROVA);
  if (recusa) return recusa;
  try {
    const resposta = await chamarBackend<DecididasEmLote>("/justificativas/lote", { method: "POST", corpo });
    return { ok: true, dados: { processadas: resposta.processadas, ignoradas: resposta.ignoradas } };
  } catch (erro) {
    return traduzirDoFechamento(erro, SO_O_GESTOR_APROVA);
  }
}

export type DadosDoRelatorio =
  /** O mês não está fechado agora: nunca foi, ou foi reaberto. */
  | { fechamento: null }
  | {
      fechamento: Fechamento;
      resumo: ResumoDoFechamento;
      /** De `GET /me`; vazios quando ele falhou, para o relatório não mostrar o nome de outra. */
      empresa: { razaoSocial: string; cnpj: string };
      /** A conciliação de cada par do resumo, na mesma ordem; null no par que não carregou. */
      conciliacoes: ConciliacaoDoPar[];
    };

/**
 * O que o relatório do fechamento (#117) precisa: o fechamento em vigor da competência, com o
 * resumo congelado, a empresa e as linhas de cada par do resumo (justificativas e pendências).
 * Sem rota nova no backend. Só o fechamento é obrigatório: sem a empresa ou sem um par, o
 * relatório sai com o que tem e diz o que faltou.
 */
export async function carregarRelatorioDoFechamento(competencia: string): Promise<Resultado<DadosDoRelatorio>> {
  // vem da URL e vai para a query do backend
  if (!COMPETENCIA.test(competencia)) return { ok: false, status: 404, erro: "Competência não encontrada." };

  let maisRecente: FechamentoAPI | undefined;
  try {
    const lista = await chamarBackend<{ itens: FechamentoAPI[] }>(`/fechamentos?competencia=${competencia}`);
    // do mais recente para o mais antigo: o primeiro da competência é o que vale
    maisRecente = lista.itens.find((item) => item.competencia === competencia);
  } catch (erro) {
    return traduzir(erro);
  }
  if (maisRecente?.estado !== "fechado" || !maisRecente.resumo) return { ok: true, dados: { fechamento: null } };

  const resumo = adaptarResumoDoFechamento(maisRecente.resumo);
  const [empresa, conciliacoes] = await Promise.all([
    chamarBackend<{ razao_social: string; cnpj: string }>("/me").then(
      (eu) => ({ razaoSocial: eu.razao_social?.trim() ?? "", cnpj: eu.cnpj ?? "" }),
      () => ({ razaoSocial: "", cnpj: "" }),
    ),
    Promise.all(
      resumo.pares.map(async (par) => {
        const lida = await carregarConciliacao(par.extratoBancoId, par.extratoSistemaId);
        return lida.ok ? lida.dados : null;
      }),
    ),
  ]);

  return { ok: true, dados: { fechamento: adaptarFechamento(maisRecente), resumo, empresa, conciliacoes } };
}

/**
 * O que o roteiro de primeiros passos da Visão geral precisa saber (spec 2026-10-15-primeiro-uso,
 * parte 4). Null quando alguma leitura falhou: sem certeza, a Visão geral fica sem roteiro em vez
 * de marcar um passo errado.
 */
export async function carregarRoteiro(): Promise<DadosDoRoteiro | null> {
  try {
    const [configuracoes, extratos, lista, fechamentos] = await Promise.all([
      chamarBackend<ConfiguracoesAPI>("/empresa/configuracoes"),
      chamarBackend<ListaExtratosAPI>("/extratos?limit=100&offset=0"),
      listarExecucoes(),
      listarFechamentos(),
    ]);
    if (!lista.ok || fechamentos === null) return null;
    // a rodada que vale de cada extrato do banco, como na lista de Conciliações
    const pendencias = porConciliacao(lista.dados.execucoes)
      .filter(({ principal }) => principal.situacao === "vale")
      .map(({ extratoBancoId, principal }) => ({ extratoBancoId, pedem: paraRevisar(principal.execucao) }));
    const maisPendente = [...pendencias].sort((a, b) => b.pedem - a.pedem)[0];
    return {
      // null antes da primeira mudança (backend #85)
      toleranciaRevisada: adaptarRegras(configuracoes).atualizadoEm !== null,
      temExtratoDoBanco: extratos.itens.some((item) => item.origem === "banco"),
      conciliou: lista.dados.execucoes.length > 0,
      resolveuAlguma: pendencias.some(({ pedem }) => pedem === 0),
      fechouAlgum: fechamentos.some((fechamento) => fechamento.estado === "fechado"),
      conciliacaoComPendencia:
        maisPendente && maisPendente.pedem > 0 ? caminhoDaConciliacao(maisPendente.extratoBancoId) : null,
    };
  } catch {
    return null;
  }
}
