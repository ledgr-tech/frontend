"use server";

import { adaptarEmpresaCliente, type EmpresaCliente, type EmpresaClienteAPI } from "@/lib/adaptadores";
import { ErroBackend, chamarBackend, emailDaSessao } from "@/lib/backend";
import { RECUSA_DEMONSTRACAO, ehContaDeDemonstracao } from "@/lib/demo";
import { caracteresCnpj, validarCnpj } from "../../../../(auth)/cadastro/passos";
import type { Falha, Resultado } from "../conciliacoes/acoes";

/**
 * As empresas clientes da conta (backend #133, parte 2; spec 2026-10-22-empresas-na-configuracao): todo
 * mundo vê a lista, admin e gestor cadastram. As rotas são da conta e ignoram a empresa ativa. O backend
 * garante cada regra (403, 409, 402, 429, a Receita no 422); a tela só mostra o que ele responde.
 */

const SESSAO_EXPIRADA = "Sua sessão expirou. Entre de novo para continuar.";

function limiteDeCadastros(segundos: number | undefined): string {
  if (!segundos) return "Muitos cadastros seguidos. Tente de novo mais tarde.";
  const minutos = Math.ceil(segundos / 60);
  return `Muitos cadastros seguidos. Tente de novo em ${minutos} ${minutos === 1 ? "minuto" : "minutos"}.`;
}

/** Os textos que o backend não dá prontos; o resto vai com o `detail` dele, que já explica bem. */
function traduzir(erro: unknown, aoCadastrar = false): Falha {
  if (!(erro instanceof ErroBackend)) {
    return { ok: false, status: 0, erro: "Não foi possível falar com o servidor." };
  }
  const { status } = erro;
  if (status === 401) return { ok: false, status, erro: SESSAO_EXPIRADA };
  if (status === 403) return { ok: false, status, erro: "Seu papel na conta não permite fazer isso." };
  if (aoCadastrar && status === 409) return { ok: false, status, erro: "Esta empresa já está cadastrada na conta." };
  if (aoCadastrar && status === 429) return { ok: false, status, erro: limiteDeCadastros(erro.segundosParaTentar) };
  if (aoCadastrar && status === 422 && erro.mensagens.cnpj) {
    // a recusa de formato vem como "Value error, CNPJ inválido"; a da Receita já vem sem o prefixo
    return { ok: false, status, erro: erro.mensagens.cnpj.replace(/^Value error, /, "") };
  }
  return { ok: false, status, erro: erro.detalhe };
}

/** Da conta de demonstração, um visitante encheria a conta de empresas que não são dele. */
async function recusaNaDemonstracao(): Promise<Falha | null> {
  return ehContaDeDemonstracao(await emailDaSessao()) ? { ok: false, status: 403, erro: RECUSA_DEMONSTRACAO } : null;
}

export async function carregarEmpresas(): Promise<Resultado<EmpresaCliente[]>> {
  try {
    const { itens } = await chamarBackend<{ itens: EmpresaClienteAPI[] }>("/empresas");
    return { ok: true, dados: itens.map(adaptarEmpresaCliente) };
  } catch (erro) {
    return traduzir(erro);
  }
}

/**
 * O CNPJ vai só com letras e números, em maiúsculas (alfanumérico incluso), e a razão social aparada.
 * O backend confere o resto: duplicado na conta, limite do plano, a Receita quando ligada. Server Action
 * é endpoint público: o que o formulário já recusaria também se recusa aqui, sem chamar o backend.
 */
export async function cadastrarEmpresa(cnpj: string, razaoSocial: string): Promise<Resultado<EmpresaCliente>> {
  const razao = razaoSocial.trim();
  if (!razao) return { ok: false, status: 422, erro: "Informe a razão social." };
  const recusaDoCnpj = validarCnpj(cnpj);
  if (recusaDoCnpj) return { ok: false, status: 422, erro: recusaDoCnpj };
  const recusa = await recusaNaDemonstracao();
  if (recusa) return recusa;
  try {
    const criada = await chamarBackend<EmpresaClienteAPI>("/empresas", {
      method: "POST",
      corpo: { cnpj: caracteresCnpj(cnpj), razao_social: razao },
    });
    return { ok: true, dados: adaptarEmpresaCliente(criada) };
  } catch (erro) {
    return traduzir(erro, true);
  }
}
