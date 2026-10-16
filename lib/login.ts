import "server-only";
import { cookies } from "next/headers";
import { CredentialsSignin, type User } from "next-auth";
import { ErroBackend, chamarBackend } from "./backend";
import { COOKIE_CADASTRO_GOOGLE, COOKIE_CONVITE_GOOGLE, type ErroConviteGoogle, VALIDADE_ID_TOKEN_SEGUNDOS, type ErroGoogle } from "./google";

/**
 * A conferência da senha, que é do backend (`POST /login`, issue #57 dele).
 * Ele devolve só quem é o usuário, sem token: quem emite o JWT continua sendo o
 * NextAuth (ADR-003), com o `empresa_id` que vem daqui.
 *
 * Separado do `auth.ts` pelo mesmo motivo do `lib/token.ts`: é a parte que
 * precisa de teste, e o `auth.ts` não se importa sem subir o NextAuth inteiro.
 */

/**
 * O corpo que `POST /login` e `POST /register` devolvem. `auth_time` só vem do
 * `/login`, e só do backend com a revogação de sessão (#75).
 */
export type UsuarioAPI = { id: string; empresa_id: string; nome: string; email: string; auth_time?: number };

/** O usuário do NextAuth a partir da resposta do backend: o `id` e o `empresa_id` são sempre os dele. */
function usuarioDaSessao(usuario: UsuarioAPI): User {
  return {
    id: usuario.id,
    email: usuario.email,
    name: usuario.nome,
    empresaId: usuario.empresa_id,
    ...(Number.isInteger(usuario.auth_time) && { authTime: usuario.auth_time }),
  };
}

/**
 * O 429 do backend. Tem que ser um `CredentialsSignin` pra chegar inteiro na
 * Server Action (qualquer outro erro o NextAuth embrulha), e o `code` é o que
 * separa "espere um minuto" de "senha errada".
 */
export class MuitasEntradas extends CredentialsSignin {
  code = "limite";
}

/**
 * O `authorize` do NextAuth. `null` é credencial errada: o backend responde o
 * mesmo 401 pra e-mail sem conta e pra senha errada, de propósito, pra não
 * contar quais e-mails existem. Backend fora do ar sobe como erro.
 */
export async function autorizar(email: string, senha: string) {
  try {
    const usuario = await chamarBackend<UsuarioAPI>("/login", {
      method: "POST",
      corpo: { email, senha },
      publica: true,
    });
    return usuarioDaSessao(usuario);
  } catch (erro) {
    if (erro instanceof ErroBackend && erro.status === 401) return null;
    if (erro instanceof ErroBackend && erro.status === 429) throw new MuitasEntradas();
    throw erro;
  }
}

export type ResultadoLoginGoogle = { ok: true; usuario: User } | { ok: false; erro: ErroGoogle | "sem_conta" };

/**
 * `POST /login/google` (backend #73) com o `id_token` do Google. O backend acha
 * o usuário pelo `sub` do Google e devolve o mesmo corpo do `/login`: o `sub`
 * do Google nunca vira o `id` da sessão.
 */
