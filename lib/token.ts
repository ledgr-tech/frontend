import { SignJWT, jwtVerify } from "jose";

/**
 * O contrato do JWT com o backend, num lugar só.
 *
 * Fechado em `02-decisoes/05-contrato-jwt-empresa-id, versão 3 (ADR-019)`: HS256, assinado com
 * `NEXTAUTH_SECRET`, claims `sub` / `conta_id` / `email` / `iat` / `exp` e,
 * desde a revogação de sessão (backend #75, ADR-016), `auth_time`. O backend
 * (`app/core/auth.py`) decodifica com PyJWT, exige `exp` e `auth_time` e resolve
 * a conta pelo `conta_id` (aceita o `empresa_id` legado, igual; os dois com valores diferentes é 401) — token sem esses claims é 401.
 *
 * Isto existe separado do `auth.ts` porque é a parte que precisa de teste: se
 * um claim sair errado, nada no app funciona e o sintoma é um 401 sem pista.
 */

/** ADR-003: 7 dias. O default do NextAuth é 30. */
export const DURACAO_SESSAO_SEGUNDOS = 60 * 60 * 24 * 7;

export const ALGORITMO = "HS256";

export type ClaimsSessao = {
  usuarioId: string;
  email: string;
  contaId: string;
  /**
   * O momento do login, em segundos desde a época, no relógio do backend: vem
   * da resposta do `POST /login` e nunca do `Date.now()` daqui (com dois
   * relógios, o login logo depois de trocar a senha nasceria revogado). Gravado
   * no login e mantido nas renovações, porque a sessão vale 7 dias a partir
   * dele, e não do último `iat`. Ausente com backend antigo: sem valor, sem claim.
   */
  authTime?: number;
};

function segredo(): Uint8Array {
  const valor = process.env.NEXTAUTH_SECRET;
  // Mesmo tratamento do backend (`exigir_nextauth_secret`): segredo vazio
  // assinaria token com chave conhecida, então nunca pode passar em silêncio.
  if (!valor?.trim()) {
    throw new Error("NEXTAUTH_SECRET não configurado: autenticação indisponível.");
  }
  return new TextEncoder().encode(valor);
}

export async function assinarToken(claims: ClaimsSessao): Promise<string> {
  return new SignJWT({
    conta_id: claims.contaId,
    email: claims.email,
    ...(claims.authTime !== undefined && { auth_time: claims.authTime }),
  })
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(claims.usuarioId)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_SEGUNDOS}s`)
    .sign(segredo());
}

/**
 * Devolve null em token inválido ou vencido — é sessão ausente, não erro. Exige `sub` e `exp`,
 * como o backend, e o limite absoluto de 7 dias contado do `auth_time` (o `exp` anda a cada
 * renovação; o login, não).
 */
export async function lerToken(token: string): Promise<ClaimsSessao | null> {
  try {
    const { payload } = await jwtVerify(token, segredo(), { algorithms: [ALGORITMO], requiredClaims: ["sub", "exp"] });
    const authTime = payload.auth_time;
    if (Number.isInteger(authTime) && Date.now() / 1000 - (authTime as number) > DURACAO_SESSAO_SEGUNDOS) return null;
    return {
      usuarioId: String(payload.sub ?? ""),
      email: typeof payload.email === "string" ? payload.email : "",
      contaId: String(payload.conta_id ?? payload.empresa_id ?? ""),
      ...(Number.isInteger(payload.auth_time) && { authTime: payload.auth_time as number }),
    };
  } catch {
    return null;
  }
}
