import { describe, expect, it } from "vitest";
import { ehErroGoogle, identidadeDoIdToken } from "./google";

/** Um id_token com o corpo dado; a assinatura não importa aqui, quem confere é o backend. */
function idToken(claims: object): string {
  const corpo = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `eyJhbGciOiJSUzI1NiJ9.${corpo}.assinatura`;
}

describe("identidadeDoIdToken", () => {
  it("lê o e-mail e o nome, com acento, do corpo do token", () => {
    expect(identidadeDoIdToken(idToken({ email: "joao@gmail.com", name: "João Conceição" }))).toEqual({
      email: "joao@gmail.com",
      nome: "João Conceição",
    });
  });

  it("sem nome no Google, o nome fica vazio para a pessoa preencher", () => {
    expect(identidadeDoIdToken(idToken({ email: "joao@gmail.com" }))).toEqual({ email: "joao@gmail.com", nome: "" });
  });

  it("devolve null sem e-mail ou com um token que não se lê", () => {
    expect(identidadeDoIdToken(idToken({ name: "João" }))).toBeNull();
    expect(identidadeDoIdToken("nao-e-um-token")).toBeNull();
    expect(identidadeDoIdToken("a.%%%.b")).toBeNull();
  });
});

describe("ehErroGoogle", () => {
  it("aceita só os motivos conhecidos, que vêm da URL", () => {
    expect(ehErroGoogle("email_com_senha")).toBe(true);
    expect(ehErroGoogle("toString")).toBe(false);
    expect(ehErroGoogle(null)).toBe(false);
  });
});
