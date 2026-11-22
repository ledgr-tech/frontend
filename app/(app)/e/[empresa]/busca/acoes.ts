"use server";

import { chamarBackend, ehContaInativa, ErroBackend } from "@/lib/backend";
import { caminhoDaConciliacao } from "@/lib/caminhos";
import { ehUuid } from "@/lib/rotas";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import type { Falha, Resultado } from "../conciliacoes/acoes";

export type AchadoDaBusca = {
  id: string;
  href: string;
  descricao: string;
  /** Data do lançamento (AAAA-MM-DD), que pode ser de outro mês que a competência. */
  data: string;
  valor: number;
  competencia: string | null;
};

export type PaginaDaBusca = {
  total: number;
  limit: number;
  offset: number;
  itens: AchadoDaBusca[];
};

// GET /busca, backend #220: os ids abrem a linha na rodada do par, não pela chave da decisão.
type LancamentoAPI = { id: string; data: string; valor: string; descricao: string; tipo: string };
type ItemAPI = {
  conciliacao_id: string;
  extrato_banco_id: string;
  extrato_sistema_id: string;
  chave: string;
  status: string;
  competencia: string | null;
  lancamento_banco: LancamentoAPI | null;
  lancamento_sistema: LancamentoAPI | null;
};

const LIMITE = 10;
const INDISPONIVEL = "Não deu para buscar agora.";
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

function objeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function uuid(valor: unknown): valor is string {
  return typeof valor === "string" && ehUuid(valor);
}

function lancamento(valor: unknown): valor is LancamentoAPI {
  if (!objeto(valor) || !uuid(valor.id) || typeof valor.descricao !== "string" || typeof valor.tipo !== "string") return false;
  if (typeof valor.data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor.data)) return false;
  const instante = Date.parse(`${valor.data}T00:00:00Z`);
  if (!Number.isFinite(instante) || new Date(instante).toISOString().slice(0, 10) !== valor.data) return false;
  return typeof valor.valor === "string" && /^[+-]?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(valor.valor) && Number.isFinite(Number(valor.valor));
}

function itemValido(valor: unknown): valor is ItemAPI {
  return objeto(valor) && uuid(valor.conciliacao_id) && uuid(valor.extrato_banco_id) && uuid(valor.extrato_sistema_id)
    && typeof valor.chave === "string" && typeof valor.status === "string"
    && (valor.competencia === null || (typeof valor.competencia === "string" && COMPETENCIA.test(valor.competencia)))
    && (valor.lancamento_banco === null || lancamento(valor.lancamento_banco))
    && (valor.lancamento_sistema === null || lancamento(valor.lancamento_sistema));
}

function adaptar(item: unknown): AchadoDaBusca | null {
  if (!itemValido(item)) return null;
  const lado = item.lancamento_banco ?? item.lancamento_sistema;
  if (!lado) return null;
  return {
    id: item.conciliacao_id,
    href: caminhoDaConciliacao(item.extrato_banco_id, item.extrato_sistema_id, item.conciliacao_id),
    descricao: lado.descricao.trim() || "Sem descrição",
    data: lado.data,
    valor: Number(lado.valor),
    competencia: item.competencia,
  };
}

function traduzir(erro: unknown): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: SEM_SERVIDOR };
  const { status } = erro;
  if (status === 401) return { ok: false, status, erro: "Sua sessão expirou. Entre de novo para continuar." };
  if (status === 429) return { ok: false, status, erro: "Muitas buscas seguidas. Espere um pouco." };
  if (ehContaInativa(erro)) return { ok: false, status, erro: erro.detalhe };
  return { ok: false, status, erro: INDISPONIVEL };
}

/** Todas as conciliações da empresa da aba; o backend interpreta valor, data e palavras. */
export async function buscarLancamentos(termo: string, offset = 0): Promise<Resultado<PaginaDaBusca>> {
  // A action é pública: não transforma o termo e corta por caractere, sem partir um emoji.
  const q = typeof termo === "string" ? Array.from(termo.trim()).slice(0, 100).join("") : "";
  if (!q) return { ok: false, status: 422, erro: "Digite algo para buscar." };
  if (!Number.isSafeInteger(offset) || offset < 0) return { ok: false, status: 422, erro: "A página da busca é inválida." };
  const parametros = new URLSearchParams({ q, limit: String(LIMITE), offset: String(offset) });
  try {
    const pagina = await chamarBackend<unknown>(`/busca?${parametros}`);
    if (!objeto(pagina) || !Array.isArray(pagina.itens) || typeof pagina.total !== "number" || !Number.isSafeInteger(pagina.total) || pagina.total < 0
      || pagina.limit !== LIMITE || pagina.offset !== offset) {
      return { ok: false, status: 502, erro: INDISPONIVEL };
    }
    return {
      ok: true,
      dados: {
        total: pagina.total,
        limit: LIMITE,
        offset,
        itens: pagina.itens.map(adaptar).filter((item) => item !== null),
      },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}
