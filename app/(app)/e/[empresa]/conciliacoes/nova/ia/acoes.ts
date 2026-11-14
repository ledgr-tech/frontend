"use server";

import { pareceUuid } from "@/lib/adaptadores";
import { ErroBackend, chamarBackend } from "@/lib/backend";
import { ARQUIVO_GRANDE_DEMAIS, TAMANHO_MAXIMO_UPLOAD_BYTES } from "@/lib/limite-de-upload";
import { conciliar, situacaoDoExtrato, verificarNovaVersao, type Falha, type Resultado } from "../../acoes";

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

/**
 * O fim do prompt, posto aqui: a tela pede um arquivo, então a IA entrega um arquivo, e não o JSON na conversa
 * (que em relatório longo ela corta, e que a pessoa teria de copiar e salvar à mão).
 * ponytail: o texto do backend ainda diz "responda somente com o JSON", daí o "no lugar de". Se o prompt.md
 * do backend passar a pedir o arquivo, este trecho sai.
 */
const ENTREGA_EM_ARQUIVO =
  "Entrega: crie um arquivo para baixar, chamado lancamentos.json, com esse JSON dentro, e não escreva o JSON na conversa. " +
  "Isto vale no lugar de responder com o JSON no texto. Na conversa, diga apenas quantos lançamentos o arquivo tem.";

/** O prompt pronto e as versões. Um 404 é um backend antes do #172. */
export async function carregarPromptIa(): Promise<Resultado<PromptDaIa>> {
  try {
    const r = await chamarBackend<{ versao_schema: string; versao_prompt: string; prompt: string }>("/importacoes-ia/prompt");
    return { ok: true, dados: { versaoSchema: r.versao_schema, versaoPrompt: r.versao_prompt, prompt: `${r.prompt.trimEnd()}\n\n${ENTREGA_EM_ARQUIVO}` } };
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
  if (arquivo.size > TAMANHO_MAXIMO_UPLOAD_BYTES) {
    return { ok: false, status: 413, erro: ARQUIVO_GRANDE_DEMAIS, erros: [], totalErros: 0 };
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
      totalErros: erro instanceof ErroBackend ? (erro.totalErros ?? erro.erros.length) : 0,
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

/** Server Action é endpoint público: ao backend vão só os três campos, e só se forem texto (S1-04). */
function soOsCampos(campos: CamposDaLinha): CamposDaLinha | null {
  const { data, valor, descricao } = campos ?? {};
  if (typeof data !== "string" || typeof valor !== "string" || typeof descricao !== "string") return null;
  return { data, valor, descricao };
}

const CAMPOS_INVALIDOS: Falha = { ok: false, status: 422, erro: "Preencha a data, o valor e a descrição." };

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
  const corpo = soOsCampos(campos);
  if (!corpo) return CAMPOS_INVALIDOS;
  try {
    const r = await chamarBackend<{ lancamento: LinhaAPI; resumo: ResumoAPI }>(`/importacoes-ia/${id}/lancamentos/${linhaId}`, {
      method: "PATCH",
      corpo,
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
  const corpo = soOsCampos(campos);
  if (!corpo) return CAMPOS_INVALIDOS;
  try {
    const r = await chamarBackend<{ lancamento: LinhaAPI; resumo: ResumoAPI }>(`/importacoes-ia/${id}/lancamentos`, {
      method: "POST",
      corpo,
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

export type ContextoNovaVersaoIa = { banco: string; sistemaAnterior?: string };

export async function recuperarExtratoConfirmado(id: string): Promise<Resultado<{ extratoId: string }>> {
  const rascunho = await carregarRascunho(id);
  if (rascunho.ok) return { ok: false, status: 409, erro: "Confirme a importação antes de conciliar." };
  if (rascunho.status !== 409) return rascunho;
  const extrato = await situacaoDoExtrato(id);
  if (!extrato.ok) return extrato;
  if (extrato.dados.origem !== "sistema" || extrato.dados.status !== "concluido") {
    return { ok: false, status: 409, erro: "O extrato do sistema ainda não está pronto." };
  }
  return { ok: true, dados: { extratoId: extrato.dados.extrato_id } };
}

export async function concluirNovaVersaoIa(
  contexto: ContextoNovaVersaoIa,
  importacaoId: string,
  retomar = false,
): Promise<{ ok: true; dados: { extratoId: string } } | (Falha & { confirmada?: boolean })> {
  const { banco, sistemaAnterior } = contexto;
  // O backend confirma no mesmo ID do rascunho. Procure o par antes de repetir um POST.
  const alvo = await verificarNovaVersao(banco, sistemaAnterior, importacaoId);
  if (!alvo.ok) return alvo;
  if (alvo.dados.jaConciliada) return { ok: true, dados: { extratoId: importacaoId } };

  let confirmado = retomar ? await recuperarExtratoConfirmado(importacaoId) : await confirmarImportacao(importacaoId);
  if (!retomar && !confirmado.ok && confirmado.status === 409) {
    confirmado = await recuperarExtratoConfirmado(importacaoId);
  }
  if (!confirmado.ok) return confirmado;
  const { extratoId } = confirmado.dados;
  const resultado = await conciliar(banco, extratoId);
  return resultado.ok ? { ok: true, dados: { extratoId } } : { ...resultado, confirmada: true };
}
