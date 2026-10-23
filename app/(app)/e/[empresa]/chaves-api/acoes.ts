"use server";

import { pareceUuid } from "@/lib/adaptadores";
import { ErroBackend, chamarBackend, emailDaSessao } from "@/lib/backend";
import { RECUSA_DEMONSTRACAO, ehContaDeDemonstracao } from "@/lib/demo";
import { podeFecharMes } from "@/lib/papel";
import { contaDaSessao } from "../../../../(auth)/acoes";
import type { Falha, Resultado } from "../conciliacoes/acoes";

/**
 * As chaves da API pública (backend #135, front #194): só de leitura, criadas e revogadas pelo admin
 * e pelo gestor; cada uma vale para uma empresa ou para todas da conta. Rotas da conta: ignoram a
 * empresa ativa. O token aparece só na resposta da criação; o backend guarda o hash.
 */

export type ChaveApi = {
  id: string;
  nome: string;
  /** O começo do token, para reconhecer a chave sem mostrar o resto. */
  prefixo: string;
  /** null quando a chave enxerga todas as empresas da conta. */
  empresa: { id: string; razaoSocial: string } | null;
  criadaPor: string | null;
  criadoEm: string;
  ultimoUsoEm: string | null;
  revogadaEm: string | null;
};

type ChaveApiAPI = {
  id: string;
  nome: string;
  prefixo: string;
  escopo: { tipo: "conta" } | { tipo: "empresa"; empresa_id: string; razao_social: string };
  criada_por: string | null;
  criado_em: string;
  ultimo_uso_em: string | null;
  revogada_em: string | null;
};

export type ChavesDaApi = {
  itens: ChaveApi[];
  /** Onde a API atende, para a documentação e para quem integra. */
  endereco: string | null;
};

const SO_ADMIN_OU_GESTOR = "Só o admin ou o gestor da conta criam e revogam chaves da API.";

function adaptar(chave: ChaveApiAPI): ChaveApi {
  return {
    id: chave.id,
    nome: chave.nome,
    prefixo: chave.prefixo,
    empresa:
      chave.escopo.tipo === "empresa" ? { id: chave.escopo.empresa_id, razaoSocial: chave.escopo.razao_social } : null,
    criadaPor: chave.criada_por,
    criadoEm: chave.criado_em,
    ultimoUsoEm: chave.ultimo_uso_em,
    revogadaEm: chave.revogada_em,
  };
}

function traduzir(erro: unknown): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
  const { status } = erro;
  if (status === 401) return { ok: false, status, erro: "Sua sessão expirou. Entre de novo para continuar." };
  if (status === 403) return { ok: false, status, erro: SO_ADMIN_OU_GESTOR };
  if (status === 422) return { ok: false, status, erro: "O nome da chave precisa ter de 1 a 60 caracteres." };
  // 404 (empresa ou chave), 409 (10 ativas) e 402 (plano) chegam com o texto do backend, que já explica
  return { ok: false, status, erro: erro.detalhe };
}

/**
 * O analista nem chega ao backend (que responderia 403). A demonstração lê a lista, mas não cria nem
 * revoga: uma chave dela daria acesso de fora a uma conta que qualquer visitante usa.
 */
async function recusa(altera: boolean): Promise<Falha | null> {
  const { papel } = await contaDaSessao();
  if (!podeFecharMes(papel)) return { ok: false, status: 403, erro: SO_ADMIN_OU_GESTOR };
  if (altera && ehContaDeDemonstracao(await emailDaSessao())) return { ok: false, status: 403, erro: RECUSA_DEMONSTRACAO };
  return null;
}

/** Ativas e revogadas, das mais novas para as mais antigas. Um 404 é um backend antes do #135. */
export async function carregarChavesApi(): Promise<Resultado<ChavesDaApi>> {
  const recusada = await recusa(false);
  if (recusada) return recusada;
  try {
    const lista = await chamarBackend<{ itens: ChaveApiAPI[] }>("/chaves-api");
    // shortcut: o endereço público da API é o mesmo que o servidor do app usa; se um dia o app falar
    // com o backend por rede interna, este passa a ser uma variável própria
    return { ok: true, dados: { itens: lista.itens.map(adaptar), endereco: process.env.LEDGR_API_URL?.replace(/\/+$/, "") || null } };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Cria a chave e devolve o token, que só aparece aqui. Sem `empresaId`, ela vale para todas as empresas. */
export async function criarChaveApi(
  nome: string,
  empresaId: string | null,
): Promise<Resultado<{ chave: ChaveApi; token: string }>> {
  const limpo = typeof nome === "string" ? nome.trim() : "";
  if (limpo.length < 1 || limpo.length > 60) {
    return { ok: false, status: 422, erro: "O nome da chave precisa ter de 1 a 60 caracteres." };
  }
  if (empresaId !== null && !pareceUuid(empresaId)) return { ok: false, status: 404, erro: "Empresa não encontrada." };
  const recusada = await recusa(true);
  if (recusada) return recusada;
  try {
    const criada = await chamarBackend<ChaveApiAPI & { chave: string }>("/chaves-api", {
      method: "POST",
      corpo: { nome: limpo, ...(empresaId && { empresa_id: empresaId }) },
    });
    return { ok: true, dados: { chave: adaptar(criada), token: criada.chave } };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Revoga na hora: a próxima chamada com ela já recebe 401. Revogar de novo não muda nada (204). */
export async function revogarChaveApi(id: string): Promise<Resultado<null>> {
  if (!pareceUuid(id)) return { ok: false, status: 404, erro: "Chave não encontrada." };
  const recusada = await recusa(true);
  if (recusada) return recusada;
  try {
    await chamarBackend<null>(`/chaves-api/${id}`, { method: "DELETE" });
    return { ok: true, dados: null };
  } catch (erro) {
    return traduzir(erro);
  }
}
