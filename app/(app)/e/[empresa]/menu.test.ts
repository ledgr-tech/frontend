import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { alternarMenu, menuRecolhido } from "./menu";

describe("menu", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset.menu;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("começa aberto enquanto ninguém recolheu", () => {
    expect(menuRecolhido()).toBe(false);
  });

  it("recolhe e abre, escrevendo o atributo que o CSS lê", () => {
    expect(alternarMenu()).toBe(true);
    expect(document.documentElement.dataset.menu).toBe("recolhido");
    expect(menuRecolhido()).toBe(true);

    expect(alternarMenu()).toBe(false);
    expect(document.documentElement.dataset.menu).toBe("aberto");
    expect(menuRecolhido()).toBe(false);
  });

  it("lembra a escolha para a próxima visita", () => {
    alternarMenu();
    expect(window.localStorage.getItem("ledgr_menu")).toBe("recolhido");
  });

  it("parte do que o script do <head> já aplicou", () => {
    // quem recolheu na visita anterior abre a página já com o atributo escrito
    document.documentElement.dataset.menu = "recolhido";
    expect(menuRecolhido()).toBe(true);
    expect(alternarMenu()).toBe(false);
  });

  it("continua alternando quando o localStorage está bloqueado", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });

    expect(alternarMenu()).toBe(true);
    expect(alternarMenu()).toBe(false);
  });
});
