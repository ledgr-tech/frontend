"use server";

import { cookies } from "next/headers";
import { signIn, signOut } from "@/auth";
import { conferirConta, contaDeTeste } from "@/lib/conta-teste";
import { demoAberta } from "@/lib/demo";

/**
 * Abrir e fechar sessão. Vive numa Server Action porque o cookie do NextAuth é
 * httpOnly: o JavaScript do navegador não escreve nem lê esse cookie — é a
 * propriedade que a decisão da Sprint 2 pediu pro token nunca ficar exposto.
 *
 * É também aqui que a senha é conferida: a conta de teste só existe no
 * servidor, e o formulário recebe de volta só qual campo errou.
 */

const COOKIES_SESSAO = ["__Secure-authjs.session-token", "authjs.session-token"];

export type ErroEntrada = "conta_nao_encontrada" | "senha_incorreta" | "falha_sessao";

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

async function abrirSessao(email: string, senha: string, manterSessao: boolean): Promise<boolean> {
  try {
    await signIn("credentials", { email, senha, redirect: false });
  } catch {
    return false;
  }
  if (!manterSessao) await tornarCookieDeSessao();
  return true;
}

export async function entrar(
  email: string,
  senha: string,
  manterSessao: boolean,
): Promise<ResultadoEntrada> {
  const conta = contaDeTeste();
  // produção sem conta configurada: não é erro de quem digitou, é ambiente
  if (!conta) return { ok: false, erro: "falha_sessao" };

  const conferencia = conferirConta(conta, email, senha);
  if (conferencia !== "ok") return { ok: false, erro: conferencia };

  return (await abrirSessao(email, senha, manterSessao))
    ? { ok: true }
    : { ok: false, erro: "falha_sessao" };
}

/**
 * O atalho do botão do Google e do fim do cadastro. Esconder o botão não basta —
 * uma Server Action pode ser chamada direto —, então a recusa é aqui.
 */
export async function entrarNaDemonstracao(manterSessao: boolean): Promise<boolean> {
  const conta = contaDeTeste();
  if (!demoAberta() || !conta) return false;
  return abrirSessao(conta.email, conta.senha, manterSessao);
}

export async function sair(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
