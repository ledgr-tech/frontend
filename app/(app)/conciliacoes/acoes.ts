"use server";

import { adaptarConciliacao, type ListaConciliacaoAPI } from "@/lib/adaptadores";
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

export async function carregarConciliacao(
  extratoBancoId: string,
): Promise<Resultado<{ conciliacao: Conciliacao; truncada: boolean }>> {
  try {
    const primeira = await chamarBackend<ListaConciliacaoAPI>(
      `/conciliacoes/${extratoBancoId}?limit=${POR_REQUISICAO}&offset=0`,
    );
    const itens = [...primeira.itens];
    let pagina = 1;
    while (itens.length < primeira.total && pagina < MAXIMO_DE_PAGINAS) {
      const proxima = await chamarBackend<ListaConciliacaoAPI>(
        `/conciliacoes/${extratoBancoId}?limit=${POR_REQUISICAO}&offset=${pagina * POR_REQUISICAO}`,
      );
      if (proxima.itens.length === 0) break;
      itens.push(...proxima.itens);
      pagina += 1;
    }

    return {
      ok: true,
      dados: {
        conciliacao: adaptarConciliacao({ ...primeira, itens }),
        truncada: itens.length < primeira.total,
      },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}
