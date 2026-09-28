"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CredentialsSignin } from "next-auth";
import { auth, signIn, signOut } from "@/auth";
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

export type ResultadoRecuperacao =
  | { ok: true }
  | { ok: false; erro: "indisponivel" | "muitas_tentativas" | "falha" };

/**
 * "Esqueci a senha" (`POST /senha/recuperar`, #66). O backend responde igual
 * para e-mail com e sem conta, de propósito: a tela também não distingue. O
 * 503 é o envio de e-mail desligado no servidor, igual para qualquer e-mail.
 */
export async function pedirRecuperacaoSenha(email: string): Promise<ResultadoRecuperacao> {
  try {
    await chamarBackend("/senha/recuperar", {
      method: "POST",
      corpo: { email: email.trim().toLowerCase() },
      publica: true,
    });
  } catch (erro) {
    if (erro instanceof ErroBackend && erro.status === 503) return { ok: false, erro: "indisponivel" };
    if (erro instanceof ErroBackend && erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    return { ok: false, erro: "falha" };
  }
  return { ok: true };
}

export type ResultadoRedefinicao =
  | { ok: true }
  | { ok: false; erro: "link_invalido" | "senha_invalida" | "muitas_tentativas" | "falha" };

/**
 * A senha nova a partir do link do e-mail (`POST /senha/redefinir`, #66). Não
 * abre sessão: quem redefiniu entra pelo login, com a senha que acabou de criar.
 * O 400 junta link expirado, já usado e inexistente — o backend não diz qual.
 */
export async function redefinirSenha(token: string, senhaNova: string): Promise<ResultadoRedefinicao> {
  try {
    await chamarBackend("/senha/redefinir", {
      method: "POST",
      corpo: { token, senha_nova: senhaNova },
      publica: true,
    });
  } catch (erro) {
    if (!(erro instanceof ErroBackend)) return { ok: false, erro: "falha" };
    if (erro.status === 422 && erro.campos.includes("senha_nova")) return { ok: false, erro: "senha_invalida" };
    if (erro.status === 400 || erro.status === 422) return { ok: false, erro: "link_invalido" };
    if (erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    return { ok: false, erro: "falha" };
  }
  return { ok: true };
}

export async function sair(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

/**
 * A razão social da empresa logada, para o cabeçalho e o menu. Vem de
 * `GET /me`, que o `/login` não cobre: ele devolve só o usuário.
 *
 * ponytail: `GET /me` ainda não existe no backend (proposta em
 * `integracao-backend-sprint5.md`). Até existir, o 404 vira nome vazio e as telas
 * escondem a empresa — melhor que mostrar o nome de outra.
 */
export async function razaoSocialDaEmpresa(): Promise<string> {
  try {
    const eu = await chamarBackend<UsuarioAPI & { razao_social?: string }>("/me");
    return eu.razao_social?.trim() ?? "";
  } catch {
    return "";
  }
}

export type ResultadoConta = { ok: true } | { ok: false; erro: string };

const FALHA_CONTA = "Não foi possível salvar agora. Tente de novo em instantes.";

/**
 * Trocar senha, trocar e-mail e excluir a conta: as rotas `/me/*` das issues
 * #66 e #68 do backend. O 404 é a rota que ainda não subiu.
 */
function mensagemDaConta(erro: unknown): string {
  if (!(erro instanceof ErroBackend)) return FALHA_CONTA;
  if (erro.status === 404 || erro.status === 405) {
    return "Ainda não disponível: o servidor do Ledgr ainda não tem esta função.";
  }
  // "Senha atual incorreta." (400) e "E-mail já cadastrado." ou conta do Google
  // (409): o texto do backend é o contrato da #66, feito para a tela.
  if (erro.status === 400 || erro.status === 409) return erro.detalhe;
  if (erro.status === 422 && erro.campos.includes("email_novo")) return "Confira o novo e-mail.";
  if (erro.status === 422 && erro.campos.includes("senha_nova")) {
    return "A senha nova precisa ter de 8 a 72 caracteres.";
  }
  if (erro.status === 429) return "Muitas tentativas. Espere um minuto e tente de novo.";
  return FALHA_CONTA;
}

/**
 * A chamada à conta de quem está logado. A conta de demonstração é de todo
 * mundo que clica em "Entrar com Google": trocar a senha dela ou apagá-la
 * tiraria a demonstração do ar, então a recusa é aqui, não só na tela.
 */
async function naConta(
  chamada: () => Promise<unknown>,
): Promise<{ ok: true; email: string } | { ok: false; erro: string }> {
  const email = (await auth())?.user?.email;
  if (!email) redirect("/login");
  const demonstracao = process.env.LEDGR_CONTA_TESTE_EMAIL?.trim().toLowerCase();
  if (demonstracao && email.toLowerCase() === demonstracao) {
    return { ok: false, erro: "A conta de demonstração não pode ser alterada." };
  }
  try {
    await chamada();
    return { ok: true, email };
  } catch (erro) {
    // aqui 401 é sessão que acabou: senha atual errada volta 400 (#66)
    if (erro instanceof ErroBackend && erro.status === 401) redirect("/login");
    return { ok: false, erro: mensagemDaConta(erro) };
  }
}

// Depois de trocar, a sessão é refeita com o que a pessoa acabou de digitar
// (#66): o token leva o e-mail, e quando a #75 revogar os tokens antigos, o
// atual deixaria de valer. ponytail: refeita sem "manter sessão", porque o
// servidor não sabe o que a pessoa escolheu no login; errar para o lado que
// termina com o navegador é o que não deixa sessão aberta sem ela querer.

export async function trocarSenha(senhaAtual: string, senhaNova: string): Promise<ResultadoConta> {
  const conta = await naConta(() =>
    chamarBackend("/me/senha", {
      method: "POST",
      corpo: { senha_atual: senhaAtual, senha_nova: senhaNova },
    }),
  );
  if (!conta.ok) return conta;
  await entrar(conta.email, senhaNova, false);
  return { ok: true };
}

export async function trocarEmail(emailNovo: string, senhaAtual: string): Promise<ResultadoConta> {
  const email = emailNovo.trim().toLowerCase();
  const conta = await naConta(() =>
    chamarBackend("/me/email", {
      method: "POST",
      corpo: { email_novo: email, senha_atual: senhaAtual },
    }),
  );
  if (!conta.ok) return conta;
  await entrar(email, senhaAtual, false);
  return { ok: true };
}

/** Pede a senha também: com um token roubado, sem ela, dava para apagar a empresa. */
export async function excluirConta(senhaAtual: string): Promise<ResultadoConta> {
  const conta = await naConta(() =>
    chamarBackend("/me", { method: "DELETE", corpo: { senha_atual: senhaAtual } }),
  );
  if (!conta.ok) return conta;
  await signOut({ redirectTo: "/" });
  return { ok: true };
}
