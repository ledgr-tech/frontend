"use server";

import {
  adaptarIntegracaoSistema,
  type IntegracaoSistema,
  type IntegracaoSistemaAPI,
} from "@/lib/adaptadores";
import { ErroBackend, chamarBackend, ehContaInativa, emailDaSessao } from "@/lib/backend";
import { RECUSA_DEMONSTRACAO, ehContaDeDemonstracao } from "@/lib/demo";
import { podeFecharMes, recusaPorPapel } from "@/lib/papel";
import { SEM_SERVIDOR } from "@/lib/sem-servidor";
import { contaDaSessao } from "../../../../(auth)/acoes";
import type { Falha, Resultado } from "../conciliacoes/acoes";

/**
 * Configuração da integração com o sistema de gestão da empresa ativa (backend #253, ADR-029).
 * Só admin e gestor configuram ou removem; a empresa ativa vai no `X-Ledgr-Empresa` pelo
 * `chamarBackend`. A chave de acesso entra só no `PUT`, nunca volta na resposta e nunca vai para
 * mensagens de erro nem logs. Na conta de demonstração, nenhuma rota nova é chamada.
 */

export type CampoIntegracao = "url" | "chave";

export type FalhaDaIntegracao = Falha & {
  codigo?: string;
  campo?: CampoIntegracao;
};

export type ResultadoIntegracao<T> = { ok: true; dados: T } | FalhaDaIntegracao;

const SO_ADMIN_OU_GESTOR = "Só o admin ou o gestor do escritório configuram a integração com o sistema.";
const INTEGRACAO_DESLIGADA = "A integração com o sistema não está disponível no momento.";
const LIMITE_URL = 2048;

function limparPydantic(mensagem: string): string {
  return mensagem.replace(/^Value error,\s*/i, "").trim();
}

function escaparRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Nunca devolve ao cliente a chave que acabou de ser enviada, mesmo que o backend a ecoe num erro. */
function ocultarChave(mensagem: string, chave?: string, campo?: CampoIntegracao): string {
  if (!chave) return mensagem;
  if (chave.length >= 4 && mensagem.includes(chave)) {
    return mensagem.split(chave).join("•••");
  }
  const isolada = new RegExp(`(?<![A-Za-z0-9])${escaparRegex(chave)}(?![A-Za-z0-9])`, "g");
  if (isolada.test(mensagem)) {
    return campo === "chave" ? "Confira a chave de acesso informada." : mensagem.replace(isolada, "•••");
  }
  return mensagem;
}

/** Se o prefixo devolvido pelo backend expuser a chave inteira (chave curta), reduz ou omite o prefixo. */
function protegerPrefixo(dados: IntegracaoSistema, chave: string): IntegracaoSistema {
  if (!dados.chavePrefixo) return dados;
  const prefixoLimpo = dados.chavePrefixo.replace(/(?:…|\.\.\.)+$/, "");
  if (prefixoLimpo.includes(chave) || chave === prefixoLimpo) {
    return {
      ...dados,
      chavePrefixo: chave.length >= 6 ? chave.slice(0, Math.min(4, Math.floor(chave.length / 2))) : null,
    };
  }
  return dados;
}

