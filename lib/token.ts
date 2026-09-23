import { SignJWT, jwtVerify } from "jose";

/**
 * O contrato do JWT com o backend, num lugar só.
 *
 * Fechado em `02-decisoes/05-contrato-jwt-empresa-id`: HS256, assinado com
 * `NEXTAUTH_SECRET`, claims `sub` / `empresa_id` / `email` / `iat` / `exp`. O
 * backend (`app/core/auth.py`) decodifica com PyJWT, exige `exp` e lê só
 * `empresa_id` — token sem esse claim, ou com valor que não é UUID, é 401.
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
  empresaId: string;
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
  return new SignJWT({ empresa_id: claims.empresaId, email: claims.email })
    .setProtectedHeader({ alg: ALGORITMO })
    .setSubject(claims.usuarioId)
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_SEGUNDOS}s`)
    .sign(segredo());
}

/** Devolve null em token inválido ou vencido — é sessão ausente, não erro. */
export async function lerToken(token: string): Promise<ClaimsSessao | null> {
  try {
    const { payload } = await jwtVerify(token, segredo(), { algorithms: [ALGORITMO] });
    return {
      usuarioId: String(payload.sub ?? ""),
      email: typeof payload.email === "string" ? payload.email : "",
      empresaId: String(payload.empresa_id ?? ""),
    };
  } catch {
    return null;
  }
}
