"use server";

import { adaptarEmpresaCliente, nomeDaEmpresa, type EmpresaCliente, type EmpresaClienteAPI } from "@/lib/adaptadores";
import { chamarBackend, emailDaSessao, ErroBackend, ehContaInativa } from "@/lib/backend";
import { ehContaDeDemonstracao, RECUSA_DEMONSTRACAO } from "@/lib/demo";
import { podeFecharMes, recusaPorPapel } from "@/lib/papel";
import { ehUuid } from "@/lib/rotas";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { contaDaSessao } from "../../../../(auth)/acoes";
import type { Falha, Resultado } from "../conciliacoes/acoes";

type EmpresaRemovidaAPI = {
  id: string;
  razao_social: string;
  nome_exibicao: string | null;
  cnpj: string;
  removida_em: string;
  removida_por_nome: string;
  apagar_em: string;
};

export type EmpresaRemovida = {
  id: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  removidaEm: string;
  removidaPor: string;
  apagarEm: string;
};

function adaptar(api: EmpresaRemovidaAPI): EmpresaRemovida {
  return {
    id: api.id,
    nome: nomeDaEmpresa(api.razao_social, api.nome_exibicao).nome,
    razaoSocial: api.razao_social,
    cnpj: api.cnpj,
    removidaEm: api.removida_em,
    removidaPor: api.removida_por_nome,
    apagarEm: api.apagar_em,
  };
}

async function recusa(): Promise<Falha | null> {
  const porPapel = recusaPorPapel(await contaDaSessao(), podeFecharMes, "Só o admin e o gestor removem e restauram empresas.");
  if (porPapel) return porPapel;
  return ehContaDeDemonstracao(await emailDaSessao())
    ? { ok: false, status: 403, erro: RECUSA_DEMONSTRACAO }
    : null;
}

function traduzir(erro: unknown): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: SEM_SERVIDOR };
  if (erro.status === 401) return { ok: false, status: 401, erro: "Sua sessão expirou. Entre de novo para continuar." };
  if (erro.status === 403 && !ehContaInativa(erro)) {
    return { ok: false, status: 403, erro: "Só o admin e o gestor removem e restauram empresas." };
  }
  if (erro.status === 429) {
    const minutos = erro.segundosParaTentar && Math.ceil(erro.segundosParaTentar / 60);
    return { ok: false, status: 429, erro: minutos
      ? `Muitas tentativas. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`
      : "Muitas tentativas. Tente de novo mais tarde." };
  }
  if (erro.status === 404 && erro.detalhe === "Not Found") {
    return { ok: false, status: 404, erro: "Remover e restaurar empresas ainda não está disponível." };
  }
  // Inclui as recusas empresa_principal, ultima_empresa e limite do plano: o backend explica a causa.
  return { ok: false, status: erro.status, erro: erro.detalhe };
}

/** Rotas da conta: o backend ignora a empresa da URL e confere a propriedade e o papel. */
export async function carregarEmpresasRemovidas(): Promise<Resultado<EmpresaRemovida[]>> {
  const negada = await recusa();
  if (negada) return negada;
  try {
    const resposta = await chamarBackend<{ itens: EmpresaRemovidaAPI[] }>("/empresas/removidas");
    return { ok: true, dados: resposta.itens.map(adaptar) };
  } catch (erro) {
    return traduzir(erro);
  }
}

export async function removerEmpresa(id: string): Promise<Resultado<EmpresaRemovida>> {
  if (typeof id !== "string" || !ehUuid(id)) return { ok: false, status: 422, erro: "Empresa inválida." };
  const negada = await recusa();
  if (negada) return negada;
  try {
    const removida = await chamarBackend<EmpresaRemovidaAPI>(`/empresas/${id}`, { method: "DELETE" });
    return { ok: true, dados: adaptar(removida) };
  } catch (erro) {
    return traduzir(erro);
  }
}

export async function restaurarEmpresa(id: string): Promise<Resultado<EmpresaCliente>> {
  if (typeof id !== "string" || !ehUuid(id)) return { ok: false, status: 422, erro: "Empresa inválida." };
  const negada = await recusa();
  if (negada) return negada;
  try {
    const restaurada = await chamarBackend<EmpresaClienteAPI>(`/empresas/${id}/restaurar`, { method: "POST" });
    return { ok: true, dados: adaptarEmpresaCliente(restaurada) };
  } catch (erro) {
    return traduzir(erro);
  }
}
