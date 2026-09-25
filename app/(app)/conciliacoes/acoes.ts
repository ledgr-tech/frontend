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
import type { Conciliacao } from "@/lib/mock-data";

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
  // vem da URL: não entra na query do backend sem conferir
  if (extratoSistemaId !== undefined && !pareceUuid(extratoSistemaId)) {
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

// ponytail: o histórico mostra as 50 execuções mais recentes (o backend aceita
// até 100 por página). Quando alguém passar disso, entra paginação na tela.
const EXECUCOES_POR_PAGINA = 50;

export type ListaExecucoes = { execucoes: Execucao[]; total: number };

/** Mais recente primeiro, incluindo as rodadas que foram refeitas depois. */
export async function listarExecucoes(): Promise<Resultado<ListaExecucoes>> {
  try {
    const lista = await chamarBackend<ListaExecucoesAPI>(
      `/execucoes?limit=${EXECUCOES_POR_PAGINA}&offset=0`,
    );
    return {
      ok: true,
      dados: { execucoes: lista.itens.map(adaptarExecucao), total: lista.total },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}

export type Painel = {
  /** As linhas da execução mais recente, que alimentam o resumo; null sem execução. */
  recente: Conciliacao | null;
  /** As outras execuções atuais, da mais recente para a mais antiga. */
  anteriores: Execucao[];
};

/**
 * O que a dashboard precisa numa ida só ao servidor: a lista de execuções diz
 * qual é a mais recente, e as linhas dela dão o resumo com valores em reais —
 * que `/execucoes` não tem, porque só guarda contagens.
 */
export async function carregarPainel(): Promise<Resultado<Painel>> {
  const lista = await listarExecucoes();
  if (!lista.ok) return lista;

  // As refeitas depois ficam só no histórico: aqui cada par de extratos aparece
  // uma vez. A mais recente de todas é sempre atual.
  const [maisRecente, ...anteriores] = lista.dados.execucoes.filter((execucao) => execucao.atual);
  if (!maisRecente) return { ok: true, dados: { recente: null, anteriores: [] } };

  const conciliacao = await carregarConciliacao(maisRecente.extratoBancoId, maisRecente.extratoSistemaId);
  if (!conciliacao.ok) return conciliacao;
  return { ok: true, dados: { recente: conciliacao.dados.conciliacao, anteriores } };
}

export type ArquivoExtrato = ArquivoConciliado & {
  /** Null quando o detalhe do arquivo não carregou; o resto da lista segue. */
  situacao: SituacaoExtrato["status"] | null;
  lancamentos: number | null;
  /** As linhas que o parser não conseguiu ler, com o motivo. */
  erros: SituacaoExtrato["erros"];
};

/**
 * Os arquivos enviados, para a tela de extratos: os nomes vêm das execuções e a
 * situação de cada um, de `GET /extratos/{id}`.
 *
 * ponytail: uma chamada por arquivo (em paralelo, até ~100 com as 50 execuções
 * da página). Some quando o backend tiver `GET /extratos` com a lista pronta.
 */
export async function listarExtratos(): Promise<Resultado<ArquivoExtrato[]>> {
  const lista = await listarExecucoes();
  if (!lista.ok) return lista;

  const arquivos = extratosDasExecucoes(lista.dados.execucoes);
  const detalhes = await Promise.all(arquivos.map((arquivo) => situacaoDoExtrato(arquivo.id)));
  return {
    ok: true,
    dados: arquivos.map((arquivo, i) => {
      const detalhe = detalhes[i];
      return detalhe.ok
        ? {
            ...arquivo,
            situacao: detalhe.dados.status,
            lancamentos: detalhe.dados.quantidade_lancamentos,
            erros: detalhe.dados.erros,
          }
        : { ...arquivo, situacao: null, lancamentos: null, erros: [] };
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

  // a mais recente de todas é sempre atual; o filtro é só por garantia
  const maisRecente = execucoes.find((execucao) => execucao.atual);
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
      return {
        ok: false,
        status: 404,
        erro: "Esta linha mudou: a conciliação foi refeita depois que a tela abriu.",
      };
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
