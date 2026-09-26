"use server";

import { cookies } from "next/headers";
import { CredentialsSignin } from "next-auth";
import { signIn, signOut } from "@/auth";
import { ErroBackend, chamarBackend } from "@/lib/backend";
import { demoAberta } from "@/lib/demo";
import { MuitasEntradas, type UsuarioAPI } from "@/lib/login";

/**
 * Abrir e fechar sessão, e criar conta. Vive numa Server Action porque o
 * cookie do NextAuth é httpOnly: o JavaScript do navegador não escreve nem lê
 * esse cookie — é a propriedade que a decisão da Sprint 2 pediu pro token
 * nunca ficar exposto.
 *
 * Quem confere a senha é o backend (`POST /login`), dentro do `authorize` do
 * NextAuth (`lib/login.ts`); daqui sai só o motivo da recusa.
 */

const COOKIES_SESSAO = ["__Secure-authjs.session-token", "authjs.session-token"];

export type ErroEntrada = "credenciais_invalidas" | "muitas_tentativas" | "falha_sessao";

export type ResultadoEntrada = { ok: true } | { ok: false; erro: ErroEntrada };

/**
 * Sem "manter sessão ativa", o cookie perde o Max-Age e morre com o navegador.
 *
 * O NextAuth grava sempre com Max-Age de 7 dias e não aceita decidir isso por
 * login, então o jeito é reescrever o cookie depois — mesmo valor, sem
 * expiração. O token em si continua valendo 7 dias; o que muda é até quando o
 * navegador guarda.
 */
async function tornarCookieDeSessao(): Promise<void> {
  const pote = await cookies();
  for (const nome of COOKIES_SESSAO) {
    const atual = pote.get(nome);
    if (!atual) continue;
    pote.set(nome, atual.value, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: nome.startsWith("__Secure-"),
    });
  }
}

export async function entrar(
  email: string,
  senha: string,
  manterSessao: boolean,
): Promise<ResultadoEntrada> {
  try {
    await signIn("credentials", { email, senha, redirect: false });
  } catch (erro) {
    // O `authorize` só recusa com `CredentialsSignin`: 429 é `MuitasEntradas`,
    // 401 é o próprio. O resto — backend fora do ar, NEXTAUTH_SECRET faltando —
    // não é culpa de quem digitou.
    if (erro instanceof MuitasEntradas) return { ok: false, erro: "muitas_tentativas" };
    if (erro instanceof CredentialsSignin) return { ok: false, erro: "credenciais_invalidas" };
    return { ok: false, erro: "falha_sessao" };
  }
  if (!manterSessao) await tornarCookieDeSessao();
  return { ok: true };
}

/**
 * O atalho do botão do Google: entra na conta de demonstração, que é uma conta
 * de verdade no backend, com e-mail e senha só no ambiente do servidor.
 * Esconder o botão não basta — uma Server Action pode ser chamada direto —,
 * então a recusa é aqui.
 */
export async function entrarNaDemonstracao(manterSessao: boolean): Promise<boolean> {
  const email = process.env.LEDGR_CONTA_TESTE_EMAIL?.trim();
  const senha = process.env.LEDGR_CONTA_TESTE_SENHA;
  if (!demoAberta() || !email || !senha) return false;
  return (await entrar(email, senha, manterSessao)).ok;
}

/** Os campos do formulário que o `POST /register` recebe. */
export type DadosCadastro = {
  nome: string;
  email: string;
  senha: string;
  razaoSocial: string;
  cnpj: string;
};

export type CampoCadastroAPI = keyof DadosCadastro;

export type ResultadoCadastro =
  /** `entrou: false` é conta criada com a sessão que não abriu: falta só entrar. */
  | { ok: true; entrou: boolean }
  | { ok: false; erro: "email_cadastrado" | "cnpj_cadastrado" | "muitas_tentativas" | "falha" }
  /** O backend recusou o formato: são os campos a corrigir, com o nome do formulário. */
  | { ok: false; erro: "invalido"; campos: CampoCadastroAPI[] };

const CAMPO_DO_FORMULARIO: Record<string, CampoCadastroAPI> = {
  nome: "nome",
  email: "email",
  senha: "senha",
  razao_social: "razaoSocial",
  cnpj: "cnpj",
};

/**
 * Cria empresa e usuário numa chamada só (`POST /register`) e já entra com a
 * mesma senha. Banco, conta e sistema de gestão, que o formulário também pede,
 * o backend ainda não guarda — ficam no navegador.
 */
export async function cadastrar(dados: DadosCadastro): Promise<ResultadoCadastro> {
  try {
    await chamarBackend<UsuarioAPI>("/register", {
      method: "POST",
      corpo: {
        nome: dados.nome,
        email: dados.email,
        senha: dados.senha,
        razao_social: dados.razaoSocial,
        cnpj: dados.cnpj,
      },
      publica: true,
    });
  } catch (erro) {
    if (!(erro instanceof ErroBackend)) return { ok: false, erro: "falha" };
    if (erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    if (erro.status === 422 && erro.campos.length > 0) {
      const campos = erro.campos.map((campo) => CAMPO_DO_FORMULARIO[campo]).filter(Boolean);
      if (campos.length > 0) return { ok: false, erro: "invalido", campos };
    }
    // As duas mensagens de 409 são o contrato: "E-mail já cadastrado." e "CNPJ
    // já cadastrado.". Uma terceira, "E-mail ou CNPJ já cadastrado.", só sai
    // de dois cadastros simultâneos — tentar de novo traz a exata.
    if (erro.status === 409 && erro.detalhe.startsWith("E-mail já")) {
      return { ok: false, erro: "email_cadastrado" };
    }
    if (erro.status === 409 && erro.detalhe.startsWith("CNPJ já")) {
      return { ok: false, erro: "cnpj_cadastrado" };
    }
    return { ok: false, erro: "falha" };
  }
  const sessao = await entrar(dados.email, dados.senha, true);
  return { ok: true, entrou: sessao.ok };
}

export async function sair(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
