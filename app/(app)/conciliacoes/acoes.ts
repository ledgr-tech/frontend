"use server";

import {
  adaptarConciliacao,
  adaptarExecucao,
  extratosDasExecucoes,
  pareceUuid,
  type ArquivoConciliado,
  type Execucao,
  type ListaConciliacaoAPI,
  type ListaExecucoesAPI,
} from "@/lib/adaptadores";
import { chamarBackend, ErroBackend } from "@/lib/backend";
import { compararRodadas, execucoesVigentes, rodadasDoBanco, type Mudancas } from "@/lib/rodadas";
import type { Conciliacao, Decisao, TipoEvento } from "@/lib/mock-data";
import { competencia } from "../fechamentos/fechamento";
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

export type ContagensConciliacao = {
  extrato_banco_id: string;
  extrato_sistema_id: string;
  total: number;
  match_exato: number;
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
  // fetch que nem chegou a sair (backend fora do ar, DNS, CORS de rede)
  return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
}

/** O 404 de uma linha que a tela ainda mostra: o par foi conciliado de novo depois que ela abriu. */
const LINHA_MUDOU = "Esta linha mudou: a conciliação foi refeita depois que a tela abriu.";

export async function enviarExtrato(dados: FormData): Promise<Resultado<{ extratoId: string }>> {
  try {
    const resposta = await chamarBackend<{ extrato_id: string; status: string }>(
      "/extratos/upload",
      { method: "POST", corpo: dados },
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
};

// ponytail: as rodadas saem das primeiras páginas de /execucoes (as de um mesmo
// extrato do banco são recentes entre si). Um filtro `?extrato_banco_id=` no
// backend tira esta varredura.
const PAGINAS_DE_RODADAS = 3;

async function execucoesRecentes(): Promise<Resultado<Execucao[]>> {
  const todas: Execucao[] = [];
  for (let pagina = 0; pagina < PAGINAS_DE_RODADAS; pagina += 1) {
    const lista = await listarExecucoes(pagina);
    if (!lista.ok) return lista;
    todas.push(...lista.dados.execucoes);
    if ((pagina + 1) * lista.dados.porPagina >= lista.dados.total) break;
  }
  return { ok: true, dados: todas };
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

  const execucoes = await execucoesRecentes();
  const rodadas = execucoes.ok ? rodadasDoBanco(execucoes.dados, extratoBancoId) : [];
  const alvo = extratoSistemaId
    ? rodadas.find((rodada) => rodada.extratoSistemaId === extratoSistemaId)
    : rodadas.at(-1);

  if (!alvo) {
    const simples = await carregarConciliacao(extratoBancoId, extratoSistemaId);
    return simples.ok ? { ok: true, dados: { ...simples.dados, rodada: null, rodadas: [], mudancas: null } } : simples;
  }

  const atual = await carregarConciliacao(extratoBancoId, alvo.extratoSistemaId);
  if (!atual.ok) return atual;

  const vistas: RodadaVista[] = rodadas.map((item) => ({
    numero: item.numero,
    total: rodadas.length,
    extratoSistemaId: item.extratoSistemaId,
    arquivoSistema: item.arquivoSistema,
    executadaEm: item.execucao.executadaEm,
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
    },
  };
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
 * ponytail: só a primeira página de `/execucoes`, e uma chamada por conciliação para o mês do
 * extrato, como o histórico. O filtro `?extrato_banco_id=` e o período em `/execucoes` resolvem.
 */
export async function carregarConciliacoes(): Promise<Resultado<ListaDeConciliacoes>> {
  const lista = await listarExecucoes();
  if (!lista.ok) return lista;
  const { execucoes, total } = lista.dados;
  const parcial = total > execucoes.length;

  const competencias = await competenciasDas(execucoes);
  const conciliacoes = porConciliacao(execucoes, competencias)
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
 * que o motor usou por último. Null sem conciliação ou sem resposta — quem mostra
 * é a janela de configurações, que abre sem ela.
 *
 * ponytail: lida de `/execucoes` porque o backend guarda a configuração da
 * empresa (`configuracoes`) mas não tem rota para ela. Com a rota, é lá que se lê
 * e se ajusta.
 */
export async function toleranciaDaUltimaConciliacao(): Promise<number | null> {
  try {
    const lista = await chamarBackend<ListaExecucoesAPI>("/execucoes?limit=1&offset=0");
    return lista.itens[0]?.tolerancia_dias ?? null;
  } catch {
    return null;
  }
}

export type ArquivoExtrato = ArquivoConciliado & {
  /** Null quando o detalhe do arquivo não carregou; o resto da lista segue. */
  situacao: SituacaoExtrato["status"] | null;
  lancamentos: number | null;
  /** As linhas que o parser não conseguiu ler, com o motivo. */
  erros: SituacaoExtrato["erros"];
  /** O mês do extrato (AAAA-MM), o mesmo do fechamento: a galeria agrupa por ele. */
  competencia: string;
};

/**
 * Os arquivos enviados, para a tela de extratos: os nomes vêm das execuções, a
 * situação de cada um de `GET /extratos/{id}` e o mês, da primeira data da
 * conciliação mais recente em que o arquivo entrou (como no fechamento).
 *
 * ponytail: uma chamada por arquivo e outra por execução (em paralelo, até ~150
 * com as 50 execuções da página). Some quando o backend tiver `GET /extratos`
 * com a lista pronta e o período de cada extrato.
 */
export async function listarExtratos(): Promise<Resultado<ArquivoExtrato[]>> {
  const lista = await listarExecucoes();
  if (!lista.ok) return lista;

  const { execucoes } = lista.dados;
  const arquivos = extratosDasExecucoes(execucoes);
  const [detalhes, datas] = await Promise.all([
    Promise.all(arquivos.map((arquivo) => situacaoDoExtrato(arquivo.id))),
    Promise.all(execucoes.map(primeiraData)),
  ]);
  // o mês de cada arquivo vem da execução mais recente em que ele aparece, a mesma que dá o nome
  const mesDoArquivo = new Map<string, string>();
  execucoes.forEach((execucao, i) => {
    const mes = competencia(datas[i], execucao.executadaEm);
    for (const id of [execucao.extratoBancoId, execucao.extratoSistemaId]) {
      if (!mesDoArquivo.has(id)) mesDoArquivo.set(id, mes);
    }
  });

  return {
    ok: true,
    dados: arquivos.map((arquivo, i) => {
      const detalhe = detalhes[i];
      const mes = mesDoArquivo.get(arquivo.id) ?? competencia(null, arquivo.conciliadoEm);
      return detalhe.ok
        ? {
            ...arquivo,
            situacao: detalhe.dados.status,
            lancamentos: detalhe.dados.quantidade_lancamentos,
            erros: detalhe.dados.erros,
            competencia: mes,
          }
        : { ...arquivo, situacao: null, lancamentos: null, erros: [], competencia: mes };
    }),
  };
}

export type VisaoGeral = {
  /** Mais recente primeiro, incluindo as rodadas refeitas depois. */
  execucoes: Execucao[];
  total: number;
  /** A execução mais recente e as linhas dela; null sem execução nenhuma. */
  recente: { execucao: Execucao; conciliacao: Conciliacao } | null;
  /** Os arquivos da mais recente com linhas que o parser não conseguiu ler. */
  arquivosComLinhasNaoLidas: { nome: string; linhas: number }[];
  /** O mês do extrato de cada extrato do banco, só quando pedido (o gráfico da tela da visão geral). */
  competencias?: Record<string, string>;
};

/**
 * O que a visão geral precisa: a lista de execuções (tendência e atividade), as
 * linhas da mais recente (o estado do mês e o que está em aberto) e a situação
 * dos dois arquivos dela. Só dos dois: varrer todos os arquivos, como a tela de
 * extratos faz, custaria uma chamada por arquivo para abrir a home.
 */
export async function carregarVisaoGeral(
  // o gráfico da tela pede o mês do extrato; a barra do topo e o assistente, que também leem a
  // visão geral, não, para não custar uma chamada por conciliação a cada tela aberta
  opcoes: { competencias?: boolean } = {},
): Promise<Resultado<VisaoGeral>> {
  const lista = await listarExecucoes();
  if (!lista.ok) return lista;
  const { execucoes, total } = lista.dados;

  // a rodada que vale do extrato do banco mais recente: a v1 reconciliada depois da
  // v2 é a execução mais nova, mas não a rodada de agora
  const [maisRecente] = execucoesVigentes(execucoes);
  if (!maisRecente) {
    return { ok: true, dados: { execucoes, total, recente: null, arquivosComLinhasNaoLidas: [] } };
  }

  const [conciliacao, banco, sistema, competencias] = await Promise.all([
    carregarConciliacao(maisRecente.extratoBancoId, maisRecente.extratoSistemaId),
    situacaoDoExtrato(maisRecente.extratoBancoId),
    situacaoDoExtrato(maisRecente.extratoSistemaId),
    opcoes.competencias ? competenciasDas(execucoes) : undefined,
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
      ...(competencias ? { competencias } : {}),
    },
  };
}

export type ParDoFechamento = {
  execucao: Execucao;
  /** A primeira data do extrato (AAAA-MM-DD), que diz de que mês ele é; null se não veio. */
  primeiraData: string | null;
  /** Os arquivos do par com linhas que o parser não conseguiu ler. */
  naoLidas: { nome: string; linhas: number }[];
};

/** A primeira linha da conciliação, só pela data: a lista vem em ordem de data. */
async function primeiraData(execucao: Execucao): Promise<string | null> {
  try {
    const pagina = await chamarBackend<ListaConciliacaoAPI>(
      `/conciliacoes/${execucao.extratoBancoId}?limit=1&offset=0&extrato_sistema_id=${execucao.extratoSistemaId}`,
    );
    const item = pagina.itens[0];
    return (item?.lancamento_banco ?? item?.lancamento_sistema)?.data ?? null;
  } catch {
    // sem a data o par ainda entra, pelo mês em que foi conciliado
    return null;
  }
}

export type Historico = ListaExecucoes & {
  /** O mês do extrato (AAAA-MM) de cada extrato do banco da página, pela rodada que vale. */
  competencias: Record<string, string>;
};

/**
 * Uma página do histórico e o mês do extrato de cada conciliação nela, para a tela agrupar como
 * Fechamentos e Extratos: pela primeira data da rodada que vale, e sem ela pelo mês em que rodou.
 *
 * ponytail: uma chamada por conciliação da página (até 50, em paralelo). Some quando
 * `/execucoes` trouxer o período do extrato.
 */
export async function carregarHistorico(pagina = 0): Promise<Resultado<Historico>> {
  const lista = await listarExecucoes(pagina);
  if (!lista.ok) return lista;

  return { ok: true, dados: { ...lista.dados, competencias: await competenciasDas(lista.dados.execucoes) } };
}

/**
 * O mês do extrato de cada conciliação da lista: pela primeira data da rodada que vale, e sem ela
 * pelo mês em que rodou. Uma chamada por conciliação, em paralelo (ver o `ponytail:` acima).
 */
async function competenciasDas(execucoes: Execucao[]): Promise<Record<string, string>> {
  const meses = await Promise.all(
    porConciliacao(execucoes).map(async ({ extratoBancoId, principal: { execucao } }) => [
      extratoBancoId,
      competencia(await primeiraData(execucao), execucao.executadaEm),
    ]),
  );
  return Object.fromEntries(meses);
}

/**
 * Cada par de extratos conciliado, com o mês a que pertence e as linhas não
 * lidas dos dois arquivos: é o que a mesa de fechamento agrupa por mês. Só as
 * rodadas atuais — a refeita depois substitui a anterior.
 *
 * ponytail: três chamadas por par (a primeira linha, pela data, e os dois
 * arquivos), em paralelo. Some quando `/execucoes` trouxer o período do extrato
 * e `GET /extratos` (backend #70) a situação dos arquivos.
 */
export async function carregarFechamentos(): Promise<Resultado<ParDoFechamento[]>> {
  const lista = await listarExecucoes();
  if (!lista.ok) return lista;

  // a versão nova do extrato do sistema substitui a antiga: um par por extrato do banco
  const atuais = execucoesVigentes(lista.dados.execucoes);
  const pares = await Promise.all(
    atuais.map(async (execucao) => {
      const [data, banco, sistema] = await Promise.all([
        primeiraData(execucao),
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
      return { execucao, primeiraData: data, naoLidas };
    }),
  );
  return { ok: true, dados: pares };
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
