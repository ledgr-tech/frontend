import { cookies } from "next/headers";

/**
 * Único ponto de contato com o backend (FastAPI). Roda **só no servidor**:
 * quem chama são Server Actions e Server Components, nunca o navegador.
 *
 * O motivo é o token. O JWT vive num cookie httpOnly e, pela decisão de
 * arquitetura da Sprint 2, não pode ser exposto ao JavaScript do client — então
 * a chamada com `Authorization: Bearer` acontece deste lado e o navegador só vê
 * o resultado. (A decisão original falava em "rota proxy"; Server Action entrega
 * a mesma propriedade com menos peça móvel, e sem abrir um caminho genérico
 * pro backend.)
 */

const URL_BASE = process.env.LEDGR_API_URL ?? "http://localhost:8000";

/** Nomes de cookie do NextAuth v5 — o prefixo `__Secure-` aparece sob https. */
const COOKIES_SESSAO = ["__Secure-authjs.session-token", "authjs.session-token"];

export class ErroBackend extends Error {
  constructor(
    readonly status: number,
    readonly detalhe: string,
  ) {
    super(detalhe);
    this.name = "ErroBackend";
  }
}

/**
 * O valor do cookie já **é** o JWT que o backend espera: `auth.ts` troca o
 * encode do NextAuth pra HS256. Sem essa troca precisaria decodificar o JWE e
 * reassinar aqui.
 */
async function tokenDaSessao(): Promise<string | null> {
  const pote = await cookies();
  for (const nome of COOKIES_SESSAO) {
    const valor = pote.get(nome)?.value;
    if (valor) return valor;
  }
  return null;
}

async function detalheDoErro(resposta: Response): Promise<string> {
  try {
    const corpo = await resposta.json();
    // FastAPI manda `{detail: "..."}`; num 422 de validação, `detail` é uma
    // lista de objetos, que não serve pra mostrar na tela.
    if (typeof corpo?.detail === "string") return corpo.detail;
  } catch {
    // resposta sem corpo JSON (502 do proxy, timeout do Railway)
  }
  return `O servidor respondeu ${resposta.status}.`;
}

export async function chamarBackend<T>(
  caminho: string,
  init: RequestInit & { corpo?: FormData | object } = {},
): Promise<T> {
  const token = await tokenDaSessao();
  if (!token) throw new ErroBackend(401, "Sessão expirada.");

  const { corpo, ...resto } = init;
  const cabecalhos = new Headers(resto.headers);
  cabecalhos.set("Authorization", `Bearer ${token}`);

  let body: BodyInit | undefined;
  if (corpo instanceof FormData) {
    // sem Content-Type de propósito: o fetch precisa gerar o boundary do multipart
    body = corpo;
  } else if (corpo !== undefined) {
    cabecalhos.set("Content-Type", "application/json");
    body = JSON.stringify(corpo);
  }

  const resposta = await fetch(`${URL_BASE}${caminho}`, {
    ...resto,
    headers: cabecalhos,
    body,
    cache: "no-store",
  });

  if (!resposta.ok) throw new ErroBackend(resposta.status, await detalheDoErro(resposta));
  if (resposta.status === 204) return undefined as T;
  return (await resposta.json()) as T;
}