function traduzir(erro: unknown, aoSalvar = false, chave?: string): FalhaDaIntegracao {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: SEM_SERVIDOR };
  const { status, codigo } = erro;
  const seguro = (texto: string, campo?: CampoIntegracao) => ocultarChave(texto, chave, campo);
  // a decisão considera o codigo antes do status: conta_inativa e integracao_indisponivel trazem texto próprio
  if (ehContaInativa(erro)) return { ok: false, status, codigo, erro: seguro(erro.detalhe) };
  if (codigo === "integracao_indisponivel") return { ok: false, status, codigo, erro: seguro(erro.detalhe) };
  if (status === 401) return { ok: false, status, erro: "Sua sessão expirou. Entre de novo para continuar." };
  if (status === 403) return { ok: false, status, erro: SO_ADMIN_OU_GESTOR };
  if (status === 404 && erro.detalhe === "Not Found") return { ok: false, status, erro: INTEGRACAO_DESLIGADA };
  if (status === 429) return { ok: false, status, erro: "Muitas tentativas seguidas. Espere um minuto e tente de novo." };
  if (status === 422) {
    if (erro.mensagens.chave) {
      return { ok: false, status, campo: "chave", erro: seguro(limparPydantic(erro.mensagens.chave), "chave") };
    }
    if (erro.mensagens.url) {
      return { ok: false, status, campo: "url", erro: seguro(limparPydantic(erro.mensagens.url), "url") };
    }
    // 422 do PUT com `detail` em texto (HTTPS obrigatório, endereço não permitido): fica ao lado do campo certo
    const campo: CampoIntegracao | undefined = aoSalvar ? (/chave/i.test(erro.detalhe) ? "chave" : "url") : undefined;
    return { ok: false, status, ...(campo && { campo }), erro: seguro(erro.detalhe, campo) };
  }
  if (status >= 500) return { ok: false, status, erro: SEM_SERVIDOR };
  return { ok: false, status, ...(codigo && { codigo }), erro: seguro(erro.detalhe) };
}

/** Admin e gestor apenas; conta de demonstração nunca chama as rotas da integração. */
async function recusa(): Promise<FalhaDaIntegracao | null> {
  const porPapel = recusaPorPapel(await contaDaSessao(), podeFecharMes, SO_ADMIN_OU_GESTOR);
  if (porPapel) return porPapel;
  if (ehContaDeDemonstracao(await emailDaSessao())) return { ok: false, status: 403, erro: RECUSA_DEMONSTRACAO };
  return null;
}

/** Estado atual da integração na empresa ativa (`GET /empresa/integracao-sistema`). */
export async function carregarIntegracaoSistema(): Promise<ResultadoIntegracao<IntegracaoSistema>> {
  const recusada = await recusa();
  if (recusada) return recusada;
  try {
    const resposta = await chamarBackend<IntegracaoSistemaAPI>("/empresa/integracao-sistema");
    return { ok: true, dados: adaptarIntegracaoSistema(resposta) };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Salva ou substitui URL e chave (`PUT /empresa/integracao-sistema`). Exige os dois campos juntos. */
export async function salvarIntegracaoSistema(
  url: string,
  chave: string,
): Promise<ResultadoIntegracao<IntegracaoSistema>> {
  // Server Action é endpoint público: confere os tipos e campos antes de qualquer chamada
  const urlLimpa = typeof url === "string" ? url.trim() : "";
  const chaveLimpa = typeof chave === "string" ? chave.trim() : "";
  if (!urlLimpa) {
    return { ok: false, status: 422, campo: "url", erro: "Informe a URL do sistema de gestão." };
  }
  if (urlLimpa.length > LIMITE_URL) {
    return { ok: false, status: 422, campo: "url", erro: "A URL do sistema é longa demais." };
  }
  if (!chaveLimpa) {
    return { ok: false, status: 422, campo: "chave", erro: "Informe a chave de acesso do sistema de gestão." };
  }
  const recusada = await recusa();
  if (recusada) return recusada;
  try {
    const resposta = await chamarBackend<IntegracaoSistemaAPI>("/empresa/integracao-sistema", {
      method: "PUT",
      corpo: { url: urlLimpa, chave: chaveLimpa },
    });
    return { ok: true, dados: protegerPrefixo(adaptarIntegracaoSistema(resposta), chaveLimpa) };
  } catch (erro) {
    return traduzir(erro, true, chaveLimpa);
  }
}

/** Remove a integração da empresa ativa (`DELETE /empresa/integracao-sistema`). 404 da configuração conta como já removida. */
export async function removerIntegracaoSistema(): Promise<Resultado<null>> {
  const recusada = await recusa();
  if (recusada) return recusada;
  try {
    await chamarBackend<null>("/empresa/integracao-sistema", { method: "DELETE" });
    return { ok: true, dados: null };
  } catch (erro) {
    // 404 cru ("Not Found") é rota desligada pela flag; qualquer outro 404 é configuração já removida
    if (erro instanceof ErroBackend && erro.status === 404 && erro.detalhe !== "Not Found") {
      return { ok: true, dados: null };
    }
    return traduzir(erro);
  }
}
