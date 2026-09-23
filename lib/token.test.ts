// @vitest-environment node
//
// jose confere o tipo da chave contra o Uint8Array global; no jsdom o global é
// outro e a mesma chave é recusada. Este módulo só roda no servidor de qualquer
// forma, então o ambiente certo pra testar é o node.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { decodeJwt, decodeProtectedHeader, SignJWT } from "jose";
import { DURACAO_SESSAO_SEGUNDOS, assinarToken, lerToken } from "./token";

const SEGREDO = "segredo-de-teste-compartilhado-com-o-backend";

const CLAIMS = {
  usuarioId: "9f4b1a2c-3d5e-4f60-8a71-2b3c4d5e6f70",
  email: "financeiro@telhacerta.com.br",
  empresaId: "1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9",
};

describe("token do backend", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = SEGREDO;
  });

  afterEach(() => {
    delete process.env.NEXTAUTH_SECRET;
  });

  it("assina em HS256, que é o que o PyJWT do backend espera", async () => {
    const token = await assinarToken(CLAIMS);
    expect(decodeProtectedHeader(token).alg).toBe("HS256");
  });

  it("leva os quatro claims do contrato, com empresa_id em snake_case", async () => {
    const payload = decodeJwt(await assinarToken(CLAIMS));
    // é o único claim que o backend lê para resolver o tenant — sem ele, 401
    expect(payload.empresa_id).toBe(CLAIMS.empresaId);
    expect(payload.sub).toBe(CLAIMS.usuarioId);
    expect(payload.email).toBe(CLAIMS.email);
    expect(payload.iat).toBeTypeOf("number");
    expect(payload.exp).toBeTypeOf("number");
  });

  it("vale 7 dias, e não os 30 que o NextAuth usaria por padrão", async () => {
    const payload = decodeJwt(await assinarToken(CLAIMS));
    expect(payload.exp! - payload.iat!).toBe(DURACAO_SESSAO_SEGUNDOS);
  });

  it("volta a ler o que assinou", async () => {
    expect(await lerToken(await assinarToken(CLAIMS))).toEqual(CLAIMS);
  });

  it("recusa token assinado com outro segredo", async () => {
    const token = await assinarToken(CLAIMS);
    process.env.NEXTAUTH_SECRET = "outro-segredo-qualquer-com-tamanho-ok";
    // é exatamente o que acontece se o valor divergir entre a Vercel e o Railway
    expect(await lerToken(token)).toBeNull();
  });

  it("recusa token vencido em vez de estourar", async () => {
    const vencido = await new SignJWT({ empresa_id: CLAIMS.empresaId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(CLAIMS.usuarioId)
      .setExpirationTime("-1s")
      .sign(new TextEncoder().encode(SEGREDO));
    expect(await lerToken(vencido)).toBeNull();
  });

  it("não assina com segredo ausente", async () => {
    delete process.env.NEXTAUTH_SECRET;
    // silêncio aqui significaria assinar com chave vazia, que qualquer um forja
    await expect(assinarToken(CLAIMS)).rejects.toThrow("NEXTAUTH_SECRET");
  });
});
