import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { aplicarTema, temaAtual, temaDoSistema } from "./tema";

function fingirSistema(escuro: boolean) {
  vi.stubGlobal("matchMedia", (consulta: string) => ({
    matches: consulta.includes("dark") && escuro,
    media: consulta,
  }));
}

describe("tema", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.tema;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("segue o sistema enquanto ninguém escolheu", () => {
    fingirSistema(true);
    expect(temaDoSistema()).toBe("escuro");
    expect(temaAtual()).toBe("escuro");

    fingirSistema(false);
    expect(temaAtual()).toBe("claro");
  });

  it("a escolha salva ganha do sistema", () => {
    fingirSistema(true);
    aplicarTema("claro");
    expect(temaAtual()).toBe("claro");
  });

  it("escreve o atributo que liga o CSS escuro", () => {
    aplicarTema("escuro");
    expect(document.documentElement.dataset.tema).toBe("escuro");
  });

  it("ignora valor estragado no localStorage e volta para o sistema", () => {
    fingirSistema(true);
    window.localStorage.setItem("ledgr_tema", "arco-íris");
    expect(temaAtual()).toBe("escuro");
  });

  it("não quebra quando o localStorage está bloqueado", () => {
    fingirSistema(false);
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("bloqueado");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("bloqueado");
      });

    expect(temaAtual()).toBe("claro");
    expect(() => aplicarTema("escuro")).not.toThrow();
    // sem persistir, mas a sessão atual respeita
    expect(document.documentElement.dataset.tema).toBe("escuro");

    getItem.mockRestore();
    setItem.mockRestore();
  });
});
