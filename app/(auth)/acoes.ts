"use server";

import { cookies } from "next/headers";
import { signIn, signOut } from "@/auth";

/**
 * Abrir e fechar sessão. Vive numa Server Action porque o cookie do NextAuth é
 * httpOnly: o JavaScript do navegador não escreve nem lê esse cookie — é a
 * propriedade que a decisão da Sprint 2 pediu pro token nunca ficar exposto.
 */

const COOKIES_SESSAO = ["__Secure-authjs.session-token", "authjs.session-token"];

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
): Promise<boolean> {
  try {
    await signIn("credentials", { email, senha, redirect: false });
  } catch {
    return false;
  }
  if (!manterSessao) await tornarCookieDeSessao();
  return true;
}

export async function sair(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
