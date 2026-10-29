"use server";

import { pareceUuid } from "@/lib/adaptadores";
import { ErroBackend, chamarBackend, emailDaSessao } from "@/lib/backend";
import { RECUSA_DEMONSTRACAO, ehContaDeDemonstracao } from "@/lib/demo";
import { podeFecharMes } from "@/lib/papel";
import { contaDaSessao } from "../../../../(auth)/acoes";
import type { Falha, Resultado } from "../conciliacoes/acoes";

/**
 * O link público do relatório do fechamento (backend #165/PR #175, front #229): o escritório gera o
 * link de um mês fechado e o cliente abre no navegador, sem conta. Atrás de `LINK_PUBLICO_HABILITADO`
 * no backend: desligada, criar dá 404 e a tela esconde a ação. O token só aparece na criação.
 */

export type LinkDoRelatorio = {
  id: string;
  prefixo: string;
  criadoPor: string;
  criadoEm: string;
  expiraEm: string;
  ultimoAcessoEm: string | null;
  acessos: number;
  /** Vale agora: não revogado, não vencido e o mês continua fechado. */
  ativo: boolean;
};

type LinkAPI = {
  id: string;
  prefixo: string;
  criado_por: string;
  criado_em: string;
  expira_em: string;
  ultimo_acesso_em: string | null;
  acessos: number;
  ativo: boolean;
};

const SO_ADMIN_OU_GESTOR = "Só o admin ou o gestor criam e revogam o link do relatório.";
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;

function adaptar(link: LinkAPI): LinkDoRelatorio {
  return {
    id: link.id,
    prefixo: link.prefixo,
    criadoPor: link.criado_por,
    criadoEm: link.criado_em,
    expiraEm: link.expira_em,
    ultimoAcessoEm: link.ultimo_acesso_em,
    acessos: link.acessos,
    ativo: link.ativo,
  };
}

function traduzir(erro: unknown): Falha {
  if (!(erro instanceof ErroBackend)) return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
  const { status } = erro;
  if (status === 401) return { ok: false, status, erro: "Sua sessão expirou. Entre de novo para continuar." };
  if (status === 403) return { ok: false, status, erro: SO_ADMIN_OU_GESTOR };
  if (status === 429) return { ok: false, status, erro: "Muitas tentativas seguidas. Espere um minuto e tente de novo." };
  // 404 (sem fechamento ativo, ou a flag desligada) e 409 (5 ativos) chegam com o texto do backend
  return { ok: false, status, erro: erro.detalhe };
}

/** O analista nem chega ao backend; a demonstração não cria link: ele abriria uma conta que todo visitante usa. */
async function recusa(altera: boolean): Promise<Falha | null> {
  const { papel } = await contaDaSessao();
  if (!podeFecharMes(papel)) return { ok: false, status: 403, erro: SO_ADMIN_OU_GESTOR };
  if (altera && ehContaDeDemonstracao(await emailDaSessao())) return { ok: false, status: 403, erro: RECUSA_DEMONSTRACAO };
  return null;
}

/** Os links de todos os fechamentos da competência, ativos e revogados. Um 404 é um backend antes do #175. */
export async function listarLinksDoRelatorio(competencia: string): Promise<Resultado<LinkDoRelatorio[]>> {
  if (!COMPETENCIA.test(competencia)) return { ok: false, status: 404, erro: "Mês não encontrado." };
  const recusada = await recusa(false);
  if (recusada) return recusada;
  try {
    const lista = await chamarBackend<{ itens: LinkAPI[] }>(`/fechamentos/${competencia}/links`);
    return { ok: true, dados: lista.itens.map(adaptar) };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Cria o link e devolve o endereço completo, que só aparece aqui (o token vai no fragmento: não chega aos logs). */
export async function criarLinkDoRelatorio(
  competencia: string,
  validadeDias: number,
  origem: string,
): Promise<Resultado<{ link: LinkDoRelatorio; endereco: string }>> {
  if (!COMPETENCIA.test(competencia)) return { ok: false, status: 404, erro: "Mês não encontrado." };
  if (!Number.isInteger(validadeDias) || validadeDias < 1 || validadeDias > 90) {
    return { ok: false, status: 422, erro: "A validade vai de 1 a 90 dias." };
  }
  const recusada = await recusa(true);
  if (recusada) return recusada;
  try {
    const criado = await chamarBackend<LinkAPI & { token: string }>(`/fechamentos/${competencia}/links`, {
      method: "POST",
      corpo: { validade_dias: validadeDias },
    });
    // a origem é a do navegador (window.location.origin); só o fragmento é segredo
    return { ok: true, dados: { link: adaptar(criado), endereco: `${origem.replace(/\/+$/, "")}/relatorio#${criado.token}` } };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Revoga na hora; revogar de novo não muda nada (204). Passa mesmo com a conta inativa. */
export async function revogarLinkDoRelatorio(competencia: string, id: string): Promise<Resultado<null>> {
  if (!COMPETENCIA.test(competencia) || !pareceUuid(id)) return { ok: false, status: 404, erro: "Link não encontrado." };
  const recusada = await recusa(true);
  if (recusada) return recusada;
  try {
    await chamarBackend<null>(`/fechamentos/${competencia}/links/${id}`, { method: "DELETE" });
    return { ok: true, dados: null };
  } catch (erro) {
    return traduzir(erro);
  }
}