export async function entrarNoBackendComGoogle(idToken: string): Promise<ResultadoLoginGoogle> {
  try {
    const usuario = await chamarBackend<UsuarioAPI>("/login/google", {
      method: "POST",
      corpo: { id_token: idToken },
      publica: true,
    });
    return { ok: true, usuario: usuarioDaSessao(usuario) };
  } catch (erro) {
    if (!(erro instanceof ErroBackend)) return { ok: false, erro: "falha" };
    if (erro.status === 404) return { ok: false, erro: "sem_conta" };
    if (erro.status === 409) return { ok: false, erro: "email_com_senha" };
    if (erro.status === 401) return { ok: false, erro: "nao_confirmado" };
    if (erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    if (erro.status === 503) return { ok: false, erro: "indisponivel" };
    return { ok: false, erro: "falha" };
  }
}

export type ResultadoConviteGoogle = { ok: true; usuario: User } | { ok: false; erro: ErroConviteGoogle };

/**
 * `POST /convites/aceitar/google` (backend #69/#73): cria a conta pelo convite com a
 * identidade do Google e já responde como o login. O e-mail do Google tem de ser o do
 * convite; o 409 desse caso só se distingue dos outros pelo texto.
 */
export async function aceitarConviteNoBackendComGoogle(token: string, idToken: string): Promise<ResultadoConviteGoogle> {
  try {
    const usuario = await chamarBackend<UsuarioAPI>("/convites/aceitar/google", {
      method: "POST",
      corpo: { token, id_token: idToken },
      publica: true,
    });
    return { ok: true, usuario: usuarioDaSessao(usuario) };
  } catch (erro) {
    if (!(erro instanceof ErroBackend)) return { ok: false, erro: "falha" };
    if (erro.status === 400) return { ok: false, erro: "convite_invalido" };
    if (erro.status === 409) {
      return { ok: false, erro: erro.detalhe.includes("diferente") ? "email_diferente" : "email_cadastrado" };
    }
    if (erro.status === 429) return { ok: false, erro: "muitas_tentativas" };
    return { ok: false, erro: "falha" };
  }
}

/**
 * Na volta do Google com o cookie do convite: aceita o convite. Nas recusas em que tentar de
 * novo pode dar certo (outra conta Google, limite, falha), o cookie fica, para a página mostrar
 * o convite de novo (o fragmento do link se perdeu na ida ao Google).
 */
async function aceitarConviteNaVolta(usuario: User, token: string, idToken: string | undefined): Promise<true | string> {
  if (!idToken) return "/aceitar-convite?google=falha";
  const resultado = await aceitarConviteNoBackendComGoogle(token, idToken);
  const pote = await cookies();
  if (resultado.ok) {
    pote.delete(COOKIE_CONVITE_GOOGLE);
    Object.assign(usuario, resultado.usuario);
    return true;
  }
  // convite que não vale mais, ou e-mail que já tem conta: tentar de novo não adianta
  if (resultado.erro === "convite_invalido" || resultado.erro === "email_cadastrado") pote.delete(COOKIE_CONVITE_GOOGLE);
  return `/aceitar-convite?google=${resultado.erro}`;
}

/**
 * O callback `signIn` do NextAuth na volta do Google. Com conta, o usuário do
 * backend toma o lugar do perfil do Google no mesmo objeto, que o NextAuth
 * passa adiante para o callback `jwt`. Sem conta, o `id_token` espera no
 * cookie e a pessoa vai terminar o cadastro. O resto volta ao login com o
 * motivo, nunca para a página de erro do NextAuth.
 */
export async function aoVoltarDoGoogle(usuario: User, idToken: string | undefined): Promise<true | string> {
  const convite = (await cookies()).get(COOKIE_CONVITE_GOOGLE)?.value;
  if (convite) return aceitarConviteNaVolta(usuario, convite, idToken);
  if (!idToken) return "/login?google=falha";
  const resultado = await entrarNoBackendComGoogle(idToken);
  if (resultado.ok) {
    Object.assign(usuario, resultado.usuario);
    return true;
  }
  if (resultado.erro !== "sem_conta") return `/login?google=${resultado.erro}`;
  (await cookies()).set(COOKIE_CADASTRO_GOOGLE, idToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: VALIDADE_ID_TOKEN_SEGUNDOS,
  });
  return "/cadastro/google";
}

/**
 * O `authorize` da sessão logo depois do `/register/google`, que já é o login
 * mas não abre a sessão do NextAuth: entra pelo `/login/google` com o mesmo
 * `id_token`, lido do cookie httpOnly, nunca do navegador. Sem cookie ou sem
 * conta, `null`.
 */
export async function autorizarDepoisDoCadastroGoogle(): Promise<User | null> {
  const pote = await cookies();
  const idToken = pote.get(COOKIE_CADASTRO_GOOGLE)?.value;
  if (!idToken) return null;
  const resultado = await entrarNoBackendComGoogle(idToken);
  if (!resultado.ok) return null;
  pote.delete(COOKIE_CADASTRO_GOOGLE);
  return resultado.usuario;
}
