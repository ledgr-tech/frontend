"use server";

import { pareceUuid } from "@/lib/adaptadores";
import { ErroBackend, chamarBackend } from "@/lib/backend";
import type { Falha, Resultado } from "../../acoes";

/**
 * Importação do relatório de lançamentos via IA (backend #158/#159, PRs #172 e #173; front #224 e #225): o
 * Ledgr entrega um prompt, a pessoa o cola com o PDF na IA que já usa e traz de volta o JSON. O Ledgr não
 * chama IA nenhuma. O arquivo entra como rascunho (some em 7 dias), a pessoa confere, corrige ou remove
 * linhas, e só ao confirmar vira o extrato do sistema. Todos os papéis, sempre na empresa ativa.
 */

export type PromptDaIa = { versaoSchema: string; versaoPrompt: string; prompt: string };

export type ErroDeCampo = { caminho: string; lancamento: number | null; mensagem: string };

export type ResumoDoRascunho = {
  quantidade: number;
  totalEntradas: string;
  totalSaidas: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  expiraEm: string;
};

export type LinhaDoRascunho = { id: string; numero: number; data: string; valor: string; descricao: string };

export type Rascunho = { id: string; resumo: ResumoDoRascunho; total: number; itens: LinhaDoRascunho[] };

/** O que falhou na leitura do arquivo: o texto e, quando o backend lista, cada campo errado. */
export type FalhaDaImportacao = Falha & { erros: ErroDeCampo[]; totalErros: number };

type ResumoAPI = {
  quantidade: number;
  total_entradas: string | number;
  total_saidas: string | number;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  expira_em: string;
};
type LinhaAPI = { id: string; numero: number; data: string; valor: string | number; descricao: string };

const LIMITE_DE_LINHAS = 1000;

function resumo(r: ResumoAPI): ResumoDoRascunho {
  return {
    quantidade: r.quantidade,
    totalEntradas: String(r.total_entradas),
    totalSaidas: String(r.total_saidas),
    periodoInicio: r.periodo_inicio,
    periodoFim: r.periodo_fim,
    expiraEm: r.expira_em,
  };
}

function linha(l: LinhaAPI): LinhaDoRascunho {
  return { id: l.id, numero: l.numero, data: l.data, valor: String(l.valor), descricao: l.descricao };
}

function traduzir(erro: unknown): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
  const { status } = erro;
  if (status === 401) return { ok: false, status, erro: "Sua sessão expirou. Entre de novo para continuar." };
  if (status === 429) return { ok: false, status, erro: "Muitas tentativas seguidas. Espere um minuto e tente de novo." };
  // 404 (importação vencida ou descartada), 409 (já confirmada), 413 e 422 chegam com o texto do backend
  return { ok: false, status, erro: erro.detalhe };
}

function ehUuid(id: string): boolean {
  return pareceUuid(id);
}

