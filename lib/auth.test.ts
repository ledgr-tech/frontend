import { describe, it, expect, beforeEach } from "vitest";
import { BLOQUEIO_MS, CONTA_TESTE, LIMITE_TENTATIVAS, autenticar, getSession, login, logout } from "./auth";

describe("auth mock", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps the session only for this tab when the person does not want to stay signed in", () => {
    login("financeiro@telhacerta.com.br", { manterSessao: false });
    expect(window.localStorage.getItem("ledgr_session")).toBeNull();
    expect(getSession()).toEqual({ email: "financeiro@telhacerta.com.br" });

    logout();
    expect(getSession()).toBeNull();
  });

  it("stores a remembered session across tabs and drops any tab-only one", () => {
    login("outra@empresa.com.br", { manterSessao: false });
    login("financeiro@telhacerta.com.br");
    expect(window.sessionStorage.getItem("ledgr_session")).toBeNull();
    expect(getSession()).toEqual({ email: "financeiro@telhacerta.com.br" });
  });

  it("returns null when no session exists", () => {
    expect(getSession()).toBeNull();
  });

  it("stores a session on login and returns it from getSession", () => {
    login("financeiro@telhacerta.com.br");
    expect(getSession()).toEqual({ email: "financeiro@telhacerta.com.br" });
  });

  it("clears the session on logout", () => {
    login("financeiro@telhacerta.com.br");
    logout();
    expect(getSession()).toBeNull();
  });

  it("returns null when localStorage contains malformed JSON", () => {
    window.localStorage.setItem("ledgr_session", "not valid json {]");
    expect(getSession()).toBeNull();
  });
});

describe("autenticar (mock)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("signs in the test account, trimming and ignoring the e-mail case", () => {
    const resultado = autenticar("  Financeiro@TelhaCerta.com.br ", CONTA_TESTE.senha);
    expect(resultado).toEqual({ ok: true, sessao: { email: CONTA_TESTE.email } });
    expect(getSession()).toEqual({ email: CONTA_TESTE.email });
  });

  it("reports an unknown e-mail without creating a session", () => {
    expect(autenticar("outra@empresa.com.br", CONTA_TESTE.senha)).toEqual({ ok: false, erro: "conta_nao_encontrada" });
    expect(getSession()).toBeNull();
  });

  it("reports a wrong password without creating a session", () => {
    expect(autenticar(CONTA_TESTE.email, "errada")).toEqual({ ok: false, erro: "senha_incorreta" });
    expect(getSession()).toBeNull();
  });

  it("blocks after too many wrong passwords, even with the right one, until the lock expires", () => {
    const agora = 1_000_000;
    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      expect(autenticar(CONTA_TESTE.email, "errada", { agora })).toEqual({ ok: false, erro: "senha_incorreta" });
    }
    expect(autenticar(CONTA_TESTE.email, "errada", { agora })).toEqual({ ok: false, erro: "muitas_tentativas" });
    expect(autenticar(CONTA_TESTE.email, CONTA_TESTE.senha, { agora: agora + 1000 })).toEqual({ ok: false, erro: "muitas_tentativas" });
    expect(getSession()).toBeNull();

    expect(autenticar(CONTA_TESTE.email, CONTA_TESTE.senha, { agora: agora + BLOQUEIO_MS + 1 })).toEqual({
      ok: true,
      sessao: { email: CONTA_TESTE.email },
    });
  });

  it("resets the wrong-password count after a successful sign-in", () => {
    const agora = 1_000_000;
    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) autenticar(CONTA_TESTE.email, "errada", { agora });
    expect(autenticar(CONTA_TESTE.email, CONTA_TESTE.senha, { agora }).ok).toBe(true);

    for (let tentativa = 1; tentativa < LIMITE_TENTATIVAS; tentativa++) {
      expect(autenticar(CONTA_TESTE.email, "errada", { agora })).toEqual({ ok: false, erro: "senha_incorreta" });
    }
  });
});
