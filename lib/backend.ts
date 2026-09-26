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
    /** Num 422 do FastAPI, os campos do corpo que não passaram na validação. */
    readonly campos: string[] = [],
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

async function erroDaResposta(resposta: Response): Promise<ErroBackend> {
  try {
    const corpo = await resposta.json();
    // FastAPI manda `{detail: "..."}`; num 422 de validação, `detail` é uma
    // lista de objetos, que não serve pra mostrar na tela — dela sai só quais
    // campos do corpo falharam (`loc: ["body", "<campo>"]`).
    if (typeof corpo?.detail === "string") return new ErroBackend(resposta.status, corpo.detail);
    if (Array.isArray(corpo?.detail)) {
      const campos = corpo.detail
        .filter((item: { loc?: unknown[] }) => item?.loc?.[0] === "body")
        .map((item: { loc: unknown[] }) => String(item.loc[1]));
      return new ErroBackend(resposta.status, `O servidor respondeu ${resposta.status}.`, campos);
    }
  } catch {
    // resposta sem corpo JSON (502 do proxy, timeout do Railway)
  }
  return new ErroBackend(resposta.status, `O servidor respondeu ${resposta.status}.`);
}

type Opcoes = RequestInit & {
  corpo?: FormData | object;
  /** Sem Bearer: só o `/login` e o `/register`, que é onde a sessão nasce. */
  publica?: boolean;
};

/** A requisição com o Bearer da sessão; erro do backend vira `ErroBackend`. */
async function requisitar(caminho: string, init: Opcoes = {}): Promise<Response> {
  const { corpo, publica, ...resto } = init;
  const cabecalhos = new Headers(resto.headers);
  if (!publica) {
    const token = await tokenDaSessao();
    if (!token) throw new ErroBackend(401, "Sessão expirada.");
    cabecalhos.set("Authorization", `Bearer ${token}`);
  }

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

  if (!resposta.ok) throw await erroDaResposta(resposta);
  return resposta;
}

export async function chamarBackend<T>(caminho: string, init: Opcoes = {}): Promise<T> {
  const resposta = await requisitar(caminho, init);
  if (resposta.status === 204) return undefined as T;
  return (await resposta.json()) as T;
}

/**
 * Para arquivo (o CSV da conciliação): a resposta vem crua, para quem chama
 * repassar os bytes. Ler como texto descartaria o BOM do UTF-8, e sem ele o
 * Excel abre os acentos quebrados.
 */
export async function baixarDoBackend(caminho: string): Promise<Response> {
  return requisitar(caminho);
}
