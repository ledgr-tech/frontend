import { describe, it, expect, beforeEach } from "vitest";
import { BLOQUEIO_MS, CONTA_TESTE, LIMITE_TENTATIVAS, autenticar } from "./auth";

// A sessão em si é do NextAuth (cookie httpOnly) e não tem mais teste aqui: o
// que sobrou neste módulo é a escolha da mensagem de erro e a contagem de
// tentativas erradas, que continuam do lado do navegador.
describe("autenticar (mock)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("aceita a conta de teste, ignorando espaços e maiúsculas no e-mail", () => {
    expect(autenticar("  Financeiro@TelhaCerta.com.br ", CONTA_TESTE.senha)).toEqual({ ok: true });
  });

  it("distingue e-mail desconhecido de senha errada", () => {
    expect(autenticar("outra@empresa.com.br", CONTA_TESTE.senha)).toEqual({
      ok: false,
      erro: "conta_nao_encontrada",
    });
    expect(autenticar(CONTA_TESTE.email, "errada")).toEqual({
      ok: false,
      erro: "senha_incorreta",
    });
  });

  it("bloqueia depois de senhas erradas demais, mesmo com a senha certa, até o prazo passar", () => {
    const agora = 1_000_000;
    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      expect(autenticar(CONTA_TESTE.email, "errada", { agora })).toEqual({
        ok: false,
        erro: "senha_incorreta",
      });
    }
    expect(autenticar(CONTA_TESTE.email, "errada", { agora })).toEqual({
      ok: false,
      erro: "muitas_tentativas",
    });
    expect(autenticar(CONTA_TESTE.email, CONTA_TESTE.senha, { agora: agora + 1000 })).toEqual({
      ok: false,
      erro: "muitas_tentativas",
    });

    expect(
      autenticar(CONTA_TESTE.email, CONTA_TESTE.senha, { agora: agora + BLOQUEIO_MS + 1 }),
    ).toEqual({ ok: true });
  });

  it("zera a contagem depois de uma entrada bem-sucedida", () => {
    const agora = 1_000_000;
    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      autenticar(CONTA_TESTE.email, "errada", { agora });
    }
    expect(autenticar(CONTA_TESTE.email, CONTA_TESTE.senha, { agora }).ok).toBe(true);

    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      expect(autenticar(CONTA_TESTE.email, "errada", { agora })).toEqual({
        ok: false,
        erro: "senha_incorreta",
      });
    }
  });
});