/** O prompt pronto e as versões. Um 404 é um backend antes do #172. */
export async function carregarPromptIa(): Promise<Resultado<PromptDaIa>> {
  try {
    const r = await chamarBackend<{ versao_schema: string; versao_prompt: string; prompt: string }>("/importacoes-ia/prompt");
    return { ok: true, dados: { versaoSchema: r.versao_schema, versaoPrompt: r.versao_prompt, prompt: r.prompt } };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Envia o JSON (ou o `.txt` com ele) e devolve o rascunho criado; no 422 traz cada campo errado. */
export async function importarViaIa(
  dados: FormData,
): Promise<{ ok: true; dados: { importacaoId: string; quantidade: number } } | FalhaDaImportacao> {
  const arquivo = dados.get("arquivo");
  if (!(arquivo instanceof File)) {
    return { ok: false, status: 422, erro: "Escolha o arquivo que a IA devolveu.", erros: [], totalErros: 0 };
  }
  const corpo = new FormData();
  corpo.append("arquivo", arquivo);
  try {
    const r = await chamarBackend<{ importacao_id: string; quantidade_lancamentos: number }>("/importacoes-ia", {
      method: "POST",
      corpo,
    });
    return { ok: true, dados: { importacaoId: r.importacao_id, quantidade: r.quantidade_lancamentos } };
  } catch (erro) {
    return {
      ...traduzir(erro),
      erros: erro instanceof ErroBackend ? erro.erros : [],
      totalErros: erro instanceof ErroBackend ? Math.max(erro.erros.length, 0) : 0,
    };
  }
}

/** O rascunho e suas linhas (até 1.000: a tela avisa se há mais). */
export async function carregarRascunho(id: string): Promise<Resultado<Rascunho>> {
  if (!ehUuid(id)) return { ok: false, status: 404, erro: "Importação não encontrada." };
  try {
    const r = await chamarBackend<{ importacao_id: string; resumo: ResumoAPI; total: number; itens: LinhaAPI[] }>(
      `/importacoes-ia/${id}?limit=${LIMITE_DE_LINHAS}`,
    );
    return { ok: true, dados: { id: r.importacao_id, resumo: resumo(r.resumo), total: r.total, itens: r.itens.map(linha) } };
  } catch (erro) {
    return traduzir(erro);
  }
}

type CamposDaLinha = { data: string; valor: string; descricao: string };

/** Falha de uma linha: o backend manda cada campo em `erros`; aqui vira uma frase só. */
function falhaDeLinha(erro: unknown): Falha {
  if (erro instanceof ErroBackend && erro.status === 422 && erro.erros.length > 0) {
    return { ok: false, status: 422, erro: erro.erros.map((e) => e.mensagem).join(" ") };
  }
  return traduzir(erro);
}

export async function corrigirLinhaDoRascunho(
  id: string,
  linhaId: string,
  campos: CamposDaLinha,
): Promise<Resultado<{ linha: LinhaDoRascunho; resumo: ResumoDoRascunho }>> {
  if (!ehUuid(id) || !ehUuid(linhaId)) return { ok: false, status: 404, erro: "Lançamento não encontrado." };
  try {
    const r = await chamarBackend<{ lancamento: LinhaAPI; resumo: ResumoAPI }>(`/importacoes-ia/${id}/lancamentos/${linhaId}`, {
      method: "PATCH",
      corpo: campos,
    });
    return { ok: true, dados: { linha: linha(r.lancamento), resumo: resumo(r.resumo) } };
  } catch (erro) {
    return falhaDeLinha(erro);
  }
}

export async function removerLinhaDoRascunho(id: string, linhaId: string): Promise<Resultado<null>> {
  if (!ehUuid(id) || !ehUuid(linhaId)) return { ok: false, status: 404, erro: "Lançamento não encontrado." };
  try {
    await chamarBackend<null>(`/importacoes-ia/${id}/lancamentos/${linhaId}`, { method: "DELETE" });
    return { ok: true, dados: null };
  } catch (erro) {
    return traduzir(erro);
  }
}

export async function acrescentarLinhaAoRascunho(
  id: string,
  campos: CamposDaLinha,
): Promise<Resultado<{ linha: LinhaDoRascunho; resumo: ResumoDoRascunho }>> {
  if (!ehUuid(id)) return { ok: false, status: 404, erro: "Importação não encontrada." };
  try {
    const r = await chamarBackend<{ lancamento: LinhaAPI; resumo: ResumoAPI }>(`/importacoes-ia/${id}/lancamentos`, {
      method: "POST",
      corpo: campos,
    });
    return { ok: true, dados: { linha: linha(r.lancamento), resumo: resumo(r.resumo) } };
  } catch (erro) {
    return falhaDeLinha(erro);
  }
}

/** Só aqui os lançamentos entram no sistema: o rascunho vira o extrato do sistema (o corpo de `GET /extratos/{id}`). */
export async function confirmarImportacao(id: string): Promise<Resultado<{ extratoId: string }>> {
  if (!ehUuid(id)) return { ok: false, status: 404, erro: "Importação não encontrada." };
  try {
    const r = await chamarBackend<{ extrato_id?: string; id?: string }>(`/importacoes-ia/${id}/confirmar`, { method: "POST" });
    return { ok: true, dados: { extratoId: r.extrato_id ?? r.id ?? id } };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Descarta o rascunho sem deixar resíduo (204). */
export async function descartarImportacao(id: string): Promise<Resultado<null>> {
  if (!ehUuid(id)) return { ok: false, status: 404, erro: "Importação não encontrada." };
  try {
    await chamarBackend<null>(`/importacoes-ia/${id}`, { method: "DELETE" });
    return { ok: true, dados: null };
  } catch (erro) {
    return traduzir(erro);
  }
}
