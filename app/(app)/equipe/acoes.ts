"use server";

import {
  adaptarConvite,
  adaptarPessoa,
  type Convite,
  type ConviteAPI,
  type Pessoa,
  type PessoaAPI,
} from "@/lib/adaptadores";
import { ErroBackend, chamarBackend, emailDaSessao } from "@/lib/backend";
import { RECUSA_DEMONSTRACAO, ehContaDeDemonstracao } from "@/lib/demo";
import type { Falha, Resultado } from "../conciliacoes/acoes";

/**
 * A equipe da empresa (backend #69, ADR-015): um papel só, o administrador, que
 * é quem cadastrou a empresa. Ele convida, cancela convite e remove pessoas;
 * todo mundo vê a lista. O backend garante cada regra (403, 409); a tela só
 * esconde o que seria recusado.
 */

/** `convites` é null para quem não é administrador: a rota responderia 403. */
export type Equipe = { pessoas: Pessoa[]; convites: Convite[] | null };

const SESSAO_EXPIRADA = "Sua sessão expirou. Entre de novo para continuar.";

function limiteDeConvites(segundos: number | undefined): string {
  if (!segundos) return "Limite de convites por hora atingido. Tente de novo mais tarde.";
  const minutos = Math.ceil(segundos / 60);
  return `Limite de convites por hora atingido. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`;
}

/** Os textos que o backend não dá prontos; o resto vai com o `detail` dele, que já explica bem. */
function traduzir(erro: unknown, aoConvidar = false): Falha {
  if (!(erro instanceof ErroBackend)) {
    return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
  }
  const { status } = erro;
  if (status === 401) return { ok: false, status, erro: SESSAO_EXPIRADA };
  if (status === 403) return { ok: false, status, erro: "Só o administrador pode fazer isso." };
  if (aoConvidar && status === 409) return { ok: false, status, erro: "Este e-mail já tem conta no Ledgr." };
  if (aoConvidar && status === 429) return { ok: false, status, erro: limiteDeConvites(erro.segundosParaTentar) };
  if (aoConvidar && status === 503) {
    return { ok: false, status, erro: "O envio de convites está indisponível no momento." };
  }
  return { ok: false, status, erro: erro.detalhe };
}

/** Da conta de demonstração, um visitante mandaria convite do Ledgr para qualquer endereço ou tiraria gente da empresa. */
async function recusaNaDemonstracao(): Promise<Falha | null> {
  return ehContaDeDemonstracao(await emailDaSessao()) ? { ok: false, status: 403, erro: RECUSA_DEMONSTRACAO } : null;
}

export async function carregarEquipe(administrador: boolean): Promise<Resultado<Equipe>> {
  try {
    const [pessoas, convites] = await Promise.all([
      chamarBackend<{ itens: PessoaAPI[] }>("/empresa/usuarios"),
      administrador ? chamarBackend<{ itens: ConviteAPI[] }>("/empresa/convites") : null,
    ]);
    return {
      ok: true,
      dados: {
        pessoas: pessoas.itens.map(adaptarPessoa),
        convites: convites ? convites.itens.map(adaptarConvite) : null,
      },
    };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** O e-mail vai aparado; o backend normaliza o resto (maiúsculas) e cancela um convite pendente para o mesmo e-mail. */
export async function convidar(email: string): Promise<Resultado<Convite>> {
  const recusa = await recusaNaDemonstracao();
  if (recusa) return recusa;
  try {
    const convite = await chamarBackend<ConviteAPI>("/empresa/convites", {
      method: "POST",
      corpo: { email: email.trim() },
    });
    return { ok: true, dados: adaptarConvite(convite) };
  } catch (erro) {
    return traduzir(erro, true);
  }
}

export async function cancelarConvite(id: string): Promise<Resultado<null>> {
  const recusa = await recusaNaDemonstracao();
  if (recusa) return recusa;
  try {
    await chamarBackend(`/empresa/convites/${encodeURIComponent(id)}`, { method: "DELETE" });
    return { ok: true, dados: null };
  } catch (erro) {
    return traduzir(erro);
  }
}

/** Corta o acesso na hora (o backend encerra as sessões); as decisões dela continuam no histórico. */
export async function removerPessoa(id: string): Promise<Resultado<null>> {
  const recusa = await recusaNaDemonstracao();
  if (recusa) return recusa;
  try {
    await chamarBackend(`/empresa/usuarios/${encodeURIComponent(id)}`, { method: "DELETE" });
    return { ok: true, dados: null };
  } catch (erro) {
    return traduzir(erro);
  }
}
